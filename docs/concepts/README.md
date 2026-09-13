---
description: "How Quando represents time with rules and ordered value layers."
---

# Concepts

Quando models time with rules, contexts, intervals, and ordered value layers.

Start with `schedule`, `rota`, or `tally` for common application tasks. The
underlying rule and interval model is useful when building custom rules or
using the lower-level APIs.

## Choose the smallest useful API

| Need                                        | Start with |
| ------------------------------------------- | ---------- |
| Opening hours or availability               | `schedule` |
| One assigned value at a time                | `rota`     |
| Numeric values that add where they overlap  | `tally`    |
| A custom definition of when                 | Rules      |
| Custom value precedence or merging          | Cascades   |
| Inactive rules, hidden layers, or rota gaps | Validation |

The root package exports schedules, rotas, tallies, rules, and common queries.
The `@kensio/quando/core` entry point adds interval and cascade operations.

## Rules describe when

A rule describes a set of covered times. At a known instant it either applies
or does not apply. Values such as a person's name belong to a rota or cascade.

```ts
import { dates, timeOfDayRange, weekdays } from "@kensio/quando";

const dispatchHours = weekdays()
  .and(timeOfDayRange("09:00", "17:00"))
  .except(dates("2026-12-25"));
```

This rule covers weekday office hours except Christmas Day. Combine rules
with these operations:

| Operation | Meaning                                            |
| --------- | -------------------------------------------------- |
| `and`     | Every rule must cover the time                     |
| `or`      | At least one rule must cover the time              |
| `except`  | The first rule covers it and an exception does not |

Schedules, rotas, tallies, and cascades use rules as scopes. A scope is the
period in which an opening, assignment, or contribution applies.

## A context bounds evaluation

Recurring rules have no natural end. A context says where evaluation starts
and where it stops.

```ts
const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};
```

The `from` value also supplies the default time zone. The optional `to` value
makes the window finite. Low-level streams can remain unbounded when `to` is
omitted.

## Rules produce intervals

Evaluating a rule produces the exact intervals it covers within a context.

```ts
import { intervals } from "@kensio/quando/core";

for (const interval of intervals(dispatchHours, week)) {
  console.log(interval.start?.toString(), interval.end?.toString());
}
```

Intervals are half-open. `[start, end)` includes the start and excludes the
end. Adjacent intervals do not overlap at their shared boundary.

The common query functions answer these questions without requiring you to
iterate the intervals yourself:

| Function              | Answer                                  |
| --------------------- | --------------------------------------- |
| `isActiveAt`          | Whether an instant is covered           |
| `nextCoveredInterval` | The current or next covered interval    |
| `firstAvailableSlot`  | The first covered interval of a length  |
| `availableSlots`      | Candidate intervals at a fixed cadence  |
| `coveredDuration`     | The covered time within a finite window |
| `coveredDayCount`     | The covered days within a finite window |
| `addCoveredTime`      | The result of adding only covered time  |
| `addCoveredDays`      | The result of adding whole covered days |
| `coverageChanges`     | Time added and removed between inputs   |

Schedules can be passed to all nine functions. Schedule methods give the
single-input queries opening-hours names. `changesTo` compares two schedules.

## Cascades attach values

A cascade is an ordered list of layers. Each layer pairs a rule with a value.
Later layers take precedence by default.

```text
1. weekdays                  alice
2. weekends                  bob
3. 2026-03-11                carol
```

Carol is assigned on 11 March because the third layer comes last. The scope's
specificity has no effect on precedence.

Rotas use this model for assignments. Schedules use boolean values. Tallies use
a `sum` strategy that adds overlapping numbers. The [cascades](../cascades/)
and [merging](../merging/) guides cover the low-level API.

## Definitions are data

Rules and domain objects have JSON-compatible definitions. Their builder
methods are non-enumerable properties and are excluded from `JSON.stringify`.

Parsers accept `unknown`, validate the complete document, and restore the
methods. Your application remains responsible for storing the JSON. See
[serialisation](../serialisation/).

## Limits

Quando calculates times and intervals. Your application runs scheduled work
and supplies holiday datasets. Use
[custom rule types](../rules/#supply-your-own-rule-type) for calculations such
as Easter or sunset.

Rules use the ISO calendar by default. `inCalendar` selects another supported
calendar. Gregorian month names and cycles of months or years are rejected
under other calendars. Use `monthCodes` to select their months. See
[rules](../rules/#set-a-calendar).

[Constraints](../constraints/) use occurrence history supplied in the query
context. They can enforce a minimum gap between bookings, a maximum number of
requests per minute, or a rolling occupied-time limit.

`knownThrough` declares the last date for which a rule's data is complete.
Queries throw if missing data beyond that date could change the result. See
[horizons](../horizon/).

Working-time arithmetic accepts [estimates](../uncertainty/) of durations and
day counts and returns the corresponding possible results. Estimates apply to
those inputs. They cannot represent a rule or layer that applies with a given
probability.

<!-- card
```ts
const dispatchHours = weekdays()
  .and(timeOfDayRange("09:00", "17:00"))
  .except(dates("2026-12-25"));
```
-->
