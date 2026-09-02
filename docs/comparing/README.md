# Comparing rules

Two rule documents can have the same canonical form. For example, `.except()`
creates `all(this, not(any(...)))` and may produce redundant nesting.

Use `canonical` to remove these structural differences before comparing rules or
creating cache keys.

## `canonical`

```ts
import { canonical, dates, weekdays } from "@kensio/quando";

const openingHours = weekdays().except(dates("2026-12-25"));

console.log(JSON.stringify(canonical(openingHours)));
```

```text
{"type":"all","rules":[{"type":"daysOfWeek","days":["monday","tuesday","wednesday","thursday","friday"]},{"type":"not","rule":{"type":"dates","dates":["2026-12-25"]}}]}
```

The result removes the nested `all` and the `any` that contains one rule. See
[the serialisation example](../serialisation/#the-builder-is-the-document) for
the original document.

`canonical` performs these transformations:

- It flattens nested `all` and `any` rules.
- It unwraps a combinator that contains one rule.
- It removes identity rules and resolves constant results.
- It converts an empty `all` to `always` and an empty `any` to `never`.
- It cancels double negation and complements of constants.
- It sorts and deduplicates operands of `all` and `any`.
- It sorts and deduplicates weekdays and dates.
- It normalises times and dates. For example, `"09:00"` and `"09:00:00"`
  become equal.

```ts
import {
  all,
  always,
  canonical,
  daysOfWeek,
  not,
  weekdays,
} from "@kensio/quando";

console.log(
  JSON.stringify(canonical(daysOfWeek("friday", "monday", "monday"))),
);
console.log(JSON.stringify(canonical(all(all(weekdays()), always()))));
console.log(JSON.stringify(canonical(not(not(daysOfWeek("monday"))))));
```

```text
{"type":"daysOfWeek","days":["monday","friday"]}
{"type":"daysOfWeek","days":["monday","tuesday","wednesday","thursday","friday"]}
{"type":"daysOfWeek","days":["monday"]}
```

`canonical` also accepts a [cascade](../cascades/). It preserves layer order,
canonicalises each scope, and removes an explicit `"override"` merge strategy
because that is the default.

## `equals` and `fingerprint`

```ts
import { all, equals, fingerprint, timeOfDay, weekdays } from "@kensio/quando";

const built = all(all(weekdays()), timeOfDay("09:00", "17:00"));
const written = all(timeOfDay("09:00:00", "17:00:00"), weekdays());

console.log(equals(built, written));
console.log(fingerprint(built));
```

```text
true
{"type":"all","rules":[{"type":"daysOfWeek","days":["monday","tuesday","wednesday","thursday","friday"]},{"type":"timeOfDay","from":"09:00:00","to":"17:00:00"}]}
```

`fingerprint` returns a stable string for the canonical value. Equal canonical
values have the same fingerprint. `equals` compares two fingerprints.

Both functions accept rules and cascades. Cascade values are serialised with
`JSON.stringify`, so they must have a stable JSON representation if the
fingerprint is used as a persistent key.

## Comparison is syntactic

Canonical form does not prove that two rules cover the same times. Rules built
from different rule types can remain different:

```ts
import { always, daysOfWeek, equals } from "@kensio/quando";

const everything = always();
const everyDay = daysOfWeek(
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
);

console.log(equals(everything, everyDay));
```

```text
false
```

Both rules cover all time, but `equals` returns `false`. Semantic equality would
require evaluating the rules over an unbounded timeline.

`canonical` does not validate rule data. Invalid times and dates remain
unchanged. Validate external data with [`parseRule`](../serialisation/) before
canonicalising it.

<!-- card
```ts
const built = weekdays().except(dates("2026-12-25"));

console.log(equals(built, canonical(built))); // → true
```
-->
