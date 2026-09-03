# Getting started

Build opening hours, ask a question, and store the result.

## Requirements

Quando requires Node 26 or another runtime with global `Temporal`. A project
using TypeScript must include `ESNext` in its libraries.

```json
{
  "compilerOptions": {
    "lib": ["ESNext"]
  }
}
```

Install the package:

```bash
npm install @kensio/quando
```

## Build opening hours

```ts
import { schedule, weekdays } from "@kensio/quando";

const openingHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00")
  .closed("2026-12-25")
  .hoursOn("2026-12-24", "09:00-15:00");
```

The schedule opens on weekdays, closes on Christmas Day, and closes early on
Christmas Eve. Later methods override earlier methods within their scope.

## Ask schedule questions

```ts
const placed = Temporal.ZonedDateTime.from("2026-03-13T16:55[Europe/London]");

console.log(openingHours.isOpen(placed));

console.log(
  openingHours.opensNext(placed.add({ hours: 2 }))?.start?.toString(),
);

console.log(
  openingHours
    .addOpenTime(placed, Temporal.Duration.from({ hours: 3 }))
    ?.toString(),
);
```

```text
true
2026-03-16T09:00:00+00:00[Europe/London]
2026-03-16T11:55:00+00:00[Europe/London]
```

`addOpenTime` counts five minutes on Friday and finishes the remaining work on
Monday.

## Measure a window

```ts
const from = Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]");
const to = Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]");

console.log(openingHours.openDuration(from, to).toString());
```

```text
PT40H
```

Windows use half-open bounds. A window contains its `from` instant and excludes
its `to` instant.

## Store and restore the schedule

```ts
import { parseSchedule } from "@kensio/quando";

const stored = JSON.stringify(openingHours);
const restored = parseSchedule(JSON.parse(stored));

console.log(restored.isOpen(placed));
```

```text
true
```

`parseSchedule` validates the document, restores the methods, and retains the
schedule zone.

## Use rules directly

Rules provide the composable core used by schedules.

```ts
import { activeAt, dates, timeOfDay, weekdays } from "@kensio/quando";

const dispatchHours = weekdays()
  .and(timeOfDay("09:00", "17:00"))
  .except(dates("2026-12-25"));

console.log(activeAt(dispatchHours, placed));
```

The [rules](../rules/) guide covers composition. The [queries](../queries/)
guide covers standalone queries. Low-level interval and cascade functions live
under `@kensio/quando/core`.

<!-- card
```ts
const openingHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00")
  .closed("2026-12-25");
```
-->
