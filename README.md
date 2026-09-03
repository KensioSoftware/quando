# Quando

Quando is a TypeScript library for schedules, rotas, time-based values, and
recurring time rules.

It answers questions such as these:

- Is this shop open now?
- When does it open next?
- When will three working hours have elapsed?
- Where is the first two-hour gap in several people's availability?
- Which half-hour booking slots are available?
- Who is on call at a given time?
- How many people are working during a period?

Quando uses the standard `Temporal` API for dates, times, durations, and time
zones.

## Install

```bash
npm install @kensio/quando
```

Quando requires Node 26 or another JavaScript runtime with global `Temporal`.
TypeScript projects must include `ESNext` in `compilerOptions.lib`.

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

The first call to `open` sets the usual hours. Later calls add exceptions.
`closed` closes Christmas Day, and `hoursOn` gives Christmas Eve its own hours.

## Choose an API

| API        | Use it for                                      |
| ---------- | ----------------------------------------------- |
| `schedule` | Opening hours and other open or closed periods  |
| `rota`     | Assigning names or application values over time |
| `tally`    | Adding numeric values where periods overlap     |
| Rules      | Composing custom definitions of when            |

Schedules, rotas, and tallies provide methods named for their domains. Rules
provide the common time model underneath them.

```ts
import { rota, tally, weekdays, weekends } from "@kensio/quando";

const onCall = rota()
  .assign(weekdays(), "alice")
  .assign(weekends(), "bob")
  .swap("2026-03-11", "carol");

const staffing = tally().plus(weekdays(), 3).plus("2026-03-11", 2);
```

## Store definitions as JSON

Quando definitions are JSON-compatible data. Parsers validate stored data and
restore the API methods.

```ts
import { parseSchedule } from "@kensio/quando";

const stored = JSON.stringify(openingHours);
const restored = parseSchedule(JSON.parse(stored));

restored.isOpen(placed);
```

## Documentation

Start with the [getting started guide](docs/getting-started/). The remaining
guides cover:

- [Schedules and rotas](docs/schedules/)
- [Rules](docs/rules/)
- [Queries](docs/queries/)
- [Time zones](docs/time-zones/)
- [Serialisation](docs/serialisation/)
- [Cascades](docs/cascades/) and [merging](docs/merging/)
- [Comparison](docs/comparing/) and the [API reference](docs/api/)

The same documentation is published at
[quandojs.dev](https://quandojs.dev).

## Scope

Quando calculates times and intervals. It leaves job execution, persistence,
and holiday data to the application. It does not solve constraints that depend
on previous occurrences, such as minimum spacing or rolling-window totals.

## Licence

[Apache-2.0](LICENSE).
