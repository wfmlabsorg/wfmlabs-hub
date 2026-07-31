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
 * hub-045: a published op-risk score can be SETTLED (a percentile against the
 * domain's own 30-day baseline) or PROVISIONAL (baseline not yet usable, so the
 * engine scores on an absolute basis). Both are real; they are not the same kind
 * of reading. The gauge previously rendered them identically, so a provisional
 * band read as a settled one. This helper now also consumes the score-state
 * contract (`state`, `scoreBasis`, `baselineProgress`, `settlesAt`) and pins a
 * badge beside the gauge. Because it is re-derived from each poll it clears itself
 * the moment the domain settles — and returns on its own if a future reset pushes
 * it back to PROVISIONAL. Requires /roc/roc-score-state.js (degrades silently
 * without it). NOTE: the gauge band is NOT recoloured — severity and confidence
 * are separate axes.
 *
 * Public API (all no-throw, safe before the fetch resolves):
 *   window.rocCanonical(fallback)      → canonical score for this domain, else
 *                                        the provided local fallback (sync).
 *   window.rocCanonicalState()         → score-state record for this domain
 *                                        ({state, scoreBasis, progress, settlesAt}).
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

  var canon = null;  // canonical score for THIS page's domain (number) or null
  var dstate = null; // hub-045: score-state record for THIS page's domain

  function entryFor(d) {
    try {
      if (!d || !Array.isArray(d.domains)) return null;
      for (var i = 0; i < d.domains.length; i++) {
        var entry = d.domains[i];
        if (!entry || entry.domain == null) continue; // skip malformed entries
        if (String(entry.domain).toLowerCase() === DOMAIN) return entry;
      }
      return null;
    } catch (e) { return null; } // never throw → never skip the OVIX fallback
  }

  function scoreFrom(d) {
    var entry = entryFor(d);
    if (!entry) return null;
    var n = Number(entry.score);
    return isNaN(n) ? null : n;
  }

  // ------------------------------------------------------------------
  // hub-045 — score-state badge, pinned beside the headline gauge.
  // Rebuilt from every poll: present while PROVISIONAL, REMOVED as soon as the
  // domain settles. Nothing dated or cached, so it is self-clearing both ways.
  // ------------------------------------------------------------------
  function gaugeHost() {
    var anchor = document.getElementById('gauge-label') || document.getElementById('g-label') ||
                 document.getElementById('gauge-svg') || document.getElementById('gauge');
    if (anchor && anchor.parentNode) return anchor.parentNode;
    return document.querySelector('.gauge-container') || document.querySelector('.gauge-panel') ||
           document.querySelector('.gc') || null;
  }

  function paintState(payload) {
    var RS = window.RocScoreState;
    if (!RS) return;
    try {
      var st = RS.domainState(entryFor(payload));
      st.lastUpdated = (payload && payload.lastUpdated) || null;
      dstate = st;

      // The badge reports THIS domain's own state, so the numbers on the page are
      // the ones that produced the gauge in front of the reader.
      var el = RS.attachBadge(gaugeHost(), st, {
        key: 'gauge', compact: true,
        slotStyle: 'margin:8px auto 0;max-width:232px;text-align:center'
      });

      if (el && st.provisional) {
        var settles = RS.fmtSettles(st.settlesAt);
        var p = document.createElement('div');
        p.className = 'roc-st-note';
        p.style.cssText = 'margin-top:4px;font-size:9px';
        // No settle estimate means it heals on data, not on a clock — say that
        // rather than implying a countdown that does not exist.
        p.textContent = st.empty
          ? 'no observations in the current window'
          : (settles ? 'absolute basis · settles ~' + settles : 'absolute basis · settles when data recovers');
        el.appendChild(p);
      }

      // Qualify the level word the dashboard prints under the gauge, without
      // altering it — the band itself remains the engine's severity call.
      var lbl = document.getElementById('gauge-label') || document.getElementById('g-label');
      if (lbl) lbl.title = st.provisional ? RS.explain(st) : '';
    } catch (e) { /* a badge must never break a dashboard */ }
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
      // hub-045: repaint state on EVERY poll, including when op-risk is unreachable
      // (risk === null) — that clears a stale badge rather than freezing one on screen.
      paintState(risk);
      if (set(scoreFrom(risk))) return;
      getJSON(OVIX_URL).then(function (ovix) { set(scoreFrom(ovix)); });
    });
  }

  // Sync getter: canonical if known, else the dashboard's local fallback.
  window.rocCanonical = function (fallback) {
    return canon != null ? canon : fallback;
  };
  // hub-045: score-state for this page's domain (null until the first poll).
  window.rocCanonicalState = function () { return dstate; };
  window.rocCanonicalDomain = DOMAIN;

  refresh();
  setInterval(refresh, 60000);
})();
