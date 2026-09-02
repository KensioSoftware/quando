# Merging values

A [cascade](../cascades/) normally resolves overlaps by precedence. The later
layer replaces the earlier layer.

Some values need to be combined. Two teams with three people each produce a
total of six. A base tariff and a peak charge can be added together.

Use a merge strategy to define how overlapping values combine.

## Default override behaviour

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

The second layer replaces the first on Wednesday, so the result is two.

## Count with `tally`

A `Tally` is a `Cascade<number>` that adds overlapping values. Its methods use
terms suited to counts:

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

`at` returns the count at one moment. `least` returns the lowest count in a
window. `counts` returns each interval with its count:

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

### Replace a count with `exactly`

`plus` adds to other values that cover the same time. `exactly` replaces lower
values within its scope:

```ts
import { tally, weekdays } from "@kensio/quando";

const staff = tally().plus(weekdays(), 3).exactly("2026-03-11", 1);

console.log(staff.at(wednesday));
```

```text
1
```

Using `plus` for the final line would produce four. Layers added after
`exactly` still add to its value.

### Unassigned time counts as zero

```ts
console.log(tally().plus(weekdays(), 3).least(from, to));
```

```text
0
```

Only weekdays have a count. The weekend is unassigned, and `least` treats it as
zero. `at` also returns zero for an unassigned moment.

## Use `sum` directly

`tally` builds a cascade with the `sum` strategy. Use `merged` directly when you
need `sum`, `max`, `min`, or `concat` without the `Tally` methods.

Pass the strategy name as the first argument to `merged`:

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

The overlapping values produce five on Wednesday. Layer order still controls
the argument order passed to the strategy. Unassigned time remains absent, and
the stream remains lazy.

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

Use `max` to keep the larger number and `min` to keep the smaller number.

## `concat`

Use `concat` to join overlapping arrays:

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

Wednesday contains both names in layer order.

## Why the strategy is a name

Merge strategies are stored in cascade JSON. A JavaScript function cannot be
stored in JSON, so cascades use strategy names.

The strategy names form a fixed set. Therefore,
[`parseCascade`](../serialisation/#parse-values-with-parsecascade)
rejects unknown strategies.

## Merge around replacement layers

A [replacing layer](../cascades/#replace-earlier-layers-within-a-scope) claims
its whole scope. Values from lower layers are not merged inside that scope.

Layers above the replacement still merge with it.

## Merge strategies validate their values

`parseCascade` validates the strategy name. `resolve` validates the values when
two layers overlap. A `sum` strategy over strings therefore fails during
resolution:

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

The error occurs only where incompatible values overlap. A `sum` cascade with
non-overlapping string values can resolve without an error.

<!-- card
```ts
const staff = merged(
  "sum",
  layer(weekdays(), 3),
  layer(dates("2026-03-11"), 2),
); // → 5 on the Wednesday
```
-->
