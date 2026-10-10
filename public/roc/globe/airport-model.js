/* ===========================================================================
 * airport-model.js — the airport state model, shared by every globe that draws
 * the airport plane (travel-globe.html, gev.html).
 *
 * hub-051's rule is "one globe, one classifier, one place to fix a bug". When a
 * second surface (the God's Eye View board) needed the same airports, the
 * choice was a second copy of opClass() — which the rule forbids — or this
 * file. Lifted VERBATIM from travel-globe.html sections 0-2 and the
 * normalise/delay functions of section 6; nothing in it touches the viewer.
 *
 * Classic script, not a module: every name stays a global, so the pages that
 * load it read exactly as they did when the code was inline. Load it after
 * roc-score-state.js and before the page script.
 * ======================================================================== */
/* ===========================================================================
 * 0. Small utilities — same idiom as globe.html, deliberately duplicated
 *    rather than shared, because these files must be able to diverge without
 *    one breaking the other.
 * ======================================================================== */
function esc(s) { var d = document.createElement('div'); d.textContent = (s == null ? '' : String(s)); return d.innerHTML; }
function safeUrl(u) {
  if (!u) return null;
  var s = String(u);
  return (s.indexOf('https://') === 0 || s.indexOf('http://') === 0) ? s : null;
}
function num(v) { var n = typeof v === 'number' ? v : parseFloat(v); return isFinite(n) ? n : null; }
function str(v) { return (v == null || v === '') ? null : String(v); }
/** First present key among several — the payload is a contract, but a contract
 *  with two spellings in circulation is still worth reading defensively. */
function pick(o) {
  for (var i = 1; i < arguments.length; i++) {
    var k = arguments[i];
    if (o && o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  }
  return null;
}

var RS = window.RocScoreState || null;
if (RS) RS.injectStyles();

/* ── hub-051 §7: DEPTH TESTING IS ON. A marker behind the earth is hidden. ──
 *
 * Every marker on this page used to carry
 * `disableDepthTestDistance: Number.POSITIVE_INFINITY` — inherited from
 * globe.html, where it is a deliberate choice that keeps the whole signal
 * population visible at once. On an AIRPORT map it is a lie about geography.
 *
 * MEASURED, in 3D, with the camera over the North Atlantic: PVG, PEK, BKK, CGK
 * and DMK — all on the far side of the planet — were drawn on top of the
 * Atlantic-facing hemisphere, so Beijing rendered as though it sat over the
 * mid-ocean. A reader could not tell a front-side airport from a back-side one,
 * which means they could not read a position off this map at all. Ted asked for
 * "points I can view on the globe itself to show TRUE risk"; a marker in the
 * wrong place is the opposite of that, and it is a subtler failure than the wall
 * of yellow precisely because it looks fine.
 *
 * Cesium's default (0) enables depth testing, which occludes far-side markers
 * correctly. It costs nothing in SCENE2D or COLUMBUS_VIEW — a flat map has no
 * back face — so this is a 3D correction that leaves the other two modes
 * untouched. globe.html is NOT changed: its layers are region-scale signal
 * geography where see-through is defensible, and it is not this task's file. */
var DEPTH_TEST = 0;

/* The degraded pulse draws the eye to a problem. Readers who have asked for
 * reduced motion get a steady, equally visible ring instead — the signal is
 * never removed to honour the preference, only its animation. */
var PULSE_OK = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

function toDate(v) {
  if (!v) return null;
  var iso = String(v).trim().replace(' ', 'T').replace(/\+00$/, 'Z');
  var t = new Date(iso);
  return isNaN(t.getTime()) ? null : t;
}
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Absolute UTC — the check time is load-bearing, so it is never only relative. */
function fmtAbs(v) {
  var t = toDate(v);
  if (!t) return null;
  return t.getUTCDate() + ' ' + MONTHS[t.getUTCMonth()] + ' ' +
    String(t.getUTCHours()).padStart(2, '0') + ':' + String(t.getUTCMinutes()).padStart(2, '0') + ' UTC';
}
function fmtAgo(v) {
  var t = toDate(v);
  if (!t) return null;
  var mins = Math.round((Date.now() - t.getTime()) / 60000);
  if (mins < 0) return 'in the future';
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + ' min ago';
  var h = Math.floor(mins / 60);
  if (h < 48) return h + ' h ago';
  return Math.floor(h / 24) + ' d ago';
}
/** "14:02 UTC · 23 min ago" — or an explicit statement that we have no time.
 *  A reading with no timestamp is not a check, and never pretends to be one. */
function fmtChecked(v) {
  var a = fmtAbs(v);
  if (!a) return null;
  var r = fmtAgo(v);
  return r ? (a + ' · ' + r) : a;
}
function titleCase(s) {
  if (!s) return '';
  return String(s).replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

/* ===========================================================================
 * 1. THE STATE MODEL — the honesty rule, expressed once, in code
 *
 * Everything the map draws about an airport's operational condition comes from
 * opClass(). It has exactly four outcomes and no fallthrough to "fine".
 * ======================================================================== */
var OP = { DEGRADED: 'degraded', NOMINAL: 'nominal', UNKNOWN: 'unknown', NOFEED: 'nofeed' };

/* Operational states that are, by themselves, a problem — regardless of what
 * any commercial feed says. These come from the state that controls the
 * airspace, so they outrank an observation. */
var OPERATIONAL_BAD = ['closed', 'restricted', 'suspended', 'partial', 'limited', 'degraded', 'stopped'];
var OPERATIONAL_OK  = ['open', 'normal', 'operational', 'nominal'];
/* Observation statuses per the contract: nominal | degraded | stopped | closed | unknown */
var OBS_BAD = ['degraded', 'stopped', 'closed'];

function opClass(a) {
  var opState = (str(a.operational_state) || '').toLowerCase();
  var obs = (str(a.obsStatus) || '').toLowerCase();
  var cov = (str(a.coverage_class) || '').toLowerCase();

  // 1. The hard fact wins. A controlling state saying "closed" is not softened
  //    by a commercial feed that has not noticed yet.
  if (OPERATIONAL_BAD.indexOf(opState) !== -1) return OP.DEGRADED;
  // 2. A feed that observed a problem.
  if (OBS_BAD.indexOf(obs) !== -1) return OP.DEGRADED;

  // 3. NOMINAL requires BOTH a fine reading AND a time it was taken. This is
  //    the line the honesty rule actually turns on: an untimestamped "fine" is
  //    indistinguishable from never having looked, so it is treated as never
  //    having looked.
  if (obs === 'nominal' && a.obsObservedAt) return OP.NOMINAL;
  if (OPERATIONAL_OK.indexOf(opState) !== -1 && a.operational_checked_at) return OP.NOMINAL;

  // 4. Everything else is unknown. Split so the reader can tell "stale" from
  //    "there is nothing to be stale" — 27 of 31 government fields are the latter.
  if (cov === 'none') return OP.NOFEED;
  return OP.UNKNOWN;
}

/** Why the classifier landed where it did — rendered verbatim in the trace
 *  panel, so the rule is checkable by a reader and not just by its author. */
function opClassWhy(a, cls) {
  var opState = (str(a.operational_state) || '').toLowerCase();
  var obs = (str(a.obsStatus) || '').toLowerCase();
  if (cls === OP.DEGRADED) {
    if (OPERATIONAL_BAD.indexOf(opState) !== -1)
      return 'DEGRADED because the controlling state reports operational_state = "' + opState +
             '". A state-declared condition outranks any commercial observation.';
    return 'DEGRADED because the observation feed reports status = "' + obs + '".';
  }
  if (cls === OP.NOMINAL) {
    if (obs === 'nominal' && a.obsObservedAt)
      return 'NOMINAL because the feed observed this field and found it normal, and we hold the ' +
             'time of that observation. A fine reading without a timestamp would NOT qualify.';
    return 'NOMINAL because the controlling state reports operational_state = "' + opState +
           '" and we hold the time it was checked.';
  }
  if (cls === OP.NOFEED)
    return 'UNKNOWN — coverage_class = "none". No commercial feed exists for this field at all, ' +
           'so there is nothing here to be stale. It is drawn hollow. Drawing it calm would be a ' +
           'claim we have not earned.';
  return 'UNKNOWN — a feed exists for this field, but we do not hold a current qualifying reading' +
         (a.operational_unknown_reason ? ' (' + a.operational_unknown_reason + ')' : '') +
         '. It is drawn hollow, never teal.';
}

/* ── The ADVISORY axis, kept strictly separate from the above ───────────────
 * advisory_level is a risk judgement by an issuer that does NOT control the
 * airspace. advisory_scope: null means we do not know what the level applies
 * to — which is emphatically not an airfield-specific all-clear.
 *
 * LIVE SHAPE (confirmed by FOREMAN against hub-044's endpoint): 42 fields carry
 * a level — caution 35 · avoid 5 · do_not_fly 2 — and EVERY ONE of them is at
 * `country` scope. The other 230 have a null scope. So today there is not a
 * single airfield-specific advisory on the map, and the rendering must not
 * imply otherwise: a country-level judgement is labelled as one, everywhere. */
var ADV = { NONE: 'none', IN_FORCE: 'in_force', UNKNOWN: 'unknown' };
var ADVISORY_CLEAR = ['none', 'normal', 'normal_precautions', 'level_1', '1', 'no_advisory', 'clear'];
/* Scopes that would make a level a statement about THIS airfield. Nothing in
 * the live data matches these yet — every level is `country`. */
var ADVISORY_FIELD_SCOPES = ['airport', 'airfield', 'aerodrome', 'icao', 'facility'];

function advClass(a) {
  var lvl = (str(a.advisory_level) || '').toLowerCase();
  var scope = str(a.advisory_scope);
  if (!lvl) return ADV.UNKNOWN;                        // no level held → unknown, not clear
  if (!scope) return ADV.UNKNOWN;                      // level held, but we do not know what it covers
  if (ADVISORY_CLEAR.indexOf(lvl) !== -1) return ADV.NONE;
  return ADV.IN_FORCE;
}
/** True when a level, even an in-force one, is a statement about a wider area
 *  than this airfield. Drives the "country-level" qualifier that rides every
 *  advisory reading on this surface. */
function advIsWideArea(a) {
  var scope = (str(a.advisory_scope) || '').toLowerCase();
  return !!scope && ADVISORY_FIELD_SCOPES.indexOf(scope) === -1;
}
/** 0..1 intensity for an in-force advisory — drives ring weight only. It never
 *  touches the operational colour ramp. */
function advIntensity(a) {
  var lvl = (str(a.advisory_level) || '').toLowerCase();
  if (lvl.indexOf('do_not') === 0 || lvl.indexOf('do not') === 0 || lvl === 'level_4' || lvl === '4') return 1.0;
  if (lvl.indexOf('avoid') !== -1 || lvl.indexOf('reconsider') !== -1 || lvl === 'level_3' || lvl === '3') return 0.72;
  if (lvl.indexOf('caution') !== -1 || lvl === 'level_2' || lvl === '2') return 0.48;
  return 0.6;
}
function advWhy(a, cls) {
  var scope = str(a.advisory_scope);
  if (cls === ADV.UNKNOWN) {
    if (!str(a.advisory_level))
      return 'No advisory level is held for this field' +
             (a.advisory_unknown_reason ? ' (' + a.advisory_unknown_reason + ')' : '') +
             '. That is unknown, not clear.';
    return 'An advisory level is held, but advisory_scope is null — we do not know whether it ' +
           'applies to this airfield or to a wider area. This is NOT an airfield-specific all-clear.';
  }
  if (cls === ADV.NONE)
    return 'An issuer has assessed this scope (' + scope + ') and has no elevated advisory in force. ' +
           'This is a risk judgement, not a statement about whether the airport is operating.';
  if (advIsWideArea(a))
    return 'An advisory is in force at ' + scope + ' scope — it applies to the ' + scope + ', NOT to ' +
           'this airfield specifically. The issuer does not control this airspace, and this says ' +
           'nothing about whether the airport is operating.';
  return 'An advisory is in force over scope "' + scope + '". The issuer does not control this ' +
         'airspace — this is a judgement about risk, not a hard operational fact.';
}

/* ── Colour. Operational owns the hazard ramp; advisory owns violet; unknown
 *    is always the neutral slate that RocScoreState already uses for the
 *    confidence axis. NO ORANGE. ─────────────────────────────────────────── */
var C_NOMINAL  = '#18BC9C';
var C_MOD      = '#eab308';
var C_SEVERE   = '#ef4444';
var C_UNKNOWN  = '#94a3b8';
var C_NOFEED   = 'rgba(148,163,184,0.5)';
var C_ADVISORY = '#a78bfa';
var C_ADV_UNK  = 'rgba(148,163,184,0.55)';

/** Degraded severity ramp. Reads `severity_band` first (a named, versioned
 *  classification), then the numeric `severity`, then the two CATEGORICAL
 *  classifications the pipeline actually publishes — never invents one.
 *
 *  ── hub-051 §7: THIS FUNCTION WAS HALF OF THE WALL OF YELLOW ─────────────
 *  It had three outcomes and could only ever reach one. `severity_band` and
 *  `severity` are NULL on all 272 rows — they belong to the airspace-ring
 *  source, which is not credentialed — and `operational_state` is `unknown` on
 *  all 272 for the same reason. So every branch fell through to the terminal
 *  `return C_MOD`, and all ten degraded airports drew the same amber. LHR
 *  breaching on median delay was indistinguishable from a closed airfield.
 *
 *  THE FIX IS NOT TO INVENT A SCORE. Grading LHR from `obsDeparturesMedianDelayMin`
 *  in the browser would be a client-side re-derivation, which the data-plane
 *  contract forbids and which would make this page the author of a severity the
 *  pipeline never published. Instead the ramp now also reads `obsStatus`, which
 *  IS a published, rule-graded categorical value (`obsRuleId` / `obsRuleVersion`
 *  name the rule): the contract's own vocabulary distinguishes `degraded` from
 *  `stopped` and `closed`, and stopped/closed are categorically worse than
 *  degraded by the pipeline's own definition, not by our arithmetic.
 *
 *  TODAY ALL TEN ARE `degraded`, SO ALL TEN STAY AMBER. That is the honest
 *  outcome and the map is not made to look more dramatic than the data. What
 *  changes is that the ramp is now LIVE — the first field that stops or closes
 *  will read red instead of joining an undifferentiated amber crowd — and that
 *  amber, on this surface, now has exactly one meaning. `degradedBand()` names
 *  the grade in words so the trace panel can state it rather than leaving the
 *  reader to infer a severity from a hue. */
function degradedBand(a) {
  var band = (str(a.severity_band) || '').toLowerCase();
  if (band) {
    if (band.indexOf('sev') === 0 || band.indexOf('crit') === 0 || band.indexOf('high') === 0 || band.indexOf('major') === 0)
      return { level: 'severe', why: 'severity_band = "' + band + '"' };
    if (band.indexOf('mod') === 0 || band.indexOf('med') === 0 || band.indexOf('elev') === 0 ||
        band.indexOf('low') === 0 || band.indexOf('min') === 0)
      return { level: 'moderate', why: 'severity_band = "' + band + '"' };
  }
  var s = num(a.severity);
  if (s != null)
    return { level: s >= 7 ? 'severe' : 'moderate', why: 'severity = ' + s + (s >= 7 ? ' (≥ 7)' : ' (< 7)') };

  // The controlling state, when it speaks at all.
  var opState = (str(a.operational_state) || '').toLowerCase();
  if (opState === 'closed' || opState === 'suspended')
    return { level: 'severe', why: 'the controlling state reports operational_state = "' + opState + '"' };
  if (OPERATIONAL_BAD.indexOf(opState) !== -1)
    return { level: 'moderate', why: 'the controlling state reports operational_state = "' + opState + '"' };

  // The observation feed's own graded category — the only axis populated today.
  var obs = (str(a.obsStatus) || '').toLowerCase();
  if (obs === 'stopped' || obs === 'closed')
    return { level: 'severe', why: 'the observation feed graded this field "' + obs + '", which the contract ranks above "degraded"' };
  if (obs === 'degraded')
    return {
      level: 'moderate',
      why: 'the observation feed graded this field "degraded"' + gradedOnRule(a) +
        '. No severity_band and no numeric severity is published for ANY airport row, so this is the ' +
        'finest grade available and it is not refined further in the browser.'
    };

  return { level: 'moderate', why: 'a problem is reported but no grading field is published for this field' };
}
/** The pipeline's own named reason, quoted rather than reinterpreted. */
function gradedOnRule(a) {
  var r = str(a.obsStatusReason);
  return r ? ' on the rule "' + r + '"' : '';
}
function degradedColor(a) {
  return degradedBand(a).level === 'severe' ? C_SEVERE : C_MOD;
}

/* ===========================================================================
 * 1b. FRESHNESS — the second axis of "do we actually know this?"  (hub-049)
 *
 * opClass() answers "did we check, and what did we find". It says nothing about
 * WHEN. A field checked four minutes ago and a field checked last Tuesday both
 * come out NOMINAL, and until now they drew identically.
 *
 * Freshness is deliberately NOT a fifth state and NOT a re-classification. An
 * old nominal reading is still a nominal reading — demoting it to UNKNOWN would
 * be inventing a rule the pipeline does not hold, and hub-048's four-state model
 * is the contract. So freshness DISCLOSES rather than reclassifies: it decays
 * the alpha of the nominal disc and drops the label to slate, while the marker
 * stays a filled teal disc that no reader can confuse with a hollow slate ring.
 *
 * Thresholds are anchored to the writer's real cadence: sweeps land every 15
 * minutes (sweep ids are minute-bucketed, e.g. "2026-08-01T17:30Z"), so FRESH is
 * three sweeps' grace and anything past a quarter-day is stale.
 * ======================================================================== */
var FRESH = { FRESH: 'fresh', AGING: 'aging', STALE: 'stale', NONE: 'none' };
var FRESH_MS = { FRESH: 45 * 60 * 1000, AGING: 6 * 60 * 60 * 1000 };
/* Observation statuses that constitute a READING. A sweep row exists for every
 * airport on every sweep, including ones the writer could not resolve — those
 * come back `unknown`. Swept is not read, and the two are never conflated. */
var OBS_READABLE = ['nominal', 'degraded', 'stopped', 'closed'];

/** The timestamp that LICENCED this marker's claim, whichever axis carried it.
 *
 *  opClass() reaches NOMINAL down two roads: an observation that came back
 *  nominal WITH a time, or a controlling state saying "open" WITH a time. Both
 *  require a clock, so both have an age, and freshness must read whichever one
 *  actually did the work. Keying on obsObservedAt alone would draw a field whose
 *  only check was an operational reading from last week at full strength —
 *  faded-because-old is precisely the treatment such a field has earned. */
function checkedAt(a) {
  return a.obsObservedAt || a.operational_checked_at || null;
}
/** Age of that check, in ms — or null if we hold no check time at all. */
function obsAgeMs(a) {
  var t = toDate(checkedAt(a));
  if (!t) return null;
  var ms = Date.now() - t.getTime();
  return ms < 0 ? 0 : ms;   // a clock-skewed future stamp is treated as "now", never as ancient
}
function freshClass(a) {
  var ms = obsAgeMs(a);
  if (ms == null) return FRESH.NONE;
  if (ms <= FRESH_MS.FRESH) return FRESH.FRESH;
  if (ms <= FRESH_MS.AGING) return FRESH.AGING;
  return FRESH.STALE;
}
/** True when the sweep touched this field AND came back with something usable. */
function hasReading(a) {
  return !!a.obsObservedAt && OBS_READABLE.indexOf((str(a.obsStatus) || '').toLowerCase()) !== -1;
}
/** Fill alpha for a NOMINAL disc. Floored at 0.34 and always paired with a teal
 *  outline, so the faintest fresh-lie a stale reading can tell is still visibly
 *  a FILLED TEAL DISC and not the hollow slate ring that means "not checked". */
function nominalAlpha(f) {
  if (f === FRESH.AGING) return 0.62;
  if (f === FRESH.STALE) return 0.34;
  // NONE should be unreachable for a nominal marker — opClass() will not return
  // NOMINAL without a timestamp. It is floored anyway rather than defaulted to
  // full strength: if that invariant ever breaks, the failure should show as
  // minimum confidence, not maximum.
  if (f === FRESH.NONE) return 0.34;
  return 0.92;
}
/** Plain-words age, for the chrome headline and the tooltip. */
function freshWords(f) {
  return f === FRESH.FRESH ? 'fresh' : f === FRESH.AGING ? 'aging' : f === FRESH.STALE ? 'stale' : 'no check time held';
}

/* ── DECLARED cadence per tier. This is what the REGISTRY intends, not what the
 *    pipeline was measured doing. The distinction matters enough that the two
 *    are printed side by side and reconciled in renderCadence() below. ─────── */
var TIER_CADENCE = {
  1: 'swept every 15 minutes',
  2: 'swept on a low-cadence rotation',
  3: 'only looked at when an event points us there'
};

/* ===========================================================================
 * 2. TRAVEL-FIRST DOMAIN ORDER
 *
 * DUPLICATED, KNOWINGLY, from src/lib/travelrisk/domains.ts (hub-047), because
 * this is a static page with no build step and cannot import TypeScript. The
 * TS module remains canonical: if the two ever disagree, that file wins.
 * Presentation only — nothing here rescores or drops a domain.
 * ======================================================================== */
var TRAVEL_DOMAIN_ORDER = [
  { domain: 'travel',         label: 'Travel',         why: 'The direct signal — ground stops, carrier IROPS, GDS outages, rail.' },
  { domain: 'weather',        label: 'Weather',        why: 'The single largest cause of delay and cancellation worldwide.' },
  { domain: 'infrastructure', label: 'Infrastructure', why: 'ATC system outages, airport power, telecom, cloud and booking dependencies.' },
  { domain: 'labor',          label: 'Labor',          why: 'ATC, airline and ground-handler strikes — routinely closes European airspace.' },
  { domain: 'geopolitical',   label: 'Geopolitical',   why: 'Airspace closures, overflight bans, conflict-zone reroutes.' },
  { domain: 'cyber',          label: 'Cyber',          why: 'Airline IT and GDS compromise — the AA-class event.' },
  { domain: 'seismic',        label: 'Seismic',        why: 'Volcanic ash is a first-order aviation hazard; quakes close airports.' },
  { domain: 'disaster',       label: 'Disaster',       why: 'Airport closure, mass evacuation, terminal damage.' },
  { domain: 'health',         label: 'Health',         why: 'Entry rules, screening, quarantine — border friction.' },
  { domain: 'environmental',  label: 'Environmental',  why: 'Smoke, ash dispersion and air quality affecting operations.' },
  { domain: 'supply_chain',   label: 'Supply Chain',   why: 'Jet fuel, parts, catering.' },
  { domain: 'financial',      label: 'Financial',      why: 'Carrier solvency, fuel cost.' }
];
/* ── hub-051 §7: THE INDEX BOARD STOPS USING THE HAZARD RAMP ───────────────
 *
 * This is the other half of the wall of yellow, and the larger half.
 *
 * `scoreColor()` used to be `s < 4.0 ? teal : s < 7.0 ? amber : red` — the same
 * three hues the airport markers use for a CHECKED, MEASURED impairment. Live,
 * the twelve global domain scores span 3.7 → 4.6. A hard colour cliff at 4.0
 * through a 0.9-point spread paints nine domains amber and three teal, and
 * makes a tenth of a provisional point look like a change in the state of the
 * world while the entire 4.0 → 6.9 interval looks like nothing at all. The
 * colour was reporting the threshold, not the planet.
 *
 * Worse, it was borrowing the alarm hues for something that has not earned
 * them: op-risk is PROVISIONAL for all twelve domains (baseline ~70% complete,
 * `provisional_absolute` basis), it is derived from news-event volume rather
 * than from an observation of any airport, and it is a RANKING instrument. A
 * ranking painted in alarm colours next to ten genuinely degraded airfields
 * makes the airfields disappear.
 *
 * So magnitude moves to a BAR — position and length, which the eye reads
 * accurately — in ONE hue, and the published `level` word is printed verbatim
 * beside it so nothing is withheld. 3.9 and 4.0 now draw as near-identical
 * bars, which is true, instead of teal-versus-amber, which was not.
 *
 * INDEX_MAX mirrors riskAxes.ts. If the published scale ever changes, both
 * change; neither invents one.
 */
var INDEX_HUE = '#22d3ee';
var INDEX_MAX = 10;
/** Bar width as a percentage, or null when there is no reading to draw. An
 *  absent score gets a hatched empty track and the word "no reading" — never a
 *  zero-length bar, which reads as calm. */
function indexBarPct(s) {
  if (s == null) return null;
  return Math.max(0, Math.min(100, (s / INDEX_MAX) * 100));
}
/** Describe the RANGE of the published scores. This computes nothing new about
 *  any domain — it reports the min, max and level tally of numbers ovix-api
 *  already published — and it exists because the single most useful thing a
 *  reader can be told about today's board is that all twelve sit inside a
 *  0.9-point band, which colour actively concealed. Self-clearing: the notice
 *  disappears on its own once the domains genuinely separate. */
function describeSpread(entries) {
  var scores = [], byLevel = {};
  entries.forEach(function (e) {
    if (!e || e.available === false || typeof e.score !== 'number' || !isFinite(e.score)) return;
    scores.push(e.score);
    var lv = String(e.level || 'UNKNOWN').toUpperCase();
    byLevel[lv] = (byLevel[lv] || 0) + 1;
  });
  if (!scores.length) return null;
  var min = Math.min.apply(null, scores), max = Math.max.apply(null, scores);
  return { min: min, max: max, span: max - min, n: scores.length, byLevel: byLevel, tight: (max - min) < 2 };
}

/* Delay / cancellation reading.
 *
 * hub-044 confirmed that `obsLifecycle`, `obsAvgDelayMin` and `obsMaxDelayMin`
 * are NULL across all 30,464 observation rows — the writer populates the
 * median / index / cancelled family instead. Those three columns are kept in
 * the view rather than silently dropped, which is right, but they are RESERVED,
 * not available, and nothing on this page may be built on them. The fields
 * below are the populated ones.
 *
 * Absent is rendered as absent, never as zero: "no departures were cancelled"
 * and "we hold no cancellation figure" are different claims, and collapsing
 * them is the same class of error as drawing an unchecked airport calm. */
function normaliseAirport(raw) {
  var a = {};
  for (var k in raw) if (Object.prototype.hasOwnProperty.call(raw, k)) a[k] = raw[k];
  a._lat = num(pick(raw, 'lat', 'latitude'));
  a._lon = num(pick(raw, 'lon', 'lng', 'longitude'));
  var t = num(raw.monitor_tier);
  a._tier = (t === 1 || t === 2 || t === 3) ? t : 3;   // unknown tier is treated as the weakest
  a._op = opClass(a);
  a._adv = advClass(a);
  // hub-049. Computed at build time, not on a per-frame callback: entities are
  // rebuilt wholesale every 5 minutes anyway, and the narrowest bucket boundary
  // is 45 minutes, so a frame-accurate age would buy nothing but GPU work.
  a._fresh = freshClass(a);
  a._hasReading = hasReading(a);

  a._depMedian = num(raw.obsDeparturesMedianDelayMin);
  a._arrMedian = num(raw.obsArrivalsMedianDelayMin);
  a._depIndex  = num(raw.obsDeparturesDelayIndex);
  a._arrIndex  = num(raw.obsArrivalsDelayIndex);
  a._depCancel = num(raw.obsDeparturesCancelled);
  a._arrCancel = num(raw.obsArrivalsCancelled);
  a._depTotal  = num(raw.obsDeparturesTotal);
  a._arrTotal  = num(raw.obsArrivalsTotal);
  a._depQual   = num(raw.obsDeparturesQualified);
  a._arrQual   = num(raw.obsArrivalsQualified);
  return a;
}

/** One human sentence describing what the feed actually measured — built only
 *  from populated fields, and silent when we hold nothing rather than
 *  reporting a comforting zero. */
function delaySentence(a) {
  var bits = [];
  var med = a._depMedian != null ? a._depMedian : a._arrMedian;
  if (med != null) bits.push('median delay ' + Math.round(med) + ' min');
  var cancels = (a._depCancel != null || a._arrCancel != null)
    ? (a._depCancel || 0) + (a._arrCancel || 0) : null;
  if (cancels != null) bits.push(cancels + ' cancelled');
  var idx = a._depIndex != null ? a._depIndex : a._arrIndex;
  if (idx != null) bits.push('delay index ' + (Math.round(idx * 100) / 100));
  return bits.length ? bits.join(' · ') : null;
}
