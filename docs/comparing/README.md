# Comparing definitions

Use `equals` when two rule or cascade documents may have different shapes but
the same canonical form. Use `fingerprint` when you need that form as a stable
string.

These operations compare document structure. They do not evaluate definitions
over time.

## Canonical form

`canonical` removes structural differences introduced by grouping, input
order, and shorthand:

```ts
import { all, canonical, timeOfDay, weekdays } from "@kensio/quando";

const openingHours = all(all(weekdays()), timeOfDay("09:00", "17:00"));

console.log(canonical(openingHours));
```

For rules, canonicalisation:

- Flattens nested `all` and `any` groups.
- Unwraps a group that contains one rule.
- Simplifies identity rules, constants, and double negation.
- Sorts and removes duplicate group members, weekdays, and dates.
- Normalises date and time strings.

For cascades, it canonicalises every layer scope and nested replacement. Layer
order stays unchanged because it controls priority and merge order. An explicit
`"override"` strategy is removed because override is the default.

## Equality

```ts
import { all, equals, timeOfDay, weekdays } from "@kensio/quando";

const built = all(all(weekdays()), timeOfDay("09:00", "17:00"));
const written = all(timeOfDay("09:00:00", "17:00:00"), weekdays());

console.log(equals(built, written));
```

```text
true
```

`equals` canonicalises both values and compares their fingerprints.

## Fingerprints

```ts
import { fingerprint, weekdays } from "@kensio/quando";

const key = fingerprint(weekdays());
```

The result is the canonical JSON string. Equal canonical values have equal
fingerprints. Cascade values must also have stable JSON representations if you
store the fingerprint as a persistent key.

## Structural limits

Canonicalisation does not prove semantic equality. Different rule types remain
different even when they happen to cover the same time:

```ts
import { always, daysOfWeek, equals } from "@kensio/quando";

const everyNamedDay = daysOfWeek(
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
);

console.log(equals(always(), everyNamedDay));
```

```text
false
```

`canonical`, `equals`, and `fingerprint` expect valid Quando data. Parse
[stored data](../serialisation/) before comparing it.

Use `coverageChanges` when you need semantic differences inside a time window.
It evaluates both definitions and reports the intervals added to and removed
from their coverage. See the [queries guide](../queries/#compare-covered-time).

<!-- card
```ts
const built = all(all(weekdays()), timeOfDay("09:00", "17:00"));
const written = all(timeOfDay("09:00:00", "17:00:00"), weekdays());

equals(built, written); // true
```
-->
