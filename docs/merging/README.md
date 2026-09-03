# Merging values

A cascade normally uses layer priority. The last matching layer supplies the
value. A merge strategy combines every matching value instead.

Use a [tally](#count-with-a-tally) for counts. Use `merged` when you need direct
access to the low-level strategies.

## Count with a tally

A tally adds numeric values that cover the same time:

```ts
import { tally, weekdays, weekends } from "@kensio/quando";

const staff = tally()
  .plus(weekdays(), 3, { label: "Usual crew" })
  .plus(weekends(), 1)
  .plus("2026-03-11", 2, { label: "Delivery cover" });

const wednesday = Temporal.ZonedDateTime.from(
  "2026-03-11T11:00[Europe/London]",
);

console.log(staff.at(wednesday));
```

```text
5
```

The tally supplies several common operations:

| Method                             | Meaning                               |
| ---------------------------------- | ------------------------------------- |
| `plus(scope, amount, options?)`    | Add an amount                         |
| `exactly(scope, amount, options?)` | Replace lower values within the scope |
| `at(instant)`                      | Read the amount at one instant        |
| `explain(instant)`                 | Explain how the matching lines add up |
| `least(from, to)`                  | Find the lowest amount in a window    |
| `counts(from, to?)`                | Resolve the valued intervals          |
| `validate(from, to)`               | Find inactive and shadowed lines      |

`at` and `least` treat unassigned time as zero. `counts` returns assigned
intervals only. See [explanations](../explanations/) for the trace returned by
`explain`.

## Use a merge strategy directly

`merged` stores the strategy in a cascade:

| Strategy   | Accepted values           | Overlap result           |
| ---------- | ------------------------- | ------------------------ |
| `override` | Any JSON-compatible value | The later value          |
| `sum`      | Numbers                   | The total                |
| `max`      | Numbers                   | The largest value        |
| `min`      | Numbers                   | The smallest value       |
| `concat`   | Arrays                    | One array in layer order |

This cascade adds two extra staff members on Wednesday:

```ts
import { dates, weekdays } from "@kensio/quando";
import { layer, merged, resolve } from "@kensio/quando/core";

const staff = merged(
  "sum",
  layer(weekdays(), 3),
  layer(dates("2026-03-11"), 2),
);

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

for (const { start, end, value } of resolve(staff, week)) {
  console.log(`${start?.toPlainDate()} → ${end?.toPlainDate()}: ${value}`);
}
```

```text
2026-03-09 → 2026-03-11: 3
2026-03-11 → 2026-03-12: 5
2026-03-12 → 2026-03-14: 3
```

Layer order controls the order used by `concat`:

```ts
const onCall = merged(
  "concat",
  layer(weekdays(), ["alice"]),
  layer(dates("2026-03-11"), ["bob"]),
);
```

The value on Wednesday is `["alice", "bob"]`.

## Replacement and merging

A replacement layer owns its whole scope. Values from lower layers do not
participate in that region. Layers above the replacement still merge with its
result.

A nested replacement cascade uses its own strategy. This lets an outer
`sum` cascade contain a replacement that uses `max`, for example.

## Validation

TypeScript connects each strategy to its value type. `sum`, `max`, and
`min` accept numbers. `concat` accepts arrays.

Runtime validation applies the same rules to raw layers and parsed documents.
Invalid values fail when the cascade is constructed or parsed:

```ts
import { asString, parseCascade } from "@kensio/quando/parsing";

parseCascade(
  {
    type: "cascade",
    merge: "sum",
    layers: [{ scope: { type: "always" }, value: "alice" }],
  },
  asString,
);
```

```text
TypeError: cascade.layers[0].value: sum needs numbers.
```

Strategy names are part of the stored JSON document. `parseCascade` rejects
unknown names.

<!-- card
```ts
const staff = merged(
  "sum",
  layer(weekdays(), 3),
  layer(dates("2026-03-11"), 2),
); // 5 on Wednesday
```
-->
