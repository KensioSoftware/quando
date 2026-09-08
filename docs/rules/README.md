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

| Builder                             | Covered time                                        |
| ----------------------------------- | --------------------------------------------------- |
| `always()`                          | All time                                            |
| `never()`                           | No time                                             |
| `daysOfWeek(...days)`               | Whole days with the selected weekday names          |
| `weekdays()`                        | Monday through Friday                               |
| `weekends()`                        | Saturday and Sunday                                 |
| `daysOfMonth(...days)`              | Whole days at the selected positions in each month  |
| `nthDayOfWeekInMonth(nth, ...days)` | The nth Monday, Friday and so on, in each month     |
| `monthsOfYear(...months)`           | The selected months, in full                        |
| `monthCodes(...codes)`              | The selected months, named as `Temporal` names them |
| `every(n, period, options)`         | Every nth day, week, month or year                  |
| `timeOfDay(from, to, zone?)`        | A local time range on every day                     |
| `dates(...dates)`                   | The selected calendar dates                         |
| `onOrAfter(date, zone?)`            | Every day from a date onwards                       |
| `onOrBefore(date, zone?)`           | Every day up to a date                              |
| `between(from, to, zone?)`          | Every day from one date to another                  |
| `all(...rules)`                     | Times covered by every rule                         |
| `any(...rules)`                     | Times covered by at least one rule                  |
| `not(rule)`                         | Times outside the rule                              |
| `inZone(zone, rule)`                | A rule subtree evaluated in one time zone           |
| `inCalendar(calendar, rule)`        | A rule subtree counted on one calendar              |
| `custom(name, options?, zone?)`     | A rule type the application supplies                |

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

The names are Gregorian. To name a month on another calendar, see
[name a month on any calendar](#name-a-month-on-any-calendar).

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

The whole of each selected period is covered. On its own,
`every(2, "weeks", { anchor: "2026-03-09" })` covers seven days out of every
fourteen. Intersect it with something narrower for the day within them, as
above.

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

## Set a calendar

Rules count on the ISO calendar by default. `inCalendar` reads one subtree on
any calendar `Temporal` implements, so "the first day of the month" can mean
Rosh Chodesh rather than the first of January.

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

The instants do not move. What changes is the year, month and day a rule reads
off a date, so `daysOfMonth`, `nthDayOfWeekInMonth` and a cycle of days or
weeks all answer on the calendar named. Weekdays are the same seven-day cycle
on these calendars and need no wrapper.

Which calendars exist is the runtime's business. A runtime with full ICU data,
such as Node 26, carries them all. `temporal-polyfill` carries only `iso8601`
and `gregory` unless its `full` build is the one assigned to the global. See
[getting started](../getting-started/#calendars-need-the-full-polyfill-build).
`inCalendar` refuses a calendar the runtime does not implement, and says which
of the two reasons applies.

Answers come back on the calendar the query was asked in, the same way they
come back in the query's zone. Which calendar a rule counted on is how it was
written rather than part of the answer.

Calendars nest and combine with zones. The innermost `inCalendar` wins, and a
rule outside the wrapper keeps counting on the ISO calendar:

```ts
const workingRoshChodesh = inCalendar("hebrew", daysOfMonth(1)).and(weekdays());
```

### Month names stay Gregorian

`monthsOfYear` names the twelve Gregorian months, and `every(n, "months")` and
`every(n, "years")` count them. Another calendar names its months differently
and a Hebrew leap year holds thirteen of them, which moves the index a
Gregorian name would map to. Both are refused under `inCalendar` rather than
answered wrongly:

```ts
inCalendar("hebrew", monthsOfYear("january"));
```

```text
RangeError: monthsOfYear() names Gregorian months, so it cannot be read on the hebrew calendar. Another calendar names its months differently, and may hold thirteen of them.
```

Name the month with `monthCodes` below, select its days with `daysOfMonth`, or
name the dates with `dates`.

`dates` and `between` name ISO dates whatever calendar surrounds them. Note
that a calendar annotation on a date string does not name a date on that
calendar. `Temporal.PlainDate.from("5786-07-15[u-ca=hebrew]")` reads the fields
as ISO and then relabels them, giving Hebrew year 9546.

`toCron` and `toRRule` refuse a rule read on another calendar, because both
notations count Gregorian months and years.

## Name a month on any calendar

`monthCodes` names a month the way `Temporal` names one. Every calendar names
it that way, so one code means one month wherever the rule is read. A code is
`"M"` and two digits, and a leap month carries a trailing `"L"`:

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

Two Hebrew years went past and one leap month came back. 5784 is a leap year
and 5785 is not.

A leap month is a month of its own rather than a second helping of the one
before it. In a Hebrew leap year Adar I is `"M05L"` and Adar II is `"M06"`. A
rule wanting both says both.

A month _name_ goes wrong in the same place. The month `Temporal` numbers 6 is
Adar I in a leap year and Adar in a common one, so the index a name would map
to moves.

On the ISO calendar the codes are the Gregorian months in order, so
`monthCodes("M03")` and `monthsOfYear("march")` cover the same days.
`monthsOfYear` reads better and is the one to write where the months are
Gregorian. `monthCodes` is the one that survives an `inCalendar` wrapper.

A code the calendar in force never reaches covers no time, the way
`daysOfMonth(31)` covers no February:

```ts
// Nothing. The ISO calendar has no leap month.
monthCodes("M05L");
```

Which codes a calendar has is the calendar's business, and for a leap month the
year's as well. A rule is written long before either is known. `"M13"` is a
Coptic month, and refusing it there on the grounds that the ISO calendar has no
thirteenth would be the same mistake.

The codes run `"M01"` to `"M13"`, and the same again with `"L"`. `MONTH_CODES`
lists them and the `MonthCode` type is their union. An editor completes them,
and a typo will not compile.

`toCron` and `toRRule` refuse `monthCodes`, on any calendar. Cron's month field
and `BYMONTH` are Gregorian positions, and a code means whichever month the
calendar reading the rule gives it. Write `monthsOfYear` where the months are
Gregorian and the output has to be one of those notations.

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

## Supply your own rule type

Some rules are functions rather than patterns. Easter is computed from a year,
sunset from a date and a pair of coordinates, and the start of a lunar month
has historically been observed. `custom` names a rule type the application
supplies, and `context.rules` holds the code that runs it.

```ts
import { activeAt, custom, schedule, weekdays } from "@kensio/quando";

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
  .closed(custom("easter", { offset: 1 }))
  .withRules({ easter });

const easterMonday = Temporal.ZonedDateTime.from(
  "2026-04-06T10:00[Europe/London]",
);

console.log(office.isOpen(easterMonday));
```

```text
false
```

A registry is a plain object keyed by name, so combining two sources of rule
types is a spread. There is no global to register into and nothing to reset
between tests.

### Attaching one to a schedule, rota or tally

`withRules` gives a schedule, a rota or a tally the registry its scopes need,
and returns a new one. Every method then reads it. So does the account each one
gives of itself:

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
  .closed(custom("bankHolidays"))
  .withRules({ bankHolidays });

const christmas = Temporal.ZonedDateTime.from(
  "2026-12-25T10:00[Europe/London]",
);

console.log(openingHours.isOpen(christmas));
console.log(openingHours.opensNext(christmas)?.start?.toString());
```

```text
false
2026-12-28T09:00:00+00:00[Europe/London]
```

The search skipped the holiday and the weekend after it. `explain`, `validate`,
`renderTimeline` and the rest read the registry the same way, and a rule type's
own `describe` is what puts "It is a bank holiday." into the explanation.

A registry holds functions, so it never enters the stored document. `toJSON`
returns what it always returned, and `withRules` called twice replaces the
registry rather than merging the two. Attach it before or after the layers that
need it, since each builder method carries it into the object it returns.

The core queries take the same registry on the context instead. That is what
`activeAt(openingHours, christmas, { rules: { bankHolidays } })` does, and it
is the route to use where the rule set is not a schedule, a rota or a tally.

### The document holds a name, not a function

A `custom` rule stores and travels like every other rule. Only evaluating one
needs the registry. A service can hold, forward and canonicalise a schedule
whose rules it cannot itself run.

```ts
console.log(JSON.stringify(custom("easter", { offset: 1 })));
```

```text
{"type":"custom","name":"easter","options":{"offset":1}}
```

Options are stored and must survive a JSON round trip. `parseRule` refuses
anything that would not. Evaluating a rule whose name the registry does not
hold throws `UnknownCustomRuleError`, which names what was asked for, what the
registry does hold, and the two ways of supplying one.

### What a rule type must return

`intervals(context, options)` returns the times the rule covers. The result
must arrive in ascending order of start and must not overlap, which is the
contract every interval stream keeps. Touching intervals are merged for you.
Out-of-order or overlapping intervals throw `CustomRuleStreamError`, because
repairing those means holding the whole stream in memory.

Quando clips the result to the query window, and a rule type may yield forever.
The example above still terminates on an unbounded context because the
interpreter stops pulling.

A `zone` argument reads the rule the way `inZone` does. The same instants
arrive displayed in that zone. A rule type reads `context.from.timeZoneId` and
never handles the field itself.

### What a custom rule cannot do

`toCron` and `toRRule` refuse a rule holding a custom type, and say why. A
notation carries what the document says, and this document says a name. The
command line cannot evaluate custom rules either, for the same reason. It reads
stored documents and has nowhere to take code from.

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
