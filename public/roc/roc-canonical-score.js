/* ============================================================================
 * ROC canonical domain-score helper (hub-013, headline source updated hub-029)
 * ----------------------------------------------------------------------------
 * Each per-domain ROC dashboard used to compute its OWN headline gauge score
 * locally (e.g. weather = MAX(event severity) → 10.0), diverging from the
 * canonical score the tape / globe / composite all show.
 *
 * hub-029: the HEADLINE 12-domain metric is now the signals-derived Operational
 * Risk Index (/api/ovix/op-risk, rule op_risk_index v1) — all 12 domains,
 * member-geo-weighted, traceable. OVIX (/api/ovix/scores) is demoted to a
 * geophysical SENSOR OVERLAY and is used here only as a fallback for domains the
 * Operational Risk Index has not (yet) scored.
 *
 * This single shared helper fetches op-risk ONCE per page (cached, refreshed
 * every 60s), falls back to OVIX scores, and exposes the canonical score for the
 * current domain, so all 13 dashboards reconcile to one source of truth instead
 * of 13 divergent copies. Only the HEADLINE number/gauge consumes this — event
 * lists/detail panels keep using each dashboard's own data.
 *
 * The domain key is derived from the page filename:
 *   weather.html      → weather
 *   supply-chain.html → supply_chain   (dashes → underscores, matches API key)
 *
 * Public API (both no-throw, safe before the fetch resolves):
 *   window.rocCanonical(fallback)      → canonical score for this domain, else
 *                                        the provided local fallback (sync).
 *   window.__rocApplyCanonical(score)  → registered BY each dashboard; the helper
 *                                        calls it the moment canonical arrives so
 *                                        the gauge repaints immediately (no wait
 *                                        for the dashboard's own refresh tick).
 * ========================================================================== */
(function () {
  if (window.__rocCanonicalLoaded) return; // idempotent
  window.__rocCanonicalLoaded = true;

  var OVIX_API = 'https://ovix-api.tedlango.workers.dev';
  var RISK_URL = OVIX_API + '/api/ovix/op-risk?scope=global'; // HEADLINE (all 12 domains)
  var OVIX_URL = OVIX_API + '/api/ovix/scores';               // sensor overlay fallback
  var file = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  var DOMAIN = file.replace(/-/g, '_').toLowerCase(); // supply-chain → supply_chain

  var canon = null; // canonical score for THIS page's domain (number) or null

  function scoreFrom(d) {
    try {
      if (!d || !Array.isArray(d.domains)) return null;
      for (var i = 0; i < d.domains.length; i++) {
        var entry = d.domains[i];
        if (!entry || entry.domain == null) continue; // skip malformed entries
        if (String(entry.domain).toLowerCase() === DOMAIN) {
          var n = Number(entry.score);
          return isNaN(n) ? null : n;
        }
      }
      return null;
    } catch (e) { return null; } // never throw → never skip the OVIX fallback
  }

  function set(n) {
    if (n == null) return false;
    canon = n;
    if (typeof window.__rocApplyCanonical === 'function') {
      try { window.__rocApplyCanonical(canon); } catch (e) { /* noop */ }
    }
    return true;
  }

  function getJSON(url) {
    var opts = {};
    try { if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opts.signal = AbortSignal.timeout(12000); } catch (e) {}
    return fetch(url, opts).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  function refresh() {
    // Prefer the Operational Risk Index; fall back to the OVIX sensor overlay only
    // if op-risk is unreachable or hasn't scored this domain.
    getJSON(RISK_URL).then(function (risk) {
      if (set(scoreFrom(risk))) return;
      getJSON(OVIX_URL).then(function (ovix) { set(scoreFrom(ovix)); });
    });
  }

  // Sync getter: canonical if known, else the dashboard's local fallback.
  window.rocCanonical = function (fallback) {
    return canon != null ? canon : fallback;
  };
  window.rocCanonicalDomain = DOMAIN;

  refresh();
  setInterval(refresh, 60000);
})();
