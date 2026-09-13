---
description: "Assign values to periods of time with ordered layers in Quando."
---

# Cascades

A cascade is an ordered set of rules that assign values over time. Each layer
pairs a rule with a value. By default, the last matching layer supplies the
value.

Use [schedules, rotas, or tallies](../concepts/#choose-the-smallest-useful-api)
for common tasks. Use a cascade directly for custom replacement or merge
behaviour.

## Build and resolve a cascade

```ts
import { dates, weekdays } from "@kensio/quando";
import { cascade, layer, resolve } from "@kensio/quando/core";

const onCall = cascade(
  layer(weekdays(), "alice", { label: "Primary possibleValues" }),
  layer(dates("2026-03-11"), "bob", {
    label: "Wednesday swap",
    comment: "Bob is covering Alice's leave.",
  }),
);

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

for (const { start, end, value } of resolve(onCall, week)) {
  console.log(
    `${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}: ${value}`,
  );
}
```

```text
2026-03-09T00:00:00 → 2026-03-11T00:00:00: alice
2026-03-11T00:00:00 → 2026-03-12T00:00:00: bob
2026-03-12T00:00:00 → 2026-03-14T00:00:00: alice
```

`resolve` returns a lazy stream of intervals, each with its assigned value.
Intervals are ordered and non-overlapping. They include their start, exclude
their end, and use the query context's time zone.

Time that has no assigned value is absent from the stream. Add an explicit
value such as `"nobody"` if your domain needs to represent that state.

The optional third argument to `layer` stores a label, a comment, or both.
`replace` accepts the same options. Explanations include this text alongside
the rule match and the layer's effect on the result.

## Layer order sets priority

The last matching layer supplies the value. Rule specificity does not affect
priority.

```ts
const onCall = cascade(
  layer(dates("2026-03-11"), "bob"),
  layer(weekdays(), "alice"),
);
```

This version assigns Alice on Wednesday because the weekday layer comes last.

Adjacent intervals are combined when `Object.is` considers their values equal.
Primitive values and repeated object references can combine. Separate object
instances remain separate.

## Replace lower layers within a scope

Use `replace` when a scope needs its own complete definition. An office that
closes early on one date is a common example:

```ts
import { all, dates, timeOfDayRange, weekdays } from "@kensio/quando";
import { cascade, layer, replace, resolve } from "@kensio/quando/core";

const openingHours = cascade(
  layer(all(weekdays(), timeOfDayRange("09:00", "17:00")), true),
  replace(dates("2026-03-11"), timeOfDayRange("09:00", "15:00")),
);
```

The replacement overrides lower layers for the whole selected date. The
office opens from 09:00 to 15:00 and is closed for the rest of that date.

Passing a rule as the replacement creates a boolean cascade. Pass another
cascade when you need a different value type:

```ts
import { dates, timeOfDayRange, weekdays } from "@kensio/quando";
import { cascade, layer, replace } from "@kensio/quando/core";

const holidayCover = cascade(
  layer(timeOfDayRange("09:00", "12:00"), "alice"),
  layer(timeOfDayRange("12:00", "17:00"), "bob"),
);

const onCall = cascade(
  layer(weekdays(), "carol"),
  replace(dates("2026-03-11"), holidayCover),
);
```

Replacement cascades can contain their own merge strategy and nested
replacements.

## Query cascade values

`valueAt` returns the value assigned at one instant. `nextValueInterval` returns the
next valued interval.

```ts
import { nextValueInterval, valueAt } from "@kensio/quando/core";

const now = Temporal.ZonedDateTime.from("2026-03-11T10:00[Europe/London]");

console.log(valueAt(onCall, now));
console.log(nextValueInterval(onCall, { from: now }));
```

Use `assigned(cascade, value)` to select periods assigned to one value. Pass
the selection to the common [queries](../queries/):

```ts
import { coveredDuration } from "@kensio/quando";
import { assigned } from "@kensio/quando/core";

const aliceTime = coveredDuration(assigned(onCall, "alice"), week);
```

Use `explain` to read why each rule matched and how it changed the result:

```ts
import { explain } from "@kensio/quando/core";

const explanation = explain(onCall, now);
console.log(explanation.summary);
```

Replacement steps contain a nested explanation. `explainRule` describes a rule
match without a cascade. See [explanations](../explanations/) for the result
shape and high-level methods.

## Merge overlapping values

The default `cascade` constructor uses priority. The `merged` constructor can
add numbers, select numeric limits, or join arrays. See
[merging values](../merging/) for the available strategies.

## Store a cascade

Cascades contain JSON-compatible data:

```ts
const stored = JSON.stringify(onCall);
```

Use `parseCascade` to validate stored data and restore its types. The
[serialisation guide](../serialisation/#cascades) shows the parser.

In stored JSON, a constant layer has a `value` field. A replacement layer has
a `replace` field containing its nested cascade. This identifies which layer
behaviour to restore when parsing.

## Bound searches over recurring cascades

`resolve` is lazy. A recurring cascade produces an endless stream when the
context has no `to`.

Use `take` when you need a fixed number of results:

```ts
import { resolve, take } from "@kensio/quando/core";

const firstTwo = take(resolve(onCall, { from: week.from }), 2);
```

A cascade that never assigns a value can search forever in an unbounded
context. Add `to` when an empty result is possible. High-level queries apply
the [documented search limits](../queries/#bound-a-search).

<!-- card
```ts
const onCall = cascade(
  layer(weekdays(), "alice"),
  layer(dates("2026-03-11"), "bob"),
);
```
-->
