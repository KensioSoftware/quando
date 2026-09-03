# Queries

Quando provides six common queries for rules, schedules, and selected cascade
values.

| Function              | Question                                           |
| --------------------- | -------------------------------------------------- |
| `activeAt`            | Is this instant covered?                           |
| `nextCoveredInterval` | What is the current or next covered interval?      |
| `firstGap`            | Where does a duration fit in covered time?         |
| `slots`               | Which fixed-length candidates fit in covered time? |
| `coveredDuration`     | How much covered time is inside this window?       |
| `advanceBy`           | Where does an amount of covered time finish?       |

Schedules can be passed directly to all six functions. They also expose
`isOpen`, `opensNext`, `openDuration`, and `addOpenTime` as methods for the four
general schedule questions.

## Query inputs

The standalone functions accept any of these inputs:

- A rule
- A schedule or another boolean cascade
- One value selected from a cascade with `assigned`

Every instant is a `Temporal.ZonedDateTime`. A range is a `Context` with
`from` and optional `to` values.

## Check an instant

`activeAt` returns whether its input covers one instant.

```ts
import { activeAt, timeOfDay, weekdays } from "@kensio/quando";

const office = weekdays().and(timeOfDay("09:00", "17:00"));
const monday = Temporal.ZonedDateTime.from("2026-03-09T10:00[Europe/London]");

console.log(activeAt(office, monday));
```

```text
true
```

Coverage is half-open. The opening instant is covered and the closing instant
is excluded.

## Find the current or next interval

`nextCoveredInterval` starts searching at `context.from`.

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

If `context.from` is already covered, the result begins at that instant. The
query answers what is covered from now onward.

A finite search can clip the end of the returned interval. Pass
`{ complete: true }` to continue far enough to return the interval's complete
end.

## Find an available gap

`firstGap` returns the earliest interval of the requested length that fits
wholly inside covered time. Intersect rules first to find time shared by
several people.

```ts
import { firstGap, timeOfDay, weekdays } from "@kensio/quando";

const alice = weekdays().and(timeOfDay("09:00", "17:00"));
const bob = weekdays().and(timeOfDay("10:00", "16:00"));
const shared = alice.and(bob);

const gap = firstGap(shared, Temporal.Duration.from({ hours: 2 }), {
  from: Temporal.ZonedDateTime.from("2026-03-09T13:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-09T18:00[Europe/London]"),
});

console.log(gap?.start?.toPlainTime().toString());
console.log(gap?.end?.toPlainTime().toString());
```

```text
13:00:00
15:00:00
```

The gap begins at the start of the first covered interval long enough to hold
it. An interval ending exactly when the gap ends is an exact fit.

## Produce booking slots

`slots` lazily emits candidate intervals. `lasting` sets each candidate's
length and `every` sets the time between candidate starts.

```ts
import { slots } from "@kensio/quando";

const candidates = slots(
  shared,
  {
    from: Temporal.ZonedDateTime.from("2026-03-09T14:00[Europe/London]"),
    to: Temporal.ZonedDateTime.from("2026-03-09T15:00[Europe/London]"),
  },
  {
    every: Temporal.Duration.from({ minutes: 15 }),
    lasting: Temporal.Duration.from({ minutes: 30 }),
  },
);

console.log(
  [...candidates].map((candidate) => candidate.start?.toPlainTime().toString()),
);
```

```text
[ '14:00:00', '14:15:00', '14:30:00' ]
```

Each covered interval starts its own cadence. Candidates may overlap when
`every` is shorter than `lasting`. A candidate must fit wholly inside one
covered interval.

Both durations use exact elapsed time and must be positive. Calendar units
such as days and months are rejected.

## Measure covered time

`coveredDuration` adds the elapsed length of every covered interval in a
finite window.

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

This query requires `context.to`. It rejects a reversed window. Durations use
exact elapsed time, including across clock changes.

## Add covered time

`advanceBy` moves forward while counting only the time covered by its
`during` input.

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

Five minutes count on Friday. Closed time is skipped, and the remaining time
finishes on Monday.

The duration may use hours, minutes, seconds, milliseconds, microseconds, and
nanoseconds. Calendar units are rejected because a day can have 23, 24, or 25
elapsed hours. Negative durations are also rejected. A zero duration returns
the starting instant.

Schedules can be passed directly:

```ts
import { schedule, weekdays } from "@kensio/quando";

const openingHours = schedule().open(weekdays(), "09:00-17:00");

const dispatch = advanceBy(placed, Temporal.Duration.from({ hours: 3 }), {
  during: openingHours,
});
```

## Bound a search

`nextCoveredInterval`, `firstGap`, and `advanceBy` may need to search for a
future answer. When no end is supplied, they apply a 100-year safety limit.

If the automatic limit expires, the query throws `SearchLimitExceededError`.
Pass `within` when finding no answer in a known range is expected:

```ts
const opening = nextCoveredInterval(office, fridayEvening, {
  within: Temporal.Duration.from({ hours: 2 }),
});
```

This search returns `undefined` after two hours. It does not throw because the
caller supplied the limit.

An existing `context.to` also provides an explicit limit. When both are
present, `within` can shorten the context window and cannot extend it.

The low-level `intervals` and `resolve` functions do not add a safety limit.
They return lazy streams. `slots` does too. The caller decides how much of a
stream to consume.

## Query a cascade value

`assigned(cascade, value)` selects the periods that carry one value. The result
works with all four common queries.

```ts
import { coveredDuration, rota, weekdays } from "@kensio/quando";
import { assigned } from "@kensio/quando/core";

const onCall = rota().assign(weekdays(), "alice");
const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

const aliceHours = coveredDuration(assigned(onCall, "alice"), week);
```

Values are matched with `Object.is`. An assigned selection is a query input and
has no stored rule form.

Use `valueAt` and `nextValue` from `@kensio/quando/core` when you want the
assigned value itself.

<!-- card
```ts
const dispatch = openingHours.addOpenTime(
  placed,
  Temporal.Duration.from({ hours: 3 }),
);
```
-->
