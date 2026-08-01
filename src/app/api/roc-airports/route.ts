import { getPool } from '@/lib/db'

/**
 * ROC Airports — the bulk airport ring feed for the travel globe (hub-044).
 *
 * Reads the Hub Neon DB directly via the same `getPool()` raw-SQL / same-origin
 * pattern as /api/roc-globe, /api/roc-pipeline-health and /api/incidents — the
 * pattern `01-Source/DATA-PLANE-CONTRACT.md` sanctions for Hub-plane data. It
 * does NOT proxy ovix-api (which has no airport routes) and adds no worker.
 *
 * GET /api/roc-airports  (public, read-only)
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * The airport data (registry, 15-min commercial-ops sweeps, airspace states,
 * feed coverage) was live in Hub Neon but nothing published it over HTTP. The
 * only reachable surface was travel-intel's *degraded*-events feed — so a globe
 * could only ever draw broken airports, which implies every airport it does NOT
 * draw is fine. That is exactly the lie the ring spec forbids. This endpoint
 * publishes ALL of it so absence and health are never confusable.
 *
 * ── THE HONESTY RULES THIS ROUTE ENFORCES ──────────────────────────────────
 * 1. EVERY registry airport appears in EVERY response. All 272 rows, always;
 *    not paginated, not filtered by default. The driving table is the
 *    `airport_airspace_ring` view (itself `airports` LEFT JOINed to
 *    `airspace_states`), and both joins below are LEFT joins. An airport is
 *    never absent because it has no data — it appears with nulls/`unknown`.
 * 2. NO VALUE IS EVER SUBSTITUTED FOR A MISSING ONE. `last_checked_at` stays
 *    null. `operational_state` / `advisory_level` stay `'unknown'` with their
 *    `*_unknown_reason` populated ('never_checked' etc). The view already does
 *    this work correctly and deliberately — this route does not "clean it up",
 *    does not COALESCE, does not default. It passes through verbatim.
 * 3. `advisory_scope` is preserved faithfully: `'airport'`, `'country'`, or
 *    null when the advisory level is unknown. A country-level advisory must
 *    never be renderable as an airfield-specific all-clear — the consumer needs
 *    this field to caveat the claim, so it is never inferred or filled in.
 * 4. THE TWO AXES STAY SEPARATE. `operational_*` (hard status from the
 *    controlling state) and `advisory_*` (a risk judgment) are orthogonal and
 *    are NOT merged. No single "overall" status is computed here, and none
 *    should be downstream: an airport can be open under a `do_not_fly`
 *    advisory, or closed in a perfectly calm country.
 *
 * ── TRACEABILITY (01-Source/TRACEABILITY-STANDARD.md) ──────────────────────
 * `rule_id` / `rule_version` / `last_checked_at` flow through untouched from
 * the ring view, and the latest observation's own rule id/version + sweep id +
 * source are exposed as `obsRuleId` / `obsRuleVersion` / `obsSweepId` /
 * `obsSource`, so every number on the globe traces to a checkable sweep row.
 * This route makes no judgment of its own — there is no rule to version here.
 *
 * ── SHAPE ──────────────────────────────────────────────────────────────────
 * { airports: [ …all 31 `airport_airspace_ring` columns verbatim (snake_case),
 *               plus `coverage_class`, plus the obs* fields (camelCase) ],
 *   meta: { count, newest_observed_at, generatedAt, … breakdowns } }
 *
 * The mixed snake/camel casing is deliberate and specified: view columns keep
 * their database names so they are greppable back to the view; the joined
 * commercial-ops fields carry an `obs` prefix so it is unambiguous which axis a
 * field belongs to (`operational_state` is the controlling state's word;
 * `obsStatus` is what the flight sweep observed).
 */

export const dynamic = 'force-dynamic'

/**
 * One query. 272 rows.
 *
 * - `airport_airspace_ring` drives (272 rows, the full registry).
 * - `airport_feed_coverage` is a 1:1 LEFT JOIN on its `icao` primary key.
 * - The latest observation per airport comes from a LATERAL LIMIT 1, which
 *   walks `idx_airport_obs_latest (icao, observed_at DESC)` — 272 index seeks
 *   rather than a sort over the whole (and ever-growing) sweep history. Sweeps
 *   land every 15 min covering all 272 airports; taking the latest PER AIRPORT
 *   (rather than the latest sweep) means a partial future sweep degrades to a
 *   stale-but-disclosed reading via `obsObservedAt` instead of a hole.
 *
 * `numeric` columns are cast to double precision so node-pg yields JSON numbers
 * instead of strings. This is a representation cast only — NULL stays NULL.
 */
const AIRPORTS_SQL = `
  SELECT
    -- ── registry / ring identity ──────────────────────────────────────────
    r.icao,
    r.iata,
    r.name,
    r.country,
    r.category,
    r.monitor_tier,
    r.ring_source,
    r.business_travel_weight,
    r.lat,
    r.lon,
    -- ── AXIS 1: operational state (hard, from the controlling state) ──────
    r.operational_state,
    r.operational_reason,
    r.operational_source,
    r.operational_source_ref,
    r.operational_checked_at,
    r.operational_unknown_reason,
    r.effective_from,
    r.effective_to,
    -- ── AXIS 2: advisory (risk judgment) — orthogonal to axis 1 ───────────
    r.advisory_level,
    r.advisory_reason,
    r.advisory_source,
    r.advisory_source_ref,
    r.advisory_checked_at,
    r.advisory_scope,
    r.advisory_unknown_reason,
    -- ── derived ring severity + provenance ────────────────────────────────
    r.gps_interference,
    r.severity::double precision AS severity,
    r.severity_band,
    r.rule_id,
    r.rule_version,
    r.last_checked_at,
    -- ── feed coverage: how much this airport can even be known ────────────
    fc.coverage_class,
    -- ── commercial ops: the latest 15-min sweep for this airport ──────────
    o.status                              AS "obsStatus",
    o.status_reason                       AS "obsStatusReason",
    o.lifecycle                           AS "obsLifecycle",
    o.observed_at                         AS "obsObservedAt",
    o.source                              AS "obsSource",
    o.sweep_id                            AS "obsSweepId",
    o.departures_total                    AS "obsDeparturesTotal",
    o.departures_qualified                AS "obsDeparturesQualified",
    o.departures_cancelled                AS "obsDeparturesCancelled",
    o.departures_median_delay_min::double precision AS "obsDeparturesMedianDelayMin",
    o.departures_delay_index::double precision      AS "obsDeparturesDelayIndex",
    o.arrivals_total                      AS "obsArrivalsTotal",
    o.arrivals_qualified                  AS "obsArrivalsQualified",
    o.arrivals_cancelled                  AS "obsArrivalsCancelled",
    o.arrivals_median_delay_min::double precision   AS "obsArrivalsMedianDelayMin",
    o.arrivals_delay_index::double precision        AS "obsArrivalsDelayIndex",
    o.avg_delay_min::double precision     AS "obsAvgDelayMin",
    o.max_delay_min::double precision     AS "obsMaxDelayMin",
    o.rule_id                             AS "obsRuleId",
    o.rule_version                        AS "obsRuleVersion"
  FROM airport_airspace_ring r
  LEFT JOIN airport_feed_coverage fc ON fc.icao = r.icao
  LEFT JOIN LATERAL (
    SELECT ao.*
      FROM airport_observations ao
     WHERE ao.icao = r.icao
     ORDER BY ao.observed_at DESC, ao.id DESC
     LIMIT 1
  ) o ON true
  ORDER BY r.icao
`

/** Count rows by a key, skipping nothing — null becomes the literal 'null' bucket. */
function tally(rows: Record<string, unknown>[], key: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    const k = r[key] === null || r[key] === undefined ? 'null' : String(r[key])
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

export async function GET() {
  try {
    const pool = getPool()
    const result = await pool.query(AIRPORTS_SQL)
    const airports = result.rows

    // Newest observation across the whole set — lets a consumer show how fresh
    // the commercial-ops layer is as a whole, independently of any one
    // airport's `obsObservedAt` (which may legitimately be older).
    let newestObserved: Date | null = null
    for (const a of airports) {
      const t = a.obsObservedAt as Date | null
      if (t && (newestObserved === null || t > newestObserved)) newestObserved = t
    }

    return Response.json(
      {
        airports,
        meta: {
          count: airports.length,
          newest_observed_at: newestObserved,
          generatedAt: new Date().toISOString(),
          // Observability / honesty breakdowns. These are counts of what was
          // returned, not a re-judgment of it — they make it checkable at a
          // glance that all three operational states and the `unknown` bucket
          // are reachable, and that nothing was silently dropped.
          operational_state: tally(airports, 'operational_state'),
          advisory_level: tally(airports, 'advisory_level'),
          advisory_scope: tally(airports, 'advisory_scope'),
          obs_status: tally(airports, 'obsStatus'),
          coverage_class: tally(airports, 'coverage_class'),
        },
      },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
    )
  } catch (e) {
    console.error('roc-airports query error:', e)
    // Fail loudly. Never return a partial or empty airport list on error — an
    // empty `airports` array would read on the globe as "no airports have
    // problems", which is the exact confusion this endpoint exists to prevent.
    return Response.json({ error: 'Failed to query airport ring' }, { status: 500 })
  }
}
