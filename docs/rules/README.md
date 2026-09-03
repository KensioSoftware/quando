# Rules

A rule describes a set of times. Five rule types select time. They are
`always`, `never`, `daysOfWeek`, `timeOfDay`, and `dates`. The `all`, `any`, and
`not` rule types combine other rules. `inZone` evaluates a rule subtree in a
named time zone.

Rules are boolean. A moment is either covered or uncovered. Use a
[cascade](../cascades/) when you need to assign values.

## Reading a rule

Call `intervals(rule, context)` to read a rule. The context sets the start and
optional end of the evaluation window:

```ts
import { always, intervals, never } from "@kensio/quando/core";

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

for (const { start, end } of intervals(always(), week)) {
  console.log(`${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}`);
}
console.log([...intervals(never(), week)].length);
```

```text
2026-03-09T00:00:00 → 2026-03-16T00:00:00
0
```

The `start` and `end` fields have the type
`Temporal.ZonedDateTime | undefined`. An undefined `start` means the interval
extends into the unbounded past. An undefined `end` means it extends into the
unbounded future.

Intervals are half-open and use the form `[start, end)`. They include the start
and exclude the end.

## `always` and `never`

`always()` covers all time. Within a bounded context, it returns the context
window. `never()` returns an empty stream.

These are the identity rules for intersections and unions. `all()` with no
arguments produces `always()`. `any()` with no arguments produces `never()`.

## `daysOfWeek`

`daysOfWeek` covers whole days selected by weekday. `weekdays()` selects Monday
through Friday. `weekends()` selects Saturday and Sunday.

```ts
import { intervals, weekdays } from "@kensio/quando/core";

const fortnight = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-23T00:00[Europe/London]"),
};

for (const { start, end } of intervals(weekdays(), fortnight)) {
  console.log(`${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}`);
}
```

```text
2026-03-09T00:00:00 → 2026-03-14T00:00:00
2026-03-16T00:00:00 → 2026-03-21T00:00:00
```

Consecutive selected days are coalesced. In this example, each working week is
one interval from Monday midnight to Saturday midnight. Do not use the number
of intervals to count days.

`daysOfWeek(...)` accepts weekday names from `"monday"` through `"sunday"`. With
no arguments, it returns a rule that covers no time.

## `timeOfDay`

`timeOfDay` covers a wall-clock window on each day. The written start and end
stay fixed across daylight-saving changes. The elapsed duration can change.
See [time zones](../time-zones/).

When `to` is earlier than `from`, the interval continues past midnight. A night
shift can therefore use one rule:

```ts
import { intervals, timeOfDay } from "@kensio/quando/core";

const twoDays = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-11T00:00[Europe/London]"),
};

for (const { start, end } of intervals(timeOfDay("22:00", "06:00"), twoDays)) {
  console.log(`${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}`);
}
```

```text
2026-03-09T00:00:00 → 2026-03-09T06:00:00
2026-03-09T22:00:00 → 2026-03-10T06:00:00
2026-03-10T22:00:00 → 2026-03-11T00:00:00
```

The first interval began before the context. The last interval ends after the
context. `intervals` clips both to the context window.

A window with equal start and end times is invalid. The builder rejects it
immediately:

```ts
try {
  timeOfDay("09:00", "09:00");
} catch (error) {
  console.log(String(error));
}
```

```text
RangeError: A time-of-day window must have different endpoints.
```

The range `09:00` to `09:00` could mean a full day or an empty interval. Quando
rejects the range. Use `always()` to cover a full day.

Builders and parsers validate time syntax and equal endpoints.

## `dates`

`dates` covers whole calendar dates:

```ts
import { dates, intervals } from "@kensio/quando/core";

const march = {
  from: Temporal.ZonedDateTime.from("2026-03-01T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-04-01T00:00[Europe/London]"),
};

const shutdown = dates("2026-03-16", "2026-03-14", "2026-03-15");

for (const { start, end } of intervals(shutdown, march)) {
  console.log(`${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}`);
}
```

```text
2026-03-14T00:00:00 → 2026-03-17T00:00:00
```

Quando sorts the dates and coalesces consecutive dates. The three dates above
produce one interval ending at midnight on 17 March.

Use `dates` for holidays and other named dates. Quando does not provide calendar
data. Supply the dates from your application or another package.

## Combining

|       |                                             |
| ----- | ------------------------------------------- |
| `all` | intersection. Every rule must apply.        |
| `any` | union. At least one rule must apply.        |
| `not` | complement. The source rule must not apply. |

`not` returns the gaps in its source rule:

```ts
import { intervals, not, timeOfDay } from "@kensio/quando/core";

const day = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-10T00:00[Europe/London]"),
};

for (const { start, end } of intervals(not(timeOfDay("09:00", "17:00")), day)) {
  console.log(`${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}`);
}
```

```text
2026-03-09T00:00:00 → 2026-03-09T09:00:00
2026-03-09T17:00:00 → 2026-03-10T00:00:00
```

The complement extends beyond both ends of this example. The context clips the
result to one day.

With no arguments, `all()` covers all time and `any()` covers no time. This is
useful when you build a combined rule from an array that may be empty.

```ts
import { all, any, intervals } from "@kensio/quando/core";

const day = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-10T00:00[Europe/London]"),
};

console.log([...intervals(all(), day)].length);
console.log([...intervals(any(), day)].length);
```

```text
1
0
```

## The builder

Every builder returns a rule with non-enumerable `.and`, `.or`, and `.except`
methods. `parseRule` restores the same methods after storage.

|              |                          |
| ------------ | ------------------------ |
| `.and(…)`    | `all(this, …)`           |
| `.or(…)`     | `any(this, …)`           |
| `.except(…)` | `all(this, not(any(…)))` |

Use `.except` to remove exceptions such as holidays from another rule:

```ts
import { dates, intervals, timeOfDay, weekdays } from "@kensio/quando/core";

const openingHours = weekdays()
  .and(timeOfDay("09:00", "17:00"))
  .except(dates("2026-03-11"));

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

for (const { start, end } of intervals(openingHours, week)) {
  console.log(`${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}`);
}
```

```text
2026-03-09T09:00:00 → 2026-03-09T17:00:00
2026-03-10T09:00:00 → 2026-03-10T17:00:00
2026-03-12T09:00:00 → 2026-03-12T17:00:00
2026-03-13T09:00:00 → 2026-03-13T17:00:00
```

Wednesday the 11th is gone entirely.

Use `.or` to form a union. This example covers weekends and each evening:

```ts
import { intervals, timeOfDay, weekends } from "@kensio/quando/core";

const cover = weekends().or(timeOfDay("18:00", "23:00"));

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-12T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

for (const { start, end } of intervals(cover, week)) {
  console.log(`${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}`);
}
```

```text
2026-03-12T18:00:00 → 2026-03-12T23:00:00
2026-03-13T18:00:00 → 2026-03-13T23:00:00
2026-03-14T00:00:00 → 2026-03-16T00:00:00
```

Saturday and Sunday form one continuous interval. Friday evening remains
separate because the rule does not cover 23:00 to midnight.

A built rule is ready to evaluate and serialise. It needs no `.build()` call.
See [serialisation](../serialisation/).

## Rules that recur forever

A context can omit its end. A recurring rule then produces a lazy, endless
stream. `take` reads only the requested number of intervals.

```ts
import { intervals, take, timeOfDay } from "@kensio/quando/core";

const forever = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
};

const openings = take(intervals(timeOfDay("09:00", "17:00"), forever), 3);

for (const { start } of openings) {
  console.log(start?.toPlainDateTime().toString());
}
```

```text
2026-03-09T09:00:00
2026-03-10T09:00:00
2026-03-11T09:00:00
```

An impossible recurring rule can search forever in an unbounded context. For
example, `weekdays().and(weekends())` never produces an interval. Set `to` when
the rule may produce no result.

## Zones

`inZone(zone, rule)` applies a time zone to a rule subtree. A rule with no zone
uses the zone from the evaluation context. See
[time zones](../time-zones/) for details.

<!-- card
```ts
const openingHours = weekdays()
  .and(timeOfDay("09:00", "17:00"))
  .except(dates("2026-12-25"));
```
-->
