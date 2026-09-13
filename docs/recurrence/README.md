---
description: "Parse RFC 5545 recurrence rules into Quando rules for schedule queries."
---

# Recurrence rules

`parseRRule` converts a supported RFC 5545 recurrence rule to a Quando rule.
You can query it, combine it with other rules, and explain its results.

## Read a recurrence

```ts
import { parseRRule } from "@kensio/quando";

const standup = parseRRule("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", {
  start: "2026-03-30T09:30",
});
```

The required `start` option supplies the recurrence's `DTSTART`. It determines:

- The time of day the recurrence runs at.
- The day the pattern repeats on when no `BYDAY` or `BYMONTHDAY` names one.
- The point the recurrence begins. Nothing before it is covered.

## Skip holidays

A recurrence is a rule, so `.except` works on it:

```ts
import { dates, parseRRule } from "@kensio/quando";

const running = standup.except(dates("2026-04-03", "2026-04-06"));
```

The next five occurrences from 30 March 2026 are the Monday, Tuesday, Wednesday
and Thursday of that week, then the Tuesday after Easter.

## What an occurrence covers

By default, an occurrence with a time of day covers one minute from its start.
This matches the interpretation of [cron expressions](../cron/).

A date-only `start` creates all-day occurrences:

```ts
parseRRule("FREQ=DAILY", { start: "2026-03-11T09:30" });
// 09:30 until 09:31, every day

parseRRule("FREQ=DAILY", { start: "2026-03-11" });
// whole days
```

## The parts

| Part         | Read as                                            |
| ------------ | -------------------------------------------------- |
| `FREQ`       | `DAILY`, `WEEKLY`, `MONTHLY` or `YEARLY`           |
| `INTERVAL`   | Every nth period                                   |
| `UNTIL`      | Date-only inclusive bound; timestamps are rejected |
| `WKST`       | The day a week is counted from, Monday by default  |
| `BYDAY`      | Weekdays, with an optional count within the month  |
| `BYMONTHDAY` | Days of the month, negative counting from the end  |
| `BYMONTH`    | Months                                             |
| `BYHOUR`     | Hours of the day                                   |
| `BYMINUTE`   | Minutes of the hour                                |

`BYDAY` takes a count under `FREQ=MONTHLY`. `BYDAY=1MO` is the first Monday of
the month and `BYDAY=-1FR` is the last Friday. Counted and bare entries mix, so
`BYDAY=1MO,FR` is the first Monday and every Friday.

For `FREQ=YEARLY`, an ordinal weekday requires `BYMONTH` to specify the month:

```ts
parseRRule("FREQ=YEARLY;BYMONTH=11;BYDAY=4TH", { start: "2026-01-01" });
```

This selects the fourth Thursday of November. An ordinal weekday without
`BYMONTH` would count within the whole year, which Quando does not support.

```ts
parseRRule("FREQ=MONTHLY;BYDAY=-1FR;UNTIL=20260630", { start: "2026-01-01" });
```

That runs on the last Friday of each month and stops after June.

The test suite checks recurrence expansion against worked examples from
RFC 5545 section 3.8.5.3, including daylight saving transitions. In those
tests, timestamp `UNTIL` bounds are replaced with equivalent final local dates
for the example start times. Unsupported forms are tested separately.

Pass the entire successful export to `parseRRule(written)` to preserve its
`start`, `duration`, and `zone`. Passing just `written.rrule` loses the duration.
Explicit durations use wall-clock time and must be positive and at most one day.
A full-day duration must start at midnight. Starts must have whole-minute precision.

## Limits

Timestamp `UNTIL` values throw `ParseError`. Quando supports date-only
`UNTIL` bounds. Exporting a timed rule with an upper date bound returns
`ok: false` because the timestamp bound required for a faithful round trip is
unsupported.

The following parts are unsupported. The parser rejects them by name:

| Part        | Why                                                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `COUNT`     | Counting occurrences needs the occurrences counted, which a rule does not do. Use `UNTIL`, or take what you need from the interval stream |
| `BYSETPOS`  | The nth occurrence within a period, for the same reason                                                                                   |
| `BYWEEKNO`  | Week numbers have no rule to map onto                                                                                                     |
| `BYYEARDAY` | Days of the year have no rule to map onto                                                                                                 |
| `BYSECOND`  | Quando reads recurrences down to the minute                                                                                               |

The parser also rejects `FREQ=SECONDLY`, `MINUTELY`, and `HOURLY`. Supported
frequencies step through calendar periods of a day or longer.

## Write a rule out

`toRRule` exports a supported rule as an RRULE with a start and duration:

```ts
import { timeOfDayRange, toRRule, weekdays } from "@kensio/quando";

const written = toRRule(weekdays().and(timeOfDayRange("09:00", "17:00")), {
  start: "2026-03-30",
});
if (written.ok) {
  written.rrule; // FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR
  written.start; // 2026-03-30T09:00
  written.duration; // PT8H
}
```

`start` supplies `DTSTART` in the form accepted by `parseRRule`. `duration`
specifies the length of each occurrence. In a calendar entry, represent that
length with `DTEND` or `DURATION`, separately from the RRULE.

A rule naming a zone carries it on the result as `zone`, for the `TZID`
parameter on `DTSTART`.

<a id="where-it-begins"></a>

### Choose the recurrence start

An exported recurrence requires `DTSTART`, even when the Quando rule has no
start date. The exporter uses:

- The rule's own lower bound, from `onOrAfter` or `datesBetween`.
- The `start` option, for a rule that has no bound of its own.

If neither is supplied, the exporter returns `ok: false`.

The exporter searches from that date and sets `DTSTART` to the first covered
date. RFC 5545 requires the recurrence pattern to agree with `DTSTART`. In
this example, a Monday rule bounded from Tuesday starts on the next Monday:

```ts
const fromTuesday = toRRule(onOrAfter("2026-03-03").and(daysOfWeek("monday")));

if (fromTuesday.ok) {
  fromTuesday.rrule; // FREQ=WEEKLY;BYDAY=MO
  fromTuesday.start; // 2026-03-09
}
```

If the rule has no occurrence from the search start onward, the exporter
returns `ok: false`.

<a id="whole-periods-written-out"></a>

### Export whole calendar periods

`everyNthPeriod` covers each selected period in full. The exporter lists all
covered days when the rule has no narrower day selection:

```ts
const fortnight = everyNthPeriod(2, "weeks", { anchor: "2026-03-02" });

const whole = toRRule(fortnight, { start: "2026-03-02" });
const mondays = toRRule(fortnight.and(daysOfWeek("monday")), {
  start: "2026-03-02",
});

if (whole.ok && mondays.ok) {
  whole.rrule; // FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TU,WE,TH,FR,SA,SU
  mondays.rrule; // FREQ=WEEKLY;INTERVAL=2;BYDAY=MO
}
```

`WKST` is written when a cycle of weeks turns over on a day other than Monday,
which is the day RFC 5545 assumes.

<a id="what-has-no-recurrence"></a>

### Unsupported conversions

The exporter returns `ok: false` with a `reason` when the rule cannot be
represented as a recurrence:

| The rule                              | Why a recurrence has no form for it               |
| ------------------------------------- | ------------------------------------------------- |
| `.except(…)`                          | A recurrence selects times and never removes them |
| `dates`                               | Those are `RDATE` properties beside the RRULE     |
| Windows of different lengths in a day | One recurrence carries one duration               |
| Start times such as 09:00 and 14:30   | `BYHOUR` and `BYMINUTE` select every combination  |
| An ordinal inside a daily cycle       | Counting within a month needs `FREQ=MONTHLY`      |

## Time zones

Pass `zone` to evaluate the recurrence in a fixed time zone, regardless of
the query context's zone:

```ts
const tokyoStandup = parseRRule("FREQ=WEEKLY;BYDAY=MO", {
  start: "2026-03-09T09:00",
  zone: "Asia/Tokyo",
});
```

Without a zone the rule follows the query context, the same as any other rule.

Use date-only `UNTIL` values such as `20261231`. The final date is included
in the recurrence's effective time zone. Timestamp forms such as
`20261231T235959` and `20261231T235959Z` are rejected.

## Errors

A malformed recurrence throws `ParseError`, a subclass of `TypeError`, naming
the part at fault:

```ts
parseRRule("FREQ=HOURLY", { start: "2026-03-09" });
// ParseError: FREQ: HOURLY recurs faster than a day, and a rule steps through
// calendar periods

parseRRule("FREQ=WEEKLY;BYDAY=1MO", { start: "2026-03-09" });
// ParseError: BYDAY: an ordinal counts a weekday within a month, so it needs
// FREQ=MONTHLY or FREQ=YEARLY with BYMONTH
```

<!-- card
```ts
const standup = parseRRule("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", {
  start: "2026-03-30T09:30",
});
```
-->
