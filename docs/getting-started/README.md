# Getting started

Install Quando, write a rule, and ask it something. This page is the shortest
path from nothing to a real answer; the pages it links to at the end explain
each piece properly.

## What you need

Quando is built on [`Temporal`](https://tc39.es/proposal-temporal/docs/), and
reads it from the global rather than importing a polyfill of its own. That is
deliberate: the polyfill is large, and a library that bundled one would push it
on every consumer whose runtime already has the real thing. So Quando has no
runtime dependencies at all, and defers entirely to what it is running on.

The cost is that the runtime has to have `Temporal`:

- **Node 26 or later**, where it is a global. The package says so in `engines`,
  which most package managers warn about at install — and refuse outright under
  a strict engine setting — rather than leaving it to surface as a missing
  `Temporal` at the first call.
- **A browser that implements it.** Where one does not — Safari, at the time of
  writing — load a polyfill first. Quando neither ships nor imports it:

  ```ts
  import "temporal-polyfill/global";
  import { weekdays } from "@kensio/quando";
  ```

  What matters is that the global exists before anything in Quando is called,
  which a bare side-effect import at the top of your entry point guarantees.

If you use TypeScript, you also need `"lib": ["ESNext"]` in your `tsconfig.json`.
TypeScript ships `Temporal`'s declarations in that library and nowhere else, and
only from version 6 — under 5.x, `Temporal` is an undeclared name whatever the
lib setting says.

## Install

```bash
npm install @kensio/quando
```

> The rule language, the builder, the parser and the queries described in these
> pages are on `main` and go out in the next release. `0.1.0`, which is what npm
> serves today, carries only the interval core — `intersect`, `union`,
> `complement`, `clip` and the comparisons beneath them. If what you installed
> has no `weekdays`, that is why.

## A rule

A rule says _when_. It is built from small pieces that combine, and the pieces
are the ones you would name out loud:

```ts
import { timeOfDay, weekdays } from "@kensio/quando";

const openingHours = weekdays().and(timeOfDay("09:00", "17:00"));
```

That is not a builder that has to be finished and unwrapped. It is already the
rule — a plain object with a `type` tag, which happens to have `.and` hanging
off it. See [serialisation](../serialisation/) for what that buys you.

## Is it open?

The simplest question. `activeAt` takes a rule and a moment:

```ts
import { activeAt, timeOfDay, weekdays } from "@kensio/quando";

const openingHours = weekdays().and(timeOfDay("09:00", "17:00"));

const friday = Temporal.ZonedDateTime.from("2026-03-13T16:30[Europe/London]");
const saturday = Temporal.ZonedDateTime.from("2026-03-14T11:00[Europe/London]");

console.log(activeAt(openingHours, friday));
console.log(activeAt(openingHours, saturday));
```

```
true
false
```

Note the zone on those timestamps. Quando works in `Temporal.ZonedDateTime`
throughout, because a schedule without a zone is not a schedule — see
[time zones](../time-zones/).

## When does it open next?

```ts
import { next, timeOfDay, weekdays } from "@kensio/quando";

const openingHours = weekdays().and(timeOfDay("09:00", "17:00"));

const opening = next(openingHours, {
  from: Temporal.ZonedDateTime.from("2026-03-13T18:00[Europe/London]"),
});

console.log(opening?.start?.toString());
console.log(opening?.end?.toString());
```

```
2026-03-16T09:00:00+00:00[Europe/London]
2026-03-16T17:00:00+00:00[Europe/London]
```

Friday evening, so the answer is Monday morning — and it is a _stretch_ of time
rather than an instant, because that is what a rule produces.

The second argument is a **context**: where evaluation starts, and optionally
where it stops. Here there is no `to` at all, and the search still terminates
immediately, because the answer arrives long before the calendar runs out.

## How much of it is there?

```ts
import { elapsed, timeOfDay, weekdays } from "@kensio/quando";

const openingHours = weekdays().and(timeOfDay("09:00", "17:00"));

const week = elapsed(openingHours, {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
});

console.log(week.toString());
console.log(week.total("hours"));
```

```
PT40H
40
```

## Where do three working hours land?

The one that is hardest to do by hand, and the reason the library exists. An
order placed at five to five on a Friday, with three hours of packing that only
count while the warehouse is open:

```ts
import { advanceBy, timeOfDay, weekdays } from "@kensio/quando";

const openingHours = weekdays().and(timeOfDay("09:00", "17:00"));

const placed = Temporal.ZonedDateTime.from("2026-03-13T16:55[Europe/London]");
const packed = advanceBy(placed, Temporal.Duration.from({ hours: 3 }), {
  during: openingHours,
});

console.log(packed?.toString());
```

```
2026-03-16T11:55:00+00:00[Europe/London]
```

Five minutes on the Friday, then two hours fifty-five into Monday.

## Where to go next

- [Concepts](../concepts/) — why a rule produces intervals rather than answering
  yes or no. Worth reading once; everything else follows from it.
- [Rules](../rules/) — every rule type there is, and what each one produces.
- [Queries](../queries/) — the four questions, and what each does about a search
  that could run forever.
- [Time zones](../time-zones/) — which zone a rule is read in, and what happens
  on the two mornings a year the clocks change.
- [Serialisation](../serialisation/) — storing rules, and reading back what a
  database or a form actually held.
- [API](../api/) — everything the package exports.

<!-- card
```ts
import { activeAt, timeOfDay, weekdays } from "@kensio/quando";

const open = weekdays().and(timeOfDay("09:00", "17:00"));

console.log(activeAt(open, friday)); // → true
```
-->
