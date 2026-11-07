# Deterministic Itinerary Engine v1

`itinerary-engine.js` is a pure CommonJS planner. `POST /api/plans/generate`
accepts caller-supplied places and travel legs; it does not call Google, Gemini,
or another provider. The existing provider-backed `/api/itinerary` contract is
unchanged. All example places and prices below are **fictional fixtures**.

## Request contract

```json
{
  "preferences": {
    "currency": "INR",
    "origin": { "latitude": 12.97, "longitude": 77.59 },
    "startAt": "2026-01-01T10:00:00+05:30",
    "availableMinutes": 240,
    "budgetAmount": 2750,
    "budgetMode": "total",
    "people": 2,
    "contingencyPercent": 0,
    "mood": "Chill",
    "categories": ["Cafe", "Food", "Movies"],
    "maxStops": 3,
    "transportMode": "walk",
    "returnToStart": false
  },
  "candidates": [{
    "id": "fictional-cafe", "name": "Fictional Café", "latitude": 12.97,
    "longitude": 77.59, "category": "Cafe", "tags": ["Chill"],
    "visitMinutes": 60, "relevanceScore": 75,
    "opening": { "status": "known", "windows": [{
      "opensAt": "2026-01-01T09:00:00+05:30",
      "closesAt": "2026-01-01T18:00:00+05:30"
    }] },
    "expenses": [{ "id": "drink", "category": "food", "quantity": 1,
      "unit": "person", "priceStatus": "estimated", "minimumCost": 80,
      "expectedCost": 100, "maximumCost": 120 }],
    "source": { "name": "Fictional test catalog" }
  }],
  "travelLegs": [{
    "fromId": "origin", "toId": "fictional-cafe", "mode": "walk",
    "durationMinutes": 10, "distanceMeters": 800, "confidence": "estimated",
    "cost": { "unit": "group", "priceStatus": "estimated",
      "minimumCost": 10, "expectedCost": 20, "maximumCost": 30 },
    "source": { "name": "Fictional route fixture" }
  }]
}
```

`preferences` requires the fields shown through `people`; all others are
optional. Defaults: contingency 0%, no mood/category filter, walking mode,
three maximum stops, 180 minutes maximum per leg, 60 minutes maximum wait,
and no return leg. `maxStops` is 1–4; `availableMinutes` is 30–720.
`excludedPlaceIds` and `preferredPlaceIds` are optional unique arrays. A
returning outing requires `returnToStart: true` and a route from its final
stop to `origin`. The plan ends at the last venue when return is false.

Candidates require unique stable IDs, name, coordinates, category, visit
duration (15–360 minutes), opening data, expenses and source metadata. Tags and
relevance score (0–100, default 50) are optional. A candidate must lie within
100 km straight-line distance of the origin; this is a **locality filter only**,
never a travel-time estimate. Each candidate has at most five Budget Engine
expenses. Expense IDs are scoped to their place before evaluation.

Opening hours are either `{ "status": "unknown" }` or `known` with up to 14
nonoverlapping absolute windows. Every timestamp must include `Z` or a numeric
UTC offset. An overnight window uses timestamps on different dates. Different
offsets across a daylight-saving boundary represent the actual elapsed time.
The future Places adapter must materialize venue-local weekly hours into these
dated windows; this engine does not infer a time zone from coordinates.
Unknown hours permit a plan only with `UNKNOWN_OPENING_HOURS` warning.
When the venue opens later, the engine waits at most `maxWaitMinutes` and counts
the wait against the available duration. Arrival, the entire visit, and any
return leg must fit the schedule.

`travelLegs` is a directed matrix of at most 180 entries. Each leg requires
known origin/destination IDs, mode (`walk`, `drive`, `transit`), duration in
minutes (1–180), confidence (`verified` or `estimated`), and `cost` using the
Budget Engine's price fields plus `unit` (`group` or `person`). Optional
distance is integer metres; optional source metadata has name and reference.
Transport cost is one Budget Engine expense per traversed leg. A missing
directed route is **not** a zero-minute route: that path is rejected.

## Search and ranking

The service validates the complete input, filters excluded and incompatible
categories, then runs depth-first expansion in stable ID order. It considers
each nonrepeating place once per plan. Every proposed stop must pass route,
travel-duration, opening-window, visit-time, total-duration, and Budget Engine
checks. Plans whose **known minimum** exceeds spendable budget are pruned.
Plans with unknown prices may be returned, but carry `cannot_determine` and
are ranked below conservatively affordable plans.

Search is bounded to 12 candidates, four stops, 300 expansion attempts and
six returned plans. At the cap, the result includes `SEARCH_LIMIT_REACHED` and
may omit a better plan; this is a bounded heuristic, not an exhaustive optimum.
The response reports expansion count and rejection counts. `no_feasible_plan`
has an empty `plans` array, never a fabricated route or price.

Each plan's integer score is the weighted mean of these 0–100 components:
relevance, mood match, selected-category coverage, preferred-place coverage,
travel efficiency, expected-budget headroom, schedule slack, distinct-category
variety and stop-count coverage. The default weights are respectively
`4, 2, 2, 2, 2, 2, 1, 3, 2`. A caller may supply `weights` with any of these
keys set to integer 0–10; omitted keys keep defaults, and all-zero weights are
rejected. Hard constraints are checked before scoring. Results sort first by
Budget Engine affordability (`fits_conservatively`, `potentially_fits`,
`cannot_determine`), then descending score, descending stop count, then stable
plan ID. Scores rank submitted data; they do not establish real-world quality.

## Response and budget semantics

A successful generation returns `status: "plans_found"`, up to six plans,
`search` metrics and top-level warnings. Each plan has a stable ID, UTC start
and end, ordered stops with arrival/visit/departure times, directed travel
legs, a full expense list, the **unmodified Budget Engine evaluation**, a
nullable spending range, remaining budget, score components and warnings.
For the fictional request above, the single plan starts at
`2026-01-01T04:30:00.000Z`, arrives at `04:40`, ends at `05:40`, and has
minimum/expected/maximum costs of **₹170/₹220/₹270**, with ₹2,530 remaining.
Its affordability is `fits_conservatively` under the supplied estimates,
while warnings still mark estimated transport and prices. An estimated upper
bound is caller data, not a guaranteed real-world cap. An unknown price yields
nullable totals and `cannot_determine`; it never becomes ₹0.

The endpoint retains the global 10 KiB JSON body limit and general 150/IP/15
minute limit, plus its own 20/IP/15 minute limit. Invalid structured input
returns the existing safe HTTP 400 `INVALID_INPUT` envelope; rate-limit
responses may contain only `error`. Successful results use `Cache-Control:
no-store`.

## Future provider integration

Milestone 4C can adapt Google Places into candidate records and dated opening
windows, and Google Routes into the directed travel matrix. Adapters must
preserve unknown data and provenance, respect provider quotas and deadlines,
and mark provider-derived costs as estimated unless independently verified.
This service has no persistence, real-time availability, reservations, taxes,
discounts, accessibility constraints, or route-geometry verification.
