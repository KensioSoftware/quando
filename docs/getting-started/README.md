---
description: "Create your first Quando schedule with weekday opening hours and exceptions."
---

# Getting started

This guide builds a weekday schedule, adds holiday exceptions, and uses it to
find a meeting slot and a working-time deadline.

## Install

```bash
npm install @kensio/quando
```

Quando uses the global `Temporal` API. If your runtime does not provide it,
install the polyfill:

```bash
npm install temporal-polyfill
```

```ts
import "temporal-polyfill/global";
import { schedule, weekdays } from "@kensio/quando";
```

Load the polyfill before calling Quando's date and time functions. Importing
Quando before loading it is safe, but evaluating dates requires `Temporal`.
TypeScript projects should include `ESNext` in `compilerOptions.lib`.

### Calendars need the full polyfill build

For calendars beyond ISO and Gregorian, load `temporal-polyfill/full/global`
in place of `temporal-polyfill/global`. Your application supplies the Temporal
implementation used by Quando.

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

Later calls override earlier calls for the same period. `setHours` replaces
all opening hours on the selected date. In this example, Christmas Eve closes
at 15:00.

Opening times are included and closing times are excluded. The range
09:00–17:00 includes 09:00 and excludes 17:00.

At 16:55 on Friday, only five open minutes remain. The 30-minute meeting must
wait until Monday. The three-hour deadline uses those five Friday minutes and
the remaining two hours and fifty-five minutes on Monday.

Duration arguments accept objects such as `{ hours: 3 }`, ISO strings such as
`"PT3H"`, and `Temporal.Duration` values.

Every query instant is a `Temporal.ZonedDateTime`. The schedule's `zone` fixes
its local clock even when the query instant is displayed in another zone.

## Overnight hours

```ts
const nightShift = schedule({ zone: "Europe/London" }).open(
  "fri",
  "22:00-06:00",
);
```

This covers Friday at 22:00 through Saturday at 06:00. The shift is associated
with its starting date. Calling `setHours` for that Friday replaces the whole
shift, including its Saturday hours.

<a id="no-answer-and-unknown-answers"></a>

## Search limits and incomplete data

With an explicit `within` limit, a search returns `undefined` if no result
fits. Without an explicit limit, it searches up to 100 years and throws
`SearchLimitExceededError` if it still has no result. A returned slot always
has both `start` and `end`.

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

Pass the result of `JSON.parse` to a Quando parser to restore the object's
methods. Invalid documents throw `ParseError` with a message, field `path`,
and error `code`.

JSON excludes custom rule callbacks. If the schedule uses them, reattach the
registry with `withCustomRules(registry)` after parsing.

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
