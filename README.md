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

Quando uses a global `Temporal`. If your runtime does not provide it, install
`temporal-polyfill` and add `import "temporal-polyfill/global"` to your entry
point before evaluating rules. See [getting started](docs/getting-started/).

TypeScript projects must include `ESNext` in `compilerOptions.lib`.

## Opening hours

```ts
import { schedule, weekdays } from "@kensio/quando";

const openingHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00")
  .closed("2026-12-25")
  .setHours("2026-12-24", "09:00-15:00");

const placed = Temporal.ZonedDateTime.from("2026-03-13T16:55[Europe/London]");

openingHours.isOpen(placed);
// true

openingHours.nextOpenInterval(placed.add({ hours: 2 }))?.start?.toString();
// 2026-03-16T09:00:00+00:00[Europe/London]

openingHours
  .firstOpenSlot(placed, { minutes: 30 }, { within: { days: 7 } })
  ?.start?.toString();
// 2026-03-16T09:00:00+00:00[Europe/London]

openingHours.addOpenTime(placed, { hours: 3 })?.toString();
// 2026-03-16T11:55:00+00:00[Europe/London]
```

The first call to `open` sets the usual hours. Later calls add exceptions.
`closed` closes Christmas Day, and `setHours` gives Christmas Eve its own hours.

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
  .assign("2026-03-11", "carol");

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

For changes from 1.x, read the [migration guide](docs/migration/).

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

Constraints that depend on previous occurrences are in scope. `atMostOccurrences` caps how
many things may happen in a window, `minimumGap` sets the least time between
them, and `atMostOccupiedTime` caps the total _time_ they take. All three read against
a history the query carries, and `firstBreach` checks a whole proposed plan
against them, feeding each occurrence into the history before asking about the
next. See [constraints](docs/constraints/).

How far a rule can be trusted is in scope too. `knownThrough` declares the last
day a subtree counts as evidence, and a query whose answer would rest on
anything past it refuses. A cascade carries the same thing per value, so
`unknownValueIntervals` says which stretches its layers cannot settle. See
[horizons](docs/horizon/).

So is an answer with several possible outcomes. "One to three working days"
goes into a query as an estimate and comes back as dates, with the weekends and
the holidays already applied. Read the possible dates off it for a customer, a
quantile for a contract, or the chance of beating a date. See
[uncertainty](docs/uncertainty/).

## Licence

[Apache-2.0](LICENSE).
