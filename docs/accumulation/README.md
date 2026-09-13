---
description: "Calculate totals from numeric values over time with Quando."
---

# Accumulating values over time

Accumulation multiplies each numeric value by the time it applies, then adds
the results within a finite window. Use it to calculate totals such as
staff-hours or usage charges.

## Total a tally

Use `Tally.totalBetween` when your values are already expressed as a tally:

```ts
import { dates, tally, timeOfDayRange, weekdays } from "@kensio/quando";

const shift = weekdays().and(timeOfDayRange("09:00", "17:00"));
const wednesdayShift = shift.and(dates("2026-03-11"));
const staff = tally().plus(shift, 3).plus(wednesdayShift, 2);

const monday = Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]");
const nextMonday = Temporal.ZonedDateTime.from(
  "2026-03-16T00:00[Europe/London]",
);

const staffHours = staff.totalBetween(monday, nextMonday, "hour");
```

The result is `136`. Three people work forty hours and two extra people work
eight hours on Wednesday.

The last argument sets the elapsed-time unit. With `"hour"`, the result is
136 staff-hours. Accepted units range from `"hour"` down to `"nanosecond"`.

## Accumulate a numeric cascade

Use `accumulate` to total a numeric cascade directly:

```ts
import { accumulate, dates, timeOfDayRange, weekdays } from "@kensio/quando";
import { layer, merged } from "@kensio/quando/core";

const shift = weekdays().and(timeOfDayRange("09:00", "17:00"));
const peak = dates("2026-03-11").and(timeOfDayRange("09:00", "17:00"));
const rate = merged("sum", layer(shift, 10), layer(peak, 2));
const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

const total = accumulate(rate, week, "hour");
```

This result is `416`. The base value contributes 400 and the Wednesday peak
contributes another 16.

`accumulate` resolves overlaps and replacements before calculating the total.
Unassigned time contributes zero.

## Elapsed time and finite windows

Accumulation measures elapsed time. A whole day contributes 23 hours when the
local clock moves forward and 25 hours when it moves back. `unit` therefore
takes hours and smaller units only.

Counting whole days is a separate query. `coveredDayCount` and
`addCoveredDays` count local calendar dates that carry covered time, and
a 23-hour day is one of them. See the
[queries guide](../queries/#count-whole-covered-days).

Every accumulation requires a finite end time (`to`). An unbounded recurring
value may have no finite total.

`tally({ zone: "Europe/London" })` fixes contribution scopes to that clock.
All tally queries accept evaluation settings, including occurrence history.
`countIntervals(from, to)` requires a finite end and includes zero-count gaps.
`minimumCount` includes the zero fallback and preserves negative counts.

<!-- card
```ts
const staffHours = staff.totalBetween(monday, nextMonday, "hour");
```
-->
