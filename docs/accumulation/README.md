# Accumulating values over time

Accumulation totals numeric values such as staffing, rates, or usage over a
finite time window.

## Total a tally

Use `Tally.totalBetween` when your values are already expressed as a tally:

```ts
import { dates, tally, timeOfDay, weekdays } from "@kensio/quando";

const shift = weekdays().and(timeOfDay("09:00", "17:00"));
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

The last argument names the elapsed-time unit used in the result. Accepted
units range from `"hour"` down to `"nanosecond"`. The explicit unit keeps a
plain number meaningful wherever it is stored or displayed.

## Accumulate a numeric cascade

Use `accumulate` with a numeric cascade when you work below the tally API:

```ts
import { accumulate, dates, timeOfDay, weekdays } from "@kensio/quando";
import { layer, merged } from "@kensio/quando/core";

const shift = weekdays().and(timeOfDay("09:00", "17:00"));
const peak = dates("2026-03-11").and(timeOfDay("09:00", "17:00"));
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
local clock moves forward and 25 hours when it moves back.

Every accumulation needs a `to` value. An open-ended recurring value could
continue forever, so it has no finite total.

<!-- card
```ts
const staffHours = staff.totalBetween(monday, nextMonday, "hour");
```
-->
