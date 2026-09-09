# Getting started

Build weekday opening hours, add exceptions, then find a booking slot or deadline.

## Install

```bash
npm install @kensio/quando
```

Quando uses a global `Temporal`. If your runtime does not provide it:

```bash
npm install temporal-polyfill
```

```ts
import "temporal-polyfill/global";
import { schedule, weekdays } from "@kensio/quando";
```

Importing Quando itself is safe before Temporal is installed. Install the global before
calling its date and time functions. For calendars beyond ISO and Gregorian,
use `temporal-polyfill/full/global`. Your application provides the Temporal implementation. TypeScript projects should include `ESNext` in `compilerOptions.lib`.

## Build and query opening hours

<!-- example: quickstart -->

```ts
import { schedule, weekdays } from "@kensio/quando";

const office = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00")
  .closed("2026-12-25")
  .setHours("2026-12-24", "09:00-15:00");

const friday = Temporal.ZonedDateTime.from("2026-03-13T16:55[Europe/London]");
const search = { within: { days: 7 } };

console.log(office.isOpen(friday));
// true

const meeting = office.firstOpenSlot(friday, { minutes: 30 }, search);
console.log(meeting?.start.toString());
// 2026-03-16T09:00:00+00:00[Europe/London]

const dispatch = office.addOpenTime(friday, { hours: 3 }, search);
console.log(dispatch?.toString());
// 2026-03-16T11:55:00+00:00[Europe/London]
```

Later calls take precedence where their scopes overlap. `setHours` replaces the
selected day's hours completely, so Christmas Eve closes at 15:00. Closing
instants are excluded: 09:00–17:00 includes 09:00 and excludes 17:00.

Five minutes of the deadline count on Friday. The remaining two hours and
fifty-five minutes finish on Monday. Duration arguments accept objects such as
`{ hours: 3 }`, ISO strings such as `"PT3H"`, and `Temporal.Duration` values.

Every query instant is a `Temporal.ZonedDateTime`. The schedule's `zone` fixes
its local clock even when the query instant is displayed in another zone.

## Overnight hours

```ts
const nightShift = schedule({ zone: "Europe/London" }).open(
  "fri",
  "22:00-06:00",
);
```

This covers Friday evening through Saturday morning. The starting Friday owns
the shift. `setHours` on that Friday also replaces its Saturday spillover.

## No answer and unknown answers

An explicit `within` search returns `undefined` when no answer fits. Without a
limit, searches stop after 100 years and throw `SearchLimitExceededError`.
A slot that exists has both `start` and `end`.

If a definition declares a knowledge horizon, a query throws
`BeyondHorizonError` when missing knowledge could change its answer. That is
different from a known closed period. See [horizons](../horizon/).

## Store and restore

```ts
import { parseSchedule } from "@kensio/quando";

const text = JSON.stringify(office);
const restored = parseSchedule(JSON.parse(text));
console.log(restored.isOpen(friday));
// true
```

Parsers accept decoded data and restore fluent methods. Invalid documents throw
`ParseError` with a readable message, a `path`, and a `code`. Custom callbacks
stay outside JSON. Reattach them with `withCustomRules(registry)` after parsing.

## Choose the next guide

| Task                                | API and guide                       |
| ----------------------------------- | ----------------------------------- |
| Open and closed periods             | [Schedules](../schedules/)          |
| People or values assigned over time | [Rotas](../schedules/#build-a-rota) |
| Numeric contributions and totals    | [Tallies](../accumulation/)         |
| Reusable descriptions of when       | [Rules](../rules/)                  |
| Limits involving existing bookings  | [Constraints](../constraints/)      |

<!-- card
```ts
const office = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00")
  .setHours("2026-12-24", "09:00-15:00");
```
-->
