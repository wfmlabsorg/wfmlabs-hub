import { getPool } from '@/lib/db'
import { regionCentroid } from '@/lib/regionCentroids'

/**
 * ROC Globe geo-feed — combined signal + open-incident feed for the Cesium globe.
 *
 * Same raw-SQL / same-origin pattern as /api/incidents and /api/roc-signals.
 *
 * SIGNALS: recent signals (default last 240 min = the client's 4h fade window;
 * the client requests mins=270 for a ~30m tail buffer so the fade edge always
 * has data — hub-023) that
 * resolve to coordinates via a three-tier lookup:
 *   Tier 1 — precise metadata->>'lat' / metadata->>'lon' when present & numeric
 *            (EONET / weather feeds, ~75% of recent signals). geo_source='precise'.
 *   Tier 2 — EXACT, case-insensitive match of signals.region_name against
 *            geo_density.region_name (no fuzzy/substring matching — that is the
 *            bug being fixed in agents-017). region_name is unique
 *            case-insensitively in geo_density, so this never fans out.
 *            geo_source='centroid'.
 *   Tier 3 — APPROXIMATE region/country-centroid fallback (hub-018), applied in
 *            JS after the query for any row Tier 1+2 missed. Resolves the bare
 *            place name in region_name ("London", "Campania", "Italy", "US
 *            Midwest") to an approximate centroid via src/lib/regionCentroids.
 *            geo_source='approximate'. Recovered ~half the previously-dropped set
 *            (live: 44 dropped → ~8 dropped). The client renders these with an
 *            explicit "≈ approximate" treatment so they never read as precise.
 * Only signals with NO logical geography ("Global"/empty/unmappable) are now
 * dropped — reported via meta.signals_no_geo.
 *
 * PROMOTION: a LATERAL join flags any signal whose id is in an OPEN incident's
 * related_signal_ids (status NOT IN ('closed','resolved')). Promoted signals
 * carry promoted=true + incident_id / incident_slug / sev_level so the globe can
 * render them AS the incident (and not double-plot / not fade them out).
 *
 * INCIDENTS: also returns open incidents that have coordinates, for convenience.
 * (The globe currently keeps its own /api/incidents fetch for the full set
 * incl. closed; this key is provided for completeness.)
 *
 * GET /api/roc-globe?mins=240  (public, read-only)
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  // Window in minutes; default 240 (= the client's 4h fade window, hub-023).
  // Clamp 30..360 so the client's mins=270 tail-buffer request is honored.
  const mins = Math.min(Math.max(parseInt(url.searchParams.get('mins') || '240', 10) || 240, 30), 360)

  try {
    const pool = getPool()

    const signalsResult = await pool.query(
      `WITH sig AS (
         SELECT s.id,
                s.category::text AS category,
                s.severity,
                s.severity_label,
                s.title,
                s.message,
                s.region_name,
                s.created_at,
                CASE WHEN (s.metadata->>'lat') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                       AND (s.metadata->>'lon') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                     THEN (s.metadata->>'lat')::double precision
                     ELSE gd.lat END AS lat,
                CASE WHEN (s.metadata->>'lat') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                       AND (s.metadata->>'lon') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                     THEN (s.metadata->>'lon')::double precision
                     ELSE gd.lon END AS lon,
                -- Whether the coords above came from precise per-signal metadata
                -- or fell back to the region centroid in geo_density. Centroid
                -- coords are imprecise and identical for every signal in a region
                -- (e.g. all 'US' cyber signals land on the US centroid), so the
                -- client scatters them deterministically — see jitter below.
                CASE WHEN (s.metadata->>'lat') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                       AND (s.metadata->>'lon') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                     THEN 'precise'
                     ELSE 'centroid' END AS geo_source
           FROM signals s
           LEFT JOIN geo_density gd ON lower(gd.region_name) = lower(s.region_name)
          WHERE s.created_at > now() - make_interval(mins => $1)
       )
       SELECT sig.id, sig.category, sig.severity, sig.severity_label, sig.title,
              sig.message, sig.region_name, sig.created_at, sig.lat, sig.lon, sig.geo_source,
              (inc.id IS NOT NULL) AS promoted,
              inc.id   AS incident_id,
              inc.slug AS incident_slug,
              inc.sev_level
         FROM sig
         LEFT JOIN LATERAL (
           SELECT i.id, i.slug, i.sev_level
             FROM incidents i
            WHERE i.status NOT IN ('closed', 'resolved')
              AND sig.id = ANY(i.related_signal_ids)
            ORDER BY i.created_at DESC
            LIMIT 1
         ) inc ON true
        ORDER BY sig.created_at DESC`,
      [mins],
    )

    // Coverage: total in-window signals (resolved + unresolved). We no longer
    // drop unresolved rows in SQL — Tier 3 (below) tries an approximate centroid
    // before anything is excluded.
    const total = signalsResult.rowCount ?? 0

    // ── Tier 3: approximate region/country-centroid fallback (hub-018) ──────
    // Tier 1+2 leave lat/lon NULL for any signal whose place name isn't a precise
    // coord and isn't an exact geo_density metro. Resolve the bare region_name to
    // an approximate centroid (world cities, sub-national regions, all countries,
    // OVIX US macro-regions — see src/lib/regionCentroids). Rows that resolve are
    // tagged geo_source='approximate'; rows with no logical geography ("Global",
    // empty, unmappable) stay coordless and are counted as signals_no_geo.
    const resolvedRows: typeof signalsResult.rows = []
    let signalsNoGeo = 0
    for (const s of signalsResult.rows) {
      if (s.lat != null && s.lon != null) {
        resolvedRows.push(s)
        continue
      }
      const c = regionCentroid(s.region_name)
      if (c) {
        resolvedRows.push({ ...s, lat: c.lat, lon: c.lon, geo_source: 'approximate' })
      } else {
        signalsNoGeo++
      }
    }
    const resolved = resolvedRows.length

    // Scatter signals that share an identical coordinate so they don't stack
    // on one pixel. Coarse region/country-centroid coords collapse many events
    // onto one point — whether the centroid came from the geo_density fallback
    // (geo_source='centroid') OR was baked into the scout's metadata as a
    // country center (geo_source='precise'). Examples seen live: every 'US'
    // cyber signal at the US centroid (39.8,-98.5), and Polish weather all at
    // the country center (51.9,19.1). We detect by collision on the final
    // coordinate, so both paths are covered. Each colliding signal is offset by
    // a deterministic, id-seeded uniform-disk amount: stable across refreshes
    // (no jumping) and independent per signal (adding/removing one never moves
    // the others). Signals with a unique coordinate are left exactly as-is.
    const SPREAD_DEG = 2.5 // ~275km radius; keeps national signals within-region
    const fract = (x: number) => x - Math.floor(x)
    const coordKey = (s: { lat: number; lon: number }) =>
      `${Number(s.lat).toFixed(3)},${Number(s.lon).toFixed(3)}`
    const coordCounts = new Map<string, number>()
    for (const s of resolvedRows) {
      const k = coordKey(s)
      coordCounts.set(k, (coordCounts.get(k) ?? 0) + 1)
    }
    const signals = resolvedRows.map((s) => {
      if ((coordCounts.get(coordKey(s)) ?? 0) < 2) return s // unique point — leave it
      const id = Number(s.id)
      // sqrt(rand) radius → uniform fill of the disk (not bunched at center)
      const radius = Math.sqrt(fract(Math.sin(id * 12.9898) * 43758.5453)) * SPREAD_DEG
      const angle = fract(Math.sin(id * 78.233) * 43758.5453) * 2 * Math.PI
      // widen E-W by 1/cos(lat) so the scatter reads circular, not squashed
      const lonScale = Math.min(1 / Math.max(Math.cos((s.lat * Math.PI) / 180), 0.2), 3)
      return {
        ...s,
        lat: s.lat + radius * Math.sin(angle),
        lon: s.lon + radius * Math.cos(angle) * lonScale,
      }
    })

    const incidentsResult = await pool.query(
      `SELECT id, title, slug, domain, sev_level, status,
              impact_summary, description,
              location_lat, location_lon, related_signal_ids, created_at
         FROM incidents
        WHERE status NOT IN ('closed', 'resolved')
          AND location_lat IS NOT NULL AND location_lon IS NOT NULL`,
    )

    return Response.json(
      {
        signals,
        incidents: incidentsResult.rows,
        meta: {
          window_minutes: mins,
          signals_total: total,
          signals_resolved: resolved,
          // Genuinely place-less signals (no logical geography) — the only ones
          // we still drop after the Tier 3 approximate fallback (hub-018).
          signals_no_geo: signalsNoGeo,
          // Back-compat alias (was: anything not plotted).
          signals_unresolved: signalsNoGeo,
          // Resolution tier breakdown for observability.
          signals_precise: signals.filter((s) => s.geo_source === 'precise').length,
          signals_centroid: signals.filter((s) => s.geo_source === 'centroid').length,
          signals_approximate: signals.filter((s) => s.geo_source === 'approximate').length,
          incidents_open: incidentsResult.rowCount ?? 0,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    console.error('roc-globe query error:', e)
    return Response.json({ error: 'Failed to query globe feed' }, { status: 500 })
  }
}
