# Merging values

A [cascade](../cascades/) settles an overlap by precedence. The later layer
wins and the earlier one is displaced, which is what a rota and a schedule
want. One person is on call, and a shop is open or it is shut.

Some domains want the other answer. Two teams each putting three people on a
Monday have six people on that Monday. A tariff built from a standing charge
and a peak rate is the sum of the two. Asking whether an order can be taken
needs the capacity, and capacity adds.

A cascade says which it means by naming a merge strategy.

## The default, spelled out

```ts
import { cascade, dates, layer, resolve, weekdays } from "@kensio/quando";

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

const staff = cascade(layer(weekdays(), 3), layer(dates("2026-03-11"), 2));

for (const { start, end, value } of resolve(staff, week)) {
  console.log(`${start?.toPlainDate()} → ${end?.toPlainDate()}: ${value}`);
}
```

```text
2026-03-09 → 2026-03-11: 3
2026-03-11 → 2026-03-12: 2
2026-03-12 → 2026-03-14: 3
```

Two on the Wednesday, because the second layer displaced the first. That is
almost certainly wrong for a roster, and it is the right answer for a rota.

## `tally`, for counting

The plain way in, and the one to reach for. A `Tally` is a `Cascade<number>`
that sums, said in the words somebody staffing a warehouse would use:

```ts
import { tally, weekdays, weekends } from "@kensio/quando";

const staff = tally()
  .plus(weekdays(), 3)
  .plus(weekends(), 1)
  .plus("2026-03-11", 2); // two extra that Wednesday

const wednesday = Temporal.ZonedDateTime.from(
  "2026-03-11T11:00[Europe/London]",
);
const saturday = Temporal.ZonedDateTime.from("2026-03-14T11:00[Europe/London]");
const from = Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]");
const to = Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]");

console.log(staff.at(wednesday));
console.log(staff.at(saturday));
console.log(staff.least(from, to));
```

```text
5
1
1
```

`at` is how many at a moment. `least` is the thinnest cover anywhere in a
window. That second one is the question a capacity check is really asking.
`counts` gives each stretch and its figure:

```ts
for (const { start, value } of staff.counts(from, to)) {
  console.log(`${start?.toPlainDate()}: ${value}`);
}
```

```text
2026-03-09: 3
2026-03-11: 5
2026-03-12: 3
2026-03-14: 1
```

### `exactly`, for a figure that replaces

`plus` adds to whatever else covers the same time. `exactly` is the figure
there instead. A skeleton crew is exactly that:

```ts
import { tally, weekdays } from "@kensio/quando";

const staff = tally().plus(weekdays(), 3).exactly("2026-03-11", 1);

console.log(staff.at(wednesday));
```

```text
1
```

Said as a `plus` that would have been four, and the author would have had to
know what they were adding to. Lines written _after_ an `of` still add to it,
because it outranks only what is under it.

### Nobody is zero

```ts
console.log(tally().plus(weekdays(), 3).least(from, to));
```

```text
0
```

Only the weekdays have a line covering them. The thinnest cover across the week
is therefore nobody. A cascade leaves an unclaimed moment out of its stream, and
`at` and `least` both read that absence as the figure it is.

## `sum`, underneath

`tally` is `merged("sum", …)` with domain words on it, in the same way a
[schedule](../schedules/) is a cascade with domain words on it. Reach for
`merged` directly for values other than counts, or where `max`, `min` or
`concat` is what the overlap means.

`merged` builds the same cascade with a strategy on it:

```ts
import { dates, layer, merged, resolve, weekdays } from "@kensio/quando";

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

const staff = merged(
  "sum",
  layer(weekdays(), 3),
  layer(dates("2026-03-11"), 2),
);

for (const { start, end, value } of resolve(staff, week)) {
  console.log(`${start?.toPlainDate()} → ${end?.toPlainDate()}: ${value}`);
}
```

```text
2026-03-09 → 2026-03-11: 3
2026-03-11 → 2026-03-12: 5
2026-03-12 → 2026-03-14: 3
```

Five on the Wednesday. Everything else about a cascade is unchanged. Order
still decides which value is which side of the merge, a day no layer claims is
still absent from the answer, and the stream is still lazy.

## `max` and `min`

```ts
import { dates, layer, merged, resolve, weekdays } from "@kensio/quando";

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

const tariff = merged(
  "max",
  layer(weekdays(), 12),
  layer(dates("2026-03-11"), 30),
);

for (const { start, end, value } of resolve(tariff, week)) {
  console.log(`${start?.toPlainDate()} → ${end?.toPlainDate()}: ${value}`);
}
```

```text
2026-03-09 → 2026-03-11: 12
2026-03-11 → 2026-03-12: 30
2026-03-12 → 2026-03-14: 12
```

`min` is the same the other way, and is the discount question rather than the
peak one.

## `concat`

Where more than one answer can hold at once, carry lists and join them:

```ts
import { dates, layer, merged, resolve, weekdays } from "@kensio/quando";

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

const onCall = merged(
  "concat",
  layer(weekdays(), ["alice"]),
  layer(dates("2026-03-11"), ["bob"]),
);

for (const { start, end, value } of resolve(onCall, week)) {
  console.log(`${start?.toPlainDate()} → ${end?.toPlainDate()}: ${value}`);
}
```

```text
2026-03-09 → 2026-03-11: alice
2026-03-11 → 2026-03-12: alice,bob
2026-03-12 → 2026-03-14: alice
```

Both names on the Wednesday, in layer order. This is what a rota that allows
two people on shift looks like.

## Why the strategy is a name

A merge function passed to `resolve` would be more flexible and would break the
thing the library is built on. A cascade is a JSON document, and a function
cannot be stored. A cascade carrying one would be a document that no longer
says what it means, and two readers of the same stored cascade could reach
different answers from it.

So the strategy is a name, the vocabulary is closed, and
[`parseCascade`](../serialisation/#parsecascade-when-the-document-carries-values)
refuses one it has not heard of. The same trade the rule language already
makes.

## Replacing layers still replace

A [replacing layer](../cascades/#overrides-which-a-plain-value-cannot-express)
claims its whole scope, and a merge does not change that. What sits below it is
kept out of the scope entirely rather than merged into it, which is what "use
this instead" has to mean.

Layers _above_ a replacement merge with it as usual. A replacement outranks
what is under it and nothing more.

## The values have to be ones the strategy can combine

The strategy is checked when a document is parsed. What the values turn out to
be is only known when the cascade is resolved, so a `sum` over names fails
there:

```ts
import { dates, layer, merged, resolve, weekdays } from "@kensio/quando";

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

const onCall = merged(
  "sum",
  layer(weekdays(), "alice"),
  layer(dates("2026-03-11"), "bob"),
);

try {
  [...resolve(onCall, week)];
} catch (error) {
  console.log(String(error));
}
```

```text
TypeError: A cascade merging by "sum" carries numbers, and this one holds string. Give it values it can combine, or merge by "override".
```

The same split the rule language keeps. Parsing checks shape and vocabulary,
and meaning is settled where the thing is evaluated. It throws only where two
layers actually meet, so a `sum` whose scopes never overlap resolves without
complaint.

<!-- card
```ts
const staff = merged(
  "sum",
  layer(weekdays(), 3),
  layer(dates("2026-03-11"), 2),
); // → 5 on the Wednesday
```
-->
