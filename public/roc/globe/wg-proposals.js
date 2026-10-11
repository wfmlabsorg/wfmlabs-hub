/* =========================================================================
 * wg-proposals.js — PROPOSED incidents as a World Glass plugin layer (one-source-of-truth phase 4).
 *
 *   proposals  Incidents the desk's rules PROPOSED (roc desk-api, rules in workers/desk-api/src/rules)
 *              and no person has decided yet. Drawn as dashed amber rings; the card says which rule,
 *              on what basis, and — for admins — offers Confirm / Dismiss. Public (Ted 2026-10-11): the
 *              data comes through /api/desk-proposals; a 401 (should the gate ever return) draws nothing
 *              and says so in the feed line (a gate, not a GAP).
 *              A proposal without coordinates is counted in the feed note and listed on the watch list,
 *              never invented onto the globe.
 * ====================================================================== */
(function () {
'use strict';
var WG = window.WG; if (!WG) return;
var Cesium = WG.Cesium, C = WG.C, esc = WG.esc;
var AMBER = '#fbbf24';
var state = { admin: false, byId: {} };

function fmtRule(p) { var r = String(p.proposal_rule || '').split(':'); return r[0] ? r[0].replace(/_/g, ' ') + (r[1] ? ' ' + r[1] : '') : 'rule'; }
function basisOf(p) { var f = p.proposal_payload && p.proposal_payload.facts; return f && f.basis ? String(f.basis) : null; }
function when(iso) { if (!iso) return null; var a = WG.ago(iso); return a === 'now' ? 'just now' : a + ' ago'; }

WG.card('proposal', function (x) {
  var p = x.p, sev = String(p.sev_level || '').toUpperCase();
  var rows = [['Rule', fmtRule(p)], ['Basis', basisOf(p)], ['Severity', sev + (p.severity != null ? ' · ' + Number(p.severity).toFixed(1) : '')], ['Domain', p.domain],
              ['Where', [p.location_name, p.location_country].filter(Boolean).join(', ') || null], ['Proposed', when(p.created_at)]];
  var html = '<div class="k" style="color:' + AMBER + '">PROPOSED · ' + esc(sev || 'SEV?') + ' · awaiting a decision</div>'
    + '<div class="t">' + esc(p.title || p.slug) + '</div>'
    + (p.description ? '<div class="s">' + esc(String(p.description).slice(0, 320)) + '</div>' : '')
    + WG.kvs(rows)
    + '<div class="s" style="margin-top:6px"><a href="/incidents/' + esc(p.slug) + '" target="_blank" rel="noopener">Open on the incidents page</a></div>';
  if (state.admin) {
    html += '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">'
      + '<button type="button" data-prop="' + esc(String(p.id)) + '" data-act="confirm" style="font:600 12px IBM Plex Sans,sans-serif;padding:5px 9px;border-radius:6px;border:1px solid rgba(34,211,238,.6);background:rgba(34,211,238,.08);color:#22d3ee;cursor:pointer">Confirm as incident</button>'
      + '<button type="button" data-prop="' + esc(String(p.id)) + '" data-act="dismiss" style="font:600 12px IBM Plex Sans,sans-serif;padding:5px 9px;border-radius:6px;border:1px solid rgba(239,68,68,.5);background:rgba(239,68,68,.06);color:#ef4444;cursor:pointer">Dismiss…</button>'
      + '<span class="s" data-prop-msg="' + esc(String(p.id)) + '"></span></div>';
  } else {
    html += '<div class="s" style="margin-top:6px;color:#94a3b8">Proposed by a desk rule · an admin confirms or dismisses</div>';
  }
  var lat = WG.num(p.location_lat), lon = WG.num(p.location_lon);
  return { html: html, at: lat != null && lon != null ? [lon, lat] : null };
});

/* Confirm / Dismiss from the card — delegated so it survives re-renders of #card. */
document.addEventListener('click', function (ev) {
  var b = ev.target && ev.target.closest ? ev.target.closest('button[data-prop]') : null; if (!b) return;
  var id = b.getAttribute('data-prop'), act = b.getAttribute('data-act'), msg = document.querySelector('[data-prop-msg="' + id + '"]');
  var body = {};
  if (act === 'dismiss') { var why = window.prompt('Why dismiss this proposal? (required)'); if (!why || !why.trim()) return; body.reason = why.trim(); }
  b.disabled = true; if (msg) msg.textContent = act === 'confirm' ? 'confirming…' : 'dismissing…';
  fetch('/api/desk-proposals/' + encodeURIComponent(id) + '/' + act, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status)); return d; }); })
    .then(function () { if (msg) msg.textContent = act === 'confirm' ? 'confirmed — now an open incident' : 'dismissed'; if (loadProposals.src) loadProposals(loadProposals.src); })
    .catch(function (e) { b.disabled = false; if (msg) msg.textContent = 'failed: ' + String(e.message || e); });
});

function loadProposals(src) {
  loadProposals.src = src;
  return fetch('/api/desk-proposals', { signal: AbortSignal.timeout(20000) })
    .then(function (r) {
      if (r.status === 401) { src.entities.removeAll(); WG.watch('proposals', []); WG.feed('proposals', true, 0, null, 'members only — sign in to see proposals'); return null; }
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error((d && d.error) || ('HTTP ' + r.status)); return d; });
    })
    .then(function (d) {
      if (!d) return;
      state.admin = !!d.admin; state.byId = {};
      src.entities.removeAll();
      var list = d.proposals || [], drawn = 0, noCoords = 0, watch = [];
      list.forEach(function (p) {
        state.byId[p.id] = p;
        var lat = WG.num(p.location_lat), lon = WG.num(p.location_lon), id = 'prop:' + p.id;
        var sev = String(p.sev_level || '').toUpperCase(), rank = (sev === 'SEV1' ? 80 : sev === 'SEV2' ? 62 : 45);
        WG.put(id, { kind: 'proposal', p: p });
        if (lat == null || lon == null) { noCoords++; }
        else {
          drawn++;
          src.entities.add({ id: id, position: Cesium.Cartesian3.fromDegrees(lon, lat),
            point: { pixelSize: 16, color: C(AMBER, 0.08), outlineColor: C(AMBER, 0.95), outlineWidth: 2 } });
          src.entities.add({ id: id + ':ring', position: Cesium.Cartesian3.fromDegrees(lon, lat),
            ellipse: { semiMajorAxis: 60000, semiMinorAxis: 60000, height: 0, fill: false, outline: true, outlineColor: C(AMBER, 0.8), outlineWidth: 2 } });
        }
        watch.push({ rank: rank, kind: 'PROPOSED · ' + (sev || 'SEV?') + (lat == null ? ' · no coordinates' : ''), color: AMBER, title: p.title || p.slug,
          sub: fmtRule(p) + (basisOf(p) ? ' · ' + basisOf(p) : '') + (p.location_name ? ' · ' + p.location_name : '') + ' · awaiting a decision', lon: lon, lat: lat, h: 1.5e6, id: id });
      });
      WG.watch('proposals', watch.sort(function (a, b) { return b.rank - a.rank; }).slice(0, 6));
      WG.feed('proposals', true, drawn, d.generated_at, list.length + ' awaiting a decision' + (noCoords ? ' · ' + noCoords + ' without coordinates (watch list only)' : '') + (state.admin ? ' · you can confirm/dismiss' : ''));
    });
}
WG.addLayer({ id: 'proposals', label: 'Proposed incidents', color: AMBER, on: true, refreshMs: 2 * 60e3, load: loadProposals });

/* key: appended, not edited */
try {
  var lg = document.getElementById('legend');
  if (lg) { var div = document.createElement('div'); div.innerHTML = '<div class="row"><span><b style="color:' + AMBER + '">◌</b> proposed incident (dashed, members only) — rules proposed, a person decides</span></div>'; while (div.firstChild) lg.appendChild(div.firstChild); }
} catch (e) { /* key is decoration */ }
})();
