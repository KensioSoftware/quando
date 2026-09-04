# Schedules and rotas

Schedules model open and closed time. Rotas assign application values over
time. Both APIs use ordered methods, with later calls taking precedence.

## Build a schedule

```ts
import { schedule, weekdays } from "@kensio/quando";

const openingHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00", { label: "Regular office hours" })
  .closed("2026-03-10", { label: "Staff training day" })
  .hoursOn("2026-03-11", "09:00-15:00", {
    comment: "The office closes early for a team meeting.",
  });
```

The first method sets the usual weekday hours. The second closes Tuesday. The
third replaces Wednesday's usual hours with a shorter day.

| Method                           | Effect                                             |
| -------------------------------- | -------------------------------------------------- |
| `.open(scope, options?)`         | Opens for the whole scope                          |
| `.open(scope, hours, options?)`  | Opens during the hours inside the scope            |
| `.closed(scope, options?)`       | Closes the whole scope                             |
| `.hoursOn(day, hours, options?)` | Replaces all earlier hours inside the day or scope |

A scope can be a rule or a date string such as `"2026-03-10"`. Hours can be a
rule or a range such as `"09:00-17:00"`.

### Method order sets precedence

Later methods win wherever their scopes overlap. Write the general case first,
then add exceptions from broadest to most specific.

```ts
const seasonalHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00")
  .closed("2026-12-25")
  .hoursOn("2026-12-24", "09:00-15:00");
```

`closed` overrides the normal weekday hours on Christmas Day. `hoursOn`
claims all of Christmas Eve before applying its shorter hours. Earlier hours do
not resume after 15:00.

### The schedule zone

`schedule({ zone })` fixes the schedule rules to one local time zone. A London
schedule still opens at 09:00 London time when queried from a Tokyo instant.

Omit the zone when the same definition should follow the query instant's local
time. See [time zones](../time-zones/) for clock changes and explicit rule
zones.

## Query a schedule

```ts
const friday = Temporal.ZonedDateTime.from("2026-03-13T16:55[Europe/London]");

openingHours.isOpen(friday);
openingHours.opensNext(friday.add({ hours: 2 }));
openingHours.firstOpenSlot(friday, Temporal.Duration.from({ minutes: 30 }));
openingHours.addOpenTime(friday, Temporal.Duration.from({ hours: 3 }));
openingHours.openDuration(
  Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
);
openingHours.renderTimeline(
  Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
);

const revisedHours = openingHours.hoursOn("2026-03-11", "10:00-18:00");
openingHours.changesTo(
  revisedHours,
  Temporal.ZonedDateTime.from("2026-03-11T00:00[Europe/London]"),
  Temporal.ZonedDateTime.from("2026-03-12T00:00[Europe/London]"),
);
```

| Method                                   | Returns                                     |
| ---------------------------------------- | ------------------------------------------- |
| `.isOpen(at)`                            | Whether the schedule is open at `at`        |
| `.explain(at)`                           | The value and reasons at `at`               |
| `.opensNext(at, search?)`                | The current or next complete opening        |
| `.firstOpenSlot(from, lasting, search?)` | The first opening long enough for a slot    |
| `.openSlots(from, to, options)`          | Candidate slots inside a finite window      |
| `.addOpenTime(from, amount, search?)`    | The instant reached after open time elapses |
| `.openDuration(from, to)`                | The open duration inside a finite window    |
| `.changesTo(next, from, to)`             | Newly opened and closed intervals           |
| `.validate(from, to)`                    | Inactive and shadowed schedule layers       |
| `.renderTimeline(from, to, options?)`    | A text or SVG chart of the opening times    |

`opensNext`, `firstOpenSlot`, and `addOpenTime` search up to 100 years by
default. Pass a `within` duration when finding no result is an expected
outcome:

```ts
const boundedOpening = openingHours.opensNext(friday.add({ hours: 2 }), {
  within: Temporal.Duration.from({ days: 7 }),
});
```

An explicit search returns `undefined` when it finds no answer. The default
search throws `SearchLimitExceededError` when its safety limit expires. The
[queries guide](../queries/#bound-a-search) explains the search options.

`openSlots` returns a lazy sequence. `lasting` sets the slot length and `every`
sets the time between slot starts:

```ts
const afternoonSlots = openingHours.openSlots(
  Temporal.ZonedDateTime.from("2026-03-13T14:00[Europe/London]"),
  Temporal.ZonedDateTime.from("2026-03-13T17:00[Europe/London]"),
  {
    every: Temporal.Duration.from({ minutes: 15 }),
    lasting: Temporal.Duration.from({ minutes: 30 }),
  },
);
```

`changesTo` compares the old schedule with a new one inside a finite window.
It returns lazy `opened` and `closed` interval streams:

```ts
const { opened, closed } = openingHours.changesTo(
  revisedHours,
  Temporal.ZonedDateTime.from("2026-03-11T00:00[Europe/London]"),
  Temporal.ZonedDateTime.from("2026-03-12T00:00[Europe/London]"),
);
```

`opened` contains time available only in `revisedHours`. `closed` contains
time available only in `openingHours`.

`validate` checks how the schedule's layers behave in a finite window. Closed
time is normal schedule output. Validation reports layer problems only. See
[validation](../validation/) for diagnostic codes and window selection.

`explain` returns a readable summary of why the schedule is open or closed. It
describes each rule match and the effect of layer priority automatically.
Optional labels and comments add business context. The
[explanations guide](../explanations/) covers the complete result.

`renderTimeline` draws one row per local day and lists the exact opening times.
Text is the default. Pass `{ format: "svg" }` for a standalone image. See the
[timelines guide](../timelines/) for examples and the standalone renderer.

## Build a rota

A rota assigns one JSON-compatible value at any moment. The value can be a
name, identifier, status, or application object.

```ts
import { rota, weekdays, weekends } from "@kensio/quando";

const onCall = rota()
  .assign(weekdays(), "alice")
  .assign(weekends(), "bob")
  .swap("2026-03-11", "carol");

const monday = Temporal.ZonedDateTime.from("2026-03-09T10:00[Europe/London]");

console.log(onCall.whoIsOn(monday));
```

```text
alice
```

| Method                            | Returns or effect                      |
| --------------------------------- | -------------------------------------- |
| `.assign(scope, value, options?)` | Adds an assignment                     |
| `.swap(day, value, options?)`     | Adds a higher-priority assignment      |
| `.whoIsOn(at)`                    | The assigned value, or `undefined`     |
| `.explain(at)`                    | The assignment and reasons at `at`     |
| `.shifts(from, to?)`              | A lazy stream of assigned intervals    |
| `.validate(from, to)`             | Diagnostics, including unassigned time |

`assign` and `swap` both append a value layer. Their names express the usual
intent. Method order determines the result.

Literal values accumulate in the inferred type. In the example,
`whoIsOn` returns `"alice" | "bob" | "carol" | undefined`. Use an explicit
type when the values arrive at runtime:

```ts
interface Duty {
  readonly person: string;
  readonly level: number;
}

const duties = rota<Duty>().assign(weekdays(), {
  person: "alice",
  level: 2,
});
```

Rota values must survive a JSON round trip. Constructors reject
`undefined`, `bigint`, functions, symbols, non-finite numbers, class
instances, hidden properties, and circular objects.

## Store and restore domain objects

Schedules and rotas include a tagged JSON form. Their methods are
non-enumerable.

```ts
import { asString, parseRota, parseSchedule } from "@kensio/quando";

const restoredHours = parseSchedule(JSON.parse(JSON.stringify(openingHours)));
const restoredRota = parseRota(JSON.parse(JSON.stringify(onCall)), asString);
```

`parseRota` needs a value parser because the application owns the value type.
`parseSchedule` already knows that schedule values are boolean.

Each object exposes its underlying `.cascade` for low-level operations. Most
schedule and rota code can stay on the domain methods. See
[serialisation](../serialisation/) for stored forms and [cascades](../cascades/)
for the lower-level model.

<!-- card
```ts
const openingHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00")
  .closed(bankHolidays)
  .hoursOn("2026-03-11", "09:00-15:00");
```
-->
