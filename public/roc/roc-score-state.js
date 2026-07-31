/* ============================================================================
 * ROC op-risk SCORE-STATE helper (hub-045)
 * ----------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * A published op-risk score can be SETTLED (computed as a percentile against the
 * domain's own trailing 30-day baseline) or PROVISIONAL (the baseline is not yet
 * usable, so the engine scores on an absolute basis instead). Both are real
 * readings. They are simply not the same KIND of reading.
 *
 * Before hub-045 the Hub received that distinction and ignored it. After a
 * baseline reset every domain went provisional at once and the globe rendered
 * twelve confident-looking bands — a viewer reasonably concluded that was the
 * world's actual state, when part of what it meant was "this is a provisional
 * basis". That is the failure mode the programme forbids everywhere else:
 * monitored-live must never render as a settled reading (hub-044 ring spec,
 * 01-Source/TRACEABILITY-STANDARD.md).
 *
 * THE CONTRACT (api-065 / roc#124) — read these, never re-derive them
 *   per domain: state ('PROVISIONAL'|'SETTLED'), scoreBasis
 *               ('baseline_percentile'|'provisional_absolute'|'empty_window'),
 *               baselineProgress (0-1), settlesAt (ISO or null), score, level
 *   top level:  compositeState, compositeLevel, compositeBasis
 *               {settled, provisional, unavailable}, ruleVersion
 *
 * THE LOAD-BEARING SEMANTIC
 *   `provisional_absolute` scores ARE comparable across domains at one instant.
 *   They are NOT comparable against a settled score, nor against the domain's own
 *   history. So:
 *     - a live cross-domain ranking is legitimate -> we rank normally;
 *     - a comparison across the provisional/settled boundary is not -> we flag it;
 *     - a trend line spanning the boundary is not -> we withhold it (see
 *       trendBlocked, and the note on the series gap below).
 *
 * CONFIDENCE AND SEVERITY ARE SEPARATE AXES. `level` keeps its three values
 * (NORMAL / ELEVATED / HIGH) and its hazard colour. State is rendered as its own
 * neutral marker. This helper never invents a fourth level, and never recolours a
 * band to express uncertainty.
 *
 * SELF-CLEARING BY CONSTRUCTION. Every consumer re-derives state from the latest
 * payload on every refresh. No date, no cached flag, no manual step: when a domain
 * reports SETTLED its marker disappears, and if a future reset pushes it back to
 * PROVISIONAL the marker returns on its own.
 *
 * KNOWN DATA-PLANE GAP (reported to FOREMAN; api-065's to close):
 * `/api/ovix/op-risk/series` points carry only {scored_at, score} — no per-point
 * `state`/`scoreBasis` and no `basisChangedAt`. There is therefore no way to tell
 * whether a given trend window crosses a basis change. Until that lands we take
 * the conservative reading: while a domain is PROVISIONAL its trend is withheld
 * with a stated reason, rather than drawn across a boundary we cannot locate.
 *
 * Public API (all no-throw, all safe on partial/absent data):
 *   RocScoreState.domainState(entry)     -> per-domain state record
 *   RocScoreState.summarize(payload)     -> index-level summary
 *   RocScoreState.badgeHTML(sum, opts)   -> badge markup string
 *   RocScoreState.attachBadge(host, sum) -> idempotent create/update/REMOVE
 *   RocScoreState.chipHTML(st)           -> inline PROV chip for a row
 *   RocScoreState.trendBlocked(st)       -> true when a trend would span a basis change
 *   RocScoreState.explain(stOrSum)       -> full "why is this provisional" sentence
 *   RocScoreState.fmtUpdated/fmtSettles/injectStyles/NEUTRAL
 * ========================================================================== */
(function () {
  if (window.RocScoreState) return; // idempotent

  var PROVISIONAL = 'PROVISIONAL';
  var SETTLED = 'SETTLED';

  // State is a CONFIDENCE signal, not a hazard signal — so it is always neutral
  // slate and never borrows a severity colour (and never orange; hub-041).
  var NEUTRAL = '#94a3b8';
  var NEUTRAL_DIM = '#64748b';
  var NEUTRAL_LINE = 'rgba(148,163,184,0.38)';
  var NEUTRAL_FILL = 'rgba(148,163,184,0.09)';

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ------------------------------------------------------------------
  // Per-domain state — read straight off the API entry.
  // `state` is canonical. `calibrating` is its legacy boolean twin and is used
  // ONLY as a compatibility shim so the Hub still renders correctly if it is
  // deployed against an ovix-api that predates roc#124.
  // ------------------------------------------------------------------
  function domainState(entry) {
    var out = {
      state: null, provisional: false, settled: false, known: false,
      scoreBasis: null, empty: false, score: null, level: null,
      progress: null, settlesAt: null, settlesAtKnown: false,
      lastUpdated: null, total: 0
    };
    if (!entry || typeof entry !== 'object') return out;

    var s = typeof entry.state === 'string' ? entry.state.toUpperCase() : null;
    if (s !== PROVISIONAL && s !== SETTLED) {
      s = (entry.calibrating === true) ? PROVISIONAL   // legacy shim (pre-roc#124)
        : (entry.calibrating === false ? SETTLED : null);
    }
    out.state = s;
    out.known = s === PROVISIONAL || s === SETTLED;
    out.provisional = s === PROVISIONAL;
    out.settled = s === SETTLED;

    out.scoreBasis = typeof entry.scoreBasis === 'string' ? entry.scoreBasis : null;
    out.empty = out.scoreBasis === 'empty_window';
    out.score = isNum(entry.score) ? entry.score : null;
    out.level = typeof entry.level === 'string' ? entry.level : null;
    // baselineProgress is authoritative — never divide baselineN ourselves.
    out.progress = isNum(entry.baselineProgress)
      ? Math.max(0, Math.min(1, entry.baselineProgress)) : null;
    // settlesAt is null for a regime-shift provisional: that one heals on DATA,
    // not on a clock, so no countdown may be rendered for it.
    out.settlesAt = (out.provisional && entry.settlesAt) ? entry.settlesAt : null;
    out.settlesAtKnown = !!out.settlesAt;
    return out;
  }

  // ------------------------------------------------------------------
  // Index-level summary for one op-risk payload (global OR region scope).
  // ------------------------------------------------------------------
  function summarize(payload) {
    var s = {
      provisional: false, compositeState: null, compositeLevel: null, known: false,
      basis: { settled: 0, provisional: 0, unavailable: 0 },
      provisionalCount: 0, settledCount: 0, total: 0,
      mixed: false, progress: null, settlesAt: null, settlesAtKnown: false,
      ruleVersion: null, lastUpdated: null, source: null
    };
    if (!payload || typeof payload !== 'object') return s;

    s.lastUpdated = payload.lastUpdated || null;
    s.source = payload.source || null;
    s.ruleVersion = payload.ruleVersion || null;
    s.compositeLevel = typeof payload.compositeLevel === 'string' ? payload.compositeLevel : null;

    var cb = payload.compositeBasis;
    if (cb && typeof cb === 'object') {
      s.basis.settled = isNum(cb.settled) ? cb.settled : 0;
      s.basis.provisional = isNum(cb.provisional) ? cb.provisional : 0;
      s.basis.unavailable = isNum(cb.unavailable) ? cb.unavailable : 0;
    }

    var doms = Array.isArray(payload.domains) ? payload.domains : [];
    s.total = doms.length;
    var minProgress = null, latestSettles = null, anyUnknownSettles = false;
    for (var i = 0; i < doms.length; i++) {
      var d = domainState(doms[i]);
      if (d.settled) s.settledCount++;
      if (!d.provisional) continue;
      s.provisionalCount++;
      if (d.progress !== null && (minProgress === null || d.progress < minProgress)) minProgress = d.progress;
      if (!d.settlesAt) anyUnknownSettles = true;                 // regime-shift → no clock
      else if (!latestSettles || d.settlesAt > latestSettles) latestSettles = d.settlesAt;
    }
    // Fall back to counting domains when compositeBasis is absent (pre-roc#124).
    if (!cb) { s.basis.settled = s.settledCount; s.basis.provisional = s.provisionalCount; }

    var cs = typeof payload.compositeState === 'string' ? payload.compositeState.toUpperCase() : null;
    if (cs !== PROVISIONAL && cs !== SETTLED) {
      cs = s.provisionalCount > 0 ? PROVISIONAL : (s.total > 0 ? SETTLED : null);
    }
    s.compositeState = cs;
    s.known = cs === PROVISIONAL || cs === SETTLED;
    s.provisional = cs === PROVISIONAL;

    s.progress = minProgress;
    // Only quote a settle time when EVERY provisional domain has one; a single
    // regime-shift domain (settlesAt null) makes an index-wide estimate dishonest.
    s.settlesAt = anyUnknownSettles ? null : latestSettles;
    s.settlesAtKnown = !!s.settlesAt;
    // The comparison hazard: settled and provisional scores side by side.
    s.mixed = s.basis.settled > 0 && s.basis.provisional > 0;
    return s;
  }

  // ------------------------------------------------------------------
  // A trend line may not span a provisional/settled basis change. The series
  // endpoint carries no per-point state, so while the current reading is
  // PROVISIONAL we cannot prove the window is single-basis — and withhold it.
  // ------------------------------------------------------------------
  function trendBlocked(st) {
    return !!(st && st.provisional);
  }
  var TREND_REASON = 'Trend withheld: scored on a provisional basis, and the history may cross a ' +
    'change of basis. Provisional and settled scores are not comparable over time.';

  // ------------------------------------------------------------------
  // Traceability gate 2: WHEN was this computed, and WHY is it provisional.
  // ------------------------------------------------------------------
  function toDate(v) {
    if (!v) return null;
    // Accept ISO and Postgres-style "2026-07-31 17:51:06.597963+00".
    var iso = String(v).trim().replace(' ', 'T').replace(/\+00$/, 'Z');
    var t = new Date(iso);
    return isNaN(t.getTime()) ? null : t;
  }
  function fmtUpdated(v) {
    var t = toDate(v);
    if (!t) return v ? String(v) : 'unknown';
    return String(t.getUTCHours()).padStart(2, '0') + ':' +
           String(t.getUTCMinutes()).padStart(2, '0') + ' UTC';
  }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtSettles(v) {
    var t = toDate(v);
    if (!t) return null; // regime-shift provisional → never render a countdown
    return t.getUTCDate() + ' ' + MONTHS[t.getUTCMonth()] + ' ' +
      String(t.getUTCHours()).padStart(2, '0') + ':' +
      String(t.getUTCMinutes()).padStart(2, '0') + ' UTC';
  }

  function basisPhrase(st) {
    if (st && st.empty) return 'has no observations in the current window';
    if (st && st.scoreBasis === 'provisional_absolute') return 'is scored on an absolute basis';
    return 'is scored on a provisional basis';
  }

  function explain(x) {
    if (!x || !x.provisional) return '';
    var bits = ['PROVISIONAL — this score ' + basisPhrase(x) +
      ', because the trailing 30-day baseline is not yet usable.'];
    if (isNum(x.progress)) bits.push('Baseline ' + Math.round(x.progress * 100) + '% complete.');
    bits.push('Provisional scores are comparable to each other right now, but NOT to a settled score ' +
      'and NOT to their own history.');
    var when = fmtSettles(x.settlesAt);
    // No settle estimate means it heals on incoming data, not on elapsed time.
    bits.push(when ? 'Expected to settle about ' + when + '.' : 'It settles when the data recovers, not on a schedule.');
    if (x.lastUpdated) bits.push('Last computed ' + fmtUpdated(x.lastUpdated) + '.');
    return bits.join(' ');
  }

  // ------------------------------------------------------------------
  // Styles — injected once, scoped to .roc-st-* so no page CSS is disturbed.
  // ------------------------------------------------------------------
  var STYLE_ID = 'roc-score-state-styles';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = [
      '.roc-st-badge{display:inline-flex;align-items:center;gap:7px;flex-wrap:wrap;',
      'padding:4px 9px;border:1px dashed ' + NEUTRAL_LINE + ';border-radius:4px;',
      'background:' + NEUTRAL_FILL + ';color:' + NEUTRAL + ';font-size:10px;font-weight:700;',
      'letter-spacing:.08em;text-transform:uppercase;line-height:1.35;cursor:help;',
      'font-family:inherit;max-width:100%;box-sizing:border-box}',
      '.roc-st-badge.block{display:flex;width:100%;justify-content:flex-start}',
      '.roc-st-badge .roc-st-dot{width:7px;height:7px;border-radius:50%;flex:0 0 auto;',
      'background:' + NEUTRAL + ';animation:roc-st-pulse 2.4s ease-in-out infinite}',
      '.roc-st-badge .roc-st-n{color:#cbd5e1;font-variant-numeric:tabular-nums}',
      '.roc-st-badge .roc-st-sub{color:' + NEUTRAL_DIM + ';font-weight:600;text-transform:none;letter-spacing:.02em}',
      '.roc-st-bar{position:relative;width:52px;height:3px;border-radius:2px;',
      'background:rgba(148,163,184,0.22);overflow:hidden;flex:0 0 auto}',
      '.roc-st-bar > i{position:absolute;inset:0 auto 0 0;background:' + NEUTRAL + ';display:block}',
      // Inline chip riding beside a level badge — the CONFIDENCE axis, kept
      // visually distinct from the hazard band it sits next to.
      '.roc-st-chip{display:inline-flex;align-items:center;padding:2px 5px;border-radius:3px;',
      'border:1px dashed ' + NEUTRAL_LINE + ';background:' + NEUTRAL_FILL + ';color:' + NEUTRAL + ';',
      'font-size:8px;font-weight:700;letter-spacing:.5px;white-space:nowrap;cursor:help}',
      '.roc-st-note{color:' + NEUTRAL_DIM + ';font-size:9px;font-style:italic;letter-spacing:.02em}',
      // Dashed underline marks a provisional VALUE without changing its band colour.
      '.roc-st-prov-val{border-bottom:1px dashed ' + NEUTRAL_LINE + '}',
      '@keyframes roc-st-pulse{0%,100%{opacity:.35}50%{opacity:1}}',
      '@media (prefers-reduced-motion: reduce){.roc-st-badge .roc-st-dot{animation:none;opacity:.8}}'
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  // ------------------------------------------------------------------
  // badgeHTML — opts: {compact, block, label, showBar}
  // ------------------------------------------------------------------
  function badgeHTML(summary, opts) {
    if (!summary || !summary.provisional) return '';
    opts = opts || {};
    var lead = opts.label || PROVISIONAL;
    var pctTxt = isNum(summary.progress) ? Math.round(summary.progress * 100) + '%' : '—';

    var h = '<span class="roc-st-badge' + (opts.block ? ' block' : '') +
      '" title="' + esc(explain(summary)) + '">' +
      '<span class="roc-st-dot"></span>' + esc(lead) +
      ' <span class="roc-st-n">' + esc(pctTxt) + '</span>';
    if (opts.showBar !== false) {
      h += '<span class="roc-st-bar"><i style="width:' +
        (isNum(summary.progress) ? (summary.progress * 100).toFixed(1) : 0) + '%"></i></span>';
    }
    if (!opts.compact) {
      var settles = fmtSettles(summary.settlesAt);
      var sub = 'baseline complete · ' +
        (summary.total ? summary.provisionalCount + '/' + summary.total + ' domains provisional · ' : '') +
        (settles ? 'settles ~' + settles : 'settles when data recovers') +
        ' · computed ' + fmtUpdated(summary.lastUpdated);
      h += '<span class="roc-st-sub">' + esc(sub) + '</span>';
    }
    return h + '</span>';
  }

  // Inline chip for a tape row / legend cell / drill line.
  function chipHTML(st, label) {
    if (!st || !st.provisional) return '';
    return '<span class="roc-st-chip" title="' + esc(explain(st)) + '">' +
      esc(label || 'PROV') + '</span>';
  }

  // ------------------------------------------------------------------
  // attachBadge — idempotent. Creates the badge under `host` while provisional,
  // updates it in place, and REMOVES it the moment the state settles. This is
  // what makes every surface self-clearing with no manual step.
  // ------------------------------------------------------------------
  function attachBadge(host, summary, opts) {
    try {
      if (!host) return null;
      var key = (opts && opts.key) || 'roc-st-slot';
      var el = host.querySelector('[data-roc-state="' + key + '"]');
      if (!summary || !summary.provisional) {
        if (el && el.parentNode) el.parentNode.removeChild(el); // self-clearing
        return null;
      }
      injectStyles();
      if (!el) {
        el = document.createElement('div');
        el.setAttribute('data-roc-state', key);
        el.style.cssText = (opts && opts.slotStyle) || 'margin:6px 0 0';
        if (opts && opts.prepend && host.firstChild) host.insertBefore(el, host.firstChild);
        else host.appendChild(el);
      }
      el.innerHTML = badgeHTML(summary, opts);
      return el;
    } catch (e) { return null; } // never break a dashboard over a badge
  }

  window.RocScoreState = {
    PROVISIONAL: PROVISIONAL,
    SETTLED: SETTLED,
    NEUTRAL: NEUTRAL,
    NEUTRAL_DIM: NEUTRAL_DIM,
    NEUTRAL_LINE: NEUTRAL_LINE,
    TREND_REASON: TREND_REASON,
    domainState: domainState,
    summarize: summarize,
    trendBlocked: trendBlocked,
    badgeHTML: badgeHTML,
    chipHTML: chipHTML,
    attachBadge: attachBadge,
    injectStyles: injectStyles,
    fmtUpdated: fmtUpdated,
    fmtSettles: fmtSettles,
    explain: explain
  };
})();
