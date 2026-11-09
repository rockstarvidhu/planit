# Bounded planning orchestrator

`POST /api/plans/create` connects the existing Places (New) adapter, Routes
(New) adapter and deterministic Itinerary Engine. The Itinerary Engine still
calls the Budget Engine; this service does not reimplement scheduling,
ranking or affordability. `/api/plans/generate` remains pure and unchanged,
and the Legacy `/api/itinerary` flow is unchanged. No Gemini or mobile UI
integration is added here.

## Request

```json
{
  "origin": { "latitude": 12.97, "longitude": 77.59 },
  "startAt": "2026-01-01T10:00:00+05:30",
  "availableMinutes": 240,
  "budgetAmount": 2750,
  "budgetMode": "total",
  "people": 2,
  "categories": ["Cafe", "Food"],
  "transportMode": "walk"
}
```

`startAt` must have an offset and be between now and seven days ahead.
`budgetMode` is `total` or `perPerson`; `people` is 1–50. Budget, duration,
coordinates and optional `contingencyPercent`, `mood`, `maxStops`,
`returnToStart` and `excludedPlaceIds` are validated by the existing engine.
The request accepts 1–3 supported categories. Transportation is `walk` or
`drive`; taxi, auto-rickshaw, cycling and transit are rejected explicitly.
`visitDurations` may provide at most four `{placeId: minutes}` estimates,
each 15–360 minutes. It cannot make a fixed-schedule movie schedulable without
session data. The client cannot supply provider URLs, API keys, field masks,
search radii, result limits, cost claims, source status or call budgets.

## Work and cost bounds

The server requests at most **8** Places results within **3,000 metres** and
deterministically selects at most **4** route candidates by requested category
order, then Place ID. Exclusions, invalid identities and fixed-schedule
activities are removed before routing. One Places request and one Routes
matrix request are the only allowed provider calls. The Express request
context allows at most two provider calls total; each adapter itself makes
at most one. There are no retries or follow-up Place Details requests.

The matrix uses the user's origin plus shortlisted places as origins, and
shortlisted places as destinations. Without return-to-start this is at most
5 × 4 = **20** billable elements. A requested return adds origin as a
destination, yielding at most 5 × 5 = **25** elements. Both are below the
Routes adapter's hard 36-element cap. Matrix results are directed; the
orchestrator never copies A → B to B → A. It does not request traffic-aware
durations because later itinerary legs depart at different times and a single
matrix departure time would misrepresent them. Basic driving therefore uses
the Routes adapter's time-independent mode.

The endpoint has a dedicated 5/IP/15-minute limiter beneath the global
150/IP/15-minute limiter. When either provider is configured live, a valid
`Idempotency-Key` header is required. Reusing a key from the same IP within
15 minutes returns 409, including after an upstream failure; the guard stores
only a SHA-256 request digest, never Google content. The guard is **process
local**, so multi-instance deployment needs a shared retry gate and Cloud
quota/budget controls. Live Places and Routes remain disabled by default.
Fixture mode must be explicitly configured for both adapters and is blocked
in production. Tests use fictional fixtures and never call Google.

## Duration, hours and price policy

Default Rove visit-duration assumptions are Café **45**, Food **75**,
Outdoors **60** and Shopping **60** minutes. They are configurable in the
server-side `DEFAULT_DURATIONS` policy or through internal dependency
injection. User overrides are labeled `user_supplied_estimate`; defaults are
labeled `rove_planning_assumption`. Neither is a Google-verified fact.
Entertainment without an explicit duration is excluded; Movies are excluded
even with a duration because a real session start is required. Duration
provenance is returned separately from Google Place provenance.

The orchestrator requests current hours only when the existing
`ROVE_PLACES_ENTERPRISE_FIELDS_ENABLED=true` configuration opts into the
higher-cost Places field. It never upgrades unknown hours to known. It lets
the existing engine calculate a tentative schedule using unknown hours, but
places that schedule **only in `provisionalPlans`**, never confirmed `plans`.
Provider-current dated hours may support a confirmed schedule, subject to
later real-world changes. No ordinary weekly hours are expanded into dates.

The adapters keep venue and transport prices unknown. The Budget Engine then
returns `cannot_determine`, null expected/conservative remaining amounts,
and warning categories. `budgetSummary.knownCostSubtotalRange` is only the
subtotal of known line items, calculated by the Budget Engine; it is **not**
a total outing cost when unknown expenses remain. When no priced items exist,
the subtotal range is null rather than zero. Party size and per-person
mode are handled by that engine. A plan is placed in confirmed `plans` only
when every stop has known opening hours and the Budget Engine reports
`fits_conservatively` and neither provider is a fixture. All others are in `provisionalPlans`. With the current
Google adapters, live prices and transport cost are unknown, so `ready` is
not normally reachable. A future independently sourced price/fare model would
need its own provenance and validation before changing that.

## Response and statuses

The response includes `status`, `demo`, `plans`, `provisionalPlans`,
`suggestions`, `exclusions`, `warnings`, `providers`, `attribution`, `usage`
and, when planning reaches the engine, `search`. Each plan retains the
engine's exact timed stops, directed travel legs, expenses, score and Budget
Engine evaluation, plus a `budgetSummary`, duration provenance and data
quality flags. `suggestions` expose the shortlisted places independently of
whether a complete route or schedule was possible. `exclusions` give stable
reason codes for candidates omitted before routing and failed matrix pairs.

| Status | Meaning |
|---|---|
| `ready` | At least one nonfixture plan has known dated hours and conservatively affordable, known costs. Other plans may still be provisional. |
| `provisional` | Timed tentative plans exist, but hours or affordability are uncertain. The confirmed `plans` list is empty. |
| `insufficient_data` | No usable destination or route exists; reasons appear in warnings and exclusions. |
| `no_feasible_plan` | Data reached the engine, but its schedule, route, time or budget constraints yield no plan. |
| `provider_unavailable` | Places or Routes is disabled, timed out, quota-limited or failed. HTTP status matches the safe provider failure (usually 502/503/504); no fictional fallback occurs. |

Fixture example: one fictional café, unknown hours and prices, a fictional
10-minute route, and the default 45-minute café visit produce a
`provisional` response with empty `plans`, one tentative 55-minute plan in
`provisionalPlans`, `demo:true`, and `cannot_determine` affordability.
The calculated plan start and end depend on the submitted start time.

With both adapters in fixture mode and a test clock before the sample
`startAt` above, the relevant response fields are:

```json
{
  "status": "provisional", "demo": true, "plans": [],
  "provisionalPlans": [{
    "startAt": "2026-01-01T04:30:00.000Z",
    "endAt": "2026-01-01T05:25:00.000Z",
    "budgetSummary": {
      "assessment": "cannot_determine",
      "unknownExpenseCategories": ["activity", "transport"],
      "expectedRemaining": null, "conservativeRemaining": null
    },
    "dataQuality": { "openingHours": "unknown", "prices": "unknown" }
  }],
  "providers": { "places": "rove_fixture", "routes": "rove_fixture" },
  "usage": { "placesRequests": 0, "routesRequests": 0, "routeElements": 2 }
}
```

The actual response also contains full timed stops, expenses, search metrics,
warnings, exclusions and attribution. No fixture item is a real destination.

Google Maps and Routes attribution flags and Places third-party credits are
propagated for client rendering. A future Android UI must display required
Google branding/copyright and third-party credits when showing live results;
the backend metadata alone does not satisfy display requirements. No Google
Places or Routes response is cached or persisted. See the
[Places policies](https://developers.google.com/maps/documentation/places/web-service/policies)
and [Routes policies](https://developers.google.com/maps/documentation/routes/policies).

## Remaining integration limits

This is not yet a public, verified real-world itinerary product. The current
adapters do not supply venue prices, transport fares or movie sessions;
many locations also lack current hours. Matrix travel times are estimates,
and one static matrix does not model traffic at every future leg departure.
Cloud API enablement, quotas, key restrictions, billing and actual response
quality require owner review before live traffic. Multi-instance deployments
need distributed rate limiting and idempotency. Android must distinguish
confirmed from provisional plans and never present fixture data as real.
