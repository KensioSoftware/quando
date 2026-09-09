# Concepts

Quando models time with rules, contexts, intervals, and ordered value layers.

You can use the domain APIs without working with every part of this model. The
model becomes useful when you need custom rules or lower-level queries.

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

A rule describes a set of covered times. It carries no application value.

```ts
import { dates, timeOfDayRange, weekdays } from "@kensio/quando";

const dispatchHours = weekdays()
  .and(timeOfDayRange("09:00", "17:00"))
  .except(dates("2026-12-25"));
```

This rule covers weekday office hours except Christmas Day. The parts have
ordinary set meanings:

| Operation | Meaning                                            |
| --------- | -------------------------------------------------- |
| `and`     | Every rule must cover the time                     |
| `or`      | At least one rule must cover the time              |
| `except`  | The first rule covers it and an exception does not |

Rules are useful on their own and also form the scopes used by schedules,
rotas, tallies, and cascades.

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

Most applications do not need to iterate intervals directly. The common query
functions answer nine questions:

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

Rules and domain objects have explicit JSON forms. Builder methods are attached
as non-enumerable properties, so JSON storage sees only the definition.

Parsers accept `unknown`, validate the complete document, and restore the
methods. Your application remains responsible for storing the JSON. See
[serialisation](../serialisation/).

## Limits

Quando calculates times and intervals. It does not run scheduled work or
provide holiday datasets. A rule the vocabulary cannot say, such as Easter or
sunset, is supplied by the application through
[custom rule types](../rules/#supply-your-own-rule-type).

Rules count on the ISO calendar unless `inCalendar` names another. Month names
stay Gregorian there, so `monthsOfYear` and a cycle of months or years are
refused on another calendar. `monthCodes` names a month on any of them. See
[rules](../rules/#set-a-calendar).

Most rules describe a set of times on their own. The ones that read what has
already happened are [constraints](../constraints/), and they take that history
on the context. A minimum gap between doses, a cap on requests per minute and a
rolling total are all constraints.

How far a rule can be trusted is declared with `knownThrough`, and a query
whose answer would rest on anything past that day refuses. See
[horizons](../horizon/).

An answer with several possible outcomes is an [estimate](../uncertainty/), and
a query takes one wherever it takes a count or a duration. The rules themselves
stay certain. A layer that applies only in some weathers has no way to say so
yet.

<!-- card
```ts
const dispatchHours = weekdays()
  .and(timeOfDayRange("09:00", "17:00"))
  .except(dates("2026-12-25"));
```
-->
