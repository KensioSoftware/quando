# Queries

`intervals` gives you the times a rule covers. These four functions are what you
usually want instead: where you get to after three working hours, whether
something is open now, how much time a window holds, and when the next stretch
begins.

|             |                                             |
| ----------- | ------------------------------------------- |
| `advanceBy` | where an amount of rule-time gets you       |
| `activeAt`  | whether a rule covers an instant            |
| `elapsed`   | how much time a rule covers within a window |
| `next`      | the next stretch a rule covers              |

Durations are exact elapsed time throughout. Three operating hours means three
real hours of opening, so a stretch spanning a clock change is measured by how
long it lasted rather than by what the clock said — see
[time zones](../time-zones/).

## `advanceBy`

The question both of the libraries Quando evolves from were built around, and
the one that is genuinely hard to do by hand: _an order is placed at five to
five on a Friday, packing takes three operating hours, when is it packed?_

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

Five minutes on the Friday, the Monday closed for a holiday, the rest on the
Tuesday morning. Nothing was sampled and nothing was stepped over in increments:
the answer is a walk along the intervals until the budget runs out.

The third argument carries the rule as `during`, and may also carry `within` and
anything else a [`Context`](../api/#context) takes apart from its window, which
`from` and `advanceBy`'s own search supply.

### It refuses calendar amounts

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

`P1D` is refused rather than accepted-and-approximated because the two halves of
the function would disagree about it. The accounting compares durations without
a reference point, where a day is 24 hours; the final step adds to a
`ZonedDateTime`, where it is a calendar day. On the mornings a clock changes
`P1D` and `PT24H` land an hour apart, and neither answer is wrong enough to
notice. If you mean 24 hours of opening, say `PT24H`.

### `within` bounds the search

`advanceBy` returns `undefined` when the search runs out before the time does:

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

Twelve hours from Friday teatime contains five minutes of opening, so there is
no answer to give. A week contains plenty. Note that `within` takes calendar
units happily — it is a horizon, not an amount of rule-time, so a day being 23
or 25 hours long changes nothing about what it means.

## `activeAt`

Whether a rule covers an instant. Intervals are half open, which shows up
exactly at the boundary:

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

Closing time is when it is shut. That is the only convention under which a day
ending at 17:00 and one beginning at 17:00 do not both contain the instant
between them.

`activeAt` takes an optional third argument for the rest of a context — a
`locale`, or a `location` for rules about the sun — but not a window: it
supplies its own, one nanosecond wide. That is also why this is the one query
that always terminates, whatever rule and whatever context it is given. There is
nowhere for it to walk.

## `elapsed`

How much time a rule covers within a window:

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

The refusal is the interesting half. Everywhere else an endless context is
supported and often useful; here the alternative to refusing is a number that
never finishes being counted, so the error arrives at once instead.

## `next`

The next stretch of time a rule covers, at or after the context's start:

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

Three things there. Asked at eleven on a Friday, `next` answers _now_ — the
stretch already running, clipped to begin where you asked, because "when does it
next open" should say "it is open" rather than skipping to tomorrow. Asked on
Friday evening with a day to look, there is nothing. Asked with no horizon at
all, Monday.

That last call has an unbounded context and still returns immediately: a lazy
stream is pulled exactly as far as the first answer.

### `within` narrows, and only narrows

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

Thirty days of horizon does not reach past Saturday morning, because a caller
who gave a window meant it. `within` is there to stop a search that would
otherwise run forever, never to extend one.

## Termination

Worth understanding once, because it is the one way these functions can
misbehave. Rules recur, so a stream can be endless; an endless stream is fine as
long as _something_ stops the pull.

|                     |                                                       |
| ------------------- | ----------------------------------------------------- |
| `activeAt`          | always terminates — its window is one nanosecond wide |
| `elapsed`           | refuses a window with no end                          |
| `next`, `advanceBy` | terminate as soon as there is an answer               |

The case with no answer is the one to bound. A satisfiable rule yields its first
interval quickly however far it recurs, but a rule that covers _nothing_ —
`weekdays().and(weekends())` — has no interval to yield and no way to discover
that it never will, so an unbounded search for it does not come back. Give the
context a `to`, or the search a `within`, whenever the answer might be nothing.

<!-- card
```ts
const packed = advanceBy(placed, Temporal.Duration.from({
  hours: 3,
}), { during: openingHours });
// → 2026-03-17T11:55:00+00:00[Europe/London]
```
-->
