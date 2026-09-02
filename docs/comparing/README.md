# Comparing rules

Two rules that say the same thing can be two different documents. `.except(…)`
is `all(this, not(any(…)))` spelled out, so a rule built with it carries an
`all` inside an `all`. A rule composed from stored pieces carries whatever
nesting the composing produced.

Comparing rules, hashing them and diffing them all want the same thing first,
which is a form that depends on what a rule says rather than on how it came to
be written.

## `canonical`

```ts
import { canonical, dates, weekdays } from "@kensio/quando";

const openingHours = weekdays().except(dates("2026-12-25"));

console.log(JSON.stringify(canonical(openingHours)));
```

```text
{"type":"all","rules":[{"type":"daysOfWeek","days":["monday","tuesday","wednesday","thursday","friday"]},{"type":"not","rule":{"type":"dates","dates":["2026-12-25"]}}]}
```

The `all` inside the `all` is gone, and so is the `any` that held one rule.
Compare that with the document `.except(…)` [actually
builds](../serialisation/#the-builder-is-the-document).

What it does, in full:

- **Flattens** a nested `all` into the `all` around it, and the same for `any`.
- **Unwraps** a combinator holding one rule.
- **Drops** `always` from an `all` and `never` from an `any`, which add
  nothing. An `all` holding `never` becomes `never`, and an `any` holding
  `always` becomes `always`.
- **Reads** an empty `all` as `always` and an empty `any` as `never`, which are
  the identities they stand for.
- **Cancels** double negation, and writes the complement of a constant as the
  other constant.
- **Orders and deduplicates** the operands of `all` and `any`, which are
  commutative and idempotent.
- **Orders** a leaf's own contents. Days come back in calendar order, dates in
  date order, both without repeats.
- **Writes** times and dates one way, so `"09:00"` and `"09:00:00"` compare
  equal.

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

A [cascade](../cascades/) canonicalises too. Its layers stay where they are,
because their order is what a cascade means. Each scope is tidied, and a
`merge` of `"override"` is dropped, being the default written out.

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

`fingerprint` is a stable string, the same for any two rules that say the same
thing. That is what a cache key is, and hashing it gives a shorter one.
`equals` compares two fingerprints.

Both take a rule or a cascade. A cascade's values go through `JSON.stringify`
along with everything else, so a fingerprint is worth as much as those values
are storable.

## Where this stops

The form is syntactic. Two rules that _cover the same time_ by different routes
stay different:

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

Those two cover exactly the same time, and they compare as different. Deciding
the other question in general means evaluating both rules over all of time,
which is expensive where it terminates at all. `equals` answers "do these say
the same thing", and that is the question a cache key and a diff both want.

A rule holding a time that will not parse comes back with that value untouched.
A function used for cache keys is worth more total than strict, and
[`parseRule`](../serialisation/) is the place that refuses a bad document.

<!-- card
```ts
const built = weekdays().except(dates("2026-12-25"));

console.log(equals(built, canonical(built))); // → true
```
-->
