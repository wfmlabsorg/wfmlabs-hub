/* ============================================================================
 * ROC canonical domain-score helper (hub-013)
 * ----------------------------------------------------------------------------
 * Each per-domain ROC dashboard used to compute its OWN headline gauge score
 * locally (e.g. weather = MAX(event severity) → 10.0), diverging from the
 * canonical OVIX score the tape / globe / composite all show (weather → 7.6).
 *
 * This single shared helper fetches /api/ovix/scores ONCE per page (cached,
 * refreshed every 60s) and exposes the canonical score for the current domain,
 * so all 13 dashboards reconcile to one source of truth instead of 13 divergent
 * copies. Only the HEADLINE number/gauge consumes this — event lists/detail
 * panels keep using each dashboard's own data.
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
  var file = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  var DOMAIN = file.replace(/-/g, '_').toLowerCase(); // supply-chain → supply_chain

  var canon = null; // canonical score for THIS page's domain (number) or null

  function apply(d) {
    if (!d || !Array.isArray(d.domains)) return;
    var m = null;
    for (var i = 0; i < d.domains.length; i++) {
      if (String(d.domains[i].domain).toLowerCase() === DOMAIN) { m = d.domains[i]; break; }
    }
    if (!m || m.score == null) return;
    var n = Number(m.score);
    if (isNaN(n)) return;
    canon = n;
    if (typeof window.__rocApplyCanonical === 'function') {
      try { window.__rocApplyCanonical(canon); } catch (e) { /* noop */ }
    }
  }

  function refresh() {
    var opts = {};
    try { if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opts.signal = AbortSignal.timeout(12000); } catch (e) {}
    fetch(OVIX_API + '/api/ovix/scores', opts)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(apply)
      .catch(function () { /* keep last good / fall back to local */ });
  }

  // Sync getter: canonical if known, else the dashboard's local fallback.
  window.rocCanonical = function (fallback) {
    return canon != null ? canon : fallback;
  };
  window.rocCanonicalDomain = DOMAIN;

  refresh();
  setInterval(refresh, 60000);
})();
