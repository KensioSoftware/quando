---
description: "Limit booking counts and occupied time with Quando constraints."
---

# Constraints

Constraints use existing occurrences, such as bookings, to decide whether a
proposed time is allowed. They can limit booking counts, total occupied time,
or the gap between bookings.

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

Use `per` for a limit that resets at calendar boundaries. Accepted values are
`"day"`, `"week"`, `"month"`, and `"year"`. Weeks begin on Monday. Use
`within` for a rolling duration. Supply exactly one of these options.

Add `zone` to the same options object to fix the time zone used for calendar
boundaries.

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

Always supply `occurrences`, using `[]` for empty history. Omitting it throws
`MissingOccurrencesError`. Include future bookings when they should constrain
the proposal. Keep entries at the same instant as separate array items if
they represent separate occurrences.

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

Occupied-time caps use elapsed time. A day in a cap means exactly 24 hours.
Years, months, and weeks are rejected because their elapsed lengths vary.

An occurrence's `lasting` duration uses calendar addition. A one-day London
booking that crosses a clock change can occupy 23 or 25 elapsed hours. Use
hours in `lasting` when you need an exact elapsed duration.

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
