# Rules

A rule describes the times when something applies. Rules are boolean and carry
no application value.

Use a [schedule](../schedules/) for opening hours or a
[cascade](../cascades/) when you need values such as names and prices.

## Build a rule

```ts
import { dates, timeOfDay, weekdays } from "@kensio/quando";

const officeHours = weekdays()
  .and(timeOfDay("09:00", "17:00"))
  .except(dates("2026-12-25"));
```

This rule covers Monday to Friday from 09:00 until 17:00, excluding Christmas
Day.

Every builder returns a rule that is ready to query, combine, serialise, or
store. There is no final `.build()` call.

## Rule builders

| Builder                      | Covered time                               |
| ---------------------------- | ------------------------------------------ |
| `always()`                   | All time                                   |
| `never()`                    | No time                                    |
| `daysOfWeek(...days)`        | Whole days with the selected weekday names |
| `weekdays()`                 | Monday through Friday                      |
| `weekends()`                 | Saturday and Sunday                        |
| `timeOfDay(from, to, zone?)` | A local time range on every day            |
| `dates(...dates)`            | The selected calendar dates                |
| `all(...rules)`              | Times covered by every rule                |
| `any(...rules)`              | Times covered by at least one rule         |
| `not(rule)`                  | Times outside the rule                     |
| `inZone(zone, rule)`         | A rule subtree evaluated in one time zone  |

Builders validate their inputs immediately. Invalid weekday names, dates,
times, and time zones fail where the rule is created.

## Select weekdays

`daysOfWeek` accepts full lowercase weekday names:

```ts
import { daysOfWeek, weekdays, weekends } from "@kensio/quando";

const deliveries = daysOfWeek("monday", "wednesday", "friday");
const workingDays = weekdays();
const restDays = weekends();
```

Consecutive selected days form one continuous interval. For example,
`weekdays()` covers Monday midnight through Saturday midnight.

Calling `daysOfWeek()` with no arguments covers no time.

## Select times of day

`timeOfDay` uses local wall-clock time:

```ts
import { timeOfDay } from "@kensio/quando";

const office = timeOfDay("09:00", "17:00");
const nightShift = timeOfDay("22:00", "06:00");
```

An end earlier than the start continues into the next day. The night shift runs
from 22:00 until 06:00.

Equal endpoints are ambiguous and rejected:

```ts
timeOfDay("09:00", "09:00");
// RangeError: A time-of-day window must have different endpoints.
```

Use `always()` when you mean a full day.

Wall-clock endpoints remain fixed across daylight-saving changes. Their elapsed
duration may change. See [time zones](../time-zones/).

## Select dates

`dates` covers whole ISO calendar dates:

```ts
import { dates } from "@kensio/quando";

const bankHolidays = dates("2026-04-03", "2026-04-06", "2026-05-04");
```

Quando sorts dates, removes duplicates, and joins consecutive dates during
evaluation. It does not provide holiday data. Pass dates from your application
or a calendar package.

Calling `dates()` with no arguments covers no time.

## Combine rules

Built rules have `.and`, `.or`, and `.except` methods:

```ts
const officeHours = weekdays().and(timeOfDay("09:00", "17:00"));
const supportHours = officeHours.or(
  weekends().and(timeOfDay("10:00", "14:00")),
);
const openWithoutHolidays = supportHours.except(bankHolidays);
```

The same operations are available as functions:

```ts
import { all, any, not } from "@kensio/quando";

const officeHours = all(weekdays(), timeOfDay("09:00", "17:00"));
const supportHours = any(
  officeHours,
  all(weekends(), timeOfDay("10:00", "14:00")),
);
const openWithoutHolidays = all(supportHours, not(bankHolidays));
```

The operations use set semantics:

| Operation | Set operation | Meaning                                    |
| --------- | ------------- | ------------------------------------------ |
| `and`     | Intersection  | Every rule covers the time                 |
| `or`      | Union         | At least one rule covers the time          |
| `except`  | Difference    | The source covers it and exceptions do not |

`all()` with no arguments covers all time. `any()` with no arguments covers
no time. These identities make it safe to combine an array that may be empty.

## Set a time zone

A rule without an explicit zone follows the zone of the query context.
`inZone` fixes one rule subtree to a named zone:

```ts
import { inZone } from "@kensio/quando";

const londonOffice = inZone(
  "Europe/London",
  weekdays().and(timeOfDay("09:00", "17:00")),
);
```

The weekday and time-of-day parts now use London local time. A nested `inZone`
can choose a different zone for one child rule.

## Query a rule

The root package provides the common queries:

```ts
import { activeAt, coverageChanges, coveredDuration } from "@kensio/quando";

const monday = Temporal.ZonedDateTime.from("2026-03-09T10:00[Europe/London]");
const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

activeAt(officeHours, monday);
coveredDuration(officeHours, week);
coverageChanges(officeHours, officeHours.except(dates("2026-03-11")), week);
```

See [queries](../queries/) for checking an instant, finding the next interval,
measuring covered time, adding covered time, and comparing coverage.

## Read intervals directly

The core entry point exposes the interval stream behind a rule:

```ts
import { intervals } from "@kensio/quando/core";

for (const { start, end } of intervals(officeHours, week)) {
  console.log(start?.toString(), end?.toString());
}
```

Intervals are ordered, non-overlapping, and half-open. They include `start` and
exclude `end`. Adjacent intervals are joined.

`start` or `end` may be `undefined` for an interval that extends into an
unbounded past or future. A finite context clips intervals to its own bounds.

## Unbounded contexts

The `to` field of a context is optional. Omitting it allows a recurring rule to
produce a lazy, endless stream:

```ts
import { intervals, take } from "@kensio/quando/core";

const future = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
};

const firstThree = take(intervals(officeHours, future), 3);
```

Bound the context when a rule may never produce an interval. An impossible rule
such as `weekdays().and(weekends())` cannot prove an empty result while it keeps
searching an unbounded future.

## Store a rule

Rules are JSON-compatible objects with non-enumerable builder methods.
`parseRule` validates stored data and restores the methods.

See [serialisation](../serialisation/) for stored forms and parser errors.

<!-- card
```ts
const officeHours = weekdays()
  .and(timeOfDay("09:00", "17:00"))
  .except(dates("2026-12-25"));
```
-->
