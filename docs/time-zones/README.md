# Time zones

"Nine to five" is a claim about a clock, and which clock is part of the rule.
Quando therefore never works in bare local time: every moment that goes in or
comes out is a `Temporal.ZonedDateTime`, and every rule is read in some named
zone. This page is about which one, and about the two mornings a year when wall
clock and elapsed time stop agreeing.

## The zone comes from the context

A context's `from` is a `ZonedDateTime`, so it already carries a zone. That is
the zone a rule is read in when it does not name one of its own — and there is
no separate `zone` field on the context that could disagree with it.

The same rule, evaluated from two places:

```ts
import { intervals, timeOfDay, weekdays } from "@kensio/quando";

const officeHours = weekdays().and(timeOfDay("09:00", "17:00"));

const inLondon = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-10T00:00[Europe/London]"),
};
const inTokyo = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Asia/Tokyo]"),
  to: Temporal.ZonedDateTime.from("2026-03-10T00:00[Asia/Tokyo]"),
};

for (const { start } of intervals(officeHours, inLondon)) {
  console.log(start?.toString());
}
for (const { start } of intervals(officeHours, inTokyo)) {
  console.log(start?.toString());
}
```

```
2026-03-09T09:00:00+00:00[Europe/London]
2026-03-09T09:00:00+09:00[Asia/Tokyo]
```

Two different instants, nine hours apart, and both correct. A rule with no zone
means "nine in the morning, wherever this is being asked about" — which is what
you want for a rule that describes a local working day, and not at all what you
want for a rule that describes one particular office.

## A rule may name its own zone

`daysOfWeek`, `dates` and `timeOfDay` each take an optional zone, which is what
lets one rule set describe a London office and a Tokyo one at the same time.
`inZone` adds it to a rule that already exists:

```ts
import { inZone, intervals, timeOfDay, weekdays } from "@kensio/quando";

const londonOffice = inZone(weekdays(), "Europe/London").and(
  timeOfDay("09:00", "17:00", "Europe/London"),
);

const fromTokyo = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Asia/Tokyo]"),
  to: Temporal.ZonedDateTime.from("2026-03-11T00:00[Asia/Tokyo]"),
};

for (const { start, end } of intervals(londonOffice, fromTokyo)) {
  console.log(`${start?.toString()} → ${end?.toString()}`);
}
```

```
2026-03-09T18:00:00+09:00[Asia/Tokyo] → 2026-03-10T02:00:00+09:00[Asia/Tokyo]
2026-03-10T18:00:00+09:00[Asia/Tokyo] → 2026-03-11T00:00:00+09:00[Asia/Tokyo]
```

The zone has to go on both halves. `inZone(weekdays(), …)` says which days are
Monday to Friday, and the zone on `timeOfDay` says whose nine o'clock — they are
separate questions, and a rule that answered them in different zones would be a
strange rule rather than an invalid one.

Note the second line stopping at midnight: the Tokyo window ran out mid-way
through London's Tuesday afternoon. Results are always clipped to the context.

## Answers come back in the context's zone

Both intervals above are reported in Tokyo time, although the rule was written
about London. That is a deliberate normalisation, and the reason is worth
knowing.

The interval algebra compares instants, and a sweep is free to take one
interval's start and another's end. Those two may have been written in different
zones — a rule that intersects a London working day with a Tokyo opening time
has both. Left alone, the result is an interval whose two halves disagree about
what time it is, which is not wrong so much as unreadable. So every interval is
read back in `context.from`'s zone on the way out.

This changes no instant. A `ZonedDateTime` is a moment plus a way of reading it,
and only the reading is being settled here. If you want the answer in another
zone, `.withTimeZone(…)` it.

## Wall clock against elapsed time

`timeOfDay` is wall clock: the times you wrote stay put across a clock change,
and the real length of the window moves instead. That is what a schedule means —
a night shift starting at ten still starts at ten on the morning the clocks go
forward, and it is an hour shorter.

Both changes, on the same rule:

```ts
import { duration, intervals, timeOfDay } from "@kensio/quando";

const nightShift = timeOfDay("22:00", "06:00");

const springForward = {
  from: Temporal.ZonedDateTime.from("2026-03-28T12:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-29T12:00[Europe/London]"),
};
const backAgain = {
  from: Temporal.ZonedDateTime.from("2026-10-24T12:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-10-25T12:00[Europe/London]"),
};

for (const context of [springForward, backAgain]) {
  for (const shift of intervals(nightShift, context)) {
    console.log(
      `${shift.start?.toPlainDateTime()} → ${shift.end?.toPlainDateTime()}` +
        `: ${duration(shift)?.toString()}`,
    );
  }
}
```

```
2026-03-28T22:00:00 → 2026-03-29T06:00:00: PT7H
2026-10-24T22:00:00 → 2026-10-25T06:00:00: PT9H
```

Ten until six, twice, and once it is seven hours and once it is nine. Both
numbers are what a payroll would say.

Every duration in Quando is exact elapsed time, which is why `advanceBy` lands
where it does:

```ts
import { advanceBy, timeOfDay } from "@kensio/quando";

const nightShift = timeOfDay("22:00", "06:00");
const clockOn = Temporal.ZonedDateTime.from("2026-10-24T22:00[Europe/London]");

const after = advanceBy(clockOn, Temporal.Duration.from({ hours: 8 }), {
  during: nightShift,
});

console.log(after?.toString());
```

```
2026-10-25T05:00:00+00:00[Europe/London]
```

Eight hours of work, clocking on at ten, and you are done at five in the morning
rather than six — because the clocks went back at two and one hour was lived
through twice. Eight hours is eight hours; it is the clock face that moved.

This is also why [`advanceBy`](../queries/#it-refuses-calendar-amounts) refuses
`P1D`: a day is a calendar unit, and on these two mornings it is not 24 hours.

## The hour that does not exist

Going the other way, an hour is missing rather than repeated. A rule about it
simply does not occur:

```ts
import { intervals, timeOfDay } from "@kensio/quando";

const smallHours = timeOfDay("01:00", "02:00");

const overTheChange = {
  from: Temporal.ZonedDateTime.from("2026-03-28T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-31T00:00[Europe/London]"),
};

for (const { start, end } of intervals(smallHours, overTheChange)) {
  console.log(`${start?.toString()} → ${end?.toString()}`);
}
```

```
2026-03-28T01:00:00+00:00[Europe/London] → 2026-03-28T02:00:00+00:00[Europe/London]
2026-03-30T01:00:00+01:00[Europe/London] → 2026-03-30T02:00:00+01:00[Europe/London]
```

The 29th is absent. On that morning both ends of `01:00`–`02:00` resolve to the
same instant, so the window covers no time at all, and an interval covering no
time is not a thing the streams may contain. Skipping it is the only answer that
keeps "the total is the sum of the intervals" true.

## Zone names are checked when a rule is read

A zone in a stored rule is validated by `parseRule`, not left to fail at query
time — a mistyped zone should be a problem when the document is read, rather
than hours later when something asks a question of it. See
[serialisation](../serialisation/).

<!-- card
```ts
timeOfDay("22:00", "06:00") // a night shift, across a clock change

//  2026-03-28T22:00 → 2026-03-29T06:00 = PT7H
//  2026-10-24T22:00 → 2026-10-25T06:00 = PT9H
```
-->
