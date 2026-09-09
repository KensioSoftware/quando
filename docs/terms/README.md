# Terms

A rule can be written as a line of terms instead of built from functions.

```ts
import { parseRuleExpression } from "@kensio/quando";

parseRuleExpression("mon-fri 09:00-17:00 @Europe/London");
```

The notation is whitespace-separated and additive. Each term says one more
thing that has to hold, and the order they are written in never matters. Every
line is a shorthand for the builders, so the object API says everything a line
says and a good deal besides.

## Terms narrow, commas widen

This is the whole model, and cron found it first. A term between spaces is
another condition to meet. A comma inside one term offers alternatives.

```ts
parseRuleExpression("mon-fri 09:00-17:00");
// all(daysOfWeek(monday…friday), timeOfDayRange("09:00", "17:00"))

parseRuleExpression("sat,sun");
// daysOfWeek("saturday", "sunday")
```

So `09:00-12:00,14:00-17:00` is a morning and an afternoon with lunch between
them. Written as two terms it asks for the times inside both windows, which is
no time at all.

## A line is one conjunction

"Weekdays nine to five, Saturdays ten to two" is two rules, and a schedule is
what holds two. The notation has no separator of its own, and the cascade does
the work:

```ts
const shop = schedule({ zone: "Europe/London" })
  .open("mon-fri 09:00-17:00")
  .open("sat 10:00-14:00")
  .closed("2026-12-25");

const saturdayTea = Temporal.ZonedDateTime.from(
  "2026-03-14T16:00[Europe/London]",
);

shop.isOpen(saturdayTea); // false
shop.nextOpenInterval(saturdayTea)?.start?.toString();
// 2026-03-16T09:00:00+00:00[Europe/London]
```

Anywhere a schedule, rota or tally takes a rule it takes a line, so `open`,
`closed` and `setHours` all read one.

## The terms

Some terms are known by their shape. A time holds a colon, a date opens with
four digits, and a weekday is letters.

| Written                  | Means                                            |
| ------------------------ | ------------------------------------------------ |
| `weekdays`               | Monday to Friday                                 |
| `weekends`               | Saturday and Sunday                              |
| `mon`, `monday`          | one weekday, in full or in three letters         |
| `mon-fri`                | a run of days, wrapping, so `fri-mon` works      |
| `sat,sun`                | either day                                       |
| `09:00-17:00`            | a window in the day, and `9:00-17:00` too        |
| `jan-mar`, `june`        | months by name                                   |
| `M01`, `M05L`            | a month by code, for a non-Gregorian calendar    |
| `2026-12-25`             | one date, and a comma gives several              |
| `2026-07-01..2026-08-31` | a stretch, open at either end if one is left off |
| `@Europe/London`         | the clock the whole line is read on              |

A term whose meaning would depend on where it was written takes a qualifier.
`15` reads as the fifteenth of the month and as three in the afternoon, and the
qualifier is what settles which.

| Written               | Means                                         |
| --------------------- | --------------------------------------------- |
| `day:1,15,-1`         | days of the month, counting from either end   |
| `month:3,6`           | months by number, for a line a program wrote  |
| `nth:-1,fri`          | the last Friday of the month                  |
| `every:2w@2026-01-05` | every second week, in phase with that date    |
| `cal:hebrew`          | the calendar the whole line counts on         |
| `except:2026-12-25`   | whatever the term after it covers, taken away |
| `holidays:gb`         | a custom rule, and the options it is given    |

`every` counts in `d`, `w`, `mo` or `y`. It refuses `m`, which reads as minutes
as often as months.

The anchor on `every` is always written out. Every other term means the same
thing wherever it appears, and a cycle with an implied anchor would name
different weeks depending on when the line was read.

## A term it cannot read is refused

The notation takes a word in whatever case it arrives, in full or abbreviated,
with or without a leading zero. A term it cannot make sense of stops it.

```ts
parseRuleExpression("weekdays excpet:2026-12-25");
// RangeError: Term 2: "excpet:2026-12-25" is not a term.
//   Did you mean "except:"?

parseRuleExpression("weekdys 09:00-17:00");
// RangeError: Term 1: cannot read "weekdys". Did you mean "weekdays"?
```

Dropping a term would give a rule that runs, covers the wrong time, and says
nothing about it. A shop open on Christmas is the failure to avoid here, and
nobody finds out until somebody turns up.

## Limits

A line is a conjunction of terms, and the rule language is larger than that. A
line has no nesting, so `any(all(a, b), all(c, d))` goes in layers on a
schedule. `except:` takes away a single term, never a group.

There is no writer yet. [`toCron`](../cron/) and [`toRRule`](../recurrence/)
both write back the notation they read, and a line does not. For storage reach
for [JSON](../serialisation/), which holds every rule there is.

<!-- card
```ts
parseRuleExpression("mon-fri 09:00-17:00 @Europe/London");
```
-->
