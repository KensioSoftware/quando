---
description: "Parse cron expressions into Quando rules for schedule queries."
---

# Cron expressions

`parseCron` converts a five-field cron expression to a Quando rule. You can
query it, combine it with other rules, and explain its results.

## Read an expression

```ts
import { parseCron } from "@kensio/quando";

const batch = parseCron("0 6 * * 1-5");
```

That rule covers 06:00 until 06:01 on Monday through Friday.

Quando represents each cron firing as a covered minute beginning at the
scheduled time. Its interval queries can then find and measure those minutes.

```ts
import { nextCoveredInterval } from "@kensio/quando";

const next = nextCoveredInterval(batch, {
  from: Temporal.ZonedDateTime.from("2026-03-30T00:00[Europe/London]"),
});
```

## Skip holidays

A cron expression is a rule, so `.except` works on it:

```ts
import { dates, parseCron } from "@kensio/quando";

const shutdown = dates("2026-04-03", "2026-04-06");
const running = parseCron("0 6 * * 1-5").except(shutdown);
```

The next five runs from 30 March 2026 are Monday through Thursday of that
week, followed by Tuesday after Easter. The supplied exceptions exclude Good
Friday and Easter Monday.

## The fields

An expression contains five fields separated by spaces:

| Position | Field        | Range             |
| -------- | ------------ | ----------------- |
| 1        | Minute       | 0 to 59           |
| 2        | Hour         | 0 to 23           |
| 3        | Day of month | 1 to 31           |
| 4        | Month        | 1 to 12, or names |
| 5        | Day of week  | 0 to 7, or names  |

Each field takes a star for all of it, a single value, a range such as `1-5`, a
step such as `*/15` or `9-17/2`, and any of those joined by commas.

Month names are `JAN` through `DEC` and day names are `SUN` through `SAT`, in
any case. Sunday is both `0` and `7`.

## Both day fields

When both day fields are restricted, a date matches if either its day of the
month or its weekday matches:

```ts
parseCron("0 0 13 * 5");
```

This runs on the 13th of each month and on every Friday. It does not mean
Friday the 13th. Quando combines the two day fields with OR.

Only `*` makes a field unrestricted. An explicit range still counts as a
restriction, even if it lists every value. For example, `0 0 13 * 0-6` matches
every day through its weekday field.

## Write a rule out

`toCron` converts a supported rule to a cron expression. It returns `ok: true`
with the expression, or `ok: false` with a reason if conversion is unsupported.

```ts
import { timeOfDayRange, toCron, weekdays } from "@kensio/quando";

const written = toCron(weekdays().and(timeOfDayRange("06:00", "06:01")));
if (written.ok) {
  written.cron; // 0 6 * * 1-5
}
```

A rule covering several minutes exports a firing for every covered minute.
For example, 09:00–17:00 becomes `* 9-16 * * *`. Parsing this expression
restores the same minute-based coverage.

If the rule specifies a time zone, the result includes `zone`. Configure the
cron runner with this zone separately because it has no field in the expression.

<a id="what-has-no-expression"></a>

### Unsupported conversions

Inspect `reason` when the result has `ok: false`:

```ts
const written = toCron(daysOfMonth(13).and(daysOfWeek("friday")));
// written.reason: it needs a day of the month and a day of the week to match
// together, and cron reads two restricted day fields as either one matching
```

A rule requiring Friday the 13th cannot be exported. The expression
`0 0 13 * 5` would also run on other Fridays and other thirteenths:

| The rule                                 | Why cron has no form for it                        |
| ---------------------------------------- | -------------------------------------------------- |
| `.except(…)`                             | Cron selects times and never removes them          |
| `dates`, `onOrAfter`, `datesBetween`     | Cron has no year field                             |
| `everyNthPeriod`                         | Cron's steps restart within each month             |
| `nthDayOfWeekInMonth`                    | `#` is a Quartz extension                          |
| `daysOfMonth(-1)`                        | POSIX cron has no `L`                              |
| A day of the month and a weekday at once | Two restricted day fields mean either one matches  |
| A window such as 09:30 to 17:30          | The clock fields select hours crossed with minutes |

## Shorthands

| Shorthand              | Expression  |
| ---------------------- | ----------- |
| `@yearly`, `@annually` | `0 0 1 1 *` |
| `@monthly`             | `0 0 1 * *` |
| `@weekly`              | `0 0 * * 0` |
| `@daily`, `@midnight`  | `0 0 * * *` |
| `@hourly`              | `0 * * * *` |

`@reboot` is refused. It names an event, and a rule covers calendar time.

## Time zones

Pass `zone` to evaluate the expression in a fixed time zone, regardless of
the query context's zone:

```ts
const tokyoBatch = parseCron("0 9 * * *", { zone: "Asia/Tokyo" });
```

Without a zone the rule follows the query context, the same as any other rule.
See [time zones](../time-zones/).

## Errors

A malformed expression throws a `TypeError` naming the field at fault:

```ts
parseCron("0 25 * * *");
// TypeError: hour: 25 is out of range for the hour field. Expected 0 to 23

parseCron("0 22-6 * * *");
// TypeError: hour: "22-6" runs backwards. Cron ranges do not wrap, so write
// two entries separated by a comma
```

## Limits

Quando supports the five-field POSIX dialect. It rejects:

- Six and seven field forms. A sixth field is seconds in one dialect and a year
  in another, and there is no way to tell them apart.
- The Quartz extensions `L`, `W`, `#` and `?`. Use
  [`daysOfMonth`](../rules/#select-days-of-the-month) for the last day of the
  month, which is what `L` usually means.
- `@reboot`.

For calendar recurrences, see [recurrence rules](../recurrence/).

`toCron` writes explicit values and ranges. It expands steps such as `*/15`
to `0,15,30,45`.

<!-- card
```ts
const running = parseCron("0 6 * * 1-5").except(dates("2026-04-03"));
```
-->
