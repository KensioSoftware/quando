---
description: "Compare Quando definitions by canonical form and compute stable fingerprints."
---

# Comparing definitions

Use `sameDefinition` to compare rule or cascade documents after normalising
their structure. Use `fingerprint` to obtain the normalised document as a
stable JSON string.

These operations compare document structure. They do not evaluate definitions
over time.

## Canonical form

`canonical` removes structural differences introduced by grouping, input
order, and shorthand:

```ts
import { all, canonical, timeOfDayRange, weekdays } from "@kensio/quando";

const openingHours = all(all(weekdays()), timeOfDayRange("09:00", "17:00"));

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
import { all, sameDefinition, timeOfDayRange, weekdays } from "@kensio/quando";

const built = all(all(weekdays()), timeOfDayRange("09:00", "17:00"));
const written = all(timeOfDayRange("09:00:00", "17:00:00"), weekdays());

console.log(sameDefinition(built, written));
```

```text
true
```

`sameDefinition` canonicalises both values and compares their fingerprints.

## Fingerprints

```ts
import { fingerprint, weekdays } from "@kensio/quando";

const key = fingerprint(weekdays());
```

The result is the canonical JSON string. Equal canonical values have equal
fingerprints. Cascade values must also have stable JSON representations if you
store the fingerprint as a persistent key.

Canonical sorting uses UTF-16 code units. It is independent of the machine's
language settings, giving the same rule the same fingerprint across machines.

## Structural limits

Canonicalisation does not prove semantic equality. Different rule types remain
different even when they happen to cover the same time:

```ts
import { always, daysOfWeek, sameDefinition } from "@kensio/quando";

const everyNamedDay = daysOfWeek(
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
);

console.log(sameDefinition(always(), everyNamedDay));
```

```text
false
```

`canonical`, `sameDefinition`, and `fingerprint` expect valid Quando data. Parse
[stored data](../serialisation/) before comparing it.

Use `coverageChanges` to compare the time covered by two definitions within
a window. It evaluates both definitions and reports added and removed
intervals. See the [queries guide](../queries/#compare-covered-time).

<!-- card
```ts
const built = all(all(weekdays()), timeOfDayRange("09:00", "17:00"));
const written = all(timeOfDayRange("09:00:00", "17:00:00"), weekdays());

sameDefinition(built, written); // true
```
-->
