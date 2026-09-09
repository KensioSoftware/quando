# Performance

Quando evaluates rules lazily. A query takes what it needs from an interval
stream and stops, so asking when a schedule next opens reads a few days rather
than the year around them.

This page says what that means in practice, what the common questions cost, and
how to measure them yourself.

## Laziness is the design

`intervals(rule, context)` returns a stream. Nothing is computed until
something reads it, and the query functions read as little as they can.

```ts
import { schedule, weekdays } from "@kensio/quando";

const office = schedule({ zone: "Europe/London" }).open(
  weekdays(),
  "09:00-17:00",
);

// Walks as far as Monday morning and stops.
office.nextOpenInterval(
  Temporal.ZonedDateTime.from("2026-06-19T18:30[Europe/London]"),
);
```

A context with no `to` describes an endless stream, and a query that wants one
occurrence pulls one occurrence. Some queries need a whole window by
definition. `openDuration`, `openDayCount` and `validate` each take a `from`
and a `to`, and read all of it.

A custom rule inherits this. Its `intervals` function is handed the context and
its result is read the same way, so a generator that yields forever is a
reasonable thing to write. See the [rules guide](../rules/).

## What the common questions cost

Mean times from `pnpm bench` on Node 26 with native `Temporal`, on a 2023
laptop. Read them as orders of magnitude.

| Question                                       | Cost   |
| ---------------------------------------------- | ------ |
| `isOpen` at one instant                        | 19 µs  |
| `isOpen`, on a schedule closed on 160 holidays | 23 µs  |
| `explain` at one instant                       | 55 µs  |
| `firstOpenSlot`, four hours                    | 48 µs  |
| `nextOpenInterval` from a Friday evening       | 70 µs  |
| `addOpenTime`, 200 working hours               | 330 µs |
| `openSlots`, half-hourly over a month          | 600 µs |
| A year of intervals, read to the end           | 2.5 ms |
| `openDuration` over a year                     | 2.9 ms |
| Reading a stored schedule back                 | 43 µs  |

Two things follow from the shape of that table.

**Point queries are cheap and window queries are not.** A window query walks the
calendar a day at a time, and its cost tracks the length of the window. Ask
about the smallest window that answers the question.

**A long list of dates costs about what a short one costs.** A `dates` rule
reads its dates once and keeps them, and a query bisects to the window instead
of walking there from the first date. Twenty years of bank holidays and one
closure next Tuesday come to much the same.

## The polyfill is slower

Below Node 26 there is no native `Temporal`, and
[temporal-polyfill](https://github.com/fullcalendar/temporal-polyfill) supplies
one. On the same benchmarks it runs about ten times slower, and closer to
fifteen on the window queries. The shape of the table holds and the difference
is a constant factor. See
[getting started](../getting-started/) for how to install it.

## Measuring it yourself

The repository carries a benchmark suite:

```bash
pnpm bench
```

It covers point queries, forward searches, window queries and document
handling. No CI job reads the numbers, because a shared runner's timings
describe the runner. CI checks a ratio instead. A test in `src/date-runs.test.ts`
asserts that a point query against four thousand dates costs about what one
against a hundred costs. That is a claim about scaling, and a slow machine
cannot break it.

<!-- card
```ts
// Walks as far as Monday morning and stops.
office.nextOpenInterval(when("2026-06-19T18:30"));
```
-->
