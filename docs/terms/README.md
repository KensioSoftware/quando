---
description: "Write Quando rules as text expressions using calendar terms and time ranges."
---

# Terms

Use `parseRuleExpression` to create a rule from a short text expression:

```ts
import { parseRuleExpression } from "@kensio/quando";

parseRuleExpression("mon-fri 09:00-17:00 @Europe/London");
```

Separate terms with spaces. Each term adds a condition, and every condition
must match. Term order has no effect. The parser returns the same rule objects
as the builders, which also support more complex combinations.

<a id="terms-narrow-commas-widen"></a>

## Combine conditions and alternatives

Spaces combine conditions with AND. Commas within a term combine alternatives
with OR:

```ts
parseRuleExpression("mon-fri 09:00-17:00");
// all(daysOfWeek(monday…friday), timeOfDayRange("09:00", "17:00"))

parseRuleExpression("sat,sun");
// daysOfWeek("saturday", "sunday")
```

`09:00-12:00,14:00-17:00` covers the morning or the afternoon, with a lunch
break between them. `09:00-12:00 14:00-17:00` requires both ranges to match
at once and therefore covers no time.

<a id="a-line-is-one-conjunction"></a>

## Combine separate expressions in a schedule

Use separate schedule calls for alternatives with different conditions. For
example, weekday hours and Saturday hours need separate expressions:

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

Schedule, rota, and tally methods accept these expressions wherever they
accept a rule. This includes `open`, `closed`, and `setHours`.

<a id="the-terms"></a>

## Supported terms

The parser recognises weekday names, dates, time ranges, and the other forms
listed below:

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

Use a prefix when a value could have several meanings. For example, `day:15`
selects the fifteenth day of the month:

| Written               | Means                                         |
| --------------------- | --------------------------------------------- |
| `day:1,15,-1`         | days of the month, counting from either end   |
| `month:3,6`           | months by number, for a line a program wrote  |
| `nth:-1,fri`          | the last Friday of the month                  |
| `every:2w@2026-01-05` | every second week, in phase with that date    |
| `cal:hebrew`          | the calendar the whole line counts on         |
| `except:2026-12-25`   | whatever the term after it covers, taken away |
| `holidays:gb`         | a custom rule, and the options it is given    |

The period units for `every` are `d` (days), `w` (weeks), `mo` (months), and
`y` (years). The ambiguous abbreviation `m` is rejected.

`every` requires an explicit anchor date after `@`. The anchor determines
which periods match, independently of when the expression is parsed.

<a id="a-term-it-cannot-read-is-refused"></a>

## Invalid expressions

Names are case-insensitive and accept their supported full or abbreviated
forms. Numeric terms accept leading zeros. An unrecognised term causes the
whole expression to fail:

```ts
parseRuleExpression("weekdays excpet:2026-12-25");
// RangeError: Term 2: "excpet:2026-12-25" is not a term.
//   Did you mean "except:"?

parseRuleExpression("weekdys 09:00-17:00");
// RangeError: Term 1: cannot read "weekdys". Did you mean "weekdays"?
```

The error identifies the term and may suggest a correction. The parser never
silently discards an invalid condition.

## Limits

Expressions support one flat set of conditions. Use the builders or separate
schedule layers for nested combinations such as `any(all(a, b), all(c, d))`.
`except:` excludes a single term.

Quando cannot convert a rule back to this text syntax. Store complete rule
definitions as [JSON](../serialisation/). [`toCron`](../cron/) and
[`toRRule`](../recurrence/) export the subsets those formats support.

<!-- card
```ts
parseRuleExpression("mon-fri 09:00-17:00 @Europe/London");
```
-->
