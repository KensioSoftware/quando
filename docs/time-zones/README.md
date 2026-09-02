# Time zones

Quando represents every input and output moment as a
`Temporal.ZonedDateTime`. Each rule uses either its own named time zone or the
zone from its evaluation context.

## The zone comes from the context

The context `from` value carries a time zone. A rule with no explicit zone uses
that zone. `Context` has no separate `zone` property.

This example evaluates one rule in London and Tokyo:

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

```text
2026-03-09T09:00:00+00:00[Europe/London]
2026-03-09T09:00:00+09:00[Asia/Tokyo]
```

Both results start at 09:00 local time. They represent different instants. Use a
rule without a zone when the rule should follow the context location.

## A rule may name its own zone

`daysOfWeek`, `dates`, and `timeOfDay` each accept an optional zone. `inZone`
adds a zone to one of these rules after it has been created:

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

```text
2026-03-09T18:00:00+09:00[Asia/Tokyo] → 2026-03-10T02:00:00+09:00[Asia/Tokyo]
2026-03-10T18:00:00+09:00[Asia/Tokyo] → 2026-03-11T00:00:00+09:00[Asia/Tokyo]
```

Set the zone on both parts of this rule. The `weekdays` zone decides which local
dates are Monday through Friday. The `timeOfDay` zone decides when 09:00 and
17:00 occur. Quando allows the two rules to use different zones when needed.

The second result stops at Tokyo midnight because that is the end of the
context. Results are always clipped to the context window.

## Answers come back in the context's zone

The previous results are reported in Tokyo time because the context starts in
Tokyo. Quando always returns intervals in the zone of `context.from`.

Combined rules may contain intervals from different zones. Normalising the
result keeps both ends of each interval in one zone.

Normalisation does not change the represented instants. Call `.withTimeZone()`
on a result when you need another display zone.

## Wall clock against elapsed time

`timeOfDay` uses wall-clock time. A night shift from 22:00 to 06:00 keeps those
local endpoints across a daylight-saving change. Its elapsed duration may
change.

This example evaluates the same shift across both UK clock changes:

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

```text
2026-03-28T22:00:00 → 2026-03-29T06:00:00: PT7H
2026-10-24T22:00:00 → 2026-10-25T06:00:00: PT9H
```

Both shifts run from 22:00 to 06:00 local time. The spring shift lasts seven
hours and the autumn shift lasts nine hours.

Quando measures durations as exact elapsed time. This affects `advanceBy`:

```ts
import { advanceBy, timeOfDay } from "@kensio/quando";

const nightShift = timeOfDay("22:00", "06:00");
const clockOn = Temporal.ZonedDateTime.from("2026-10-24T22:00[Europe/London]");

const after = advanceBy(clockOn, Temporal.Duration.from({ hours: 8 }), {
  during: nightShift,
});

console.log(after?.toString());
```

```text
2026-10-25T05:00:00+00:00[Europe/London]
```

Eight elapsed hours after 22:00 is 05:00 on the morning when the clocks move
back. The repeated hour counts twice.

For the same reason, [`advanceBy`](../queries/#elapsed-durations-only) rejects
`P1D`. A calendar day may contain 23, 24, or 25 elapsed hours.

## A skipped hour produces no interval

When the clocks move forward, some local times do not occur. A rule that covers
only a skipped range produces no interval for that date:

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

```text
2026-03-28T01:00:00+00:00[Europe/London] → 2026-03-28T02:00:00+00:00[Europe/London]
2026-03-30T01:00:00+01:00[Europe/London] → 2026-03-30T02:00:00+01:00[Europe/London]
```

There is no interval on 29 March. The local range from 01:00 to 02:00 has zero
elapsed duration on that date, and interval streams omit empty intervals.

## Zone names are checked when a rule is read

`parseRule` validates zone names in stored rules. An unknown zone causes a
`TypeError` while the document is parsed. See
[serialisation](../serialisation/).

<!-- card
```ts
timeOfDay("22:00", "06:00") // a night shift, across a clock change

//  2026-03-28T22:00 → 2026-03-29T06:00 = PT7H
//  2026-10-24T22:00 → 2026-10-25T06:00 = PT9H
```
-->
