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

| Builder                             | Covered time                                       |
| ----------------------------------- | -------------------------------------------------- |
| `always()`                          | All time                                           |
| `never()`                           | No time                                            |
| `daysOfWeek(...days)`               | Whole days with the selected weekday names         |
| `weekdays()`                        | Monday through Friday                              |
| `weekends()`                        | Saturday and Sunday                                |
| `daysOfMonth(...days)`              | Whole days at the selected positions in each month |
| `nthDayOfWeekInMonth(nth, ...days)` | The nth Monday, Friday and so on, in each month    |
| `monthsOfYear(...months)`           | The selected months, in full                       |
| `every(n, period, options)`         | Every nth day, week, month or year                 |
| `timeOfDay(from, to, zone?)`        | A local time range on every day                    |
| `dates(...dates)`                   | The selected calendar dates                        |
| `onOrAfter(date, zone?)`            | Every day from a date onwards                      |
| `onOrBefore(date, zone?)`           | Every day up to a date                             |
| `between(from, to, zone?)`          | Every day from one date to another                 |
| `all(...rules)`                     | Times covered by every rule                        |
| `any(...rules)`                     | Times covered by at least one rule                 |
| `not(rule)`                         | Times outside the rule                             |
| `inZone(zone, rule)`                | A rule subtree evaluated in one time zone          |

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

## Select days of the month

`daysOfMonth` takes positions in the month. Positive numbers count from the
first day, and negative numbers count back from the last:

```ts
import { daysOfMonth } from "@kensio/quando";

const invoiceDay = daysOfMonth(1);
const paydays = daysOfMonth(15, -1);
const monthEnd = daysOfMonth(-1);
```

A negative day is resolved against whichever month it falls in. `daysOfMonth(-1)`
covers 28 February in an ordinary year, 29 February in a leap year, and 31
March.

A positive day that a month never reaches covers no time in that month.
`daysOfMonth(31)` covers seven months of the year, and February in none of them.
Use `daysOfMonth(-1)` for the end of every month.

Days are whole calendar days, so consecutive selections join. `daysOfMonth(1, -1)`
covers the last day of one month and the first of the next as one interval.

Zero and numbers beyond 31 in either direction are rejected where the rule is
written. Calling `daysOfMonth()` with no arguments covers no time.

## Select the nth day of the week in a month

`nthDayOfWeekInMonth` counts occurrences of a weekday within the month. This is the
shape of every recurring monthly meeting there is:

```ts
import { nthDayOfWeekInMonth } from "@kensio/quando";

const boardMeeting = nthDayOfWeekInMonth(1, "monday");
const patchTuesday = nthDayOfWeekInMonth(2, "tuesday");
const payrollCutoff = nthDayOfWeekInMonth(-1, "friday");
```

The count runs from the start of the month at `1` and back from the end at
`-1`. The last Friday is the last one whether the month holds four or five.

A month without a fifth of that weekday covers no time. `nthDayOfWeekInMonth(5, "monday")`
matches in some months and not others, which is why `-1` is the way to write
"the last".

More than one weekday takes the same position in the month:

```ts
const firstWeekend = nthDayOfWeekInMonth(1, "saturday", "sunday");
```

The count is per weekday. This is the first Saturday and the first Sunday, and
in a month where the two fall next to each other they join into one interval.

Counts run from 1 to 5 and from -1 to -5. No month holds six of any weekday, so
anything further is rejected where the rule is written.

## Select months

`monthsOfYear` takes month names, the way `daysOfWeek` takes weekday names:

```ts
import { monthsOfYear } from "@kensio/quando";

const summerBreak = monthsOfYear("july", "august");
const financialYearEnd = monthsOfYear("march");
```

Names avoid the ambiguity that month numbers carry (`Temporal` counts from 1
and the older `Date` counts from 0). The `MONTHS` export lists all twelve.

Consecutive months form one interval, and the year wraps.
`monthsOfYear("december", "january")` covers one stretch across the new year.

Combine the two for a rule about a particular date in a particular month:

```ts
const quarterEnds = monthsOfYear("march", "june", "september", "december").and(
  daysOfMonth(-1),
);
```

Calling `monthsOfYear()` with no arguments covers no time.

## Repeat every nth period

`every` steps through the calendar a period at a time. The anchor fixes which
cycle counts as the first:

```ts
import { daysOfWeek, every, onOrAfter } from "@kensio/quando";

const fortnightly = every(2, "weeks", { anchor: "2026-03-09" }).and(
  daysOfWeek("monday"),
);
```

Periods are `"days"`, `"weeks"`, `"months"` and `"years"`. The `PERIODS` export
lists them.

The whole of each selected period is covered, so `every(2, "weeks")` on its own
covers seven days out of every fourteen. Intersect it with something narrower
for the day within them, as above.

Weeks are seven-day blocks measured from the anchor. A cycle anchored on a
Wednesday has weeks running Wednesday to Wednesday. Months and years are counted
on the calendar, so a quarterly cycle covers whole months whatever their length.

### The anchor sets the phase

Periods are counted in both directions. A cycle anchored in April also covers
the right weeks in March, so bound it with a date when the recurrence has a
start:

```ts
const meetings = every(2, "weeks", { anchor: "2026-03-09" })
  .and(daysOfWeek("monday"))
  .and(onOrAfter("2026-03-23"));
```

Keeping the two apart means one rule says what the rhythm is and the other says
when it runs. See [bound a stretch of the calendar](#bound-a-stretch-of-the-calendar).

An interval of `1` selects every period, which covers all of time.

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

## Bound a stretch of the calendar

Every rule above recurs forever. `onOrAfter`, `onOrBefore` and `between` bound
one. A schedule can then start on a date, stop on a date, or run for a season:

```ts
import { between, onOrAfter, weekdays, weekends } from "@kensio/quando";

const newHours = weekdays().and(onOrAfter("2026-04-01"));
const summerWeekends = weekends().and(between("2026-06-01", "2026-08-31"));
```

`newHours` covers no weekday before 1 April and every weekday from then on.

Both ends are included. A date names a whole day here, the way it does in
`dates`, so `between("2026-04-01", "2026-04-30")` covers the whole of 30 April
and `between(d, d)` covers that one day.

An unbounded end stays unbounded. Read `onOrAfter("2026-04-01")` over a context
with no end and one interval comes back, open at the far end.

A range that ends before it starts is rejected where it is written. It covers
no time, and it almost always means the two arguments were swapped.

A range needs at least one end. The rule type is two shapes rather than one
with two optional fields, so `{ type: "dateRange" }` will not compile, and
`parseRule` refuses the same document arriving as stored JSON. Use `always()`
for all of time.

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
