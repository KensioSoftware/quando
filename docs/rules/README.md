# Rules

A rule says _when_, and nothing else. There are five that select time —
`always`, `never`, `daysOfWeek`, `timeOfDay`, `dates` — and three that combine
rules into bigger ones: `all`, `any`, `not`. That is the whole language. Every
schedule you can express is those eight pieces arranged.

Rules are boolean: a moment is either covered or it is not. Nothing here carries
a value, which is what keeps `not` meaningful — see
[concepts](../concepts/#rules-combine).

## Reading a rule

`intervals(rule, context)` is how you see what a rule covers. The context says
where to start looking and, optionally, where to stop:

```ts
import { always, intervals, never } from "@kensio/quando";

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

Every example below prints intervals the same way. `start` and `end` are
`Temporal.ZonedDateTime | undefined`, and `undefined` means unbounded: an absent
`start` is the unbounded past, an absent `end` the unbounded future.

Intervals are half open — `[start, end)` — so a stretch ending at 17:00 and one
beginning at 17:00 do not overlap and no instant falls in a crack.

## `always` and `never`

As above: `always()` covers all of time, so within a window it is the window,
and `never()` covers none, so it is an empty stream.

They exist because they are the identities — `always` for intersection, `never`
for union — which is what lets a rule assembled from a list behave when the list
turns out to be empty. They are also how "closed" and "open all hours" are said,
which is less exotic than it sounds: a holiday calendar with nothing in it and a
service that never stops are both ordinary.

## `daysOfWeek`

Whole days, by their day of the week. `weekdays()` and `weekends()` are the two
you were going to write anyway:

```ts
import { intervals, weekdays } from "@kensio/quando";

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

**Two weeks of weekdays is two intervals, not ten.** Consecutive selected days
coalesce into one stretch running from Monday midnight to Saturday midnight,
because that is what the days _are_: five intervals touching at midnight and one
interval covering the same time are the same set of moments, and only one of
those two is a well-formed stream. Counting intervals is therefore not a way to
count days.

`daysOfWeek(...)` takes any of `"monday"` through `"sunday"`. With no days at
all it covers nothing, and says so immediately rather than walking the calendar
looking for a day that can never match.

## `timeOfDay`

A wall-clock window inside each day. Wall clock is the point: across a clock
change the times you wrote stay put and the real length of the window changes,
which is what a schedule means by "nine to five". See
[time zones](../time-zones/) for what that costs in elapsed hours.

A `to` earlier than `from` **wraps past midnight**, so a night shift is one rule
rather than two:

```ts
import { intervals, timeOfDay } from "@kensio/quando";

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

Note the first and last lines: the shift that began the evening before the
window opened is still running when it does, and the one that starts inside the
window is cut off by its end. A rule is always shown clipped to the context it
was asked about.

A window whose ends are equal is refused, at evaluation:

```ts
import { intervals, take, timeOfDay } from "@kensio/quando";

const wholeDay = timeOfDay("09:00", "09:00");
console.log(JSON.stringify(wholeDay));

try {
  take(
    intervals(wholeDay, {
      from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
    }),
    1,
  );
} catch (error) {
  console.log(String(error));
}
```

```text
{"type":"timeOfDay","from":"09:00","to":"09:00"}
RangeError: A time-of-day window from 09:00 to 09:00 has the same start and end. Use { type: "always" } for a whole day.
```

Twenty-four hours is one reading of `09:00`–`09:00` and nothing at all is
another, and a rule that has to be guessed at is worse than one that complains.
`always()` already says the first unambiguously.

That it throws when read rather than when written is deliberate: constructing a
rule checks its shape, and evaluating one checks what it means. Keeping the two
apart is what stops them disagreeing.

## `dates`

Whole days, named:

```ts
import { dates, intervals } from "@kensio/quando";

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

Sorted and coalesced, as everywhere else: three dates written in the order they
came to mind are one three-day stretch, ending at midnight on the 17th because
the 16th is included whole.

This is where holidays go. Quando ships no calendar data — that belongs in
satellite packages, so the core carries none — so a bank holiday list is a
`dates` rule you got from somewhere else.

## Combining

|       |                                             |
| ----- | ------------------------------------------- |
| `all` | intersection — every rule must hold         |
| `any` | union — at least one must hold              |
| `not` | complement — the times a rule does not hold |

`not` is the one worth seeing, because its answer runs off both ends of the
context:

```ts
import { intervals, not, timeOfDay } from "@kensio/quando";

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

Unbounded in principle, clipped to the window in practice — which is what makes
a composition over recurring rules finish at all.

With no arguments each combinator gives its identity: `all()` is all of time,
`any()` is none. That is not a curiosity, it is what makes building a rule from
a list you might have filtered to nothing behave.

```ts
import { all, any, intervals } from "@kensio/quando";

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

Every rule function returns the rule with three methods on it, so the common
compositions read left to right rather than inside out.

|              |                          |
| ------------ | ------------------------ |
| `.and(…)`    | `all(this, …)`           |
| `.or(…)`     | `any(this, …)`           |
| `.except(…)` | `all(this, not(any(…)))` |

`.except` earns its place because opening-hours-minus-exceptions is the
commonest shape there is, and spelled out it reads like nothing at all:

```ts
import { dates, intervals, timeOfDay, weekdays } from "@kensio/quando";

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

`.or` reaches for the union in the same way. On-call cover of every weekend and
every evening:

```ts
import { intervals, timeOfDay, weekends } from "@kensio/quando";

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

The Saturday and Sunday arrive as one interval, and the Friday evening as its
own — because 23:00 Friday to midnight Saturday is not covered, so there is
nothing to join them.

A built rule is an ordinary rule object. There is no `.build()` and nothing to
unwrap, and `JSON.stringify` gives the document a hand-written rule would give.
That is [serialisation](../serialisation/).

## Rules that recur forever

A context needs no end, and a recurring rule then produces an endless stream.
This is supported, and it is why the stream is lazy: `take` pulls exactly as far
as it needs.

```ts
import { intervals, take, timeOfDay } from "@kensio/quando";

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

The case to know about is the opposite one: a rule whose answer is _empty_ over
an unbounded context has nothing to discover that from, and will keep looking.
`weekdays().and(weekends())` never holds, and asking an endless context when it
next does will not come back. Give the context a `to` whenever the answer might
be nothing.

## Zones

`daysOfWeek`, `dates` and `timeOfDay` each take an optional zone, which is what
lets one rule set describe a London office and a Tokyo one. Without it, a rule
is read in the zone of the context it is evaluated against. That is
[time zones](../time-zones/), which is a page of its own because the
consequences are not obvious.

<!-- card
```ts
const openingHours = weekdays()
  .and(timeOfDay("09:00", "17:00"))
  .except(dates("2026-12-25"));
```
-->
