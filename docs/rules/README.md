---
description: "Define recurring periods and combine them with Quando's boolean rule operations."
---

# Rules

A rule defines the times when a condition holds. Use rules to describe
recurring periods, select dates, and combine or exclude covered time.

Use a [schedule](../schedules/) for opening hours or a
[cascade](../cascades/) when you need values such as names and prices.

## Build a rule

```ts
import { dates, timeOfDayRange, weekdays } from "@kensio/quando";

const officeHours = weekdays()
  .and(timeOfDayRange("09:00", "17:00"))
  .except(dates("2026-12-25"));
```

This rule covers Monday to Friday from 09:00 until 17:00, excluding Christmas
Day.

Every builder returns a rule that is ready to query, combine, serialise, or
store. There is no final `.build()` call.

## Rule builders

| Builder                              | Covered time                                        |
| ------------------------------------ | --------------------------------------------------- |
| `always()`                           | All time                                            |
| `never()`                            | No time                                             |
| `daysOfWeek(...days)`                | Whole days with the selected weekday names          |
| `weekdays()`                         | Monday through Friday                               |
| `weekends()`                         | Saturday and Sunday                                 |
| `daysOfMonth(...days)`               | Whole days at the selected positions in each month  |
| `nthDayOfWeekInMonth(nth, ...days)`  | The nth Monday, Friday and so on, in each month     |
| `monthsOfYear(...months)`            | The selected months, in full                        |
| `monthCodes(...codes)`               | The selected months, named as `Temporal` names them |
| `everyNthPeriod(n, period, options)` | Every nth day, week, month or year                  |
| `timeOfDayRange(from, to, zone?)`    | A local time range on every day                     |
| `dates(...dates)`                    | The selected calendar dates                         |
| `onOrAfter(date, zone?)`             | Every day from a date onwards                       |
| `onOrBefore(date, zone?)`            | Every day up to a date                              |
| `datesBetween(from, to, zone?)`      | Every day from one date to another                  |
| `all(...rules)`                      | Times covered by every rule                         |
| `any(...rules)`                      | Times covered by at least one rule                  |
| `not(rule)`                          | Times outside the rule                              |
| `inZone(zone, rule)`                 | A rule subtree evaluated in one time zone           |
| `inCalendar(calendar, rule)`         | A rule subtree counted on one calendar              |
| `customRule(name, options?, zone?)`  | A rule type the application supplies                |

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

A positive day matches only months that contain that date. For example,
`daysOfMonth(31)` matches the 31st in seven months of the year and never
matches in February. Use `daysOfMonth(-1)` for the last day of every month.

Days are whole calendar days, so consecutive selections join. `daysOfMonth(1, -1)`
covers the last day of one month and the first of the next as one interval.

Zero and numbers beyond 31 in either direction are rejected where the rule is
written. Calling `daysOfMonth()` with no arguments covers no time.

## Select the nth day of the week in a month

`nthDayOfWeekInMonth` selects a weekday by its position in the month. Use it
for a meeting on the first Monday or the last Friday:

```ts
import { nthDayOfWeekInMonth } from "@kensio/quando";

const boardMeeting = nthDayOfWeekInMonth(1, "monday");
const patchTuesday = nthDayOfWeekInMonth(2, "tuesday");
const payrollCutoff = nthDayOfWeekInMonth(-1, "friday");
```

Positive counts start at the beginning of the month. Negative counts start
at the end. A count of `-1` selects the last occurrence of the weekday.

`nthDayOfWeekInMonth(5, "monday")` covers no time in a month with only four
Mondays. Use `-1` when the rule should always select the last Monday.

More than one weekday takes the same position in the month:

```ts
const firstWeekend = nthDayOfWeekInMonth(1, "saturday", "sunday");
```

The count applies to each weekday separately. This rule selects the first
Saturday and the first Sunday. When those dates are consecutive, their
intervals are joined.

Counts must be from 1 to 5 or from -1 to -5. Other values are rejected when
the rule is created.

## Select months

`monthsOfYear` takes month names, the way `daysOfWeek` takes weekday names:

```ts
import { monthsOfYear } from "@kensio/quando";

const summerBreak = monthsOfYear("july", "august");
const financialYearEnd = monthsOfYear("march");
```

Use month names for this builder. `MONTHS` lists all twelve accepted names.
For comparison, numeric months start at 1 in `Temporal` and at 0 in `Date`.

Consecutive months form one interval, and the year wraps.
`monthsOfYear("december", "january")` covers one stretch across the new year.

Combine the two for a rule about a particular date in a particular month:

```ts
const quarterEnds = monthsOfYear("march", "june", "september", "december").and(
  daysOfMonth(-1),
);
```

Calling `monthsOfYear()` with no arguments covers no time.

The names are Gregorian. To name a month on another calendar, see
[name a month on any calendar](#name-a-month-on-any-calendar).

## Repeat every nth period

`everyNthPeriod` selects every nth calendar period relative to an anchor date:

```ts
import { daysOfWeek, everyNthPeriod, onOrAfter } from "@kensio/quando";

const fortnightly = everyNthPeriod(2, "weeks", { anchor: "2026-03-09" }).and(
  daysOfWeek("monday"),
);
```

Periods are `"days"`, `"weeks"`, `"months"` and `"years"`. The `PERIODS` export
lists them.

The rule covers each selected period in full. For example,
`everyNthPeriod(2, "weeks", { anchor: "2026-03-09" })` covers seven days out
of every fourteen. Combine it with a weekday rule to select a day within each
selected week.

Weeks are seven-day blocks measured from the anchor. A cycle anchored on a
Wednesday has weeks running Wednesday to Wednesday. Months and years are counted
on the calendar, so a quarterly cycle covers whole months whatever their length.

### The anchor sets the phase

The recurrence extends both before and after the anchor. Add a date bound
when it should start on a particular date:

```ts
const meetings = everyNthPeriod(2, "weeks", { anchor: "2026-03-09" })
  .and(daysOfWeek("monday"))
  .and(onOrAfter("2026-03-23"));
```

The anchor determines which periods match. The date bound determines when
coverage starts. See [bound a stretch of the calendar](#bound-a-stretch-of-the-calendar).

An interval of `1` selects every period, which covers all of time.

## Select times of day

`timeOfDayRange` uses local wall-clock time:

```ts
import { timeOfDayRange } from "@kensio/quando";

const office = timeOfDayRange("09:00", "17:00");
const nightShift = timeOfDayRange("22:00", "06:00");
```

An end earlier than the start continues into the next day. The night shift runs
from 22:00 until 06:00.

Equal endpoints are ambiguous and rejected:

```ts
timeOfDayRange("09:00", "09:00");
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

Use `onOrAfter`, `onOrBefore`, and `datesBetween` to limit a rule to a range of
dates. This is useful for schedules that start or end on a known date:

```ts
import { datesBetween, onOrAfter, weekdays, weekends } from "@kensio/quando";

const newHours = weekdays().and(onOrAfter("2026-04-01"));
const summerWeekends = weekends().and(datesBetween("2026-06-01", "2026-08-31"));
```

`newHours` covers no weekday before 1 April and every weekday from then on.

Both endpoint dates are included in full. For example,
`datesBetween("2026-04-01", "2026-04-30")` includes all of 30 April.
`datesBetween(d, d)` covers the single date `d`.

With no `to` in the query context, `onOrAfter("2026-04-01")` returns one
interval whose `end` is `undefined`.

A range whose end precedes its start is rejected when the rule is created.

A date range requires at least one endpoint. TypeScript rejects
`{ type: "dateRange" }`, and `parseRule` rejects the same incomplete document
at runtime. Use `always()` to cover all time.

## Combine rules

Fluent rules have `.and`, `.or`, and `.except` methods:

```ts
const officeHours = weekdays().and(timeOfDayRange("09:00", "17:00"));
const supportHours = officeHours.or(
  weekends().and(timeOfDayRange("10:00", "14:00")),
);
const openWithoutHolidays = supportHours.except(bankHolidays);
```

The same operations are available as functions:

```ts
import { all, any, not } from "@kensio/quando";

const officeHours = all(weekdays(), timeOfDayRange("09:00", "17:00"));
const supportHours = any(
  officeHours,
  all(weekends(), timeOfDayRange("10:00", "14:00")),
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
  weekdays().and(timeOfDayRange("09:00", "17:00")),
);
```

The weekday and time-of-day parts now use London local time. A nested `inZone`
can choose a different zone for one child rule.

## Set a calendar

Rules use the ISO calendar by default. Wrap a rule in `inCalendar` to evaluate
its calendar fields using another calendar supported by `Temporal`. This
example selects the first day of each Hebrew month:

```ts
import { daysOfMonth, inCalendar } from "@kensio/quando";
import { intervals } from "@kensio/quando/core";

const roshChodesh = inCalendar("hebrew", daysOfMonth(1));

const window = {
  from: Temporal.ZonedDateTime.from("2026-01-01T00:00[Asia/Jerusalem]"),
  to: Temporal.ZonedDateTime.from("2026-06-01T00:00[Asia/Jerusalem]"),
};

console.log(
  [...intervals(roshChodesh, window)]
    .map((interval) => interval.start?.toPlainDate().toString())
    .join(" "),
);
```

```text
2026-01-19 2026-02-18 2026-03-19 2026-04-18 2026-05-17
```

`inCalendar` changes the calendar used to interpret each instant.
`daysOfMonth`, `nthDayOfWeekInMonth`, and cycles of days or weeks use that
calendar. The weekday cycle is the same across these calendars.

Available calendars depend on the runtime. Node 26 with full ICU data supports
Temporal's calendars. The default `temporal-polyfill` build supports only
`iso8601` and `gregory`. Load its `full` build for other calendars, as described
in [getting started](../getting-started/#calendars-need-the-full-polyfill-build).
`inCalendar` rejects unsupported calendars with an error explaining the missing
runtime support.

Results retain the calendar and time zone of the query context. The calendar
used to evaluate the rule affects which intervals match, not their display.

Calendars nest and combine with zones. The innermost `inCalendar` wins, and a
rule outside the wrapper keeps counting on the ISO calendar:

```ts
const workingRoshChodesh = inCalendar("hebrew", daysOfMonth(1)).and(weekdays());
```

### Month names stay Gregorian

`monthsOfYear` and month or year cycles use Gregorian month positions. These
positions do not apply to every calendar. For example, a Hebrew leap year has
thirteen months. Quando rejects these builders when evaluated under a
non-Gregorian `inCalendar` wrapper:

```ts
inCalendar("hebrew", monthsOfYear("january"));
```

```text
RangeError: monthsOfYear() names Gregorian months, so it cannot be read on the hebrew calendar. Another calendar names its months differently, and may hold thirteen of them.
```

For other calendars, select months with `monthCodes` and days with
`daysOfMonth`. Use `dates` when the ISO dates are already known.

`dates` and `datesBetween` name ISO dates whatever calendar surrounds them. Note
that a calendar annotation on a date string does not name a date on that
calendar. `Temporal.PlainDate.from("5786-07-15[u-ca=hebrew]")` reads the fields
as ISO and then relabels them, giving Hebrew year 9546.

`toCron` and `toRRule` refuse a rule read on another calendar, because both
notations count Gregorian months and years.

## Name a month on any calendar

`monthCodes` selects months using Temporal month codes. A code starts with
`"M"` followed by two digits. A leap-month code also ends with `"L"`. The
calendar determines which month each code identifies:

```ts
import { inCalendar, monthCodes } from "@kensio/quando";
import { intervals } from "@kensio/quando/core";

// Adar I, the leap month a Hebrew leap year adds.
const adarI = inCalendar("hebrew", monthCodes("M05L"));

const window = {
  from: Temporal.ZonedDateTime.from("2023-09-01T00:00[Asia/Jerusalem]"),
  to: Temporal.ZonedDateTime.from("2025-09-01T00:00[Asia/Jerusalem]"),
};

for (const month of intervals(adarI, window)) {
  console.log(
    `${month.start?.toPlainDate().toString()} to ${month.end?.toPlainDate().toString()}`,
  );
}
```

```text
2024-02-10 to 2024-03-11
```

The window includes Hebrew years 5784 and 5785. Only 5784 is a leap year, so
the result contains one leap-month interval.

Leap months have distinct codes. In a Hebrew leap year, Adar I is `"M05L"`
and Adar II is `"M06"`. Select both codes if both months should match.

Month numbers can refer to different named months in different years. Hebrew
month 6 is Adar I in a leap year and Adar in a common year.

On the ISO calendar, `monthCodes("M03")` and `monthsOfYear("march")` cover
the same days. Use month names for Gregorian rules and month codes for rules
that need to work under other calendars.

A code the calendar in force never reaches covers no time, the way
`daysOfMonth(31)` covers no February:

```ts
// Nothing. The ISO calendar has no leap month.
monthCodes("M05L");
```

A code may match in one calendar or year and cover no time in another.
For example, `"M13"` identifies a Coptic month but covers no time in the ISO
calendar.

Accepted codes run from `"M01"` to `"M13"`, with optional trailing `"L"`.
`MONTH_CODES` lists them, and the `MonthCode` union provides TypeScript
validation and editor completion.

`toCron` and `toRRule` refuse `monthCodes`, on any calendar. Cron's month field
and `BYMONTH` are Gregorian positions, and a code means whichever month the
calendar reading the rule gives it. Write `monthsOfYear` where the months are
Gregorian and the output has to be one of those notations.

## Query a rule

The root package provides the common queries:

```ts
import { isActiveAt, coverageChanges, coveredDuration } from "@kensio/quando";

const monday = Temporal.ZonedDateTime.from("2026-03-09T10:00[Europe/London]");
const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

isActiveAt(officeHours, monday);
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

## Supply your own rule type

Use a custom rule for dates or times supplied by your application, such as
Easter, sunset, or observed lunar dates. `customRule` stores the rule's name
and options. A registry in `context.rules` supplies its implementation.

```ts
import { isActiveAt, customRule, schedule, weekdays } from "@kensio/quando";

// The application's own computus. Quando ships no calendar data.
import { easterSunday } from "./computus.js";

const midnight = (date, zone) =>
  date.toZonedDateTime({ timeZone: zone, plainTime: "00:00" });

const easter = {
  *intervals(context, options) {
    const offset = options?.offset ?? 0;
    const zone = context.from.timeZoneId;

    for (let year = context.from.year; ; year += 1) {
      const date = easterSunday(year).add({ days: offset });
      const start = midnight(date, zone);
      if (
        context.to !== undefined &&
        Temporal.ZonedDateTime.compare(start, context.to) >= 0
      ) {
        return;
      }
      // The next midnight, not 24 hours later. A local day is 23 or 25 hours
      // long on the mornings a clock changes.
      yield { start, end: midnight(date.add({ days: 1 }), zone) };
    }
  },
  describe: () => "Easter, computed for the year.",
};

const office = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00")
  .closed(customRule("easter", { offset: 1 }))
  .withCustomRules({ easter });

const easterMonday = Temporal.ZonedDateTime.from(
  "2026-04-06T10:00[Europe/London]",
);

console.log(office.isOpen(easterMonday));
```

```text
false
```

A registry is a plain object keyed by rule name. Combine registries with
object spread and pass the result to the queries that need it. Registries are
local to the query or domain object.

<a id="attaching-one-to-a-schedule-rota-or-tally"></a>

### Attach a registry to a schedule, rota, or tally

`withCustomRules` returns a new schedule, rota, or tally with an attached
registry. Its queries, explanations, validation, and timelines use that
registry:

```ts
const bankHolidays = {
  intervals: () => [
    {
      start: Temporal.ZonedDateTime.from("2026-12-25T00:00[Europe/London]"),
      end: Temporal.ZonedDateTime.from("2026-12-26T00:00[Europe/London]"),
    },
  ],
  describe: () => "It is a bank holiday.",
};

const openingHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00")
  .closed(customRule("bankHolidays"))
  .withCustomRules({ bankHolidays });

const christmas = Temporal.ZonedDateTime.from(
  "2026-12-25T10:00[Europe/London]",
);

console.log(openingHours.isOpen(christmas));
console.log(openingHours.nextOpenInterval(christmas)?.start?.toString());
```

```text
false
2026-12-28T09:00:00+00:00[Europe/London]
```

The search skips the holiday and the following weekend. The custom rule's
`describe` callback supplies the text "It is a bank holiday." in the
explanation.

The registry contains functions and is excluded from `toJSON()`. Calling
`withCustomRules` again replaces the attached registry. To combine registries,
merge their objects before attaching them.

Builder methods preserve the attached registry. You can attach it before or
after adding layers.

Standalone queries accept the registry in their evaluation options. For
example, `isActiveAt(openingHours, christmas, { rules: { bankHolidays } })`
supplies it for one query. Use this form when querying a rule directly.

<a id="the-document-holds-a-name-not-a-function"></a>

### Store a custom rule

Custom rules can be stored, forwarded, and canonicalised without their
implementations. The registry is required only when evaluating them.

```ts
console.log(JSON.stringify(customRule("easter", { offset: 1 })));
```

```text
{"type":"custom","name":"easter","options":{"offset":1}}
```

Custom rule options must be JSON-compatible. `parseRule` rejects unsupported
values. Evaluating a rule missing from the registry throws
`UnknownCustomRuleError`. The error identifies the missing rule, lists
available rules, and explains how to supply a registry.

### What a rule type must return

`intervals(context, options)` must return non-overlapping intervals in
ascending order of start. Quando merges touching intervals. Out-of-order or
overlapping output throws `CustomRuleStreamError`.

Quando clips output to the query window and reads intervals lazily. A custom
rule can produce an endless stream. Consumers such as `take` stop after
reading the results they need.

A custom rule's `zone` argument works like `inZone`. Quando passes the context
instants to the callback in that zone. Read `context.from.timeZoneId` to get
the effective zone.

<a id="what-a-custom-rule-cannot-do"></a>

### Export and command-line limits

`toCron` and `toRRule` return `ok: false` for custom rules because those
formats cannot represent an application-defined implementation. The CLI
cannot evaluate custom rules because it has no way to load a registry.

## Store a rule

Rules are JSON-compatible objects with non-enumerable builder methods.
`parseRule` validates stored data and restores the methods.

See [serialisation](../serialisation/) for stored forms and parser errors.

<!-- card
```ts
const officeHours = weekdays()
  .and(timeOfDayRange("09:00", "17:00"))
  .except(dates("2026-12-25"));
```
-->
