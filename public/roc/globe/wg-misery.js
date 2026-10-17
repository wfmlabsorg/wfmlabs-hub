/* =========================================================================
 * wg-misery.js — the Travel Misery Index, as a World Glass plugin layer (api-083).
 *
 *   One marker per registry airport (660 of them, military airbases included), from /api/roc-misery.
 *   AIRPORTS ARE SQUARES. Every other layer on the board draws circles (events, hazards, quakes — hollow when
 *   the position is approximate), so an airport must never be a circle (Ted, 2026-10-15: "difficult to see what
 *   airports are versus little events that are these open circles"). A square is an airport, full stop;
 *   its IATA code is printed beside it once you are within ~2,500 km.
 *     SIZE   = scheduled movements (departures + arrivals) in the feed's 2-hour window — square-root
 *              scale, so a 300-movement hub is ~3× a 30-movement field, not 10×.
 *     COLOUR = misery 0-100 (rule airport_misery v2): calm < 20 teal · slow 20-40 amber ·
 *              miserable 40-60 orange · severe ≥ 60 red. A ring pulses around severe.
 *     GREY   = no score — the feed withheld statistics (too few flights), the airport was absent from
 *              the sweep, or it has never been observed. A dark square at its real size, never calm.
 *     MILITARY = violet square with a white cross, no commercial data by construction (category government).
 *   The gauge is ONE line in the top bar next to the feeds list: flight-weighted mean misery across scored
 *   airports for the newest sweep + a 24-hour sparkline; counts, cancellations and method sit in its tooltip.
 *
 * Honesty (hub-051): a failed read is a GAP, never an empty calm layer. Everything the score was
 * built from (median, index, cancellations, window, sweep, baseline maturity) is on the card.
 * ====================================================================== */
(function () {
'use strict';
var WG = window.WG; if (!WG) return;
var Cesium = WG.Cesium, C = WG.C, esc = WG.esc;

var BANDS = [
  { band: 'calm',      from: 0,  color: '#18BC9C', word: 'calm' },
  { band: 'slow',      from: 20, color: '#eab308', word: 'slow' },
  { band: 'miserable', from: 40, color: '#f97316', word: 'miserable' },
  { band: 'severe',    from: 60, color: '#ef4444', word: 'severe' }
];
var C_UNSCORED = '#94a3b8', C_MILITARY = '#a78bfa';
var REASON = {
  ok: null,
  insufficient_qualified: 'too few usable flights in the window to score',
  no_statistics: 'the feed reported flights but withheld delay statistics',
  absent_from_feed: 'absent from this sweep (vendor coverage gap)',
  fetch_failed: 'the sweep failed — last reading is stale',
  no_traffic_in_window: 'no scheduled traffic in the window',
  never_observed: 'never observed — added to the registry after the last sweep',
  no_commercial_data: 'military airbase — no commercial flight data by construction'
};
function bandOf(score) { if (score == null) return null; var b = BANDS[0]; for (var i = 0; i < BANDS.length; i++) if (score >= BANDS[i].from) b = BANDS[i]; return b; }
function colorOf(a) { if (a.military) return C_MILITARY; var b = bandOf(a.misery); return b ? b.color : C_UNSCORED; }
function dotPx(mov) { if (!(mov > 0)) return 4; return Math.round(Math.min(22, 4 + Math.sqrt(mov))); }
function mins(v) { return v == null ? null : Math.round(v) + ' min'; }
function pct(v) { return v == null ? null : Math.round(v * 100) + '%'; }
function when(iso) { if (!iso) return null; var a = WG.ago(iso); return a === 'now' ? 'just now' : a + ' ago'; }
function windowText(a) {
  if (!a.window_start_at || !a.window_end_at) return null;
  var s = String(a.window_start_at), e = String(a.window_end_at);
  return s.slice(11, 16) + '–' + e.slice(11, 16) + 'Z (feed window, ends ' + when(a.window_end_at) + ')';
}
function signed(v, unit) { if (v == null) return null; return (v > 0 ? '+' : '') + (Math.round(v * 10) / 10) + (unit || ''); }


/* ── the glyph: a rounded square, cached per (size, fill, outline, style) ── */
var glyphCache = {};
function squareGlyph(px, fill, outline, style) {
  var key = px + '|' + fill + '|' + outline + '|' + (style || '');
  if (glyphCache[key]) return glyphCache[key];
  var pad = 3, w = px + pad * 2, c = document.createElement('canvas'); c.width = w; c.height = w;
  var g = c.getContext('2d'), r = Math.max(2, Math.round(px / 5));
  g.beginPath(); g.moveTo(pad + r, pad); g.lineTo(pad + px - r, pad); g.quadraticCurveTo(pad + px, pad, pad + px, pad + r);
  g.lineTo(pad + px, pad + px - r); g.quadraticCurveTo(pad + px, pad + px, pad + px - r, pad + px); g.lineTo(pad + r, pad + px);
  g.quadraticCurveTo(pad, pad + px, pad, pad + px - r); g.lineTo(pad, pad + r); g.quadraticCurveTo(pad, pad, pad + r, pad); g.closePath();
  g.fillStyle = fill; g.fill(); g.lineWidth = style === 'thin' ? 1 : 1.5; g.strokeStyle = outline; g.stroke();
  if (style === 'cross') {   // military: a white cross so the violet square reads as "base" even when tiny
    g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = Math.max(1.5, px / 6); var m = pad + px / 2, a = px * 0.28;
    g.beginPath(); g.moveTo(m - a, m); g.lineTo(m + a, m); g.moveTo(m, m - a); g.lineTo(m, m + a); g.stroke();
  }
  glyphCache[key] = c; return c;
}
var LABEL_NEAR = new Cesium.DistanceDisplayCondition(0, 2.5e6);
function codeLabel(a, px, col, text, far) {
  return { text: text, font: (far ? '12px' : '11px') + ' monospace', fillColor: C(col), outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -(px / 2 + 9)), distanceDisplayCondition: far || LABEL_NEAR };
}

/* ── the card ── */
WG.card('misery', function (x) {
  var a = x.a, b = bandOf(a.misery), col = colorOf(a);
  var head = (a.military ? 'Military airbase' : 'Airport') + ' · ' + (a.misery != null ? 'misery ' + Math.round(a.misery) + ' · ' + b.word : a.military ? 'no commercial data' : 'not scored');
  var h = '<div class="h" style="color:' + col + '">' + esc(head) + '</div><div class="ct">' + esc(a.name || a.icao) + '</div>';
  var rows = [['codes', (a.iata ? a.iata + ' · ' : '') + a.icao], ['where', [a.city, a.country].filter(Boolean).join(', ')]];
  if (!a.military) rows.push(['flights in window', a.movements != null ? a.movements + ' scheduled (' + (a.departures_total != null ? a.departures_total : '?') + ' departures · ' + (a.arrivals_total != null ? a.arrivals_total : '?') + ' arrivals)' : null]);
  if (!a.military) rows.push(['cancelled', a.cancelled != null && a.movements ? a.cancelled + ' (' + (a.departures_cancelled || 0) + ' dep · ' + (a.arrivals_cancelled || 0) + ' arr' + (a.cancel_rate != null ? ' · ' + pct(a.cancel_rate) : '') + ')' : null]);
  if (!a.military) rows.push(['delays', a.median_delay_min != null ? 'median ' + mins(a.median_delay_min) + ' (dep ' + (a.departures_median_delay_min != null ? signed(a.departures_median_delay_min, 'm') : '—') + ' · arr ' + (a.arrivals_median_delay_min != null ? signed(a.arrivals_median_delay_min, 'm') : '—') + ')' + (a.delay_index != null ? ' · index ' + (Math.round(a.delay_index * 100) / 100) + '/5' : '') : null]);
  (a.faa || []).forEach(function (p) { rows.push(['FAA ' + p.label, p.title + (p.detail ? ' — ' + p.detail : '') + (p.ends_at ? ' · until ' + p.ends_at.slice(11, 16) + 'Z' : '')]); });
  if (a.faa && a.faa.length && a.misery != null && a.misery < 40) rows.push(['note', 'The score counts flights that have already moved; flights held by the FAA reach it only when they depart or land.']);
  if (a.misery == null) rows.push(['why no score', REASON[a.misery_reason] || a.misery_reason || 'unknown']);
  if (a.vs_normal != null) rows.push(['vs normal', signed(a.vs_normal) + ' against the ' + (a.baseline_granularity === 'day_of_week' ? 'same-weekday' : 'flat') + ' baseline (' + a.baseline_maturity + ', ' + a.baseline_samples + ' samples)']);
  else if (a.misery != null) rows.push(['vs normal', 'no baseline yet']);
  if (a.program_type) rows.push(['programme', a.program_type + (a.lifecycle ? ' · ' + a.lifecycle : '')]);
  rows.push(['sweep status', a.obs_status ? a.obs_status + (a.obs_status_reason ? ' · ' + a.obs_status_reason : '') : null]);
  rows.push(['window', windowText(a)]);
  rows.push(['observed', a.observed_at ? when(a.observed_at) : null]);
  rows.push(['registry', (a.category || '') + ' · tier ' + a.monitor_tier + ' · weight ' + a.business_travel_weight]);
  rows.push(['rule', a.rule_id ? a.rule_id + ' ' + a.rule_version : null]);
  h += WG.kvs(rows);
  if (!a.military) h += '<pre>The feed gives a median delay and a 0–5 index per window, not a count of delayed flights; cancellations are counted.</pre>';
  if (a.misery != null) h += '<pre>45 × min(1, median/60) + 30 × min(1, index/4) + 25 × min(1, cancelled%/20), × min(1, flights/20) — our own index from the 15-minute sweep, not FlightAware\'s.</pre>';
  return { html: h, at: [a.lon, a.lat] };
});

/* ── the gauge: ONE line in the top bar, next to the feeds list (2026-10-16, Ted: the 3-line strip covered the map) ──
 * "MISERY 13 calm · 284/666 · 17 mis · 9 sev · −0.2/1h ▁▂▃" — counts, cancellations and the method live in the tooltip. */
function ensureGauge() {
  var el = document.getElementById("misery-gauge");
  if (el) return el;
  var host = document.getElementById("feeds"); if (!host || !host.parentNode) return null;
  el = document.createElement("a"); el.id = "misery-gauge"; el.href = "/travelrisk/misery"; el.target = "_blank"; el.rel = "noopener";
  el.style.cssText = "display:flex;align-items:center;gap:5px;font-size:10px;line-height:1;white-space:nowrap;color:#94a3b8;text-decoration:none;cursor:pointer";
  host.parentNode.insertBefore(el, host.nextSibling);
  return el;
}
function drawSpark(canvas, series) {
  var ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height; ctx.clearRect(0, 0, w, h);
  var pts = series.filter(function (s) { return s.misery != null; }); if (pts.length < 2) return;
  var n = pts.length, step = (w - 3) / (n - 1), top = 1, span = h - 4;   // the 0–100 scale compressed so a calm 13 is still a visible line
  var y = function (m) { return top + span - Math.min(100, m) / 100 * span; };
  BANDS.slice(1).forEach(function (b) { ctx.strokeStyle = b.color; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.moveTo(0, y(b.from)); ctx.lineTo(w, y(b.from)); ctx.stroke(); });
  ctx.globalAlpha = 1; ctx.lineWidth = 1.2; ctx.strokeStyle = "#e2e8f0"; ctx.beginPath();
  pts.forEach(function (s, i) { if (i) ctx.lineTo(i * step, y(s.misery)); else ctx.moveTo(0, y(s.misery)); });
  ctx.stroke();
  var last = pts[n - 1], lb = bandOf(last.misery); ctx.fillStyle = lb ? lb.color : "#e2e8f0"; ctx.beginPath(); ctx.arc((n - 1) * step, y(last.misery), 2, 0, Math.PI * 2); ctx.fill();
}
function renderGauge(g, meta) {
  var el = ensureGauge(); if (!el) return;
  var now = g && g.now, series = (g && g.series) || [];
  if (!now || now.misery == null) { el.innerHTML = "<b style=\"color:#e2e8f0\">MISERY</b> <span>— no scored sweep in 24 h</span>"; el.title = "Travel misery: no scored sweep in the last 24 hours"; return; }
  var b = bandOf(now.misery), prev = series.length > 4 ? series[series.length - 5] : null;   // ~1 h earlier at 15-min sweeps
  var trend = prev && prev.misery != null ? signed(now.misery - prev.misery) + "/1h" : "";
  el.innerHTML = "<b style=\"color:#e2e8f0;letter-spacing:.06em\">MISERY</b>"
    + " <b style=\"color:" + b.color + ";font-size:12px\">" + Math.round(now.misery) + "</b><span style=\"color:" + b.color + "\">" + b.word + "</span>"
    + "<span>· " + now.airports_scored + "/" + now.airports_total + " · " + now.miserable_airports + " mis · " + now.severe_airports + " sev" + (trend ? " · " + trend : "") + "</span>"
    + "<canvas id=\"misery-spark\" width=\"72\" height=\"14\" style=\"display:block;width:72px;height:14px;opacity:.9\"></canvas>";
  el.title = "Travel misery " + now.misery.toFixed(1) + " (" + b.word + "): flight-weighted mean of every scored airport in the latest 15-minute sweep · "
    + now.airports_scored + " of " + now.airports_total + " registry airports scored · " + now.miserable_airports + " miserable (≥40) · " + now.severe_airports + " severe (≥60)"
    + (now.cancelled != null ? " · " + now.cancelled + " cancellations in window" : "") + (trend ? " · " + trend.replace("/1h", " vs 1 h ago") : "")
    + " · sparkline = last 24 h · sweep " + when(now.observed_at) + " · click for the Travel Misery dashboard (new tab); click any square for that airport";
  var cv = document.getElementById("misery-spark"); if (cv) drawSpark(cv, series);
}

/* ── the layer ── */
function loadMisery(src) {
  return fetch('/api/roc-misery', { signal: AbortSignal.timeout(25000) })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error((d && d.error) || ('HTTP ' + r.status)); return d; }); })
    .then(function (d) {
      var list = d.airports || []; if (!list.length) throw new Error('empty misery payload');
      src.entities.removeAll();
      var counts = { scored: 0, unscored: 0, military: 0 }, bands = {}, watch = [];
      list.forEach(function (a) {
        if (a.lat == null || a.lon == null) return;
        var id = 'mi:' + a.icao, col = colorOf(a), px = dotPx(a.movements), pos = Cesium.Cartesian3.fromDegrees(a.lon, a.lat);
        WG.put(id, { kind: 'misery', a: a });
        if (a.military) {
          counts.military++;
          src.entities.add({ id: id, position: pos, billboard: { image: squareGlyph(9, C_MILITARY, '#0f172a', 'cross'), verticalOrigin: Cesium.VerticalOrigin.CENTER },
            label: codeLabel(a, 9, C_MILITARY, a.iata || a.icao) });
          return;
        }
        if (a.misery == null) {
          counts.unscored++;
          src.entities.add({ id: id, position: pos, billboard: { image: squareGlyph(px, '#1e293b', C_UNSCORED, 'thin'), verticalOrigin: Cesium.VerticalOrigin.CENTER },
            label: codeLabel(a, px, C_UNSCORED, faaTag(a) + (a.iata || a.icao)) });
          return;
        }
        counts.scored++; var b = bandOf(a.misery); bands[b.band] = (bands[b.band] || 0) + 1;
        var far = a.misery >= 60 ? new Cesium.DistanceDisplayCondition(0, 1.2e7) : a.misery >= 40 ? new Cesium.DistanceDisplayCondition(0, 5.0e6) : null;
        src.entities.add({ id: id, position: pos, billboard: { image: squareGlyph(px, col, '#0f172a'), verticalOrigin: Cesium.VerticalOrigin.CENTER },
          label: codeLabel(a, px, col, faaTag(a) + (a.iata || a.icao) + (a.misery >= 40 ? ' ' + Math.round(a.misery) : ''), far) });
        if (a.misery >= 60) {
          src.entities.add({ id: id + ':halo', position: pos, ellipse: { semiMajorAxis: WG.pulse(2600, 50000, 140000), semiMinorAxis: WG.pulse(2600, 50000, 140000), material: C(col, 0.18), outline: false, height: 0 } });
        }
        if (a.misery >= 40) watch.push({ rank: 40 + Math.min(40, a.misery * 0.4) + Math.min(10, (a.movements || 0) / 30), kind: 'MISERY · ' + b.word.toUpperCase(), color: col,
          title: (a.name || a.icao) + ' (' + (a.iata || a.icao) + ')', sub: 'misery ' + Math.round(a.misery) + ' · ' + (a.movements || 0) + ' movements · ' + (a.cancelled || 0) + ' cancelled' + (a.median_delay_min != null ? ' · median ' + mins(a.median_delay_min) : '') + (a.vs_normal != null ? ' · ' + signed(a.vs_normal) + ' vs normal' : ''),
          lon: a.lon, lat: a.lat, h: 900000, id: id });
      });
      watch.sort(function (x, y) { return y.rank - x.rank; });
      WG.watch('misery', watch.slice(0, 6));
      renderGauge(d.global, d.meta);
      var m = d.meta || {}, g = d.global && d.global.now;
      var note = (g && g.misery != null ? 'global ' + Math.round(g.misery) + ' (' + bandOf(g.misery).word + ') · ' : '') + counts.scored + ' scored';
      note += ['severe', 'miserable', 'slow'].filter(function (k) { return bands[k]; }).map(function (k) { return ' · ' + bands[k] + ' ' + k; }).join('');
      note += ' · ' + counts.unscored + ' unscored · ' + counts.military + ' military';
      WG.feed('misery', true, list.length, m.newest_observed_at || m.generatedAt, note);
    });
}

// 2026-10-16 (Ted): this IS the airports layer now — listed first, named like the one it replaced.
/** Live FAA programme, strongest first ("GS ", "GDP ", "CLSD "), prefixed to the code label — beside the score, never in it. */
function faaTag(a) { var p = a.faa && a.faa[0]; return p && /^(CLSD|GS|GDP|DLY)$/.test(p.label) && p.label !== 'DLY' ? p.label + ' ' : ''; }

WG.addLayer({ id: 'misery', label: 'Airports & delays', color: '#18BC9C', on: true, first: true, refreshMs: 5 * 60e3, load: loadMisery });
})();
