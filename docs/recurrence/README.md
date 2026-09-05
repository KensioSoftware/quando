# Recurrence rules

`parseRRule` reads an RFC 5545 recurrence rule as a Quando rule. Every query,
combination and explanation then works on it the way it works on any other rule.

## Read a recurrence

```ts
import { parseRRule } from "@kensio/quando";

const standup = parseRRule("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", {
  start: "2026-03-30T09:30",
});
```

An RRULE leans on `DTSTART` for three separate things, so `start` is required
here and does all three:

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

A recurrence fires at an instant and a Quando rule covers time, so an occurrence
becomes the minute it starts in. This is the same reading
[cron expressions](../cron/) get.

A start written as a plain date carries no clock time, and the recurrence covers
whole days instead. That is an all-day event.

```ts
parseRRule("FREQ=DAILY", { start: "2026-03-11T09:30" });
// 09:30 until 09:31, every day

parseRRule("FREQ=DAILY", { start: "2026-03-11" });
// whole days
```

## The parts

| Part         | Read as                                           |
| ------------ | ------------------------------------------------- |
| `FREQ`       | `DAILY`, `WEEKLY`, `MONTHLY` or `YEARLY`          |
| `INTERVAL`   | Every nth period                                  |
| `UNTIL`      | A bound on the last day, that day included        |
| `WKST`       | The day a week is counted from, Monday by default |
| `BYDAY`      | Weekdays, with an optional count within the month |
| `BYMONTHDAY` | Days of the month, negative counting from the end |
| `BYMONTH`    | Months                                            |
| `BYHOUR`     | Hours of the day                                  |
| `BYMINUTE`   | Minutes of the hour                               |

`BYDAY` takes a count under `FREQ=MONTHLY`. `BYDAY=1MO` is the first Monday of
the month and `BYDAY=-1FR` is the last Friday. Counted and bare entries mix, so
`BYDAY=1MO,FR` is the first Monday and every Friday.

A count also works under `FREQ=YEARLY` when `BYMONTH` gives it a month to count
within, which is how most yearly recurrences are written:

```ts
parseRRule("FREQ=YEARLY;BYMONTH=11;BYDAY=4TH", { start: "2026-01-01" });
```

That is the fourth Thursday of November. Without `BYMONTH` the count would run
over the whole year, which has no rule to map onto, and is refused.

```ts
parseRRule("FREQ=MONTHLY;BYDAY=-1FR;UNTIL=20260630", { start: "2026-01-01" });
```

That runs on the last Friday of each month and stops after June.

## Limits

Five parts exist and have no rule to map onto. Each is refused by name rather
than ignored, because dropping one changes what a recurrence means.

| Part        | Why                                                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `COUNT`     | Counting occurrences needs the occurrences counted, which a rule does not do. Use `UNTIL`, or take what you need from the interval stream |
| `BYSETPOS`  | The nth occurrence within a period, for the same reason                                                                                   |
| `BYWEEKNO`  | Week numbers have no rule to map onto                                                                                                     |
| `BYYEARDAY` | Days of the year have no rule to map onto                                                                                                 |
| `BYSECOND`  | Quando reads recurrences down to the minute                                                                                               |

`FREQ=SECONDLY`, `MINUTELY` and `HOURLY` recur faster than a day, and Quando's
recurrence steps through calendar periods. They are refused by name too.

## Write a rule out

`toRRule` goes the other way. A recurrence is one part of a calendar entry, so
three values come back together.

```ts
import { timeOfDay, toRRule, weekdays } from "@kensio/quando";

const written = toRRule(weekdays().and(timeOfDay("09:00", "17:00")), {
  start: "2026-03-30",
});
if (written.ok) {
  written.rrule; // FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR
  written.start; // 2026-03-30T09:00
  written.duration; // PT8H
}
```

`start` is DTSTART, in the form `parseRRule` takes it back in. `duration` is
how long one occurrence runs, and it belongs in the `DTEND` or `DURATION`
property beside the recurrence. An RRULE says when something happens and never
how long it lasts.

A rule naming a zone carries it on the result as `zone`, for the `TZID`
parameter on `DTSTART`.

### Where it begins

Every recurrence begins at DTSTART. A rule need not begin anywhere (a rule
about Mondays is about every Monday there has ever been). The start comes from
one of two places:

- The rule's own lower bound, from `onOrAfter` or `between`.
- The `start` option, for a rule that has no bound of its own.

A rule with neither comes back with `ok: false`. Choosing a date quietly would
drop every occurrence before it.

That start is where the search begins, and DTSTART is the first day from there
that the rule covers. RFC 5545 leaves a recurrence set undefined when DTSTART
falls outside it. Bound the Mondays from a Tuesday and the recurrence begins on
the Monday after:

```ts
const fromTuesday = toRRule(onOrAfter("2026-03-03").and(daysOfWeek("monday")));

if (fromTuesday.ok) {
  fromTuesday.rrule; // FREQ=WEEKLY;BYDAY=MO
  fromTuesday.start; // 2026-03-09
}
```

A rule covering nothing from that day onwards has no first occurrence, and
comes back with `ok: false`.

### Whole periods written out

`every` covers whole periods, and a recurrence names the occurrences within
one. So a cycle with no day named has its days written out.

```ts
const fortnight = every(2, "weeks", { anchor: "2026-03-02" });

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

### What has no recurrence

`ok` is `false` when a rule says something no recurrence can. `reason` names
what stopped it.

| The rule                              | Why a recurrence has no form for it               |
| ------------------------------------- | ------------------------------------------------- |
| `.except(…)`                          | A recurrence selects times and never removes them |
| `dates`                               | Those are `RDATE` properties beside the RRULE     |
| Windows of different lengths in a day | One recurrence carries one duration               |
| Start times such as 09:00 and 14:30   | `BYHOUR` and `BYMINUTE` select every combination  |
| An ordinal inside a daily cycle       | Counting within a month needs `FREQ=MONTHLY`      |

## Time zones

A recurrence runs on one clock. Name it, and the whole rule is read on that
clock whatever zone the query uses:

```ts
const tokyoStandup = parseRRule("FREQ=WEEKLY;BYDAY=MO", {
  start: "2026-03-09T09:00",
  zone: "Asia/Tokyo",
});
```

Without a zone the rule follows the query context, the same as any other rule.

`UNTIL` bounds by whole days, and RFC 5545 writes it three ways.

| Written            | Read as                                                               |
| ------------------ | --------------------------------------------------------------------- |
| `20261231`         | That calendar date                                                    |
| `20261231T235959`  | That calendar date. No `Z` means local time                           |
| `20261231T235959Z` | An instant, converted to the day it falls on in the recurrence's zone |

So a bound of `20260314T230000Z` is the 15th in Tokyo, and `20260314T230000`
is the 14th wherever it is read.

## Errors

A malformed recurrence throws a `TypeError` naming the part at fault:

```ts
parseRRule("FREQ=HOURLY", { start: "2026-03-09" });
// TypeError: FREQ: HOURLY recurs faster than a day, and a rule steps through
// calendar periods

parseRRule("FREQ=WEEKLY;BYDAY=1MO", { start: "2026-03-09" });
// TypeError: BYDAY: an ordinal counts a weekday within a month, so it needs
// FREQ=MONTHLY
```

<!-- card
```ts
const standup = parseRRule("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", {
  start: "2026-03-30T09:30",
});
```
-->
