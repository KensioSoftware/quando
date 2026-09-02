# Concepts

Quando calculates when something happens under a set of time rules.

`Temporal` represents dates, times, durations, and time zones. Quando uses those
values to evaluate rules such as "weekdays from 09:00 to 17:00, except bank
holidays".

This page explains the model. See [getting started](../getting-started/) for a
short example, or go to [rules](../rules/) and [queries](../queries/) for the
API.

## A rule produces intervals

A rule produces the intervals during which it applies. For example, a warehouse
rule might produce one interval for each period when the warehouse is open.

This is more useful than testing one instant at a time. Sampling requires a step
size. A large step can miss a boundary, while a small step can make a long
search slow.

Intervals preserve exact boundaries. They also support the main calculations
directly:

```text
weekdays 09:00–17:00, for the week of 2026-03-09:

  Mon ▓▓▓▓▓▓▓▓        Tue ▓▓▓▓▓▓▓▓        Wed ▓▓▓▓▓▓▓▓
  Thu ▓▓▓▓▓▓▓▓        Fri ▓▓▓▓▓▓▓▓        Sat                 Sun
```

Working time in a window is the sum of the interval durations. Advancing by
working time means moving through the intervals until the duration is used.
The next opening is the next interval.

Intervals are half-open. They include the start and exclude the end, written as
`[start, end)`. Two intervals can meet at 17:00 without overlapping.

## Rules combine

Rules combine with three set operations:

|       |                                             |
| ----- | ------------------------------------------- |
| `all` | intersection. Every rule must apply.        |
| `any` | union. At least one rule must apply.        |
| `not` | complement. The source rule must not apply. |

For example, "weekdays and 09:00 to 17:00" is an intersection. "Saturdays or
bank holidays" is a union. See [rules](../rules/) for every rule type.

## Overrides need layers

Set operations work well for exceptions. Opening hours excluding holidays can
be written as `all(hours, not(holidays))` or `hours.except(holidays)`.

Overrides are harder to express as sets. The following rule defines normal
weekday hours and replaces the hours on 11 March:

```ts
import { dates, intervals, timeOfDay, weekdays } from "@kensio/quando";

const closesEarly = dates("2026-03-11");

const openingHours = weekdays()
  .and(timeOfDay("09:00", "17:00"))
  .except(closesEarly)
  .or(closesEarly.and(timeOfDay("09:00", "15:00")));

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-14T00:00[Europe/London]"),
};

for (const { start, end } of intervals(openingHours, week)) {
  console.log(`${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}`);
}
```

```text
2026-03-09T09:00:00 → 2026-03-09T17:00:00
2026-03-10T09:00:00 → 2026-03-10T17:00:00
2026-03-11T09:00:00 → 2026-03-11T15:00:00
2026-03-12T09:00:00 → 2026-03-12T17:00:00
2026-03-13T09:00:00 → 2026-03-13T17:00:00
```

The rule must name 11 March twice. It first removes the date from the normal
hours, then adds the shorter hours.

## Cascades apply layers in order

A cascade expresses the same override as an ordered list of layers. Each layer
has a scope and a value. By default, the last layer that covers a moment wins.

```text
  1. weekdays 09:00–17:00         ← the usual hours
  2. bank holidays: closed        ← an exception
  3. the 11th: 09:00–15:00        ← an override, wins inside its own day
```

A value can be a boolean, a name, a price, or another domain value. Schedules
use boolean values. Rotas use values such as names.

Rules remain boolean and cascades carry values. This keeps operations such as
`not` well-defined. See [cascades](../cascades/) for the full API.

Cascades use precedence by default. They can also merge overlapping values with
`sum`, `max`, `min`, or `concat`. See [merging](../merging/).

## Rules are data

A rule is a JSON-compatible object. You can store it in a database, send it
through an API, or keep it in a configuration file.

Quando provides builders and parsers. Your application handles storage. See
[serialisation](../serialisation/) for the JSON format and validation.

## What a rule cannot say

Every rule describes a set of times. This model cannot express constraints on a
series of separate occurrences.

Examples include:

- At most four doses a day, at least four hours apart.
- Ninety days in any rolling period of a hundred and eighty.
- Nine hours of driving a day, with a break after four and a half.
- A hundred requests a minute.

These constraints require information about previous occurrences. Quando does
not support them.

Quando also has no validity horizon. A weekday rule continues into the future,
even if its holiday data stops earlier. Applications must track how far their
data is valid.

## Scope

Quando calculates times. A separate scheduler can use the results to run timers
or trigger events.

`Temporal` provides the date and time operations. Quando uses `Temporal` values
for its inputs and outputs.

<!-- card
```ts
const openingHours = weekdays()
  .and(timeOfDay("09:00", "17:00"))
  .except(closesEarly)
  .or(closesEarly.and(timeOfDay("09:00", "15:00")));
```
-->
