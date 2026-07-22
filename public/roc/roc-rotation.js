/* ============================================================================
 * ROC unified dashboard rotation engine
 * ----------------------------------------------------------------------------
 * Single source of truth for the auto-rotation slideshow across the OVIX globe
 * and every ROC dashboard. Loaded as its OWN <script src> on all pages so it
 * runs independently of each page's main (Cesium/dashboard) script — an error
 * there can no longer break rotation.
 *
 * The critical behavior: rotation is a cross-page RELAY. Each page, on load,
 * checks persisted state and (if active) re-arms a timer to navigate to the
 * next slide. Previously only the globe did this; the dashboards used a
 * separate, incompatible system that never resumed on load — so rotation
 * stalled on the first dashboard. This unifies both.
 *
 * State (localStorage 'roc-rotation'): { active, interval, enabledSlides }
 * Exposes: toggleRotation, startRotation, stopRotation, navNext, navPrev,
 *          navDomain, updateRotationInterval, toggleSlide, and rocNav(action).
 * ========================================================================== */
(function () {
  if (window.__rocRotationEngine) return; // idempotent — never double-init
  window.__rocRotationEngine = true;

  // Canonical rotation order. 'scores' (the all-indexes overview: 12 domain
  // indexes + composite + trend) is the FIRST/anchor slide (hub-036) so the
  // rotation periodically returns to the main index dashboard instead of only
  // cycling the individual domains — Ted's flag: "once it starts rotating we
  // don't see the main indexes." 'globe' was removed (hub-013): the landing
  // now has a native Cesium globe hero, so the rotation must NOT cycle to a
  // second standalone /roc/globe/globe.html slide. ROUTES.globe is kept below
  // for back-compat (direct navDomain('globe') callers).
  var ORDER = ['scores', 'weather', 'seismic', 'disaster', 'cyber', 'health',
               'infrastructure', 'financial', 'environmental', 'geopolitical',
               'travel', 'labor', 'supply_chain'];
  var ROUTES = {
    globe:          '/roc/globe/globe.html',
    scores:         '/roc/dashboards/scores.html',
    weather:        '/roc/dashboards/weather.html',
    seismic:        '/roc/dashboards/seismic.html',
    disaster:       '/roc/dashboards/disaster.html',
    cyber:          '/roc/dashboards/cyber.html',
    health:         '/roc/dashboards/health.html',
    infrastructure: '/roc/dashboards/infrastructure.html',
    financial:      '/roc/dashboards/financial.html',
    environmental:  '/roc/dashboards/environmental.html',
    geopolitical:   '/roc/dashboards/geopolitical.html',
    travel:         '/roc/dashboards/travel.html',
    labor:          '/roc/dashboards/labor.html',
    supply_chain:   '/roc/dashboards/supply-chain.html'
  };
  var LABELS = { globe: 'Globe', cyber: 'Cyber', health: 'Health', financial: 'Finance',
                 scores: 'Scores', supply_chain: 'Supply', labor: 'Labor' };

  var KEY = 'roc-rotation';
  function getState() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function setState(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }
  function enabledList() {
    var s = getState();
    var en = (s.enabledSlides && s.enabledSlides.length) ? s.enabledSlides : ORDER.slice();
    // keep canonical order
    return ORDER.filter(function (k) { return en.indexOf(k) !== -1; });
  }
  function intervalSec() {
    var s = getState();
    if (s.interval) return s.interval;
    var sel = document.getElementById('rot-interval');
    if (sel && sel.value) return parseInt(sel.value, 10) || 30;
    var legacy = parseInt(localStorage.getItem('roc-speed') || '', 10);
    return legacy || 30;
  }

  function currentKey() {
    var path = window.location.pathname;
    for (var k in ROUTES) {
      if (ROUTES[k] === path || path.indexOf(ROUTES[k]) !== -1) return k;
    }
    return 'globe';
  }
  function step(dir) {
    var en = enabledList();
    if (!en.length) en = ORDER.slice();
    var cur = currentKey();
    var idx = en.indexOf(cur);
    if (idx === -1) idx = 0;
    return en[(idx + dir + en.length) % en.length];
  }
  function go(key) { if (ROUTES[key]) window.location.href = ROUTES[key]; }

  function arm() {
    if (window._rotTimer) { clearTimeout(window._rotTimer); window._rotTimer = null; }
    var s = getState();
    if (!s.active) return;
    window._rotTimer = setTimeout(function () {
      var st = getState();
      if (!st.active) return;
      go(step(1)); // navigate to next enabled slide
    }, intervalSec() * 1000);
  }

  function updateUI() {
    var s = getState();
    var active = !!s.active;
    // Play/pause buttons across both page types (+ injected fallback)
    ['nav-play', 'bnr-play', 'globe-transport-play', 'roc-fab-play'].forEach(function (id) {
      var b = document.getElementById(id);
      if (!b) return;
      b.innerHTML = active ? '&#9208;' /* ⏸ */ : '&#9654;' /* ▶ */;
      if (id === 'nav-play') { b.classList.toggle('playing', active); b.title = active ? 'Pause rotation' : 'Play rotation'; }
      if (id === 'globe-transport-play') { b.style.background = active ? 'rgba(24,188,156,0.25)' : 'rgba(24,188,156,0.08)'; }
    });
    var ind = document.getElementById('rotation-indicator');
    if (ind) ind.style.display = active ? 'block' : 'none';
    var sel = document.getElementById('rot-interval');
    if (sel && s.interval) sel.value = String(s.interval);
    renderSlideChips();
  }

  function renderSlideChips() {
    var el = document.getElementById('slide-selector');
    if (!el) return;
    var en = enabledList();
    el.innerHTML = ORDER.map(function (k) {
      var on = en.indexOf(k) !== -1;
      return '<span class="slide-chip' + (on ? ' active' : '') +
        '" onclick="toggleSlide(\'' + k + '\')">' + (LABELS[k] || k) + '</span>';
    }).join('');
  }

  // ── Public API ──
  function start() {
    var s = getState();
    s.active = true;
    s.interval = intervalSec();
    if (!s.enabledSlides) s.enabledSlides = ORDER.slice();
    setState(s);
    updateUI();
    arm();
  }
  function stop() {
    var s = getState();
    s.active = false;
    setState(s);
    if (window._rotTimer) { clearTimeout(window._rotTimer); window._rotTimer = null; }
    updateUI();
  }
  window.startRotation = start;
  window.stopRotation = stop;
  window.toggleRotation = function () { getState().active ? stop() : start(); };
  window.navNext = function () { go(step(1)); };
  window.navPrev = function () { go(step(-1)); };
  window.navDomain = function (k) { go(k); };
  window.updateRotationInterval = function () {
    var sel = document.getElementById('rot-interval');
    var v = sel ? parseInt(sel.value, 10) : intervalSec();
    var s = getState();
    s.interval = v || 30;
    setState(s);
    if (s.active) arm();
  };
  window.toggleSlide = function (k) {
    var s = getState();
    var en = (s.enabledSlides && s.enabledSlides.length) ? s.enabledSlides.slice() : ORDER.slice();
    var i = en.indexOf(k);
    if (i !== -1 && en.length > 1) en.splice(i, 1);
    else if (i === -1) en.push(k);
    s.enabledSlides = en;
    setState(s);
    renderSlideChips();
  };
  // Return to the all-indexes overview (scores.html). Stops rotation first so
  // the relay does not immediately carry the member off the overview again.
  window.rocHome = function () { stop(); go('scores'); };
  // Back-compat shim for dashboards' rocNav() button handlers.
  window.rocNav = function (action) {
    if (action === 'next') window.navNext();
    else if (action === 'prev') window.navPrev();
    else if (action === 'toggle') window.toggleRotation();
    else if (action === 'home') window.rocHome();
  };

  // Guarantee a visible play/pause control on every page. If the page's native
  // control is missing (e.g. feed-health) or hidden (e.g. iframe-hide logic),
  // inject a consistent floating prev/play/next bar wired to the engine.
  function ensureControl() {
    var native = document.getElementById('bnr-play') ||
                 document.getElementById('nav-play') ||
                 document.getElementById('globe-transport-play');
    var visible = native && native.offsetParent !== null;
    if (visible) return; // native control present and shown — engine drives it
    if (document.getElementById('roc-rot-fab')) return; // already injected
    var btn = 'background:rgba(24,188,156,.1);border:1px solid rgba(24,188,156,.35);' +
              'color:#18BC9C;font-size:13px;width:28px;height:24px;border-radius:3px;' +
              'cursor:pointer;padding:0;line-height:1;';
    var bar = document.createElement('div');
    bar.id = 'roc-rot-fab';
    bar.style.cssText = 'position:fixed;bottom:14px;right:14px;display:flex;gap:4px;' +
      'z-index:99999;background:rgba(6,6,16,.88);border:1px solid rgba(24,188,156,.3);' +
      'border-radius:6px;padding:5px;font-family:system-ui,sans-serif;';
    bar.innerHTML =
      '<button title="Previous dashboard" onclick="navPrev()" style="' + btn + '">&#9198;</button>' +
      '<button id="roc-fab-play" title="Play/Pause rotation" onclick="toggleRotation()" style="' + btn + '">&#9654;</button>' +
      '<button title="Next dashboard" onclick="navNext()" style="' + btn + '">&#9197;</button>';
    document.body.appendChild(bar);
  }

  // Persistent "ALL INDEXES" home control on every ROC page (hub-036). Rendered
  // from this shared script so one definition covers the globe + all dashboards.
  // It sits at the always-on fixed layer (like #rotation-indicator) so it stays
  // visible AND clickable while rotation is active — the core fix: a member can
  // always jump back to the all-indexes overview (scores.html). Hidden on the
  // overview itself, where it would be redundant. Mission Control palette (cyan
  // #18BC9C / #22d3ee), NO ORANGE.
  function ensureHomeControl() {
    if (currentKey() === 'scores') return;               // already on the overview
    if (document.getElementById('roc-home-btn')) return; // idempotent
    if (!document.body) return;
    var btn = document.createElement('button');
    btn.id = 'roc-home-btn';
    btn.type = 'button';
    btn.title = 'Back to all indexes (overview dashboard)';
    btn.innerHTML = '&#8962; ALL INDEXES'; // ⌂
    btn.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:99999;' +
      'background:rgba(6,6,16,.92);border:1px solid rgba(24,188,156,.45);' +
      'color:#18BC9C;font-family:\'JetBrains Mono\',ui-monospace,monospace;' +
      'font-size:10px;letter-spacing:.14em;font-weight:700;padding:5px 10px;' +
      'border-radius:4px;cursor:pointer;line-height:1;user-select:none;';
    btn.onmouseover = function () { btn.style.borderColor = '#22d3ee'; btn.style.color = '#22d3ee'; };
    btn.onmouseout = function () { btn.style.borderColor = 'rgba(24,188,156,.45)'; btn.style.color = '#18BC9C'; };
    btn.onclick = function () { window.rocHome(); };
    document.body.appendChild(btn);
  }

  // One-time migration: ensure newly-added slides (labor, supply_chain) appear in
  // any pre-existing saved selection without disturbing the user's other choices.
  function migrate() {
    var s = getState();
    if (s.enabledSlides && s.enabledSlides.length) {
      var changed = false;
      // 'scores' added (hub-036) so the all-indexes overview joins the loop for
      // members who had already customized their slide selection.
      ['labor', 'supply_chain', 'scores'].forEach(function (k) {
        if (s.enabledSlides.indexOf(k) === -1) { s.enabledSlides.push(k); changed = true; }
      });
      if (changed) setState(s);
    }
  }

  // ── On load: resume the relay if active (THE FIX) ──
  function init() { migrate(); ensureControl(); ensureHomeControl(); updateUI(); arm(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
