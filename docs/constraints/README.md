# Constraints

Constraints describe allowed time using existing occurrences. Use them to limit
booking counts, occupied time, or the gap between bookings.

## Choose what to limit

```ts
import {
  atMostOccurrences,
  atMostOccupiedTime,
  minimumGap,
} from "@kensio/quando";

const fourPerDay = atMostOccurrences(4, { per: "day" });
const fourIn24Hours = atMostOccurrences(4, { within: { hours: 24 } });
const sixHoursPerDay = atMostOccupiedTime({ hours: 6 }, { per: "day" });
const oneHourApart = minimumGap({ hours: 1 });
```

`per` starts a new calendar bucket each day, week, month, or year. Use the
singular values `"day"`, `"week"`, `"month"`, and `"year"`. Weeks begin on Monday.
`within` is a rolling duration. Exactly one of `per` and `within` is required.
Add `zone` to the same options object to fix calendar boundaries to a clock.

`minimumGap` measures from one occurrence's end to the next one's start. It
checks existing occurrences both before and after the proposed time. Exactly
the requested gap is enough.

## Supply existing occurrences

An occurrence has an `at` instant and optional `lasting` duration. Occurrences
without `lasting` count toward occurrence limits but occupy no time.

<!-- example: booking-plan -->

```ts
import { allowsPlan, atMostOccupiedTime, firstBreach } from "@kensio/quando";

const at = Temporal.ZonedDateTime.from("2026-03-09T09:00[Europe/London]");
const limit = atMostOccupiedTime({ hours: 1 }, { per: "day" });
const plan = [{ at, lasting: Temporal.Duration.from({ hours: 2 }) }];

console.log(allowsPlan(limit, plan, { occurrences: [] }));
// false
console.log(firstBreach(limit, plan, { occurrences: [] })?.index);
// 0
```

Use `occurrences: []` when the existing history is empty. Omitting it throws
`MissingOccurrencesError`. The array can include future bookings when they
should constrain a proposed booking. Two occurrences at the same instant are
two occurrences. Keep the history as an array.

Domain methods accept the same `occurrences` option as standalone queries.
For example, `office.isOpen(at, { occurrences: existing })` evaluates any
constraints used in that schedule.

## Check the whole booking

`allowsPlan` returns a boolean. `firstBreach` returns the first violation with
the original plan `index`, the violating `at` instant, the `occurrence`, and
an explanation. It returns `undefined` when the whole plan is allowed.

The plan is processed in time order. Each accepted occurrence joins the history
for the next one. Occupied-time limits include the entire candidate booking,
so a two-hour booking cannot pass a one-hour limit merely because the history
was empty at its start. Overlapping occupied intervals count once.

The first violation can be inside a booking. For rolling occupied-time caps it
is the first instant strictly over the allowance. Calendar buckets count the
whole occupancy in that bucket. An overfull bucket can reject the booking at
its start. An exact fit is allowed.

## Ask about one instant

`isActiveAt(rule, at, { occurrences })` asks whether the existing history leaves
room at that instant. It does not add a proposed duration to the history. Use
`allowsPlan` or `firstBreach` to validate a complete proposed booking.

Use `explainRule` for a point explanation. Its `status` is `"matched"`,
`"unmatched"`, or `"unknown"`. Its `conditions` explain each combined constraint.

## Duration meanings

Occupied-time caps use elapsed time. In those caps, a day is exactly 24 hours.
years, months, and weeks are rejected as ambiguous lengths. Occurrence
`lasting` uses calendar addition, so a London day spanning a clock change can
occupy 23 or 25 elapsed hours. Use hours when both lengths must be exact.

One query carries one occurrence history. Check independently constrained
resources separately. Cron and RRULE cannot store occurrence history, so their
exporters return `ok: false` for these constraints.

<!-- card
```ts
const limit = atMostOccurrences(4, { per: "day" })
  .and(minimumGap({ hours: 1 }));
allowsPlan(limit, bookings, { occurrences: existing });
```
-->
