# Time zones

Quando evaluates local dates and times in a named time zone. The zone comes
from the query context, a schedule, or an explicit rule.

## The context supplies the default zone

Every query starts from a `Temporal.ZonedDateTime`. Its zone becomes the
default for rules that have no zone of their own.

```ts
import { timeOfDay, weekdays } from "@kensio/quando";
import { intervals } from "@kensio/quando/core";

const officeHours = weekdays().and(timeOfDay("09:00", "17:00"));

const londonDay = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-10T00:00[Europe/London]"),
};
const tokyoDay = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Asia/Tokyo]"),
  to: Temporal.ZonedDateTime.from("2026-03-10T00:00[Asia/Tokyo]"),
};

console.log([...intervals(officeHours, londonDay)][0]?.start?.toString());
console.log([...intervals(officeHours, tokyoDay)][0]?.start?.toString());
```

```text
2026-03-09T09:00:00+00:00[Europe/London]
2026-03-09T09:00:00+09:00[Asia/Tokyo]
```

Both intervals begin at 09:00 local time. They represent different instants.

A `Context` has no separate zone field. The zone on `from` is the source of
the default.

## Fix a rule to one zone

`inZone(zone, rule)` evaluates a complete rule subtree in the named zone.

```ts
import { inZone, timeOfDay, weekdays } from "@kensio/quando";

const londonOffice = inZone(
  "Europe/London",
  weekdays().and(timeOfDay("09:00", "17:00")),
);
```

Both the weekday and the time range now use London local time. A query from
Tokyo still evaluates this rule in London.

A nested `inZone` can choose another zone for one part of the rule. The
nearest explicit zone applies to that subtree.

## Give a schedule a zone

Schedules provide the same default at the domain level:

```ts
import { schedule, weekdays } from "@kensio/quando";

const londonOffice = schedule({ zone: "Europe/London" }).open(
  weekdays(),
  "09:00-17:00",
);
```

Every rule passed to this schedule uses London unless that rule contains its
own explicit zone. Omit the schedule zone when the definition should follow the
query instant's zone.

## Results use the context zone

Intervals are returned in the zone of `context.from`. A London rule queried
from Tokyo produces values displayed in Tokyo time.

This affects display only. Calling `.withTimeZone("Europe/London")` on a result
keeps the same instant and changes its displayed local time.

When a context has a finite `to`, results are clipped at that instant even if
the rule's local interval continues beyond it.

## Wall-clock time and elapsed time

`timeOfDay` describes wall-clock endpoints. A shift from 22:00 to 06:00 keeps
those local times when clocks change. Its elapsed duration can be seven, eight,
or nine hours.

```ts
import { timeOfDay } from "@kensio/quando";
import { duration, intervals } from "@kensio/quando/core";

const nightShift = timeOfDay("22:00", "06:00");
const springChange = {
  from: Temporal.ZonedDateTime.from("2026-03-28T12:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-29T12:00[Europe/London]"),
};
const autumnChange = {
  from: Temporal.ZonedDateTime.from("2026-10-24T12:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-10-25T12:00[Europe/London]"),
};

for (const context of [springChange, autumnChange]) {
  const [shift] = [...intervals(nightShift, context)];
  console.log(shift === undefined ? undefined : duration(shift)?.toString());
}
```

```text
PT7H
PT9H
```

Queries such as `coveredDuration` and `advanceBy` use exact elapsed time.
`advanceBy` therefore rejects calendar durations containing years, months,
weeks, or days.

## Skipped and repeated local times

Some local times do not exist when clocks move forward. Others occur twice when
clocks move back.

By default, Quando uses Temporal's `compatible` disambiguation. Set
`disambiguation` on the context when the application needs another policy:

```ts
const strict = {
  from: Temporal.ZonedDateTime.from("2026-03-28T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-31T00:00[Europe/London]"),
  disambiguation: "reject" as const,
};
```

The available policies are `compatible`, `earlier`, `later`, and `reject`.
The `reject` policy throws when evaluation encounters an ambiguous or
nonexistent local time.

A time-of-day range with zero elapsed duration produces no interval. For
example, the London range from 01:00 to 02:00 is absent on the 2026 spring
clock-change date.

## Zone validation

Rule builders, `schedule`, and parsers validate zone names immediately. An
unknown zone throws at the authoring or parsing boundary.

<!-- card
```ts
const londonOffice = inZone(
  "Europe/London",
  weekdays().and(timeOfDay("09:00", "17:00")),
);
```
-->
