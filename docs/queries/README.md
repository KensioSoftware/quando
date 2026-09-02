# Queries

Quando provides four common queries over the intervals covered by a rule.

|             |                                             |
| ----------- | ------------------------------------------- |
| `advanceBy` | where an amount of rule-time gets you       |
| `activeAt`  | whether a rule covers an instant            |
| `elapsed`   | how much time a rule covers within a window |
| `next`      | the next stretch a rule covers              |

Durations use exact elapsed time. A three-hour duration always means three
elapsed hours, including across a clock change. See
[time zones](../time-zones/).

## `advanceBy`

`advanceBy` adds time that counts only while a rule applies. This example adds
three hours of warehouse opening time to an order placed at 16:55 on Friday:

```ts
import { advanceBy, dates, timeOfDay, weekdays } from "@kensio/quando";

const openingHours = weekdays()
  .and(timeOfDay("09:00", "17:00"))
  .except(dates("2026-03-16"));

const placed = Temporal.ZonedDateTime.from("2026-03-13T16:55[Europe/London]");

const dispatch = advanceBy(placed, Temporal.Duration.from({ hours: 3 }), {
  during: openingHours,
});

console.log(dispatch?.toString());
```

```text
2026-03-17T11:55:00+00:00[Europe/London]
```

The calculation uses five minutes on Friday. Monday is excluded by the holiday
rule. The remaining time falls on Tuesday morning.

Pass the rule in the `during` property. The options can also contain `within`,
`location`, and `locale`. The first argument supplies the context start.

### Elapsed durations only

```ts
import { advanceBy, timeOfDay, weekdays } from "@kensio/quando";

const openingHours = weekdays().and(timeOfDay("09:00", "17:00"));
const placed = Temporal.ZonedDateTime.from("2026-03-13T16:55[Europe/London]");

try {
  advanceBy(placed, Temporal.Duration.from({ days: 1 }), {
    during: openingHours,
  });
} catch (error) {
  console.log(String(error));
}

try {
  advanceBy(placed, Temporal.Duration.from({ hours: -1 }), {
    during: openingHours,
  });
} catch (error) {
  console.log(String(error));
}
```

```text
RangeError: advanceBy() measures elapsed time, so P1D is ambiguous: days are calendar units, and a day is not 24 hours on the mornings a clock changes. Give hours, minutes or seconds.
RangeError: advanceBy() cannot go backwards. Asked for -PT1H.
```

`advanceBy` rejects years, months, weeks, and days. These are calendar units, and
their elapsed length depends on the starting date and time zone. Use hours,
minutes, seconds, milliseconds, microseconds, or nanoseconds. Use `PT24H` when
you mean 24 elapsed hours.

### `within` bounds the search

Set `within` to limit how far `advanceBy` searches. It returns `undefined` when
the search ends before the requested rule time has elapsed:

```ts
import { advanceBy, timeOfDay, weekdays } from "@kensio/quando";

const openingHours = weekdays().and(timeOfDay("09:00", "17:00"));
const placed = Temporal.ZonedDateTime.from("2026-03-13T16:55[Europe/London]");

console.log(
  advanceBy(placed, Temporal.Duration.from({ hours: 3 }), {
    during: openingHours,
    within: Temporal.Duration.from({ hours: 12 }),
  }),
);
console.log(
  advanceBy(placed, Temporal.Duration.from({ hours: 3 }), {
    during: openingHours,
    within: Temporal.Duration.from({ days: 7 }),
  })?.toString(),
);
```

```text
undefined
2026-03-16T11:55:00+00:00[Europe/London]
```

The first search contains only five minutes of opening time. The second search
contains enough opening time. `within` can use calendar units because it defines
a search horizon from a known starting point.

## `activeAt`

`activeAt` reports whether a rule covers an instant. The result follows
half-open interval boundaries:

```ts
import { activeAt, timeOfDay, weekdays } from "@kensio/quando";

const openingHours = weekdays().and(timeOfDay("09:00", "17:00"));
const closing = Temporal.ZonedDateTime.from("2026-03-13T17:00[Europe/London]");

console.log(activeAt(openingHours, closing));
console.log(activeAt(openingHours, closing.subtract({ nanoseconds: 1 })));
```

```text
false
true
```

An interval ending at 17:00 excludes 17:00. An interval starting at 17:00
includes it.

The optional third argument accepts a `locale` and `location`. `activeAt`
creates its own one-nanosecond window around the given instant, so it always
terminates.

## `elapsed`

`elapsed` returns the total duration covered by a rule within a context:

```ts
import { elapsed, timeOfDay, weekdays } from "@kensio/quando";

const openingHours = weekdays().and(timeOfDay("09:00", "17:00"));
const from = Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]");

console.log(
  elapsed(openingHours, {
    from,
    to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
  }).toString(),
);

try {
  elapsed(openingHours, { from });
} catch (error) {
  console.log(String(error));
}
```

```text
PT40H
RangeError: elapsed() needs a window with an end: give the context a `to`.
```

The context must have a `to`. An unbounded window has no finite total duration,
so `elapsed` rejects it.

## `next`

`next` returns the next covered interval at or after the context start:

```ts
import { next, timeOfDay, weekdays } from "@kensio/quando";

const openingHours = weekdays().and(timeOfDay("09:00", "17:00"));

const open = next(openingHours, {
  from: Temporal.ZonedDateTime.from("2026-03-13T11:00[Europe/London]"),
});
console.log(
  `${open?.start?.toPlainDateTime()} → ${open?.end?.toPlainDateTime()}`,
);

const fridayEvening = {
  from: Temporal.ZonedDateTime.from("2026-03-13T18:00[Europe/London]"),
};

console.log(
  next(openingHours, fridayEvening, {
    within: Temporal.Duration.from({ hours: 24 }),
  }),
);
console.log(
  next(openingHours, fridayEvening)?.start?.toPlainDateTime().toString(),
);
```

```text
2026-03-13T11:00:00 → 2026-03-13T17:00:00
undefined
2026-03-16T09:00:00
```

When the rule is already active, `next` returns the current interval clipped to
the context start. The 24-hour search from Friday evening finds no opening. The
unbounded search finds Monday morning.

The unbounded search stops after it finds the first interval.

### `within` only narrows a context

A context that already ends before the horizon keeps its own end:

```ts
import { next, timeOfDay, weekdays } from "@kensio/quando";

const openingHours = weekdays().and(timeOfDay("09:00", "17:00"));

const untilSaturday = {
  from: Temporal.ZonedDateTime.from("2026-03-13T18:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-14T00:00[Europe/London]"),
};

console.log(
  next(openingHours, untilSaturday, {
    within: Temporal.Duration.from({ days: 30 }),
  }),
);
```

```text
undefined
```

The context ends on Saturday morning. A 30-day `within` value does not extend
that end. It only shortens a context that would otherwise run longer.

## Termination

Recurring rules can produce endless streams. Each query needs a result or a
bound that stops evaluation.

|                     |                                                             |
| ------------------- | ----------------------------------------------------------- |
| `activeAt`          | always terminates because its window is one nanosecond wide |
| `elapsed`           | refuses a window with no end                                |
| `next`, `advanceBy` | terminate as soon as there is an answer                     |

Bound a search when its rule may produce no interval. For example,
`weekdays().and(weekends())` can search forever in an unbounded context. Set the
context `to` or the search `within` in this case.

<!-- card
```ts
const packed = advanceBy(placed, Temporal.Duration.from({
  hours: 3,
}), { during: openingHours });
// → 2026-03-17T11:55:00+00:00[Europe/London]
```
-->
