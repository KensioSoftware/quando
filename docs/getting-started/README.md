# Getting started

This guide builds a weekly schedule, adds two exceptions, and queries the
result.

## Requirements

Quando requires Node 26 or another runtime with global `Temporal`.

Install the package:

```bash
npm install @kensio/quando
```

TypeScript projects must include `ESNext` in the compiler libraries:

```json
{
  "compilerOptions": {
    "lib": ["ESNext"]
  }
}
```

## Create a schedule

```ts
import { schedule, weekdays } from "@kensio/quando";

const openingHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00")
  .closed("2026-12-25")
  .hoursOn("2026-12-24", "09:00-15:00");
```

`open` combines a scope with a range of local times. Here the scope is Monday
through Friday. The next two calls add exceptions for Christmas Day and
Christmas Eve.

Later methods take precedence within their scope. This makes the definition
read from the usual case to its exceptions.

## Ask whether it is open

All query instants are `Temporal.ZonedDateTime` values.

```ts
const placed = Temporal.ZonedDateTime.from("2026-03-13T16:55[Europe/London]");

console.log(openingHours.isOpen(placed));
```

```text
true
```

The schedule is open at 16:55 on that Friday. Closing time is excluded because
Quando uses half-open intervals.

## Find the next opening

```ts
const fridayEvening = placed.add({ hours: 2 });
const next = openingHours.opensNext(fridayEvening);

console.log(next?.start?.toString());
```

```text
2026-03-16T09:00:00+00:00[Europe/London]
```

The next opening begins at 09:00 on Monday.

## Add working time

`addOpenTime` moves through open periods and skips closed periods.

```ts
const dispatch = openingHours.addOpenTime(
  placed,
  Temporal.Duration.from({ hours: 3 }),
);

console.log(dispatch?.toString());
```

```text
2026-03-16T11:55:00+00:00[Europe/London]
```

Five minutes count on Friday. The remaining two hours and fifty-five minutes
finish on Monday.

## Measure open time

```ts
const from = Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]");
const to = Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]");

console.log(openingHours.openDuration(from, to).toString());
```

```text
PT40H
```

The window includes `from` and excludes `to`.

## Store and restore the schedule

The schedule is JSON-compatible data with non-enumerable methods attached.
Store it with the JSON tools you already use, then pass the stored value to
`parseSchedule`.

```ts
import { parseSchedule } from "@kensio/quando";

const stored = JSON.stringify(openingHours);
const restored = parseSchedule(JSON.parse(stored));

console.log(restored.isOpen(placed));
```

```text
true
```

`parseSchedule` validates the complete document and restores the schedule
methods.

## Continue reading

[Schedules and rotas](../schedules/) covers the other domain methods.
[Rules](../rules/) explains how to describe custom periods. [Queries](../queries/)
covers the standalone query functions.

<!-- card
```ts
const openingHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00")
  .closed("2026-12-25");
```
-->
