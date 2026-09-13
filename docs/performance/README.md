---
description: "How Quando evaluates rules lazily and how to measure query performance."
---

# Performance

Quando evaluates intervals as a query requests them. A search for the next
opening stops when it finds one. A duration query evaluates the whole requested
window.

<a id="laziness-is-the-design"></a>

## How lazy evaluation works

`intervals(rule, context)` returns a lazy stream. Evaluation starts when the
stream is consumed, and query functions stop reading once they have an answer.

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

Without `to`, a recurring rule can produce an endless stream. A query for the
next occurrence reads only enough to find that occurrence. Queries such as
`openDuration`, `openDayCount`, and `validate` require both `from` and `to`
and evaluate the whole window.

Custom rules follow the same model. Their `intervals` callback receives a
context and can return a generator whose results are read lazily. See the
[rules guide](../rules/).

<a id="what-the-common-questions-cost"></a>

## Example query timings

These mean times were measured with `pnpm bench` on a 2023 laptop running
Node 26 with native `Temporal`. They illustrate relative costs. Measure your
own workload before relying on a particular timing.

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

Window queries examine the calendar day by day, and their cost grows with the
length of the window. Use the smallest window that answers your question.

A `dates` rule stores its dates once. Queries use binary search to find the
requested window in that list. Point queries therefore have similar costs for
short and long date lists.

<a id="the-polyfill-is-slower"></a>

## Native Temporal and the polyfill

The same benchmarks run about ten times slower with
[temporal-polyfill](https://github.com/fullcalendar/temporal-polyfill), and
about fifteen times slower for window queries. The relative costs remain
similar. Use the polyfill when your runtime lacks native `Temporal`. See
[getting started](../getting-started/) for installation.

## Measuring it yourself

The repository carries a benchmark suite:

```bash
pnpm bench
```

The suite covers point queries, forward searches, window queries, and
document handling. CI does not enforce these absolute timings.

The test in `src/date-runs.test.ts` compares point-query costs for lists of
4,000 and 100 dates. It checks how the query scales with the list size while
allowing for differences between machines.

<!-- card
```ts
// Walks as far as Monday morning and stops.
office.nextOpenInterval(when("2026-06-19T18:30"));
```
-->
