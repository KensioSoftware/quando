---
description: "Find available time and calculate working-time deadlines with Quando queries."
---

# Queries

Use these queries to check availability, find booking slots, measure covered
time, and calculate working-time deadlines. They accept rules, schedules, and
selected cascade values.

| Function              | Question                                           |
| --------------------- | -------------------------------------------------- |
| `isActiveAt`          | Is this instant covered?                           |
| `nextCoveredInterval` | What is the current or next covered interval?      |
| `firstAvailableSlot`  | Where does a duration fit in covered time?         |
| `availableSlots`      | Which fixed-length candidates fit in covered time? |
| `coveredDuration`     | How much covered time is inside this window?       |
| `coveredDayCount`     | How many days inside this window are covered?      |
| `addCoveredTime`      | Where does an amount of covered time finish?       |
| `addCoveredDays`      | Where does a count of covered days finish?         |
| `coverageChanges`     | What covered time was added or removed?            |

Schedules can be passed directly to all nine functions. They also expose
`isOpen`, `nextOpenInterval`, `firstOpenSlot`, `openSlots`, `openDuration`,
`openDayCount`, `addOpenTime`, and `addOpenDays` with opening-hours names. Use
`changesTo` to compare two schedules.

## Query inputs

The standalone functions accept any of these inputs:

- A rule
- A schedule or another boolean cascade
- One value selected from a cascade with `assigned`

Represent each instant with `Temporal.ZonedDateTime`. A `QueryWindow` has
required `from` and `to` values. Low-level interval streams accept a `Context`,
whose `to` is optional.

Evaluation options include `occurrences`, `rules`, and `disambiguation`.
Duration inputs accept `Temporal.Duration`, ISO duration strings, or objects
such as `{ minutes: 30 }`.

## Check an instant

`isActiveAt` returns whether its input covers one instant.

```ts
import { isActiveAt, timeOfDayRange, weekdays } from "@kensio/quando";

const office = weekdays().and(timeOfDayRange("09:00", "17:00"));
const monday = Temporal.ZonedDateTime.from("2026-03-09T10:00[Europe/London]");

console.log(isActiveAt(office, monday));
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

If `context.from` is already covered, the returned interval starts at
`context.from`. It excludes any earlier part of the opening.

A finite search can clip the interval's end to the search window. Pass
`{ intervalEnd: "complete", endWithin: { days: 7 } }` to search for the
opening's actual end.

`endWithin` limits this additional search from the returned interval's start.
It defaults to 100 years. If the end cannot be found within that limit, the
query throws `SearchLimitExceededError`, even when `endWithin` was supplied
explicitly.

## Find an available gap

`firstAvailableSlot` returns the earliest interval of the requested length that fits
wholly inside covered time. Intersect rules first to find time shared by
several people.

```ts
import { firstAvailableSlot, timeOfDayRange, weekdays } from "@kensio/quando";

const alice = weekdays().and(timeOfDayRange("09:00", "17:00"));
const bob = weekdays().and(timeOfDayRange("10:00", "16:00"));
const shared = alice.and(bob);

const gap = firstAvailableSlot(shared, Temporal.Duration.from({ hours: 2 }), {
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

A found slot has required `start` and `end` fields. Only the slot itself can
be `undefined`.

The slot starts at the beginning of the first covered interval long enough to
hold it. The slot may end exactly at the covered interval's end.

Use `openingHours.firstOpenSlot(from, lasting, search?)` when querying a
schedule.

## Produce booking slots

`availableSlots` lazily emits candidate intervals. `lasting` sets each candidate's
length and `every` sets the time between candidate starts.

```ts
import { availableSlots } from "@kensio/quando";

const candidates = availableSlots(
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

Use `openingHours.openSlots(from, to, options)` when querying a schedule.

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

`addCoveredTime` moves forward while counting only the time covered by its
`during` input.

```ts
import { addCoveredTime } from "@kensio/quando";

const placed = Temporal.ZonedDateTime.from("2026-03-13T16:55[Europe/London]");

const dispatch = addCoveredTime(placed, Temporal.Duration.from({ hours: 3 }), {
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

const dispatch = addCoveredTime(placed, Temporal.Duration.from({ hours: 3 }), {
  during: openingHours,
});
```

## Count whole covered days

`coveredDayCount` counts the local calendar dates inside a window that carry
any covered time.

```ts
import { coveredDayCount, weekdays } from "@kensio/quando";

const openDays = coveredDayCount(weekdays(), {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
});

console.log(openDays);
```

```text
5
```

A date counts if it contains any covered time. A day open from 09:00 to 13:00
and a day open from 09:00 to 17:00 each count as one open day.

Dates are local to the zone of `context.from`. The window is half open. A date
whose covered time begins exactly at `to` falls outside it.

Day counts and elapsed durations measure different things. A week of
four-hour days contains five open days and 20 open hours. Use
`coveredDuration` when you need the elapsed total.

## Add whole covered days

`addCoveredDays` advances by a whole number of covered calendar dates.

```ts
import { addCoveredDays, schedule, weekdays } from "@kensio/quando";

const courier = schedule({ zone: "Europe/London" }).open(
  weekdays(),
  "09:00-17:00",
);
const ordered = Temporal.ZonedDateTime.from("2026-03-13T16:55[Europe/London]");

const delivery = addCoveredDays(ordered, 3, { during: courier });

console.log(delivery?.toString());
```

```text
2026-03-18T09:00:00+00:00[Europe/London]
```

The result is the first covered instant on the target date, at or after
`from`. For a future opening-hours date, this is the first opening that day.
Call `.toPlainDate()` if you only need the date.

The count is a whole number of days and cannot be negative. A zero count
returns the starting instant. Part of a day is an elapsed duration, and
`addCoveredTime` is the query that takes one.

Use day arithmetic to advance by dates. Counting results from
`nextCoveredInterval` counts intervals, which can span several days. For
example, a rule covering whole weekdays produces one continuous interval
from Monday through Friday.

### Which day the count starts on

By default, counting starts after the date of `from`. Three working days
from Friday afternoon therefore ends on Wednesday.

Pass `startingDay: "included"` to count the starting date first, when covered
time remains on it:

```ts
const sameDay = addCoveredDays(ordered, 1, {
  during: courier,
  startingDay: "included",
});
```

With `startingDay: "included"`, the starting date counts only if covered
time remains at or after `from`. At 18:00 on Friday, counting starts on Monday
because the office has closed. During Friday's opening hours, a count of one
returns `from` itself.

To leave three whole covered days between a starting date and an event, count
three days with the default starting-day setting, then place the event after
the third day. If you are implementing a notice-period policy, apply its
remaining date-selection rules in your application.

## Compare covered time

`coverageChanges` compares two definitions inside a context. `added` contains
time covered only by the new definition. `removed` contains time covered only
by the old definition.

```ts
import { coverageChanges, timeOfDayRange, weekdays } from "@kensio/quando";

const oldHours = weekdays().and(timeOfDayRange("09:00", "17:00"));
const newHours = weekdays().and(timeOfDayRange("10:00", "18:00"));

const changed = coverageChanges(oldHours, newHours, {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-10T00:00[Europe/London]"),
});
```

Both results are lazy interval streams. They compare evaluated coverage, so
definitions with different document structures can still produce no changes.

For schedules, use opening-hours names:

```ts
import { schedule, weekdays } from "@kensio/quando";

const oldSchedule = schedule().open(weekdays(), "09:00-17:00");
const newSchedule = schedule().open(weekdays(), "10:00-18:00");
const from = Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]");
const to = Temporal.ZonedDateTime.from("2026-03-10T00:00[Europe/London]");

const { opened, closed } = oldSchedule.changesTo(newSchedule, from, to);
```

`opened` contains newly open time. `closed` contains time that was open only
in the old schedule.

## Bound a search

`nextCoveredInterval`, `firstAvailableSlot`, `addCoveredTime`, and `addCoveredDays` may
need to search for a future answer. When no end is supplied, they apply a 100-year safety limit.

If the automatic limit expires, the query throws `SearchLimitExceededError`.
Pass `within` when finding no answer in a known range is expected:

```ts
const opening = nextCoveredInterval(office, fridayEvening, {
  within: Temporal.Duration.from({ hours: 2 }),
});
```

This search returns `undefined` if it finds no opening within the two-hour
search window.

An existing `context.to` also provides an explicit limit. When both are
present, `within` can shorten the context window and cannot extend it.

The low-level `intervals` and `resolve` functions do not add a safety limit.
They return lazy streams. `availableSlots` is also lazy but requires a finite
window. These iterators are consumed once. Call the query again to restart.

## Query a cascade value

`assigned(cascade, value)` selects the periods that carry one value. The result
works with all nine common queries.

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

Values are matched with `Object.is`. For object values restored from JSON, use
`whereValueMatches(onCall, duty => duty.person === "alice")` to select by a stable
field. Both selectors preserve an attached custom-rule registry. They are query
inputs and have no stored rule form.

Use `valueAt` and `nextValueInterval` from `@kensio/quando/core` when you want the
assigned value itself.

<!-- card
```ts
const dispatch = openingHours.addOpenTime(
  placed,
  Temporal.Duration.from({ hours: 3 }),
);
```
-->
