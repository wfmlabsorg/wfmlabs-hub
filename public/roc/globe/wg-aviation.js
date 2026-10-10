/* World Glass plugin — aviation operations layer (roadmap Cycle 3).
 *
 * Two layers, both on by default, registered through window.WG (world-glass.html section 9):
 *   faa       FAA airport programs: ground stops, ground delay programs, airport closures, arrival and
 *             departure delays, deicing, and airspace flow programs, drawn as rings at the airport. Ring
 *             style says the program; the label carries cause, delay and expected end; the card every field.
 *   airspace  Airspace restrictions: country and FIR states from the roc airspace worker (FAA NOTAM,
 *             EASA conflict-zone bulletins, safeairspace.net) as translucent polygons. A FIR with no
 *             usable outline is a labelled marker that says "≈ boundary not drawn"; nothing is invented.
 *
 * Data: /api/gev-aviation?layer=faa|airspace (src/lib/gev-aviation.ts holds the parsing and licences).
 * FIR outlines: VATSIM vatspy-data-project, CC BY-SA 4.0 — attribution appended to #credits below.
 * Country outlines: Natural Earth (public domain). FAA NAS Status: US Government, public domain.
 *
 * Honesty (hub-051): a failed feed reports GAP through WG.feed; positions from a secondary source say
 * "approximate"; anything the server could not place is named in the feed note, never dropped silently.
 */
(function () {
  'use strict';
  var WG = window.WG;
  if (!WG) return;
  var Cesium = WG.Cesium, C = WG.C, esc = WG.esc;
  /** esc() covers text nodes; attribute values also need their quotes escaped */
  function attr(s) { return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function link(u, text) { return u && /^https:\/\//i.test(u) ? '<a href="' + attr(u) + '" target="_blank" rel="noopener">' + esc(text) + '</a>' : null; }
  function getJson(url, ms) {
    return fetch(url, { signal: AbortSignal.timeout(ms) }).then(function (r) {
      // a proxy or platform error page is HTML: report the status, not a JSON parse error
      if (!/application\/json/i.test(r.headers.get('content-type') || '')) throw new Error('HTTP ' + r.status + ' (non-JSON response)');
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; });
    });
  }
  /** "2026-10-10T22:00:00Z" → "22:00Z" today, "Oct 11 22:00Z" otherwise */
  function when(iso) {
    var t = Date.parse(iso); if (!isFinite(t)) return null;
    var d = new Date(t), now = new Date();
    var hm = ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2) + 'Z';
    if (d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() === now.getUTCDate()) return hm;
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()] + ' ' + d.getUTCDate() + (d.getUTCFullYear() !== now.getUTCFullYear() ? ' ' + d.getUTCFullYear() : '') + ' ' + hm;
  }
  function mins(m) { return m == null ? null : m >= 60 ? Math.floor(m / 60) + 'h' + (m % 60 ? ('0' + Math.round(m % 60)).slice(-2) : '') : Math.round(m) + 'm'; }
  /** a ring of positions `r` metres around a point (small-circle approximation, fine at airport scale) */
  function circle(lon, lat, r, h) {
    var pts = [], R = 6371000, la = lat * Math.PI / 180;
    for (var i = 0; i <= 72; i++) {
      var b = i / 72 * 2 * Math.PI;
      pts.push(Cesium.Cartesian3.fromDegrees(lon + (r / R) * Math.sin(b) / Math.max(0.05, Math.cos(la)) * 180 / Math.PI, lat + (r / R) * Math.cos(b) * 180 / Math.PI, h));
    }
    return pts;
  }
  function appendCredit(text) {
    var el = document.getElementById('credits');
    if (!el || el.getAttribute('data-wg-aviation')) return;
    el.setAttribute('data-wg-aviation', '1');
    el.appendChild(document.createTextNode(' · ' + text));
  }
  appendCredit('FAA NAS Status · FIR boundaries © VATSIM VATSpy data project (CC BY-SA 4.0) · Natural Earth');

  /* =====================================================================
   * FAA AIRPORT PROGRAMS
   * ================================================================== */
  var KIND = {
    ground_stop:     { label: 'Ground stop',          short: 'GS',    color: '#ef4444', width: 4,   dash: false },
    closure:         { label: 'Airport closure',      short: 'CLSD',  color: '#e879f9', width: 3,   dash: true },
    ground_delay:    { label: 'Ground delay program', short: 'GDP',   color: '#f59e0b', width: 3,   dash: false },
    arrival_delay:   { label: 'Arrival delays',       short: 'ARR',   color: '#facc15', width: 2,   dash: true },
    departure_delay: { label: 'Departure delays',     short: 'DEP',   color: '#facc15', width: 2,   dash: true },
    deicing:         { label: 'Deicing',              short: 'DEICE', color: '#7dd3fc', width: 1.5, dash: true }
  };
  var ORDER = ['ground_stop', 'closure', 'ground_delay', 'arrival_delay', 'departure_delay', 'deicing'];
  var AFP_COLOR = '#a78bfa';
  var LIFE = { live: 'in force', scheduled: 'scheduled', unknown: 'reported (feed gives no window)' };
  var LOC = { faa: 'FAA feed', registry: 'hub airport registry', vatspy: 'VATSpy airport list — approximate' };

  function progLine(p) {
    var k = KIND[p.kind], bits = [k.short + (p.lifecycle === 'scheduled' ? ' (sched)' : '') + (p.partial ? ' (partial)' : '')];
    if (p.kind === 'arrival_delay' || p.kind === 'departure_delay') bits.push(p.delay_min_min != null || p.max_delay_min != null ? (mins(p.delay_min_min) || '?') + '–' + (mins(p.max_delay_min) || '?') + (p.trend ? ' ' + String(p.trend).toLowerCase() : '') : null);
    else if (p.avg_delay_min != null) bits.push('avg ' + mins(p.avg_delay_min));
    if (p.cause) bits.push(String(p.cause).slice(0, 28));
    if (p.lifecycle === 'scheduled' && p.start) bits.push('from ' + when(p.start));
    else if (p.end) bits.push('to ' + when(p.end));
    return bits.filter(Boolean).join(' · ');
  }
  function progRows(p) {
    return WG.kvs([
      ['status', LIFE[p.lifecycle] || p.lifecycle], ['cause', p.cause],
      ['average delay', p.avg_delay_min != null ? mins(p.avg_delay_min) : null], ['maximum delay', p.max_delay_min != null ? mins(p.max_delay_min) : null],
      ['delay range', p.delay_min_min != null ? mins(p.delay_min_min) + ' – ' + (mins(p.max_delay_min) || '?') : null], ['trend', p.trend],
      ['started', p.start ? when(p.start) : null], ['expected end', p.end ? when(p.end) : null],
      ['ARTCC', p.center], ['flights included', p.scope], ['NOTAM', p.notam],
      ['window', p.recurring ? 'recurring published window (DLY/DAILY) — predictable, not a disruption' : null],
      ['extent', p.partial ? 'closed to some traffic only (qualified closure)' : null],
      ['reported', p.updated ? when(p.updated) : null], ['source', p.source === 'faa-xml' ? 'FAA status XML (no timestamps)' : 'FAA NAS Status'],
      ['advisory', link(p.advisory_url, 'ATCSCC advisory'), true]
    ]) + (p.text ? '<pre>' + esc(p.text) + '</pre>' : '');
  }
  WG.card('faa', function (x) {
    var a = x.a;
    var h = '<div class="h">FAA airport programs · NAS Status</div><div class="ct">' + esc((a.name || a.code) + ' (' + a.code + ')') + '</div>';
    a.programs.forEach(function (p) {
      h += '<div class="h" style="margin-top:8px;color:' + KIND[p.kind].color + '">' + esc(KIND[p.kind].label) + '</div>' + progRows(p);
    });
    if (a.config) h += '<div class="h" style="margin-top:8px">Airport configuration</div>' + WG.kvs([
      ['arrival runways', a.config.arrival_runways], ['departure runways', a.config.departure_runways],
      ['arrival rate', a.config.arrival_rate != null ? a.config.arrival_rate + ' / h' : null], ['as of', a.config.at ? when(a.config.at) : null]]);
    h += WG.kvs([['position', LOC[a.loc] || 'unknown']]);
    return { html: h, at: [a.lon, a.lat] };
  });
  WG.card('afp', function (x) {
    var f = x.f;
    return { html: '<div class="h">FAA airspace flow program</div><div class="ct">' + esc(f.element) + '</div>' + WG.kvs([
      ['cause', f.cause], ['average delay', f.avg_delay_min != null ? mins(f.avg_delay_min) : null], ['start', f.start], ['end', f.end],
      ['floor', f.floor], ['ceiling', f.ceiling], ['geometry', 'flow constrained area line from the FAA status XML']]) + (f.raw ? '<pre>' + esc(f.raw) + '</pre>' : ''),
      at: f.line && f.line[0] ? f.line[0] : null };
  });

  function loadFaa(src) {
    return getJson('/api/gev-aviation?layer=faa', 30000).then(function (d) {
      src.entities.removeAll();
      var watch = [], n = 0, byKind = {};
      (d.airports || []).forEach(function (a) {
        if (a.lat == null || a.lon == null || !a.programs || !a.programs.length) return;
        a.programs.sort(function (x, y) { return ORDER.indexOf(x.kind) - ORDER.indexOf(y.kind); });
        var id = 'faa:' + a.code, top = KIND[a.programs[0].kind], payload = { kind: 'faa', a: a };
        WG.put(id, payload);
        src.entities.add({ id: id, position: Cesium.Cartesian3.fromDegrees(a.lon, a.lat, 3000),
          point: { pixelSize: 9, color: C(top.color), outlineColor: C('#ffffff', 0.8), outlineWidth: 1.5 } });
        a.programs.forEach(function (p, i) {
          var k = KIND[p.kind], pid = id + ':' + p.kind + (i ? ':' + i : ''), alpha = p.lifecycle === 'scheduled' || p.partial || p.recurring ? 0.45 : 0.95;
          n++; byKind[p.kind] = (byKind[p.kind] || 0) + 1;
          WG.put(pid, payload);
          src.entities.add({ id: pid + ':ring', polyline: { positions: circle(a.lon, a.lat, 38000 + i * 24000, 3000), width: k.width,
            material: k.dash ? new Cesium.PolylineDashMaterialProperty({ color: C(k.color, alpha), dashLength: 18 }) : C(k.color, alpha) } });
          var hardStop = (p.kind === 'ground_stop' || (p.kind === 'closure' && !p.partial && !p.recurring)) && p.lifecycle !== 'scheduled';
          if (hardStop && i === 0) src.entities.add({ id: id + ':halo', position: Cesium.Cartesian3.fromDegrees(a.lon, a.lat),
            ellipse: { semiMajorAxis: WG.pulse(2000, 30000, 110000), semiMinorAxis: WG.pulse(2000, 30000, 110000), material: C(k.color, 0.18), outline: false, height: 0 } });
          if (hardStop) watch.push({ rank: p.kind === 'ground_stop' ? 88 : 82, kind: p.kind === 'ground_stop' ? 'FAA GROUND STOP' : 'AIRPORT CLOSED', color: k.color,
            title: (a.name || a.code) + ' (' + a.code + ')', sub: [p.cause || (p.text ? String(p.text).slice(0, 60) : null), p.end ? 'expected end ' + when(p.end) : 'no end published', a.approx ? 'position approximate' : null].filter(Boolean).join(' · '),
            lon: a.lon, lat: a.lat, h: 700000, id: id });
          else if (p.kind === 'ground_stop') watch.push({ rank: 80, kind: 'FAA GROUND STOP · SCHEDULED', color: k.color, title: (a.name || a.code) + ' (' + a.code + ')',
            sub: [p.cause, p.start ? 'from ' + when(p.start) : null].filter(Boolean).join(' · '), lon: a.lon, lat: a.lat, h: 700000, id: id });
        });
        src.entities.add({ id: id + ':lbl', position: Cesium.Cartesian3.fromDegrees(a.lon, a.lat, 3000),
          label: { text: (a.approx ? '≈ ' : '') + a.code + '\n' + a.programs.map(progLine).join('\n'), font: '11px monospace', fillColor: C(top.color),
            outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
            pixelOffset: new Cesium.Cartesian2(12, 0), distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 7.0e6) } });
      });
      (d.flows || []).forEach(function (f, i) {
        if (!f.line || f.line.length < 2) return;
        var id = 'afp:' + i; WG.put(id, { kind: 'afp', f: f });
        src.entities.add({ id: id, polyline: { positions: f.line.map(function (c) { return Cesium.Cartesian3.fromDegrees(c[0], c[1], 4000); }), width: 3, material: C(AFP_COLOR, 0.9) } });
        src.entities.add({ id: id + ':lbl', position: Cesium.Cartesian3.fromDegrees(f.line[0][0], f.line[0][1], 4000),
          label: { text: 'AFP ' + f.element + (f.avg_delay_min != null ? ' · avg ' + mins(f.avg_delay_min) : ''), font: '11px monospace', fillColor: C(AFP_COLOR),
            outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 7.0e6) } });
      });
      watch.sort(function (x, y) { return y.rank - x.rank; });
      WG.watch('faa', watch.slice(0, 5));
      var m = d.meta || {}, failed = m.failed || [], flows = (d.flows || []).length;
      var note = ORDER.filter(function (k) { return byKind[k]; }).map(function (k) { return byKind[k] + ' ' + KIND[k].short; }).join(' · ') || 'no FAA programs in force';
      note += ' · ' + flows + ' AFP';
      if ((m.flows_without_geometry || []).length) note += ' (' + m.flows_without_geometry.length + ' without geometry: ' + m.flows_without_geometry.join(', ') + ')';
      if ((d.unlocated || []).length) note += ' · not located: ' + d.unlocated.map(function (u) { return u.code + ' ' + u.kinds.join('/'); }).join(', ');
      if (m.notices_not_drawn) note += ' · ' + m.notices_not_drawn + ' narrow NOTAMs not drawn';
      if (m.resolved_not_drawn) note += ' · ' + m.resolved_not_drawn + ' resolved';
      note += ' · US airports only';
      if (failed.length) note = 'gap: ' + failed.join(', ') + ' · ' + note;
      WG.feed('faa', failed.length === 0, n + flows, m.source_updated || m.fetched_at, note);
    });
  }

  /* =====================================================================
   * AIRSPACE RESTRICTIONS
   * ================================================================== */
  var LEVEL = {
    closed:     { label: 'CLOSED',      color: '#b91c1c', alpha: 0.26, rank: 75 },
    restricted: { label: 'RESTRICTED',  color: '#fb923c', alpha: 0.20, rank: 64 },
    do_not_fly: { label: 'DO NOT FLY',  color: '#dc2626', alpha: 0.22, rank: 58 },
    avoid:      { label: 'AVOID',       color: '#f97316', alpha: 0.16, rank: 52 },
    caution:    { label: 'CAUTION',     color: '#eab308', alpha: 0.10, rank: 0 }
  };
  var SRC = { faa_notam: 'FAA NOTAM', easa_czib: 'EASA conflict-zone bulletin', safeairspace: 'safeairspace.net (OPSGROUP)' };
  function zoneLevel(z) {
    if (z.operational_state === 'closed' || z.operational_state === 'restricted') return LEVEL[z.operational_state];
    return LEVEL[z.advisory_level] || LEVEL.caution;
  }
  var axisNote = '';
  WG.card('airspace', function (x) {
    var z = x.z, lv = zoneLevel(z);
    var h = '<div class="h">Airspace · ' + esc(z.scope) + ' · <span style="color:' + lv.color + '">' + esc(lv.label) + '</span></div><div class="ct">' + esc(z.name) + '</div>' + WG.kvs([
      ['advisory', String(z.advisory_level).replace(/_/g, ' ')], ['operational', z.operational_state === 'unknown' ? 'unknown' + (axisNote ? ' — ' + axisNote : '') : z.operational_state],
      ['GPS interference', z.gps_interference ? 'reported' : null], ['severity', z.severity != null ? z.severity + (z.severity_band ? ' (' + z.severity_band + ')' : '') : null]]);
    z.notices.forEach(function (n) {
      h += '<div class="h" style="margin-top:8px">' + esc(n.scope + ' ' + n.id) + '</div>' + WG.kvs([
        ['advisory', n.advisory_level !== 'unknown' ? String(n.advisory_level).replace(/_/g, ' ') + ' · ' + (SRC[n.advisory_source] || n.advisory_source || '') : null],
        ['checked', n.advisory_checked_at ? (WG.ago(n.advisory_checked_at) === 'now' ? 'just now' : WG.ago(n.advisory_checked_at) + ' ago') : null], ['valid until', n.advisory_valid_until ? when(n.advisory_valid_until) : null],
        ['operational', n.operational_state !== 'unknown' ? n.operational_state + ' · ' + (SRC[n.operational_source] || n.operational_source || '') : null],
        ['effective', n.effective_from || n.effective_to ? (when(n.effective_from) || '?') + ' → ' + (when(n.effective_to) || 'no end') : null],
        ['GPS interference', n.gps_interference ? 'reported' : null],
        ['reference', link(n.advisory_source_ref, 'source') || (n.advisory_source_ref ? esc(n.advisory_source_ref) : null), true]
      ]) + (n.advisory_reason || n.operational_reason ? '<pre>' + esc(n.operational_reason || n.advisory_reason) + '</pre>' : '');
    });
    h += '<div class="h" style="margin-top:8px">Where this is drawn</div><div class="s" style="font-size:11px;opacity:.85">' + esc(z.where) + '</div>';
    return { html: h, at: z.at };
  });

  function loadAirspace(src) {
    return getJson('/api/gev-aviation?layer=airspace', 40000).then(function (d) {
      src.entities.removeAll();
      var m = d.meta || {}, failed = m.failed || [], counts = {}, watch = [];
      var ax = m.axis || null;
      // the operational (closure) axis is only as good as the NOTAM feed behind it: say what the worker said
      if (ax && ax.operational && !Object.keys(ax.operational).some(function (k) { return k !== 'unknown' && k !== 'null'; })) {
        axisNote = 'no NOTAM closure data (' + Object.keys(ax.operational_unknown_reason || {}).filter(function (k) { return k && k !== 'null'; }).join(', ') + ')';
      } else axisNote = '';
      (d.zones || []).forEach(function (z) {
        var lv = zoneLevel(z), id = 'as:' + z.key, payload = { kind: 'airspace', z: z };
        counts[lv.label] = (counts[lv.label] || 0) + 1;
        WG.put(id, payload);
        (z.polys || []).forEach(function (poly, j) {
          if (!poly[0] || poly[0].length < 4) return;
          var pid = id + ':p' + j; WG.put(pid, payload);
          src.entities.add({ id: pid, polygon: { hierarchy: WG.hierarchy(poly), height: 0, material: C(lv.color, lv.alpha), outline: true, outlineColor: C(lv.color, 0.85), arcType: Cesium.ArcType.RHUMB } });
        });
        if (z.at) {
          var marker = z.geom_kind === 'marker';
          src.entities.add({ id: id, position: Cesium.Cartesian3.fromDegrees(z.at[0], z.at[1], 5000),
            point: marker ? { pixelSize: 10, color: C(lv.color, 0.9), outlineColor: C('#ffffff', 0.7), outlineWidth: 1 } : undefined,
            label: { text: (z.scope === 'airport' ? z.id : z.name) + ' · ' + lv.label + (z.gps_interference ? ' · GPS' : '') + (marker ? '\n≈ boundary not drawn' : ''), font: '11px monospace', fillColor: C(lv.color),
              outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, marker ? -14 : 0),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, marker ? 6.0e6 : 1.4e7) } });
          if (lv.rank) watch.push({ rank: lv.rank, kind: 'AIRSPACE · ' + lv.label, color: lv.color, title: z.name,
            sub: (z.notices.map(function (n) { return SRC[n.operational_state !== 'unknown' ? n.operational_source : n.advisory_source] || ''; }).filter(Boolean).filter(function (v, i, arr) { return arr.indexOf(v) === i; }).join(', ') || 'airspace worker') + (z.gps_interference ? ' · GPS interference' : ''),
            lon: z.at[0], lat: z.at[1], h: 3500000, id: id });
        }
      });
      watch.sort(function (x, y) { return y.rank - x.rank; });
      WG.watch('airspace', watch.slice(0, 4));
      var note = ['CLOSED', 'RESTRICTED', 'DO NOT FLY', 'AVOID', 'CAUTION'].filter(function (k) { return counts[k]; }).map(function (k) { return counts[k] + ' ' + k.toLowerCase(); }).join(' · ') || 'no restricted airspace reported';
      if ((d.unlocated || []).length) note += ' · ' + d.unlocated.length + ' notices without a location (' + d.unlocated.map(function (u) { return u.id; }).join(', ') + ')';
      if (axisNote) note += ' · operational axis: ' + axisNote;
      if (failed.length) note = 'gap: ' + failed.join(', ') + ' · ' + note;
      WG.feed('airspace', failed.length === 0, (d.zones || []).length, (ax && ax.advisory_checked_at) || m.fetched_at, note);
    });
  }

  WG.addLayer({ id: 'airspace', label: 'Airspace restrictions', color: '#eab308', on: true, refreshMs: 10 * 60e3, load: loadAirspace });
  WG.addLayer({ id: 'faa', label: 'FAA airport programs', color: '#ef4444', on: true, refreshMs: 2 * 60e3, load: loadFaa });
})();
