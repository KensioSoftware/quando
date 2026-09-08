# Quando

Quando is a TypeScript library for schedules, rotas, time-based values, and
recurring time rules.

It answers questions such as these:

- Is this shop open now?
- When does it open next?
- When will three working hours have elapsed?
- Where is the first two-hour gap in several people's availability?
- Which half-hour booking slots are available?
- Which opening times changed in a revised schedule?
- Does a rota leave any time unassigned?
- Why is this instant open, closed, assigned, or counted this way?
- Who is on call at a given time?
- How many people are working during a period?

Quando uses the standard `Temporal` API for dates, times, durations, and time
zones.

## Install

```bash
npm install @kensio/quando
```

Quando reads `Temporal` from the global scope. Node 26 has one, as do Chrome
144, Edge 144 and Firefox 139. On Node 22, Node 24 or Safari, install
[`temporal-polyfill`](https://www.npmjs.com/package/temporal-polyfill) and
assign it to `globalThis.Temporal` before importing Quando. The
[getting started guide](docs/getting-started/#runtimes-without-global-temporal)
shows the two lines it takes.

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
  .firstOpenSlot(placed, Temporal.Duration.from({ minutes: 30 }))
  ?.start?.toString();
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

## Command line

The installed `quando` command reads stored definitions. It can return a
timeline, explain one instant, or validate a finite window.

```bash
npx quando timeline opening-hours.json \
  --from '2026-03-09T00:00[Europe/London]' \
  --to '2026-03-10T00:00[Europe/London]'
```

Commands return JSON by default. Pass `--format text` for terminal output. The
[command-line guide](docs/cli/) lists the accepted documents and options.

## Documentation

Start with the [getting started guide](docs/getting-started/). The remaining
guides cover:

- [Schedules and rotas](docs/schedules/)
- [Rules](docs/rules/), [terms](docs/terms/) and [constraints](docs/constraints/)
- [Horizons](docs/horizon/)
- [Queries](docs/queries/)
- [Validation](docs/validation/)
- [Explanations](docs/explanations/)
- [Command line](docs/cli/)
- [Time zones](docs/time-zones/)
- [Serialisation](docs/serialisation/)
- [Cascades](docs/cascades/) and [merging](docs/merging/)
- [Comparison](docs/comparing/) and the [API reference](docs/api/)
- [Performance](docs/performance/)

The same documentation is published at
[quandojs.dev](https://quandojs.dev).

## Scope

Quando calculates times and intervals. It leaves job execution, persistence,
and holiday data to the application.

Constraints that depend on previous occurrences are in scope. `atMost` caps how
many things may happen in a window and `spacedBy` sets the least time between
them, `atMostTime` caps the total _time_ they take, and all three read against
a history the query carries. Checking a whole proposed plan rather than the
next occurrence is still to come. See [constraints](docs/constraints/).

How far a rule can be trusted is in scope too. `knownThrough` declares the last
day a subtree counts as evidence, and a query whose answer would rest on
anything past it refuses. Saying which _value_ a cascade assigns where a layer
runs out is still to come. See [horizons](docs/horizon/).

## Licence

[Apache-2.0](LICENSE).
