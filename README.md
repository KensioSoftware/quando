# Quando

Declarative temporal rules for schedules, deadlines, and exceptions.

Quando calculates when something happens. It uses `Temporal` for dates, times,
durations, and time zones.

```bash
npm install @kensio/quando
```

Quando requires Node 26 or another runtime with global `Temporal`.

## Opening hours

```ts
import { schedule, weekdays } from "@kensio/quando";

const openingHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00")
  .closed("2026-12-25")
  .hoursOn("2026-12-24", "09:00-15:00");

const placed = Temporal.ZonedDateTime.from("2026-03-13T16:55[Europe/London]");

openingHours.isOpen(placed);
// true

openingHours.opensNext(placed.add({ hours: 2 }))?.start?.toString();
// 2026-03-16T09:00:00+00:00[Europe/London]

openingHours
  .addOpenTime(placed, Temporal.Duration.from({ hours: 3 }))
  ?.toString();
// 2026-03-16T11:55:00+00:00[Europe/London]
```

Method order sets precedence. The Christmas closure overrides the ordinary
weekday hours. `hoursOn` replaces the hours for its date.

## Rotas and tallies

```ts
import { rota, tally, weekdays, weekends } from "@kensio/quando";

const onCall = rota()
  .assign(weekdays(), "alice")
  .assign(weekends(), "bob")
  .swap("2026-03-11", "carol");

onCall.whoIsOn(placed);
// "alice"

const staff = tally().plus(weekdays(), 3).plus("2026-03-11", 2);

staff.at(Temporal.ZonedDateTime.from("2026-03-11T11:00[Europe/London]"));
// 5
```

A rota uses precedence. A tally adds values where its layers overlap.

## Rules

Rules handle cases outside the domain façades.

```ts
import { dates, timeOfDay, weekdays } from "@kensio/quando";

const dispatchHours = weekdays()
  .and(timeOfDay("09:00", "17:00"))
  .except(dates("2026-12-25"));
```

Rules are JSON-shaped data with non-enumerable fluent methods. `parseRule`
validates stored data and restores those methods.

## Storage

The domain façades keep their type and configuration in JSON.

```ts
import { parseSchedule } from "@kensio/quando";

const stored = JSON.stringify(openingHours);
const restored = parseSchedule(JSON.parse(stored));

restored.isOpen(placed);
```

Cascade and rota values must be JSON-compatible. TypeScript rejects
`undefined`, `bigint`, functions, and symbols. Runtime validation rejects
non-finite numbers, class instances, and circular objects.

## Advanced APIs

The root entry point contains the common rule and domain APIs. Low-level
interval, cascade, and resolution functions live under `@kensio/quando/core`.
Storage parsers are also available from `@kensio/quando/parsing`.

```ts
import { cascade, layer, resolve } from "@kensio/quando/core";
```

## Documentation

- [Getting started](docs/getting-started/)
- [Schedules and rotas](docs/schedules/)
- [Rules](docs/rules/)
- [Queries](docs/queries/)
- [Time zones](docs/time-zones/)
- [Serialisation](docs/serialisation/)
- [Cascades](docs/cascades/)
- [Merging](docs/merging/)
- [Comparing](docs/comparing/)
- [API](docs/api/)

The documentation is published at [quandojs.dev](https://quandojs.dev).

## Scope

Quando calculates times and intervals. It does not run jobs, store data, or
provide holiday datasets. Occurrence constraints such as minimum spacing and
rolling-window totals require a separate constraint solver.

## Licence

[Apache-2.0](LICENSE).
