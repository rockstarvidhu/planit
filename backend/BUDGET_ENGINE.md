# Deterministic Budget Engine

`budget-engine.js` is a pure CommonJS calculation service. `POST /api/budget/evaluate`
exposes it through the existing Express JSON parser, IP rate limits and safe error
handler. It makes no provider requests and does not alter `/api/itinerary`.

## Model

- All money is **integer INR** (whole rupees). Inputs and results must be safe
  integers; intermediate multiplication, addition, division and percentage
  calculations use `BigInt`. Unsafe or overflowing values are rejected.
- `budgetMode: "total"` means `budgetAmount` covers the whole group.
  `"perPerson"` multiplies it by `people`. `effectiveBudgetPerPerson` is the
  floor of total divided by people; `perPersonRemainder` preserves the remainder.
- Each expense has a unique `id`, `category`, integer `quantity` (1–1000),
  `unit` (`group` or `person`), `priceStatus`, and unit prices
  `minimumCost`, `expectedCost`, `maximumCost`. A group unit is charged
  `quantity` times; a person unit is charged `quantity × people` times.
- `verified` requires equal nonnegative prices plus `source.name` and an ISO UTC
  `source.verifiedAt`. Optional `source.reference` is an opaque label.
  `estimated` requires minimum and expected prices in order; maximum may be
  `null` when no upper bound is known. `unknown` requires all three prices to
  be `null`. The engine cannot itself authenticate a claimed source or timestamp.
- `contingencyPercent` defaults to 0 and is an integer 0–100. The reserve is
  `ceil(effectiveTotalBudget × contingencyPercent / 100)`, rounded **once**.
  `spendableBudget` excludes that reserve. `remainingBudget` is spendable minus
  expected cost and may be negative. Utilization is expected cost divided by
  **effective total budget**, in integer basis points (10,000 = 100%).
- Complete minimum/expected/maximum totals are `null` when any corresponding
  expense price is unknown. `maximum` is also `null` for an unbounded estimate.
  Unknown prices are never treated as free. The itemized breakdown exposes
  `unitsCharged` and each scaled cost; warnings list missing, unbounded and
  estimated expense IDs.

Affordability is `exceeds` if known minimum costs already exceed spendable
budget; `cannot_determine` if any prices are unknown; `fits_conservatively` if
every maximum is known and their sum fits; otherwise `potentially_fits`.
An estimated expense remains labeled estimated even when its maximum fits.

## Example

The expenses below are **fictional test data**, not venue prices.

```json
{
  "currency": "INR",
  "budgetAmount": 2750,
  "budgetMode": "total",
  "people": 2,
  "contingencyPercent": 10,
  "expenses": [
    { "id": "fictional-ride", "category": "travel", "quantity": 1,
      "unit": "group", "priceStatus": "verified", "minimumCost": 500,
      "expectedCost": 500, "maximumCost": 500,
      "source": { "name": "Fictional test receipt", "verifiedAt": "2026-01-01T00:00:00Z" } },
    { "id": "fictional-meal", "category": "food", "quantity": 1,
      "unit": "person", "priceStatus": "estimated", "minimumCost": 250,
      "expectedCost": 300, "maximumCost": 400 }
  ]
}
```

The response includes the original normalized fields and a two-item breakdown.
Its calculation fields are:

```json
{
  "effectiveTotalBudget": 2750,
  "effectiveBudgetPerPerson": 1375,
  "perPersonRemainder": 0,
  "contingencyReserve": 275,
  "spendableBudget": 2475,
  "totalMinimumCost": 1000,
  "totalExpectedCost": 1100,
  "totalMaximumCost": 1300,
  "remainingBudget": 1375,
  "utilizationBasisPoints": 4000,
  "affordability": "fits_conservatively",
  "warnings": [{ "code": "ESTIMATED_PRICES", "expenseIds": ["fictional-meal"] }]
}
```

Malformed input returns HTTP 400 `{ "error": "Invalid …", "code": "INVALID_INPUT" }`.
The endpoint is limited to 60 requests per IP per 15 minutes, beneath the
existing general limit of 150, and accepts at most 50 expenses within the
existing 10 KiB body limit. Its result is `Cache-Control: no-store`.

## Limits and next integration

This service evaluates supplied prices; it does not discover places, verify
receipts, estimate unknown prices, account for taxes or discounts, or persist
plans. The future itinerary editor can submit a complete new expense list after
each change and compare deterministic breakdowns. It must keep provider-derived
prices marked `estimated` unless independently verified, and must not treat a
`null` total as zero.
