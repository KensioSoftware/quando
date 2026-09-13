---
description: "Calculate possible dates and their probabilities through Quando's time rules."
---

# Uncertainty

Quando can calculate several possible results from an estimated count or
duration. For example, a delivery estimate of one to three working days
produces three possible arrival dates, using the courier's opening hours and
holiday rules.

```ts
import {
  addCoveredTime,
  addCoveredDays,
  all,
  assumeUniform,
  chanceBefore,
  chances,
  combineIndependentOutcomes,
  mapOutcomes,
  median,
  mode,
  nextCoveredInterval,
  quantile,
  possibilities,
  possibleValues,
  timeOfDayRange,
  weekdays,
} from "@kensio/quando";

const at = (iso: string): Temporal.ZonedDateTime =>
  Temporal.ZonedDateTime.from(`${iso}[Europe/London]`);

const courier = all(weekdays(), timeOfDayRange("09:00", "17:00"));
const ordered = at("2026-03-13T14:00"); // a Friday afternoon

addCoveredDays(ordered, possibilities([1, 2, 3]), { during: courier }).values;
// [
//   2026-03-16T09:00:00+00:00[Europe/London],
//   2026-03-17T09:00:00+00:00[Europe/London],
//   2026-03-18T09:00:00+00:00[Europe/London],
// ]
```

The three results are Monday, Tuesday, and Wednesday at 09:00. The calculation
skips the weekend and returns the courier's opening time on each date.

<a id="two-shapes-because-they-answer-different-questions"></a>

## Possible outcomes and probabilities

`possibilities` lists possible outcomes without assigning probabilities.
`chances` assigns a probability to each outcome:

```ts
const basic = possibilities([1, 2, 3]);

const advanced = chances([
  { value: 1, probability: 0.25 },
  { value: 2, probability: 0.5 },
  { value: 3, probability: 0.25 },
]);
```

Queries preserve the kind of estimate supplied. A `Possibilities` input
produces possible results without probabilities. A `Distribution` input
produces results with probabilities. A plain count produces a single result.

Probabilities must sum to one. `chances` rejects other totals rather than
rescaling the supplied probabilities.

<a id="through-the-calendar"></a>

## Calculate dates through a schedule

The same working-day count can span different amounts of elapsed time. One
working day from Friday ends on Monday, while one from Monday ends on Tuesday.
Quando calculates each outcome through the rules and assigns its probability
to the resulting date.

```ts
const arrival = addCoveredDays(ordered, advanced, { during: courier });

arrival.outcomes;
// [
//   { value: 2026-03-16T09:00:00+00:00[Europe/London], probability: 0.25 },
//   { value: 2026-03-17T09:00:00+00:00[Europe/London], probability: 0.5 },
//   { value: 2026-03-18T09:00:00+00:00[Europe/London], probability: 0.25 },
// ]
```

When several inputs produce the same result, their probabilities are added.
In this example, waiting one or two calendar days from Friday reaches the
same next opening on Monday:

```ts
const from = at("2026-03-13T07:00");
const waiting = chances([
  { value: 1, probability: 0.2 }, // the Saturday
  { value: 2, probability: 0.3 }, // the Sunday
  { value: 4, probability: 0.5 }, // the Tuesday
]);

const opening = mapOutcomes(
  waiting,
  (days) =>
    nextCoveredInterval(courier, {
      from: from.add({ days }),
      to: from.add({ days: days + 14 }),
    })?.start,
);

opening.outcomes;
// [
//   { value: 2026-03-16T09:00:00+00:00[Europe/London], probability: 0.5 },
//   { value: 2026-03-17T09:00:00+00:00[Europe/London], probability: 0.5 },
// ]
```

Use `mapOutcomes` to apply a function to each outcome in an estimate. This also
works with queries that accept only single values. [`addCoveredTime`](../queries/)
and `addCoveredDays` accept estimates directly.

`addCoveredTime` counts elapsed time only while the rule applies. Pass an
estimate of durations to calculate several possible completion times:

```ts
const packing = possibilities([
  Temporal.Duration.from("PT30M"),
  Temporal.Duration.from("PT2H"),
]);

addCoveredTime(at("2026-03-13T16:00"), packing, { during: courier }).values;
// [
//   2026-03-13T16:30:00+00:00[Europe/London],
//   2026-03-16T10:00:00+00:00[Europe/London],
// ]
```

The half-hour outcome finishes at 16:30 on Friday. The two-hour outcome uses
Friday's remaining hour and finishes at 10:00 on Monday.

<a id="reading-one"></a>

## Inspect an estimate

Use these functions to list possible results or summarise their probabilities:

```ts
possibleValues(arrival).map((one) => one.toPlainDate().toString());
// ["2026-03-16", "2026-03-17", "2026-03-18"]

median(arrival); // 2026-03-17T09:00:00+00:00[Europe/London]
mode(arrival); // 2026-03-17T09:00:00+00:00[Europe/London]
quantile(arrival, 0.95); // 2026-03-18T09:00:00+00:00[Europe/London]

chanceBefore(arrival, at("2026-03-18T00:00")); // 0.75
```

`possibleValues` returns distinct outcomes. `quantile(arrival, 0.95)` returns
the earliest outcome by which cumulative probability reaches 95%.
`chanceBefore` returns the probability of an outcome before the given instant.

Quando provides a median, mode, and quantiles, all of which select possible
outcomes. It has no mean function. Averaging datetimes could produce a time
outside the schedule, such as Saturday morning for a weekday-only courier.

<a id="the-weights-are-yours-to-supply"></a>

## Supply or assume probabilities

Functions that require probabilities reject a `Possibilities` input:

```ts
median(possibilities([1, 2, 3]));
// RangeError: median() needs weights, and possibilities carry none. Say which
// distribution it stands for with assumeUniform(), or supply the weights with
// chances().
```

Use `assumeUniform` when you explicitly want to give each possible outcome
equal probability. This is an assumption about the input, not a probability
inferred from the range:

```ts
const assumed = assumeUniform(possibilities([1, 2, 3]));

assumed.outcomes.map((one) => one.probability);
// [0.3333333333333333, 0.3333333333333333, 0.3333333333333333]

assumed.assumed; // true
```

The resulting distribution has `assumed: true`. Mapping preserves this flag.
Combining two distributions preserves it if either input is assumed.

Combining an input without probabilities produces `Possibilities`. That result
has no probabilities and no `assumed` flag.

## Combining two estimates

Use `combineIndependentOutcomes` to combine two independent estimates. Adding
two estimates with values from one to three can produce values from two to six.
The probabilities depend on the input distributions:

```ts
const both = combineIndependentOutcomes(
  advanced,
  advanced,
  (first, second) => first + second,
);

possibleValues(both); // [2, 3, 4, 5, 6]

both.outcomes.map((one) => [one.value, one.probability]);
// [[2, 0.0625], [3, 0.25], [4, 0.375], [5, 0.25], [6, 0.0625]]
```

In this example, six has a probability of 1/16. Keeping the full distribution
preserves this information when further estimates are combined.

`combineIndependentOutcomes` assumes independent inputs. If two delivery times
share a source of delay, combining them as independent estimates can give
incorrect probabilities. Model the shared cause as one estimate and map its
outcomes to the result.

The result has probabilities only when both inputs have probabilities:

```ts
combineIndependentOutcomes(
  advanced,
  possibilities([0, 1]),
  (first, second) => first + second,
);
// { kind: "spread", values: [1, 2, 3, 4] }
```

When either input is `Possibilities`, the result contains possible values
without probabilities.

<a id="what-it-refuses"></a>

## Handle unresolved outcomes

A query throws `UnresolvedOutcomeError` if its search limit prevents it from
resolving any outcome:

```ts
addCoveredDays(ordered, possibilities([1, 20]), {
  during: courier,
  within: Temporal.Duration.from("P3D"),
});
// RangeError: addCoveredDays() ran out of search before reaching the
// outcome 20. Dropping it would take that much probability out of the answer
// without saying so. Widen `within`.
```

The query fails as a whole. Silently omitting an unresolved outcome would
change the distribution and make its probabilities incorrect.

## Ordering

Functions such as `median`, `quantile`, and cumulative probability queries
need ordered outcomes. Quando supplies ordering for numbers and Temporal
values, including durations and instants. Supply an `order` comparator for
other value types:

```ts
possibleValues(
  possibilities(["ccc", "a", "bb"]),
  (left, right) => left.length - right.length,
);
// ["a", "bb", "ccc"]
```

## Limits

Estimates describe input values, such as durations and day counts. They do not
assign probabilities to whether a rule or layer applies. Use
[horizons](../horizon/) for rules whose data is complete only through a known
date.

Your application must supply the outcomes and probabilities. Quando does not
fit distributions from historical records.

Estimates contain discrete outcomes. Convert continuous inputs to discrete
values before passing them to Quando, using a sampling resolution appropriate
for your application.

Schedule arithmetic accepts the same estimates as the standalone functions.
An `Estimate<T>` variable works without narrowing it first. A search that
cannot resolve every outcome throws `UnresolvedOutcomeError`, with the failed
`outcome`, `operation`, and `within` limit. It never drops outcomes or their probability mass.

<!-- card
```ts
const arrival = addCoveredDays(ordered, advanced, {
  during: courier,
});
quantile(arrival, 0.95);
```
-->
