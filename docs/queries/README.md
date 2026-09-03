# Queries

Queries answer common questions about the time a rule or boolean cascade
covers.

| Function              | Question                                      |
| --------------------- | --------------------------------------------- |
| `activeAt`            | Does this cover an instant?                   |
| `nextCoveredInterval` | What is the current or next covered interval? |
| `coveredDuration`     | How much covered time falls inside a window?  |
| `advanceBy`           | Where does an amount of covered time finish?  |

Schedules expose the same operations as `isOpen`, `opensNext`, `openDuration`,
and `addOpenTime`.

## Check an instant

```ts
import { activeAt, timeOfDay, weekdays } from "@kensio/quando";

const office = weekdays().and(timeOfDay("09:00", "17:00"));
const monday = Temporal.ZonedDateTime.from("2026-03-09T10:00[Europe/London]");

console.log(activeAt(office, monday));
```

```text
true
```

`activeAt` uses half-open interval bounds. Opening time is covered and closing
time is excluded.

## Find the current or next interval

```ts
import { nextCoveredInterval } from "@kensio/quando";

const fridayEvening = {
  from: Temporal.ZonedDateTime.from("2026-03-13T18:00[Europe/London]"),
};

const opening = nextCoveredInterval(office, fridayEvening);
console.log(opening?.start?.toString());
```

```text
2026-03-16T09:00:00+00:00[Europe/London]
```

When the start lies inside a covered interval, the returned interval starts at
that instant. Pass `complete: true` to return its real end when a finite search
window would clip it.

## Measure covered time

```ts
import { coveredDuration } from "@kensio/quando";

const week = coveredDuration(office, {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
});

console.log(week.toString());
```

```text
PT40H
```

`coveredDuration` requires a `to`. It rejects a reversed window.

## Advance through covered time

```ts
import { advanceBy } from "@kensio/quando";

const placed = Temporal.ZonedDateTime.from("2026-03-13T16:55[Europe/London]");

const dispatch = advanceBy(placed, Temporal.Duration.from({ hours: 3 }), {
  during: office,
});

console.log(dispatch?.toString());
```

```text
2026-03-16T11:55:00+00:00[Europe/London]
```

`advanceBy` accepts exact elapsed units from hours down to nanoseconds. It
rejects years, months, weeks, days, and negative durations. A zero duration
returns the input instant.

Schedules pass directly as `during`:

```ts
import { schedule, weekdays } from "@kensio/quando";

const openingHours = schedule().open(weekdays(), "09:00-17:00");
const dispatch = advanceBy(placed, Temporal.Duration.from({ hours: 3 }), {
  during: openingHours,
});
```

## Search limits

`nextCoveredInterval` and `advanceBy` apply a 100-year safety limit when the
context has no end and the caller supplies no `within`. They throw
`SearchLimitExceededError` if the limit expires.

Use `within` when an empty result is expected:

```ts
const opening = nextCoveredInterval(office, fridayEvening, {
  within: Temporal.Duration.from({ hours: 2 }),
});
```

The result is `undefined` after the explicit range has been searched. An
existing `context.to` also defines an explicit range. `within` narrows that
range and never widens it.

The low-level `intervals` and `resolve` streams remain lazy. An unbounded stream
is suitable when the caller controls how many values it pulls. Those functions
live in `@kensio/quando/core`.

## Cascade values

Use `assigned` from the core entry point to query one value in a cascade:

```ts
import { coveredDuration, rota, weekdays } from "@kensio/quando";
import { assigned } from "@kensio/quando/core";

const onCall = rota().assign(weekdays(), "alice");
const weekContext = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};
const aliceHours = coveredDuration(assigned(onCall, "alice"), weekContext);
```

`activeAt`, `nextCoveredInterval`, `coveredDuration`, and `advanceBy` accept a
rule, a boolean cascade or façade, or an assigned cascade value.

<!-- card
```ts
const dispatch = openingHours.addOpenTime(
  placed,
  Temporal.Duration.from({ hours: 3 }),
);
```
-->
