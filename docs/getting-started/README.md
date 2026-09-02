# Getting started

Install Quando, create a rule, and run the four main queries.

## What you need

Quando uses the global
[`Temporal`](https://tc39.es/proposal-temporal/docs/) API. It has no runtime
dependencies and does not include a polyfill.

Use one of these runtimes:

- Node 26 or later.
- A browser with native `Temporal` support.
- A browser with a `Temporal` polyfill loaded before Quando is used.

  ```bash
  npm install temporal-polyfill
  ```

  ```ts
  import "temporal-polyfill/global";
  import { weekdays } from "@kensio/quando";
  ```

  Put the side-effect import at the top of your entry point. This creates the
  global before your application calls Quando.

With TypeScript 6 or later, include `"lib": ["ESNext"]` in `tsconfig.json` to
load the `Temporal` declarations. TypeScript 5 does not include them.

## Install

```bash
npm install @kensio/quando
```

## A rule

A rule describes a set of times. Build a rule from smaller rules:

```ts
import { timeOfDay, weekdays } from "@kensio/quando";

const openingHours = weekdays().and(timeOfDay("09:00", "17:00"));
```

`openingHours` is ready to use. It is a plain object with a `type` field and
builder methods such as `.and`. See [serialisation](../serialisation/) for its
JSON form.

## Is it open?

`activeAt` reports whether a rule covers a given moment:

```ts
import { activeAt, timeOfDay, weekdays } from "@kensio/quando";

const openingHours = weekdays().and(timeOfDay("09:00", "17:00"));

const friday = Temporal.ZonedDateTime.from("2026-03-13T16:30[Europe/London]");
const saturday = Temporal.ZonedDateTime.from("2026-03-14T11:00[Europe/London]");

console.log(activeAt(openingHours, friday));
console.log(activeAt(openingHours, saturday));
```

```text
true
false
```

Quando uses `Temporal.ZonedDateTime` for moments. See
[time zones](../time-zones/) for zone selection and clock changes.

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

```text
2026-03-16T09:00:00+00:00[Europe/London]
2026-03-16T17:00:00+00:00[Europe/London]
```

The next interval starts on Monday morning and ends on Monday afternoon.

The second argument is a context. `from` sets the start of the search. An
optional `to` sets its end. This search has no end because it finds an interval
on the following Monday.

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

```text
PT40H
40
```

## Where do three working hours land?

`advanceBy` moves through the time covered by a rule. This example starts an
order at 16:55 on Friday and adds three hours of warehouse opening time:

```ts
import { advanceBy, timeOfDay, weekdays } from "@kensio/quando";

const openingHours = weekdays().and(timeOfDay("09:00", "17:00"));

const placed = Temporal.ZonedDateTime.from("2026-03-13T16:55[Europe/London]");
const packed = advanceBy(placed, Temporal.Duration.from({ hours: 3 }), {
  during: openingHours,
});

console.log(packed?.toString());
```

```text
2026-03-16T11:55:00+00:00[Europe/London]
```

The calculation uses five minutes on Friday and the remaining two hours and 55
minutes on Monday.

## Where to go next

- [Concepts](../concepts/) explains the data model.
- [Rules](../rules/) documents every rule type.
- [Queries](../queries/) documents the four main queries and search bounds.
- [Time zones](../time-zones/) explains zone selection and clock changes.
- [Serialisation](../serialisation/) covers storing and parsing rules.
- [API](../api/) lists every package export.

<!-- card
```ts
import { activeAt, timeOfDay, weekdays } from "@kensio/quando";

const open = weekdays().and(timeOfDay("09:00", "17:00"));

console.log(activeAt(open, friday)); // → true
```
-->
