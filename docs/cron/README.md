# Cron expressions

`parseCron` reads a cron expression as a Quando rule. Every query, combination
and explanation then works on it the way it works on any other rule.

## Read an expression

```ts
import { parseCron } from "@kensio/quando";

const batch = parseCron("0 6 * * 1-5");
```

That rule covers 06:00 until 06:01 on Monday through Friday.

Cron fires at an instant and a Quando rule covers time, so a firing time
becomes the minute that starts there. This is what lets the ordinary queries
answer questions about a schedule of runs.

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

Reading the next five runs from 30 March 2026 gives the Monday, Tuesday,
Wednesday and Thursday of that week, and then the Tuesday after Easter. Good
Friday and Easter Monday are gone.

## The fields

Five fields, separated by spaces.

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

A day of the month and a day of the week both restricted means a run happens
when **either** matches.

```ts
parseCron("0 0 13 * 5");
```

That runs on the 13th of the month and on every Friday. Reading it as Friday
the 13th is the common mistake. POSIX specifies the union, and every cron in
wide use follows it.

A star leaves a field open. A field naming every day restricts it, so
`0 0 13 * 0-6` runs every day.

## Write a rule out

`toCron` goes the other way. Cron says less than a rule can, so the answer is
an expression or the reason there is none.

```ts
import { timeOfDay, toCron, weekdays } from "@kensio/quando";

const written = toCron(weekdays().and(timeOfDay("06:00", "06:01")));
if (written.ok) {
  written.cron; // 0 6 * * 1-5
}
```

A rule covering more than a minute at a time comes out as every minute of it.
Office hours become `* 9-16 * * *`. That matches the reading an expression gets
on the way in, where a run covers the minute it starts in.

A rule naming a zone carries it on the result as `zone`. Cron has no field for
one, and the daemon has to be told some other way.

### What has no expression

`ok` is `false` when cron has no way to say what the rule says. `reason` names
what stopped it.

```ts
const written = toCron(daysOfMonth(13).and(daysOfWeek("friday")));
// written.reason: it needs a day of the month and a day of the week to match
// together, and cron reads two restricted day fields as either one matching
```

Friday the 13th is the sharpest case. The expression that looks right,
`0 0 13 * 5`, is the union, and it fires on about five days a month.

| The rule                                 | Why cron has no form for it                        |
| ---------------------------------------- | -------------------------------------------------- |
| `.except(…)`                             | Cron selects times and never removes them          |
| `dates`, `onOrAfter`, `between`          | Cron has no year field                             |
| `every`                                  | Cron's steps restart within each month             |
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

A cron daemon runs on one clock. Name it, and the rule is read on that clock
whatever zone the query uses:

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

The five-field POSIX dialect only.

- Six and seven field forms. A sixth field is seconds in one dialect and a year
  in another, and there is no way to tell them apart.
- The Quartz extensions `L`, `W`, `#` and `?`. Use
  [`daysOfMonth`](../rules/#select-days-of-the-month) for the last day of the
  month, which is what `L` usually means.
- `@reboot`.

For calendar recurrences, see [recurrence rules](../recurrence/).

An expression comes back from `toCron` in values and ranges. Steps such as
`*/15` are read on the way in and written out as `0,15,30,45`.

<!-- card
```ts
const running = parseCron("0 6 * * 1-5").except(dates("2026-04-03"));
```
-->
