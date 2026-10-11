# World Glass — roadmap to a travel-risk posture board

World Glass (`/roc/globe/world-glass.html`) is the travel-risk posture board. Phases 1–2 built the **instrument**:
airports on the shared classifier, aviation hazards, cyclones, radar, IR, lightning, live aircraft, corridors, a 24 h
replay, looks, share links and photorealistic 3D. The cycles below turn it into a **posture**: something that drives
incidents and ties events, news and flights together.

The cycles are in suggested order. Ted ranks them.

## Cycle 3 — Aviation operations layer
Show what the system is doing to flights, not just what the weather is doing.
- **FAA NAS programs** (travel-intel already ingests them): ground stops, ground delay programs and airspace flow
  programs as rings on the airport, carrying cause, average delay and expected end. ATCSCC advisories have no
  coordinates today, so attach them to the airport or FIR they name.
- **Airspace closures and restrictions** from the airspace worker (NOTAM, EASA conflict-zone bulletins), drawn as FIR
  polygons.
- **Eurocontrol** network restrictions and delays for Europe (this source is not ingested yet).
- **Airline-level disruption:** cancellations and delays by carrier at a hub. This needs a paid source, for example
  AeroDataBox airline endpoints or FlightAware AeroAPI. **Decision needed: budget.**

## Cycle 4 — Layers that drive incidents
Turn layer conditions into **proposed** incidents that a person confirms. Nothing auto-publishes.
- Rules, each with an owner and a threshold. Examples:
  - a cyclone cone intersects a registry airport within 72 h;
  - a volcanic-ash SIGMET covers a hub or a corridor;
  - a ground stop lasts more than 2 h at a tier-1 airport;
  - both ends of a listed corridor are degraded for more than 1 h.
- Proposals go to the hub's incidents with status `proposed`. They appear on the board in a distinct "PROPOSED" style.
  One click confirms a proposal and one click dismisses it, and every outcome is logged so the thresholds can be tuned.
- **Decision needed:** should proposals be visible on the public board, or only to signed-in members?

## Cycle 5 — Tie incidents and news to flights
- **From an incident or news story to exposure:**
  1. Start from the story's place (or its country centroid, which is marked as approximate).
  2. Find the airports within a radius.
  3. List the aircraft inbound and outbound now (adsb.lol by airport), plus scheduled flights in the next 6 h (needs
     a schedules source, see Cycle 3).
- **From a flight to context:** click an aircraft to see the hazards and incidents along its route. This needs a
  route lookup; adsbdb data may not be redistributed, so it needs a licensed source.
- **News geocoding:** news-intel stories carry only country codes. Add place extraction (city or airport) so stories
  land where they happen rather than at country centroids.

## Cycle 6 — Keys and power-ups
- A **Power up** panel, as in gods-eye-view: a viewer pastes their own key (Cesium ion, Google Map Tiles, FlightAware,
  Windy) and premium layers unlock **for that viewer only**. The key is stored in their browser and never sent to us.
- Server-side keys stay for the public baseline.
- A cost guard on Google Map Tiles: a session cap, with the layer switching off and saying so when the cap is reached.

## Cycle 7 — Flyovers and scenes
- Scripted cinematic tours of the top situations on photorealistic 3D: approach, orbit, card, next. Built on the tour
  mode and the Fly over action.
- Saved **scenes** (camera path plus layers plus a time) that can be shared and replayed in a briefing.

## Cycle 8 — Posture
- A posture score per region, blending the airport plane, hazards, airspace, incidents and news. Each region shows its
  drivers, and confidence is stated separately from hazard, following the hub-051 honesty rules.
- A posture strip on the board and a posture line in the 6-hourly Travel Ops Brief, so the email and the glass agree.

## Known gaps carried forward
- No Meteosat infrared: Europe, Africa and the Indian Ocean are absent from the IR layer.
- Lightning covers only the Americas and adjacent oceans.
- NHC covers the Atlantic and the East and Central Pacific; there is no JTWC (West Pacific or Indian Ocean) yet.
- Corridor arcs use a curated list of busy routes, not route data.
- On preview deployments, airports and incidents (which need the hub database) and live events (CORS-limited to the
  production hosts) show GAP. This is expected; production is unaffected.

## 2026-10-11 — signal over noise pass (Ted)
- **Defaults**: ON = airports & delays, flight events, flight delays (2 h+), open incidents, tropical cyclones, natural
  hazards, FAA airport programs. OFF = SIGMET volumes, radar, live event dots, corridor arcs, airspace restrictions,
  rail, regional op-risk index, traffic, IR, lightning, 3D. Everything stays one click away in the layer list.
- **Flight events vs delays**: a diversion (emergency landing, turbulence, injury) and an emergency squawk are
  EVENTS — red, solid, glowing arc. A cancellation is red dashed. Long delays are amber on their own `delays` layer.
- **Key**: folds to its header, hides with the KEY button, remembers both per browser; the layer list is fitted
  above it so the two never overlap.
- **Scrubber**: whole bar is draggable (the sparkline no longer eats the pointer), drags redraw once per frame, and
  the 15-minute history refresh keeps the hour being replayed instead of snapping to LIVE.
- **Tour (later the same day)**: a bar at the top names the stop (kind · title · why it is a story), with ◀ ▶, pause/
  resume, slow/normal/fast dwell, ✕; ← → space Esc work too; touching the globe pauses instead of ending the tour.
- **Scrollbars** inside the layer list, watch list and card are thin and dark.
- **Tour zoom** (2026-10-11): on tour, each stop flies two zoom levels higher than its own entry height (×4, capped at 12,000 km) so it reads as a region.

## 2026-10-11 — World Glass reads the desk (api-074 / hub)
- `loadEvents` and `loadIncidents` now read desk-api `/desk/items` (layer 1 events + hazards sev ≥ 5; open incidents, proposals excluded — they have their own layer) and `/desk/posture` for the travel level. Same clustered, re-scored items the alerts and proposals use.
- `geo` from the desk: `exact` drawn solid; `approx` (desk-api placed it at a monitored city or a country's main airport) drawn HOLLOW with "APPROXIMATE" on the card and the watch entry; `none` stays off the globe, watch list only. The feed line counts both.
- Cards for events/incidents show `n sources`, severity basis + axes, and the desk's plain-words `why`.
- Still reading their own feeds: airports/sweep, hazards (SIGMET), cyclones, radar, story flights, aircraft — those are layers, not stories.
