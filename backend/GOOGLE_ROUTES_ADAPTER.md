# Google Routes (New) matrix adapter

Milestone 4C.2 adds `POST /api/routes/matrix`, backed by
`providers/google-routes.js`. It uses the fixed REST endpoint
`https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix` for
bounded directed travel durations and road/path distances. The existing
Legacy Directions call in `/api/itinerary` is unchanged. The deterministic
`/api/plans/generate` route still makes no provider calls.

## Configuration and billing gate

| Server variable | Default | Effect |
|---|---|---|
| `ROVE_ROUTES_MODE` | `disabled` | `fixture` uses fictional data outside production; `live` selects Google. |
| `ROVE_ROUTES_LIVE_ENABLED` | `false` | Must be `true` as well as `live` mode before a call is sent. |
| `ROVE_ROUTES_TRAFFIC_ENABLED` | `false` | Must be `true` for explicit driving `departureTime` and `TRAFFIC_AWARE`. |
| `GOOGLE_API_KEY` | unset | Existing server-side key; must be authorized for Routes API (New). Never returned. |

Requests are limited to 8 per IP per 15 minutes beneath the global
150/IP/15-minute limit. Each endpoint operation performs **at most one**
provider call, using the existing request deadline, 8-second provider timeout,
per-process concurrency cap and service call budget. No retries, pagination,
background calls or cache are introduced. The JSON body limit remains 10 KiB.

Both origin and destination lists contain 1–6 unique IDs and validated world
coordinates. Their Cartesian product is capped at **36 elements before any
provider call**. A 6 × 6 matrix therefore has 36 potentially billable
elements, including self-pairs that the adapter deliberately discards; callers
should pass a small shortlist and avoid unnecessary self-pairs. Google bills
Compute Route Matrix **per element**, not per HTTP request. Google's larger
published limit is not Rove's budget. Basic `DRIVE` uses `TRAFFIC_UNAWARE`
and `WALK` omits routing preference (Essentials); explicit traffic-aware
driving uses `TRAFFIC_AWARE` (Pro) only after both the request and flag opt in.
See Google's [usage and billing](https://developers.google.com/maps/documentation/routes/usage-and-billing)
documentation. The owner must verify Routes API enablement, key restrictions,
quota, budget and billing alerts in Google Cloud before live mode.

## Request and response

```json
{
  "origins": [{ "id": "origin", "latitude": 12.97, "longitude": 77.59 }],
  "destinations": [{ "id": "fictional-cafe", "latitude": 12.971, "longitude": 77.591 }],
  "mode": "walk"
}
```

Only `walk` → Google `WALK` and `drive` → Google `DRIVE` are supported. Taxi,
auto-rickshaw, cycling and transit are **not** silently treated as driving;
unsupported mode returns 400 `UNSUPPORTED_MODE`. A departure time is accepted
only for driving, must be offset-aware RFC 3339, and must be between now and
seven days ahead. Walking with a departure time returns 400. For drive, an
explicit departure time opts into predicted traffic and the Pro billing tier;
without it, the adapter uses time-independent `TRAFFIC_UNAWARE` routing.
Google's [matrix method](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRouteMatrix)
permits routing preference only for driving or two-wheel modes. Walking
routes are beta; their caution warning is returned for any walking result and
must be displayed if a future UI presents the route. See Google's
[vehicle mode guidance](https://developers.google.com/maps/documentation/routes/vehicles-rm).

The explicit field mask is:

`originIndex,destinationIndex,status,condition,distanceMeters,duration`

`status` is essential because individual elements can fail even when the HTTP
request succeeds. No wildcard, toll, fare, polyline, traffic model or Route
Details field is requested. REST JSON array responses and line-delimited JSON
are accepted, with bounded response size. Rows are keyed by their returned
indices, **never array order**.

The response has `{status,provider,mode,legs,failed,warnings,attribution,usage}`.
`status` is `ok`, `partial` or `unavailable`. Each successful leg contains
`fromId`, `toId`, mode, `durationSeconds`, `durationMinutes`, `distanceMeters`,
`confidence:"estimated"`, a source, server calculation time, optional
departure time, provider provenance and an **unknown** group transport cost:

```json
{
  "fromId": "origin", "toId": "fictional-cafe", "mode": "walk",
  "durationSeconds": 601, "durationMinutes": 11, "distanceMeters": 875,
  "confidence": "estimated",
  "cost": { "unit": "group", "priceStatus": "unknown",
    "minimumCost": null, "expectedCost": null, "maximumCost": null }
}
```

The duration string is parsed as seconds, including fractional seconds. The
adapter rounds **up** to integer seconds and then up to integer minutes for
the existing planner; it does not understate travel time. Durations outside
the planner's 1–180 minute range become unavailable rather than invalid legs.
Distance is the route distance returned by Google, not a straight-line guess.
No taxi fare, auto fare, fuel price or return cost is invented. The Budget
Engine will treat the unknown transport expense as `cannot_determine`.

Failed, missing, duplicate, malformed, self and `ROUTE_NOT_FOUND` pairs are
listed separately in `failed` with a fixed reason. A valid leg in a partial
matrix remains usable; no missing reverse leg is synthesized. A wholly
malformed response or an HTTP/provider failure is an error, not a successful
empty matrix. Timeouts map to 504, quota to 503, authentication to 502; raw
provider messages and headers are never reflected. `usage` exposes requested,
successful and failed elements, provider request count (zero in fixture),
potentially billable live elements, mode and traffic-aware status. The API
returns `Cache-Control: no-store`.

## Integration and policy

The offline integration test passes a Places fixture candidate and a Routes
fixture leg to the existing Itinerary Engine. With the Places candidate's
unknown visit duration, the engine returns `no_feasible_plan`. A separate,
explicitly supplied **fictional test duration** lets the planner run, while
unknown venue and transport prices still yield `cannot_determine`. Production
orchestration, justified visit-duration estimates and route shortlist design
remain Milestone 4C.3 work. The adapter does not alter Budget Engine rules.

The route response flags Google attribution. A future client displaying live
route results must show Google's required copyright statement, and must follow
the [Routes API policies](https://developers.google.com/maps/documentation/routes/policies)
for attribution and Google Maps content storage. This adapter does not persist
or cache route results. The current mobile UI does not consume this endpoint.

All tests use injected transports or fictional fixtures. No real Google API
request was made. Real-world route accuracy, traffic forecasts, Cloud setup,
billing and client attribution remain unverified until separately authorized.
