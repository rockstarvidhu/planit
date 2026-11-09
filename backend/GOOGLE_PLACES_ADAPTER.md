# Google Places (New) discovery adapter

Milestone 4C.1 adds `POST /api/places/discover` in `index.js` and a contained
`providers/google-places.js` adapter. The existing `/api/itinerary` still uses
Google Places **Legacy** text search/details/photo endpoints; its behavior and
mobile contract are unchanged. This adapter uses the fixed Places (New)
`places:searchNearby` endpoint. There is no Routes, Gemini, mobile UI or
background integration in this milestone.

## Configuration and cost controls

| Server setting | Default | Meaning |
|---|---|---|
| `ROVE_PLACES_MODE` | `disabled` | `fixture` for local/test fictional data or `live` for Google. Fixture is blocked when `NODE_ENV=production`. |
| `ROVE_PLACES_LIVE_ENABLED` | `false` | Must be `true` in addition to live mode; otherwise no Google call. |
| `ROVE_PLACES_ENTERPRISE_FIELDS_ENABLED` | `false` | Must be `true` before a request may set `includeOpeningHours:true`. |
| `GOOGLE_API_KEY` | unset | Existing server-side key, required only for live mode; never send to a client. |

The endpoint permits 10 requests per IP per 15 minutes, under the general
150/IP/15 minute limiter. Proxy trust stays governed by exact
`TRUSTED_PROXY_IPS` ingress addresses. Each discovery uses at most one provider
call under the existing request deadline, provider timeout (8 seconds), global
provider concurrency and call budgets. There is no pagination, Place Details,
automatic retry or response cache. The request body is capped at 10 KiB.
Google Cloud API enablement, key restrictions, quotas, budgets and billing
alerts must be verified by the owner before live mode is enabled; these
cloud settings are not verifiable from this repository.

## Request and response

```json
{
  "latitude": 12.97, "longitude": 77.59, "radiusMeters": 3000,
  "categories": ["Cafe", "Food"], "limit": 8,
  "includeOpeningHours": false
}
```

Coordinates are finite world coordinates. Radius is an integer 100–10,000
meters; limit is an integer 1–12 (default 8). `categories` is a unique list
of 1–3 supported categories. `plannedAt` is optional except when opening
hours are requested, when it must be an offset-aware timestamp. Unknown
category names, malformed timestamps and out-of-range values return 400.
Clients cannot supply Google URLs, provider field masks or provenance.

The response is `{status:"ok",provider,candidates,attribution,warnings,skipped}`.
`provider` is `google_places_new` or `rove_fixture`. A valid empty Google
result is `candidates:[]`; disabled service, quota, timeout and malformed
responses are errors, never a successful empty result. Errors use the existing
safe `{error,code}` envelope (except rate-limit middleware, which has `error`
only). Live results require Google Maps attribution; each candidate carries
filtered third-party attribution text and safe HTTPS links when provided.
`Cache-Control: no-store` is set on success and error responses.

Each candidate has `id` (Google Place ID), `name`, coordinates, Rove category,
`tags:[]`, `visitMinutes:null`, opening status, an unknown-cost expense,
server-generated `source` and `provenance`, business status and attribution.
`provenance` records provider, fetch time, Place ID, opening confidence and
unknown price status. A place without a valid ID, name or coordinates is
skipped. Closed businesses and irrelevant primary types are excluded;
duplicate IDs collapse to one candidate. All skipped counts are reported.
Price level returned unexpectedly by the provider is deliberately ignored:
it is not an INR meal or outing cost. The unknown expense has null
minimum/expected/maximum values, never zero.

The deterministic planner now accepts `visitMinutes:null` for an explicitly
unknown visit duration but excludes it from scheduling and counts it in
`search.issues.unknownDuration`. It still requires real directed travel legs;
this adapter creates none. Milestone 4C.2 must acquire or otherwise provide
defensible visit durations and travel legs before these candidates can yield
plans. No zero-minute routes or manufactured visit times are inserted.

## Discovery type mapping

| Rove category | Places (New) included types |
|---|---|
| Cafe | `cafe`, `coffee_shop`, `tea_store` |
| Food | `restaurant`, `food_court` |
| Movies | `movie_theater` |
| Outdoors | `park`, `botanical_garden`, `garden`, `hiking_area`, `national_park` |
| Entertainment | `amusement_park`, `museum`, `bowling_alley`, `video_arcade`, `art_gallery` |
| Shopping | `shopping_mall`, `market`, `book_store` |

Only these explicit types enter a search. Generic `point_of_interest` is not
treated as an outing. `school`, `hospital`, `bank`, `gas_station`,
`corporate_office` and `airport` primary types are excluded even if secondary
types overlap. Unrecognized types remain excluded. Google type availability
and regional results should be verified with fixtures before broad rollout.

## Fields and opening hours

The default explicit field mask is:

`places.id,places.displayName,places.location,places.primaryType,places.types,places.businessStatus,places.attributions`

These Nearby Search fields fall in the **Pro** billing family. Opening hours
add `places.timeZone,places.currentOpeningHours` only when both the request
and Enterprise configuration opt in. `currentOpeningHours` is an **Enterprise**
field. Neither path requests price, price range, ratings, photos or `*`.
Billing depends on the actual Google Cloud SKU and account; review current
[Nearby Search](https://developers.google.com/maps/documentation/places/web-service/nearby-search),
[field](https://developers.google.com/maps/documentation/places/web-service/data-fields),
and [SKU](https://developers.google.com/maps/billing-and-pricing/sku-details/places)
documentation before enabling live traffic.

When hours are requested, the adapter uses only provider **current** dated
periods and the venue's IANA `timeZone.id`. It converts each local open/close
point to an absolute ISO timestamp, supporting midnight crossing and dated
special hours. It does not expand regular weekly schedules. If hours are
missing, the timezone is invalid, a point is ambiguous/nonexistent at a DST
transition, periods are malformed/overlap, or the planned local date is
outside today plus six days at fetch time, opening remains `unknown` with a
warning. An empty period list also remains unknown. This is conservative;
actual hours can change after retrieval. See the [Place resource](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places)
for current versus regular hours. The planning engine interprets unknown
hours as uncertainty, not confirmed open status.

## Policy and data handling

The adapter does not persist or cache Google result content. Place IDs are
separate stable references and have a policy exception for storage; any future
database must review Google's [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies)
before storing names, coordinates, hours, photos or other content. When live
results appear in an app, the client must show Google Maps attribution and
any supplied third-party attribution. Google specifies logo/attribution rules
for lists without a Google map; the current mobile UI does not display this
endpoint, so rollout must include a compliant display and public Terms of Use
and Privacy Policy disclosures. The API response flags required attribution
but cannot itself satisfy the client display requirement.

## Offline testing and limitations

`npm test` uses fictional fixtures and injected mock transports; no test makes
a Google network call. `ROVE_PLACES_MODE=fixture` can exercise the route in a
nonproduction environment with one explicitly fictional café. The existing
Google Legacy integration is untouched. Live credentials, cloud billing,
actual regional type coverage, Google production payloads and client policy
display remain unverified. No real API request was made in this milestone.
