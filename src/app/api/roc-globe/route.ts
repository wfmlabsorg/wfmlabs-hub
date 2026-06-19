import { getPool } from '@/lib/db'

/**
 * ROC Globe geo-feed — combined signal + open-incident feed for the Cesium globe.
 *
 * Same raw-SQL / same-origin pattern as /api/incidents and /api/roc-signals.
 *
 * SIGNALS: recent signals (default last 150 min — a small buffer past the
 * client's 2h fade window so the globe can animate the fading tail) that
 * resolve to coordinates via a two-tier lookup:
 *   Tier 1 — precise metadata->>'lat' / metadata->>'lon' when present & numeric
 *            (EONET / weather feeds, ~75% of recent signals).
 *   Tier 2 — EXACT, case-insensitive match of signals.region_name against
 *            geo_density.region_name (no fuzzy/substring matching — that is the
 *            bug being fixed in agents-017). region_name is unique
 *            case-insensitively in geo_density, so this never fans out.
 * Signals that resolve to neither tier are dropped (reported via meta.unresolved).
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
 * GET /api/roc-globe?mins=150  (public, read-only)
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  // Window in minutes; default 150 (2h fade + 30m tail buffer). Clamp 30..360.
  const mins = Math.min(Math.max(parseInt(url.searchParams.get('mins') || '150', 10) || 150, 30), 360)

  try {
    const pool = getPool()

    const signalsResult = await pool.query(
      `WITH sig AS (
         SELECT s.id,
                s.category::text AS category,
                s.severity,
                s.severity_label,
                s.title,
                s.region_name,
                s.created_at,
                CASE WHEN (s.metadata->>'lat') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                       AND (s.metadata->>'lon') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                     THEN (s.metadata->>'lat')::double precision
                     ELSE gd.lat END AS lat,
                CASE WHEN (s.metadata->>'lat') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                       AND (s.metadata->>'lon') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                     THEN (s.metadata->>'lon')::double precision
                     ELSE gd.lon END AS lon
           FROM signals s
           LEFT JOIN geo_density gd ON lower(gd.region_name) = lower(s.region_name)
          WHERE s.created_at > now() - make_interval(mins => $1)
       )
       SELECT sig.id, sig.category, sig.severity, sig.severity_label, sig.title,
              sig.region_name, sig.created_at, sig.lat, sig.lon,
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
        WHERE sig.lat IS NOT NULL AND sig.lon IS NOT NULL
        ORDER BY sig.created_at DESC`,
      [mins],
    )

    // Coverage: how many in-window signals could not be resolved to coords.
    const totalResult = await pool.query(
      `SELECT count(*)::int AS total
         FROM signals
        WHERE created_at > now() - make_interval(mins => $1)`,
      [mins],
    )
    const total = totalResult.rows[0]?.total ?? 0
    const resolved = signalsResult.rowCount ?? 0

    const incidentsResult = await pool.query(
      `SELECT id, title, slug, domain, sev_level, status,
              location_lat, location_lon, related_signal_ids, created_at
         FROM incidents
        WHERE status NOT IN ('closed', 'resolved')
          AND location_lat IS NOT NULL AND location_lon IS NOT NULL`,
    )

    return Response.json(
      {
        signals: signalsResult.rows,
        incidents: incidentsResult.rows,
        meta: {
          window_minutes: mins,
          signals_total: total,
          signals_resolved: resolved,
          signals_unresolved: total - resolved,
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
