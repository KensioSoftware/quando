# Uncertainty

A calculated time is usually an estimate. "One to three working days" is what a
courier says, and turning that into dates takes the weekends, the bank holidays
and the courier's own hours. Quando is where those already live.

```ts
import {
  advanceBy,
  advanceByCoveredDays,
  all,
  assumeUniform,
  chanceBefore,
  chances,
  combineOutcomes,
  mapOutcomes,
  median,
  mode,
  nextCoveredInterval,
  quantile,
  spread,
  support,
  timeOfDay,
  weekdays,
} from "@kensio/quando";

const at = (iso: string): Temporal.ZonedDateTime =>
  Temporal.ZonedDateTime.from(`${iso}[Europe/London]`);

const courier = all(weekdays(), timeOfDay("09:00", "17:00"));
const ordered = at("2026-03-13T14:00"); // a Friday afternoon

advanceByCoveredDays(ordered, spread([1, 2, 3]), { during: courier }).values;
// [
//   2026-03-16T09:00:00+00:00[Europe/London],
//   2026-03-17T09:00:00+00:00[Europe/London],
//   2026-03-18T09:00:00+00:00[Europe/London],
// ]
```

The weekend is where it should be. One working day from a Friday is the
following Monday, and each answer is the hour the courier opens that morning.

## Two shapes, because they answer different questions

`spread` carries the outcomes and says nothing about their weights. `chances`
carries a probability against each one.

```ts
const basic = spread([1, 2, 3]);

const advanced = chances([
  { value: 1, probability: 0.25 },
  { value: 2, probability: 0.5 },
  { value: 3, probability: 0.25 },
]);
```

Both go into a query the same way. What comes back matches what went in, so a
spread gives a spread and a distribution gives a distribution. A caller who
passes a plain count still gets a plain answer, and never meets any of this.

The probabilities have to total one. A list that totals anything else is a
mistake somewhere upstream, and scaling it here would decide on the caller's
behalf which of the weights was wrong.

## Through the calendar

The mapping from working days to datetimes bends. One working day from a Friday
lands on Monday and one from a Monday lands on Tuesday, so shifting a mean and
a variance would answer wrongly. Quando resolves each outcome through the rules
and gathers the probability on whatever it lands on.

```ts
const arrival = advanceByCoveredDays(ordered, advanced, { during: courier });

arrival.outcomes;
// [
//   { value: 2026-03-16T09:00:00+00:00[Europe/London], probability: 0.25 },
//   { value: 2026-03-17T09:00:00+00:00[Europe/London], probability: 0.5 },
//   { value: 2026-03-18T09:00:00+00:00[Europe/London], probability: 0.25 },
// ]
```

Two outcomes that land in the same place are added together. A wait of one
calendar day and a wait of two from a Friday morning both come out at Monday,
and the answer says so once:

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

`mapOutcomes` takes any function at all, so every query in the library works on
an estimate whether or not it was written for one. [`advanceBy`](../queries/)
and `advanceByCoveredDays` take one directly, because those are the two that
most often have a range behind them.

`advanceBy` measures elapsed time that only counts while the rules hold, and an
estimate over durations goes through it the same way:

```ts
const packing = spread([
  Temporal.Duration.from("PT30M"),
  Temporal.Duration.from("PT2H"),
]);

advanceBy(at("2026-03-13T16:00"), packing, { during: courier }).values;
// [
//   2026-03-13T16:30:00+00:00[Europe/London],
//   2026-03-16T10:00:00+00:00[Europe/London],
// ]
```

Half an hour finishes before the courier closes on the Friday. Two hours runs
an hour into Monday, because the hour after five o'clock never counted.

## Reading one

One computation, several descriptions. That is the reason for keeping the
distribution rather than a range.

```ts
support(arrival).map((one) => one.toPlainDate().toString());
// ["2026-03-16", "2026-03-17", "2026-03-18"]

median(arrival); // 2026-03-17T09:00:00+00:00[Europe/London]
mode(arrival); // 2026-03-17T09:00:00+00:00[Europe/London]
quantile(arrival, 0.95); // 2026-03-18T09:00:00+00:00[Europe/London]

chanceBefore(arrival, at("2026-03-18T00:00")); // 0.75
```

`support` is the plain range to show a customer. `quantile` at 0.95 is the date
to put in a contract. `chanceBefore` answers "what is the chance it arrives
before Christmas?" A lot of retail wants to answer that one in a sentence.

**There is no mean.** The mean of a distribution over datetimes lands on the
instant axis. For a courier that has never delivered at three on a Saturday
morning, that is where it puts the answer. A median, a mode and a
quantile all land on outcomes that can happen.

## The weights are yours to supply

A spread has no weights, and every view that needs them refuses it:

```ts
median(spread([1, 2, 3]));
// RangeError: median() needs weights, and a spread carries none. Say which
// distribution it stands for with assumeUniform(), or supply the weights with
// chances().
```

Reading "one to three working days" as uniform manufactures confident numbers
from an assumption the courier never made. Say it out loud and Quando will
oblige:

```ts
const assumed = assumeUniform(spread([1, 2, 3]));

assumed.outcomes.map((one) => one.probability);
// [0.3333333333333333, 0.3333333333333333, 0.3333333333333333]

assumed.assumed; // true
```

`assumed` survives every mapping, and every combination of two distributions
where either side carries it. A combination involving a spread comes back as a
spread, which carries no weights to have assumed anything about. A quantile read
off an assumed distribution is a claim about the assumption, and `assumed` is
how a reader tells the two apart.

## Combining two estimates

Ranges compose badly. Add two one-to-three ranges and the support is two to
six. That is true and it misleads. The middle carries most of the probability
and the ends carry very little:

```ts
const both = combineOutcomes(
  advanced,
  advanced,
  (first, second) => first + second,
);

support(both); // [2, 3, 4, 5, 6]

both.outcomes.map((one) => [one.value, one.probability]);
// [[2, 0.0625], [3, 0.25], [4, 0.375], [5, 0.25], [6, 0.0625]]
```

Six is possible and it happens one time in sixteen. Chain three or four such
steps and the range covers so much ground that it stops informing anybody,
while the distribution stays sharp.

**Combining assumes the two estimates are independent.** Two parcels leaving
the same warehouse on the same morning share a cause, and a convolution
understates how often both are late. That is the tail anyone planning actually
cares about. Where a shared cause matters, model the cause as one estimate and
map that.

Weights survive only where both sides have them:

```ts
combineOutcomes(advanced, spread([0, 1]), (first, second) => first + second);
// { kind: "spread", values: [1, 2, 3, 4] }
```

There is no honest weight to put on a pair drawn from something unweighted, so
the answer comes back as a range.

## What it refuses

An outcome the search never reaches is refused rather than dropped:

```ts
advanceByCoveredDays(ordered, spread([1, 20]), {
  during: courier,
  within: Temporal.Duration.from("P3D"),
});
// RangeError: advanceByCoveredDays() ran out of search before reaching the
// outcome 20. Dropping it would take that much probability out of the answer
// without saying so. Widen `within`.
```

A distribution missing part of its mass still reads as a distribution, and
every quantile drawn from it would be wrong by however much went missing.

## Ordering

A median, a quantile and a CDF all need the outcomes in order. Counts,
durations, instants and the rest of what `Temporal` answers with are ordered as
they already are. Anything else takes an `order` of its own:

```ts
support(
  spread(["ccc", "a", "bb"]),
  (left, right) => left.length - right.length,
);
// ["a", "bb", "ccc"]
```

## Limits

**The rules themselves are certain.** A layer that only applies in some
weathers makes the answer a distribution over interval sets. That is a larger
change than this one. [Horizons](../horizon/) cover the related case of rules that are
known only so far ahead.

**Nothing fits a distribution from history.** Turning delivery records into
weights means converting calendar times back into rule-relative durations,
which Quando is well placed to do and does not do yet.

**A discrete estimate is the whole model.** Continuous inputs are discretised
by whoever supplies them, at a resolution they choose. Quando imposes no
sampling rate of its own.

<!-- card
```ts
const arrival = advanceByCoveredDays(ordered, advanced, {
  during: courier,
});
quantile(arrival, 0.95);
```
-->
