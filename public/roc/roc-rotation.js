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

  // Canonical rotation order (globe first, then domain dashboards).
  var ORDER = ['globe', 'weather', 'seismic', 'disaster', 'cyber', 'health',
               'infrastructure', 'financial', 'environmental', 'geopolitical', 'travel'];
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
    travel:         '/roc/dashboards/travel.html'
  };
  var LABELS = { globe: 'Globe', cyber: 'Cyber', health: 'Health', financial: 'Finance', scores: 'Scores' };

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
    // Play/pause buttons across both page types
    ['nav-play', 'bnr-play', 'globe-transport-play'].forEach(function (id) {
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
  // Back-compat shim for dashboards' rocNav() button handlers.
  window.rocNav = function (action) {
    if (action === 'next') window.navNext();
    else if (action === 'prev') window.navPrev();
    else if (action === 'toggle') window.toggleRotation();
  };

  // ── On load: resume the relay if active (THE FIX) ──
  function init() { updateUI(); arm(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
