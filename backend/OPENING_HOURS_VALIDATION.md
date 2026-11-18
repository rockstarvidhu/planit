# Opening-hours validation (offline 4F.3)

`opening-hours.js` is a pure, request-scoped normalizer and interval evaluator.
The Places adapter passes its existing `currentOpeningHours` and IANA `timeZone`
fields to it. No hours response is cached, persisted, or sent as a raw Google
object to the mobile client. Place IDs remain the only provider identifiers
used across requests.

## Model and interpretation

Current hours normalize to `status: "known"` (or `"closed"` for an explicitly
empty schedule), optional place ID, provider, `source: "current_opening_hours"`, venue `timeZone`, `fetchedAt`, `validFrom`,
`validUntil`, dated nonoverlapping `windows`, `specialDays`, confidence and
structured warning codes. The coverage
interval is local midnight on the retrieval date through local midnight seven
calendar days later. A visit must fit wholly within this interval and one
open period. A period's start is not assumed to be Sunday. Google can truncate
open/close points to the coverage boundary; these are usable only *inside*
that boundary. `openNow` is never used to validate a future visit.

Synthetic normalized example (the date and venue are fictional):

```json
{
  "status": "known",
  "placeId": "fictional-cafe",
  "provider": "supplied_fixture",
  "source": "current_opening_hours",
  "timeZone": "Asia/Kolkata",
  "fetchedAt": "2026-01-01T04:00:00.000Z",
  "validFrom": "2025-12-31T18:30:00.000Z",
  "validUntil": "2026-01-07T18:30:00.000Z",
  "windows": [{ "opensAt": "2026-01-01T04:30:00.000Z", "closesAt": "2026-01-01T07:30:00.000Z" }],
  "specialDays": [],
  "confidence": "provider_current_hours",
  "warnings": []
}
```

An explicit empty `periods: []` means closed within the covered week. Missing
`periods`, an invalid IANA zone, malformed or overlapping periods, or an
unsupported date yields `unknown`. A 24-hour no-close sentinel covers the
current seven-day interval, never dates beyond it. `specialDays` accompany
the dated current periods, which already incorporate exceptional openings and
closures. The normalizer does not derive a full weekly pattern from those
periods.

`regularOpeningHours` can be held as a request-scoped weekly hint. For a
future interval, `regularHint` interprets weekday/time points with the venue's
IANA timezone, including overnight spans and DST. A regular-hours match is
reported as `regularSchedule: "open"` or `"closed"` under overall `unknown`;
it is **not** verified because holiday and exceptional hours have not been
checked. The existing live field mask does not request regular hours, so this
path is exercised only by synthetic fixtures for now. Missing timezone or
ambiguous/nonexistent DST local times remain unknown. No fixed UTC offset is
used as a timezone substitute.

`evaluateVisitHours(opening, arrival, departure)` returns `open`, `closed`, or
`unknown`, a source, `verifiedForScheduledInterval`, and a reason when needed.
Open means published dated periods cover the *entire* proposed interval; it
is not a guarantee that real-world hours will not change. Closed means the
applicable dated schedule has a gap or closure during that interval. Unknown
means coverage or source information cannot settle it. Closing time is an
exclusive boundary: a visit may finish exactly at closing, but may not extend
beyond it.

The Itinerary Engine still owns scheduling. It may wait within the existing
`maxWaitMinutes` for a later opening, but will never shorten a visit to fit.
Known closure is a hard rejection. Each returned stop has additive
`hoursValidation`; unknown stops retain `UNKNOWN_OPENING_HOURS`. The
orchestrator classifies any plan with an unknown stop as provisional, separate
from the Budget Engine's price assessment. A fixture plan remains provisional
even when all synthetic hours and costs are known.

## Provider strategy and cost

**Selected for a future approved live test: Option A**, the existing
Nearby Search Enterprise field mask, gated by
`ROVE_PLACES_ENTERPRISE_FIELDS_ENABLED=true`. It is off by default. This
milestone did not enable the flag, change the mask, add a provider request,
or make a live call. The current flag adds `places.timeZone` and
`places.currentOpeningHours` to the existing Nearby Search request. It may
retrieve Enterprise hours for up to eight discovered places even though only
four are shortlisted.

Option B would keep Nearby Search Pro and add up to four Place Details
Enterprise requests after shortlisting. It could avoid requesting hours for
discarded places, but adds four calls and bounded sequential or concurrent
latency. It would require extending the existing two-call request-context
budget and protecting against duplicate requests. It is **not implemented or
enabled**. The model below is first-tier list-rate usage after applicable
monthly free caps, before volume discounts, taxes, or contractual terms.
Actual billing eligibility and free-cap balance must be checked in Cloud
Billing. A request is billed by its highest requested field tier, not by how
many returned places are retained.
The published monthly free-usage caps for the compared SKUs are 1,000
events for Enterprise Places globally and 7,000 for eligible India pricing;
Nearby Pro and Routes Matrix Pro list 5,000 globally and 35,000 in India.
These are account-wide monthly thresholds, not a guaranteed free allowance
for this project or run.

| Per plan, four-place shortlist | Global USD | Eligible India USD |
|---|---:|---:|
| A: one Nearby Enterprise | $0.0350 | $0.0105 |
| B: one Nearby Pro + four Details Enterprise | $0.1120 | $0.0336 |
| One walking Routes Pro matrix, 20 elements | $0.2000 | $0.0600 |
| **A total with matrix** | **$0.2350** | **$0.0705** |
| **B total with matrix** | **$0.3120** | **$0.0936** |

Return-to-origin allows 25 matrix elements, making totals $0.2850/$0.0855
for A and $0.3620/$0.1086 for B (global/eligible India). Option A uses at
most one Places request and one Routes request; Option B would use five Places
requests and one Routes request. Both retain the same 20/25 matrix-element
limits. A one-call Enterprise request also fits the existing two-provider-call
context, idempotency guard, provider deadline, no-retry policy, and Cloud
quota protections. For a controlled live test, the owner must separately
confirm the Enterprise SKU quota and billing alert, approve one request, and
inspect the actual Cloud usage afterward. No free usage is guaranteed.

Sources: [Places field tiers](https://developers.google.com/maps/documentation/places/web-service/data-fields),
[current hours and truncation](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places),
[global prices](https://developers.google.com/maps/billing-and-pricing/pricing),
[India prices](https://developers.google.com/maps/billing-and-pricing/pricing-india).

## Data policy and remaining work

Google restricts storage, prefetching and redistribution of Places content;
Place IDs are an exception. Any future persisted plan must refresh provider
hours under the applicable policy before presenting a current claim. Display
of live Places information must retain required Google and third-party
attribution. See [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies).
The current app already treats live plans as nonsavable until a compliant
refresh strategy exists.

Current hours are a provider snapshot, not a reservation or guarantee. Some
venues omit hours, supply incomplete periods, or change schedules after
retrieval. This milestone does not source venue prices or transport fares.
Live Enterprise hours remain disabled. A later owner-approved test should use
one city, one idempotent request, at most four shortlisted places and one
Routes matrix, then compare returned `hoursValidation` against the provider
payload without retaining raw Google content.
