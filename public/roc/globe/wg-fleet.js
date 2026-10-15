/* =========================================================================
 * wg-fleet.js — the rest of the ROC fleet, as World Glass plugin layers.
 *
 *   nathaz     Natural hazards (ovix-api events: USGS/EMSC quakes, GDACS, NOAA tsunami, NASA EONET/FIRMS,
 *              Smithsonian volcanoes, NWS/SPC/MeteoAlarm warnings). Hue = kind, size = severity
 *              (magnitude for quakes). Filled = located at the event; HOLLOW = the upstream placed it
 *              at a zone/region/country centroid (approximate), grouped per centroid.
 *   rail       Unplanned rail disruption (rail-probe: SNCB/NMBS via iRail). Matched stations are drawn
 *              and joined by a straight line (not the track); unmatched notices sit at a country
 *              centroid, hollow and marked approximate.
 *   opregions  The 43 ovix op-risk region nodes (5 macro + 38 sub). NOT a choropleth: the taxonomy is
 *              not a partition of the earth (see RegionRiskMap.tsx). One hue, magnitude = column
 *              height (a bar, per riskAxes.ts); a node with no domain reading is a hollow slate ring
 *              and says "no reading". Confidence (how many of 12 domains read, settled/provisional)
 *              is printed beside the score, never folded into its colour.
 *
 * All data comes through the same-origin proxy /api/gev-fleet (contract in its route.ts).
 * Honesty (hub-051): a failed read is a GAP, never an empty calm layer; below-floor and capped
 * items are counted in the feed note.
 * ====================================================================== */
(function () {
'use strict';
var WG = window.WG; if (!WG) return;
var Cesium = WG.Cesium, C = WG.C, esc = WG.esc;

var KIND = {
  quake:    { c: '#f5d0fe', w: 'Earthquake' },   volcano: { c: '#d6a77a', w: 'Volcano' },
  wildfire: { c: '#fb7185', w: 'Wildfire' },     flood:   { c: '#60a5fa', w: 'Flood' },
  tsunami:  { c: '#2dd4bf', w: 'Tsunami' },      cyclone: { c: '#ec4899', w: 'Tropical cyclone' },
  storm:    { c: '#c4b5fd', w: 'Severe storm' }, weather: { c: '#a5b4fc', w: 'Weather warning' },
  drought:  { c: '#d6d3d1', w: 'Drought' }
};
var INDEX_HUE = '#22d3ee', SLATE = '#94a3b8', RAIL = '#a3e635';
function kindOf(k) { return KIND[k] || KIND.weather; }
function getJ(layer, ms) {
  return fetch('/api/gev-fleet?layer=' + layer, { signal: AbortSignal.timeout(ms || 30000) })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error((d && d.error) || ('HTTP ' + r.status)); return d; }); });
}
function link(u, t) { return u && /^https?:\/\//.test(u) ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(t) + '</a>' : null; }
function when(iso) { if (!iso) return null; var a = WG.ago(iso); return a === 'now' ? 'just now' : a + ' ago'; }

/* NWS Active Warnings dashboard (Ted, 2026-10-15): every NWS warning and every covered region on the board
 * opens the dashboard we built — scrolling warnings, airports impacted — never a raw alert record and never
 * the retired region window. Mirrors src/lib/travelrisk/nwsHref.ts and ovix-api SUB_REGIONS. */
var NWS_NODES = [
  ['us-northeast', ['NY','NJ','CT','MA','PA','ME','NH','VT','RI','DE','MD']],
  ['us-southeast', ['GA','FL','NC','SC','VA','TN','AL','MS','LA','KY','WV']],
  ['us-midwest', ['IL','OH','MI','IN','WI','MN','IA','MO','KS','NE','ND','SD']],
  ['us-south-central', ['TX','OK','AR']],
  ['us-mountain', ['AZ','CO','NM','NV','UT','WY','MT','ID']],
  ['us-west-coast', ['CA','OR','WA']]
];
function nwsHref(node) { return '/travelrisk/region/' + encodeURIComponent(node || 'global') + '/nws'; }
function isNws(h) { return /^NWS/.test(h.src || '') || /^https?:\/\/(api|alerts)\.weather\.gov\//i.test(h.url || ''); }
/* "Henderson, NC; Transylvania, NC" → the sub-region that holds NC; nothing recognisable → the general dashboard. */
function nwsNodeFor(areaDesc) {
  var segs = String(areaDesc || '').split(';');
  for (var i = 0; i < segs.length; i++) {
    var m = /,\s*([A-Z]{2})\s*$/.exec(segs[i].trim());
    if (!m) continue;
    for (var j = 0; j < NWS_NODES.length; j++) if (NWS_NODES[j][1].indexOf(m[1]) >= 0) return NWS_NODES[j][0];
  }
  return null;
}
/* A region node NWS covers: the six US sub-regions in full, North America in part. Elsewhere there is no panel. */
function nwsNodeOf(n) {
  if (n.id === 'north-america') return n.id;
  for (var i = 0; i < NWS_NODES.length; i++) if (NWS_NODES[i][0] === n.id) return n.id;
  return null;
}
var SPACE_HREF = '/travelrisk/region/global/space'; // planetary: one dashboard (2026-10-15)
function nwsLink(h) { return isNws(h) ? '<a href="' + nwsHref(nwsNodeFor(h.area)) + '" target="_blank" rel="noopener">NWS Active Warnings ↗</a>' : null; }
function bar(v) { var p = Math.max(0, Math.min(100, (v / 10) * 100)); return '<span style="display:inline-block;vertical-align:middle;width:90px;height:7px;background:#1e293b;border-radius:2px;margin-right:6px"><span style="display:block;height:7px;width:' + p.toFixed(0) + '%;background:' + INDEX_HUE + ';border-radius:2px"></span></span>'; }
function floorNote(f) { var k = Object.keys(f || {}); return k.length ? k.map(function (x) { return f[x] + ' ' + x; }).join('; ') : 'none'; }

/* airports, for "nearest airport" on watch items and cards (same-origin, already edge-cached) */
var airports = null;
function loadAirports() {
  if (airports) return Promise.resolve(airports);
  return fetch('/api/roc-airports', { signal: AbortSignal.timeout(20000) }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { var l = (d && (d.airports || d.rows || d.data)) || []; airports = l.map(function (a) { return { code: a.iata || a.icao, name: a.name, lat: WG.num(a.lat != null ? a.lat : a.latitude), lon: WG.num(a.lon != null ? a.lon : a.longitude) }; }).filter(function (a) { return a.lat != null && a.lon != null && a.code; }); return airports; })
    .catch(function () { return []; });
}
function km(aLat, aLon, bLat, bLon) { var r = Math.PI / 180, dLa = (bLat - aLat) * r, dLo = (bLon - aLon) * r; var h = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2); return 12742 * Math.asin(Math.sqrt(h)); }
function nearestAirport(lat, lon, maxKm) {
  var best = null; (airports || []).forEach(function (a) { var d = km(lat, lon, a.lat, a.lon); if (d <= maxKm && (!best || d < best.d)) best = { a: a, d: d }; });
  return best ? best.a.code + ' ' + Math.round(best.d) + ' km' : null;
}

/* =========================================================================
 * NATURAL HAZARDS
 * ====================================================================== */
WG.card('fleetHazard', function (x) {
  var h = x.h, k = kindOf(h.kind), near = nearestAirport(h.lat, h.lon, 300);
  var html = '<div class="h" style="color:' + k.c + '">' + esc(k.w) + ' · ' + esc(h.src) + (h.label ? ' · ' + esc(h.label) : '') + '</div><div class="ct">' + esc(h.title) + '</div>' + WG.kvs([
    ['magnitude', h.mag != null ? 'M' + h.mag : null], ['GDACS alert', h.gdacs ? h.gdacs + (h.gdacsNote ? ' · ' + h.gdacsNote : '') : null],
    ['severity', h.sev != null ? h.sev + ' / 10 (ovix scale)' : null], ['area', h.area],
    ['location', h.approx ? 'APPROXIMATE — placed at the ' + (h.precision || 'area') + ' centroid by the source, not at the event' : 'as reported (' + WG.num(h.lat).toFixed(2) + ', ' + WG.num(h.lon).toFixed(2) + ')'],
    ['nearest airport', near ? near + ' (registry)' : 'none within 300 km'], ['occurred', when(h.at)], ['expires', h.expires ? h.expires.slice(0, 16).replace('T', ' ') + 'Z' : null],
    ['dashboard', nwsLink(h), true], ['source', link(h.url, h.src + (isNws(h) ? ' record (json)' : ' record')), true]]) + (h.detail ? '<pre>' + esc(h.detail) + '</pre>' : '');
  return { html: html, at: [h.lon, h.lat] };
});
WG.card('fleetHazardGroup', function (x) {
  var g = x.g, k = kindOf(g.items[0].kind);
  var html = '<div class="h" style="color:' + k.c + '">' + esc(g.items[0].src) + ' · ' + g.items.length + ' warning' + (g.items.length === 1 ? '' : 's') + ' · APPROXIMATE</div><div class="ct">' + esc(g.where) + '</div>'
    + '<pre>Placed at the ' + esc(g.items[0].precision || 'area') + ' centroid the source publishes. The warnings below are for areas inside it, not for this point.</pre>'
    + g.items.slice(0, 14).map(function (h) { var kk = kindOf(h.kind); return '<div style="margin:3px 0"><span style="color:' + kk.c + '">' + esc(h.label || kk.w) + '</span> · ' + (isNws(h) ? '<a href="' + nwsHref(nwsNodeFor(h.area)) + '" target="_blank" rel="noopener">' + esc(h.title) + '</a>' + (link(h.url, 'json') ? ' <span style="font-size:10px">' + link(h.url, 'json') + '</span>' : '') : (link(h.url, h.title) || esc(h.title))) + (h.area ? ' <span style="color:' + SLATE + '">(' + esc(h.area.slice(0, 80)) + ')</span>' : '') + (h.expires ? ' <span style="color:' + SLATE + '">until ' + esc(h.expires.slice(5, 16).replace('T', ' ')) + 'Z</span>' : '') + '</div>'; }).join('')
    + (g.items.length > 14 ? '<div style="color:' + SLATE + '">+ ' + (g.items.length - 14) + ' more</div>' : '');
  return { html: html, at: [g.lon, g.lat] };
});
function loadHazards(src) {
  return Promise.all([getJ('hazards', 40000), loadAirports()]).then(function (res) {
    var d = res[0], items = d.items || [], meta = d.meta || {};
    if (!Array.isArray(d.items)) throw new Error('no hazard payload');
    src.entities.removeAll();
    var groups = {}, watch = [], drawn = 0;
    items.forEach(function (h) {
      if (h.approx) {   // approximate: group per published centroid, drawn hollow
        var gk = h.src + '|' + h.lat.toFixed(1) + '|' + h.lon.toFixed(1);
        (groups[gk] = groups[gk] || { key: gk, lat: h.lat, lon: h.lon, items: [] }).items.push(h);
      } else {
        var k = kindOf(h.kind), id = 'nh:' + h.id, pos = Cesium.Cartesian3.fromDegrees(h.lon, h.lat);
        var size = h.mag != null ? Math.max(6, Math.min(22, 5 + (h.mag - 4) * 3.4)) : 6 + Math.max(0, h.sev - 4);
        WG.put(id, { kind: 'fleetHazard', h: h }); drawn++;
        src.entities.add({ id: id, position: pos, point: { pixelSize: size, color: C(k.c, 0.85), outlineColor: C('#0b1220'), outlineWidth: 1.2 } });
        if (h.sev >= 8 || (h.mag != null && h.mag >= 6)) src.entities.add({ id: id + ':ring', position: pos,
          ellipse: { semiMajorAxis: WG.pulse(3200, 60000, 320000), semiMinorAxis: WG.pulse(3200, 60000, 320000), material: C(k.c, 0.0001), outline: true, outlineColor: C(k.c, 0.75), outlineWidth: 2, height: 0 } });
        if (h.mag != null && h.mag >= 6) src.entities.add({ id: id + ':lbl', position: pos, label: { text: 'M' + h.mag, font: '12px monospace', fillColor: C(k.c), outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -16), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1.2e7) } });
      }
      // watch: M6+ quakes, GDACS orange/red, tsunami threat messages, extreme warnings
      var near = nearestAirport(h.lat, h.lon, 250), k2 = kindOf(h.kind), r = 0, why = '';
      if (h.kind === 'quake' && h.mag >= 6) { r = 60 + (h.mag - 6) * 10 + (near ? 4 : 0); why = 'M' + h.mag; }
      else if (/^(orange|red)$/i.test(h.gdacs || '')) { r = /red/i.test(h.gdacs) ? 74 : 62; why = 'GDACS ' + h.gdacs.toUpperCase(); }
      else if (h.kind === 'tsunami') { r = 78; why = h.label || 'tsunami'; }
      else if (/extreme/i.test(h.label || '')) { r = 56; why = 'EXTREME'; }
      if (r) watch.push({ rank: r, kind: k2.w.toUpperCase() + ' · ' + why, color: k2.c, title: h.title,
        sub: [h.src, h.gdacs && h.gdacsNote ? 'GDACS ' + h.gdacs + ': ' + h.gdacsNote : null, near ? 'near ' + near : null, h.approx ? 'approx. location' : null, when(h.at)].filter(Boolean).join(' · '),
        lon: h.lon, lat: h.lat, h: 1800000, id: h.approx ? null : 'nh:' + h.id });
    });
    Object.keys(groups).forEach(function (gk, i) {
      var g = groups[gk], k = kindOf(g.items[0].kind), id = 'ng:' + i;
      g.items.sort(function (a, b) { return b.sev - a.sev; });
      g.where = g.items[0].src + ' — ' + (g.items[0].area || g.items[0].title).split(/[;,]/)[0].slice(0, 60) + (g.items.length > 1 ? ' and nearby areas' : '');
      WG.put(id, { kind: 'fleetHazardGroup', g: g }); drawn += g.items.length;
      watch.forEach(function (w) { if (!w.id && Math.abs(w.lat - g.lat) < 0.06 && Math.abs(w.lon - g.lon) < 0.06) w.id = id; });
      var pos = Cesium.Cartesian3.fromDegrees(g.lon, g.lat);
      src.entities.add({ id: id, position: pos, point: { pixelSize: Math.min(18, 8 + g.items.length), color: C(k.c, 0.04), outlineColor: C(k.c, 0.95), outlineWidth: 2 } });
      src.entities.add({ id: id + ':lbl', position: pos, label: { text: '≈' + (g.items.length > 1 ? ' ' + g.items.length : ''), font: '11px monospace', fillColor: C(k.c), outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -14), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 9e6) } });
    });
    WG.watch('nathaz', watch.sort(function (a, b) { return b.rank - a.rank; }).slice(0, 6));
    var dead = Object.keys(meta.sources || {}).filter(function (s) { return /STALE|DEAD/.test(meta.sources[s].status); });
    var failed = meta.failed || [];
    WG.feed('nathaz', failed.length === 0, drawn, meta.fetched_at,
      (failed.length ? 'PARTIAL — no answer from: ' + failed.join(', ') + '. ' : '') + drawn + ' drawn (cap ' + (meta.cap || '?') + '), ' + Object.keys(groups).length + ' approximate centroid groups (hollow). '
      + (dead.length ? 'Upstream sources not reporting (ovix feed-health): ' + dead.map(function (s) { return s + ' ' + meta.sources[s].status; }).join(', ') + ' — absence there is a gap, not calm. ' : '')
      + ((meta.truncated || []).length ? 'Upstream row cap reached: ' + meta.truncated.join(', ') + '. ' : '')
      + 'Not drawn: ' + floorNote(meta.floored) + '.');
  });
}

/* =========================================================================
 * RAIL DISRUPTION
 * ====================================================================== */
var railMeta = null;
WG.card('fleetRail', function (x) {
  var r = x.r, at = r.points.length ? [r.points[0].lon, r.points[0].lat] : r.centroid ? [r.centroid.lon, r.centroid.lat] : null;
  var html = '<div class="h" style="color:' + RAIL + '">Rail · ' + esc(r.operator || 'operator') + ' · ' + esc(r.kind || '') + '</div><div class="ct">' + esc(r.title) + '</div>' + WG.kvs([
    ['location', r.approx ? 'APPROXIMATE — ' + (r.centroid ? r.centroid.what : 'country centroid') : 'stations matched ' + r.matched + (r.points.length > 1 ? '; line drawn straight between them, not along the track' : '')],
    ['stations', r.points.map(function (p) { return p.name; }).join(' · ') || null], ['severity', r.severity != null ? r.severity + ' / 10 (rail-probe rule)' : null],
    ['coverage', railMeta ? railMeta.coverage : null], ['source', link(r.url, 'operator notice'), true]]) + (r.message ? '<pre>' + esc(r.message) + '</pre>' : '');
  return { html: html, at: at };
});
function loadRail(src) {
  return getJ('rail', 35000).then(function (d) {
    var meta = d.meta || {}, items = d.items || [], failed = meta.failed || [];
    if (!Array.isArray(d.items)) throw new Error('no rail payload');
    railMeta = meta; src.entities.removeAll();
    var watch = [];
    items.forEach(function (r) {
      var id = 'rl:' + r.id.replace(/^rl:/, ''), anchor;
      WG.put(id, { kind: 'fleetRail', r: r });
      if (r.points.length) {
        r.points.forEach(function (p, j) { var sid = j ? id + ':s' + j : id; if (j) WG.put(sid, { kind: 'fleetRail', r: r }); src.entities.add({ id: sid, position: Cesium.Cartesian3.fromDegrees(p.lon, p.lat), point: { pixelSize: 9, color: C(RAIL, 0.9), outlineColor: C('#0b1220'), outlineWidth: 1.2 } }); });
        if (r.points.length > 1) src.entities.add({ id: id + ':arc', polyline: { positions: Cesium.Cartesian3.fromDegreesArray([].concat.apply([], r.points.map(function (p) { return [p.lon, p.lat]; }))), width: 4, material: C(RAIL, 0.85), clampToGround: true } });
        anchor = r.points[0];
      } else if (r.centroid) {
        anchor = r.centroid;
        src.entities.add({ id: id, position: Cesium.Cartesian3.fromDegrees(anchor.lon, anchor.lat), point: { pixelSize: 15, color: C(RAIL, 0.04), outlineColor: C(RAIL), outlineWidth: 2 } });
        src.entities.add({ id: id + ':lbl', position: Cesium.Cartesian3.fromDegrees(anchor.lon, anchor.lat), label: { text: '≈ rail', font: '11px monospace', fillColor: C(RAIL), outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -16), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 6e6) } });
      }
      if (anchor && r.kind === 'unplanned' && (r.severity || 0) >= 8) watch.push({ rank: 48 + (r.approx ? 4 : 0), kind: 'RAIL · ' + (r.operator || '').split(' ')[0], color: RAIL, title: r.title,
        sub: (r.approx ? 'country-wide / approx. location' : r.points.map(function (p) { return p.name.split('/')[0]; }).join(' – ')), lon: anchor.lon, lat: anchor.lat, h: 600000, id: id });
    });
    WG.watch('rail', watch.slice(0, 3));
    WG.feed('rail', failed.length === 0, items.length, meta.fetched_at,
      (failed.length ? 'GAP — no answer from: ' + failed.join(', ') + '. ' : '') + items.length + ' unplanned disruption(s); ' + (meta.planned_dropped != null ? meta.planned_dropped + ' planned works not drawn. ' : '') + (meta.coverage || ''));
  });
}

/* =========================================================================
 * REGIONAL OPERATIONAL RISK (ovix op-risk index, 43 nodes)
 * ====================================================================== */
WG.card('fleetRegion', function (x) {
  var n = x.n, read = (n.domains || []).length, b = n.basis || {};
  // The region window is retired (Ted, 2026-10-15). A region NWS covers opens its NWS Active Warnings
  // dashboard in a new tab; the weather domain row goes there too. Other domains have no panel yet.
  var win = nwsNodeOf(n) ? nwsHref(nwsNodeOf(n)) : null;
  var head = '<div class="h" style="color:' + INDEX_HUE + '">Op-risk index · ' + esc(n.tier === 'macro' ? 'macro region' : 'sub-region') + '</div><div class="ct">' + esc(n.name) + '</div>'
    + (win ? '<div style="margin:4px 0 6px"><a href="' + win + '" target="_blank" rel="noopener" style="color:' + INDEX_HUE + ';font-weight:700">Open NWS Active Warnings ↗</a></div>'
      : '<div style="margin:4px 0 6px;color:' + SLATE + '">NWS Active Warnings covers the United States only.</div>')
    + '<div style="margin:0 0 6px"><a href="' + SPACE_HREF + '" target="_blank" rel="noopener" style="color:' + INDEX_HUE + ';font-weight:700">Open Space Weather ↗</a> <span style="color:' + SLATE + '">(planetary — HF radio, GNSS, polar routes)</span></div>';
  if (!n.reachable) return { html: head + '<pre>No answer from ovix-api for this region on the last read. This is a gap, not a calm region.</pre>', at: [n.lon, n.lat] };
  var html = head + WG.kvs([
    ['composite', n.composite != null ? bar(n.composite) + esc(n.composite.toFixed(1)) + ' / 10 · ' + esc(n.level || '') : 'NO READING — no domain has events in this region', true],
    ['confidence', 'reading on ' + read + ' of 12 domains' + (b.settled != null ? ' (settled ' + b.settled + ', provisional ' + (b.provisional || 0) + ')' : '') + ' · state ' + (n.state || '?')],
    ['no reading', (n.noReading || []).join(', ') || null], ['updated', when(n.updated)]])
    + (read ? '<div class="h" style="margin-top:8px">Domains with a reading · drivers</div>' + n.domains.map(function (d) {
      return '<div style="margin:4px 0">' + bar(d.score) + (win && d.domain === 'weather' ? '<a href="' + win + '" target="_blank" rel="noopener">weather ↗</a>' : d.domain === 'infrastructure' ? '<a href="' + SPACE_HREF + '" target="_blank" rel="noopener">infrastructure ↗</a>' : esc(d.domain)) + ' ' + esc((d.score != null ? d.score.toFixed(1) : '?') + ' ' + (d.level || '') + (d.state === 'PROVISIONAL' ? ' · provisional' : '') + (d.events != null ? ' · ' + d.events + ' events' : ''))
        + (d.top ? '<div style="color:' + SLATE + ';margin-left:96px">' + esc(d.top) + (d.topSource ? ' — ' + esc(d.topSource) : '') + '</div>' : '') + '</div>'; }).join('') : '')
    + '<pre>A provisional index ranked from event volume, not a checked operational state: magnitude is drawn as column height in one hue, and red/amber stay reserved for things checked and found impaired. A region with few domains reading can score high on one driver. Regions are a business taxonomy, not a partition of the map: empty ground is unscored, not safe.</pre>';
  return { html: html, at: [n.lon, n.lat] };
});
function loadRegions(src) {
  return getJ('regions', 40000).then(function (d) {
    var meta = d.meta || {}, nodes = d.nodes || [], failed = meta.failed || [];
    if (!nodes.length) throw new Error(failed.join(', ') || 'no region payload');
    src.entities.removeAll();
    var scored = 0, none = 0, watch = [];
    nodes.forEach(function (n) {
      if (n.lat == null || n.lon == null) return;
      var id = 'or:' + n.id, macro = n.tier === 'macro', base = Cesium.Cartesian3.fromDegrees(n.lon, n.lat);
      WG.put(id, { kind: 'fleetRegion', n: n });
      var far = new Cesium.DistanceDisplayCondition(0, macro ? 2.6e7 : 9e6);
      if (n.reachable && n.composite != null) {
        scored++;
        var len = Math.max(0.3, n.composite) * 70000, r = macro ? 70000 : 38000;
        src.entities.add({ id: id, position: Cesium.Cartesian3.fromDegrees(n.lon, n.lat, len / 2),
          cylinder: { length: len, topRadius: r, bottomRadius: r, material: C(INDEX_HUE, macro ? 0.22 : 0.38), outline: true, outlineColor: C(INDEX_HUE, 0.85),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(macro ? 4e6 : 1.6e6, Number.MAX_VALUE) } });
        // up close a 300 km column would wall off the view; it becomes a small marker instead
        src.entities.add({ id: id + ':halo', position: base, point: { pixelSize: macro ? 12 : 9, color: C(INDEX_HUE, 0.35), outlineColor: C(INDEX_HUE), outlineWidth: 1.5,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, macro ? 4e6 : 1.6e6) } });
        src.entities.add({ id: id + ':lbl', position: Cesium.Cartesian3.fromDegrees(n.lon, n.lat, len + 25000), label: { text: n.name + '  ' + n.composite.toFixed(1) + '  ' + (n.domains || []).length + '/12',
          font: (macro ? '13px' : '11px') + ' monospace', fillColor: C(INDEX_HUE), outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, distanceDisplayCondition: far } });
        if (n.level === 'HIGH') {
          var top = (n.domains || [])[0];
          watch.push({ rank: 50 + n.composite, kind: 'OP-RISK · HIGH', color: INDEX_HUE, title: n.name + ' ' + n.composite.toFixed(1) + '/10',
            sub: 'reading on ' + (n.domains || []).length + ' of 12 domains · ' + (n.state || '') + (top ? ' · top: ' + top.domain + (top.top ? ' — ' + top.top : '') : ''), lon: n.lon, lat: n.lat, h: macro ? 6000000 : 2500000, id: id });
        }
      } else {
        none++;
        src.entities.add({ id: id, position: base, point: { pixelSize: macro ? 14 : 10, color: C(SLATE, 0.04), outlineColor: C(SLATE), outlineWidth: 2 } });
        src.entities.add({ id: id + ':lbl', position: base, label: { text: n.name + (n.reachable ? '  no reading' : '  unreachable'), font: '11px monospace', fillColor: C(SLATE), outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -14), distanceDisplayCondition: far } });
      }
    });
    WG.watch('opregions', watch.sort(function (a, b) { return b.rank - a.rank; }).slice(0, 3));
    WG.feed('opregions', failed.length === 0, nodes.length, meta.updated || meta.fetched_at,
      (failed.length ? 'PARTIAL — ' + failed.join(', ') + '. ' : '') + scored + ' scored, ' + none + ' with no reading or unreachable (hollow). Column height = composite (one hue, not an alarm colour); metros ' + (meta.metros || 'not drawn') + '.');
  });
}

WG.addLayer({ id: 'nathaz', label: 'Natural hazards', color: '#fb7185', on: true, refreshMs: 5 * 60e3, load: loadHazards });
WG.addLayer({ id: 'rail', label: 'Rail disruption (BE)', color: RAIL, on: false, refreshMs: 5 * 60e3, load: loadRail });
WG.addLayer({ id: 'opregions', label: 'Regional op-risk index', color: INDEX_HUE, on: false, refreshMs: 10 * 60e3, load: loadRegions });

/* key + credits: appended, not edited, so the page's own markup stays untouched */
try {
  var lg = document.getElementById('legend');
  if (lg) {
    var div = document.createElement('div');
    var dot = function (c, t) { return '<b style="color:' + c + '">●</b> ' + t; };
    div.innerHTML = '<div class="row"><span>' + [dot('#f5d0fe', 'quake (size = mag)'), dot('#fb7185', 'wildfire'), dot('#60a5fa', 'flood'), dot('#d6a77a', 'volcano'), dot('#c4b5fd', 'storm'), dot('#a5b4fc', 'warning'), dot('#2dd4bf', 'tsunami')].join(' ') + ' · hollow ≈ = approximate (centroid)</span></div>'
      + '<div class="row"><span>' + dot('#a3e635', 'rail (straight line between stations)') + ' · ' + dot('#22d3ee', 'op-risk region: column = index') + ' · <b style="color:#94a3b8">○</b> no reading</span></div>';
    while (div.firstChild) lg.appendChild(div.firstChild);
  }
  var cr = document.getElementById('credits');
  if (cr) cr.appendChild(document.createTextNode(' · Hazards: USGS, EMSC, GDACS, NOAA, NASA EONET/FIRMS, Smithsonian GVP, NWS, MeteoAlarm via ovix · Rail: iRail (SNCB/NMBS)'));
} catch (e) { /* the key is a convenience; the layers do not depend on it */ }
})();
