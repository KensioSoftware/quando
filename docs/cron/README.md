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

Writing a rule back out as cron is still to come.

<!-- card
```ts
const running = parseCron("0 6 * * 1-5").except(dates("2026-04-03"));
```
-->
