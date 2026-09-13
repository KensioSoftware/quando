---
description: "Model opening hours and assign values over time with Quando schedules and rotas."
---

# Schedules and rotas

Use a schedule for open and closed periods. Use a rota to assign a value, such
as a person's name, over time. Both APIs return new objects as you add rules.
Later calls take precedence where periods overlap.

## Build a schedule

```ts
import { schedule, weekdays } from "@kensio/quando";

const openingHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00", { label: "Regular office hours" })
  .closed("2026-03-10", { label: "Staff training day" })
  .setHours("2026-03-11", "09:00-15:00", {
    comment: "The office closes early for a team meeting.",
  });
```

The first method sets the usual weekday hours. The second closes Tuesday. The
third replaces Wednesday's usual hours with a shorter day.

| Method                            | Effect                                             |
| --------------------------------- | -------------------------------------------------- |
| `.open(scope, options?)`          | Opens for the whole scope                          |
| `.open(scope, hours, options?)`   | Opens during the hours inside the scope            |
| `.closed(scope, options?)`        | Closes the whole scope                             |
| `.setHours(day, hours, options?)` | Replaces all earlier hours inside the day or scope |

A scope selects the period the method changes. Supply a rule or a text
expression such as `"2026-03-10"` or `"mon-fri 09:00-17:00"`. Hours can be a
rule or a range such as `"09:00-17:00"`. See the [terms guide](../terms/) for
the expression syntax.

### Method order sets precedence

Later methods win wherever their scopes overlap. Write the general case first,
then add exceptions from broadest to most specific.

```ts
const seasonalHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00")
  .closed("2026-12-25")
  .setHours("2026-12-24", "09:00-15:00");
```

`closed` overrides the normal weekday hours on Christmas Day. `setHours`
replaces all earlier hours on Christmas Eve. The office is closed after 15:00
that day.

### The schedule zone

`schedule({ zone })` fixes the schedule rules to one local time zone. A London
schedule still opens at 09:00 London time when queried from a Tokyo instant.

Omit the zone when the same definition should follow the query instant's local
time. See [time zones](../time-zones/) for clock changes and explicit rule
zones.

### Overnight hours

`open("fri", "22:00-06:00")` opens from Friday at 22:00 to Saturday at
06:00. The whole shift is associated with Friday.

`setHours("2026-03-13", "09:00-17:00")` replaces every earlier shift that
starts on that Friday, including its Saturday hours. A later `closed` call
closes the calendar period it selects, including any overnight hours within
that period.

### Evaluation options

All queries accept an optional final object with `rules`, `occurrences`, and
`disambiguation`. `withCustomRules(registry)` attaches custom callbacks to a
derived schedule. Explicit query settings override the attached settings.

## Query a schedule

```ts
const friday = Temporal.ZonedDateTime.from("2026-03-13T16:55[Europe/London]");

openingHours.isOpen(friday);
openingHours.nextOpenInterval(friday.add({ hours: 2 }));
openingHours.firstOpenSlot(friday, Temporal.Duration.from({ minutes: 30 }));
openingHours.addOpenTime(friday, Temporal.Duration.from({ hours: 3 }));
openingHours.openDuration(
  Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
);
openingHours.addOpenDays(friday, 3);
openingHours.openDayCount(
  Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
);
openingHours.timeline(
  Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
);

const revisedHours = openingHours.setHours("2026-03-11", "10:00-18:00");
openingHours.changesTo(
  revisedHours,
  Temporal.ZonedDateTime.from("2026-03-11T00:00[Europe/London]"),
  Temporal.ZonedDateTime.from("2026-03-12T00:00[Europe/London]"),
);
```

| Method                                   | Returns                                            |
| ---------------------------------------- | -------------------------------------------------- |
| `.isOpen(at)`                            | Whether the schedule is open at `at`               |
| `.explain(at)`                           | The value and reasons at `at`                      |
| `.nextOpenInterval(at, search?)`         | The current or next opening, clipped to the search |
| `.firstOpenSlot(from, lasting, search?)` | The first opening long enough for a slot           |
| `.openSlots(from, to, options)`          | Candidate slots inside a finite window             |
| `.addOpenTime(from, amount, search?)`    | The instant reached after open time elapses        |
| `.openDuration(from, to)`                | The open duration inside a finite window           |
| `.addOpenDays(from, count, options?)`    | The instant reached after whole open days          |
| `.openDayCount(from, to)`                | The open days inside a finite window               |
| `.changesTo(next, from, to)`             | Newly opened and closed intervals                  |
| `.validate(from, to)`                    | Inactive and shadowed schedule layers              |
| `.timeline(from, to, options?)`          | Evaluated timeline data                            |

`nextOpenInterval`, `firstOpenSlot`, `addOpenTime`, and `addOpenDays` search up to 100
years by default. Pass a `within` duration when finding no result is an expected
outcome:

```ts
const boundedOpening = openingHours.nextOpenInterval(friday.add({ hours: 2 }), {
  within: Temporal.Duration.from({ days: 7 }),
});
```

A search with an explicit `within` limit returns `undefined` if no result
fits. The default search throws `SearchLimitExceededError` if it reaches its
safety limit. The
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

`addOpenDays` counts whole days where `addOpenTime` counts elapsed hours. Three
working days from a Friday afternoon is the following Wednesday, and the answer
is the instant the schedule opens that morning:

```ts
const delivery = openingHours.addOpenDays(friday, 3);

console.log(delivery?.toString());
```

```text
2026-03-18T09:00:00+00:00[Europe/London]
```

A date counts as one open day if the schedule is open during any part of it.
A half-day therefore counts as one day.

`addOpenDays` and `openDayCount` count dates in the schedule's configured time
zone, as `timeline` does. The instant returned by `addOpenDays` is displayed in
the zone of `from`. The
[queries guide](../queries/#which-day-the-count-starts-on) covers the
`startingDay` convention and clear days.

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

`timeline` returns JSON-compatible data with one entry per local day.
Pass the result to `renderTimeline(data)` for a text chart. See the
[timelines guide](../timelines/) for examples and the standalone function.

## Build a rota

A rota assigns one JSON-compatible value at a time. The value can be a name,
identifier, status, or application object. Use `rota({ zone })` to evaluate
assignment scopes in a fixed time zone.

```ts
import { rota, weekdays, weekends } from "@kensio/quando";

const onCall = rota()
  .assign(weekdays(), "alice")
  .assign(weekends(), "bob")
  .assign("2026-03-11", "carol");

const monday = Temporal.ZonedDateTime.from("2026-03-09T10:00[Europe/London]");

console.log(onCall.whoIsOn(monday));
```

```text
alice
```

| Method                            | Returns or effect                      |
| --------------------------------- | -------------------------------------- |
| `.assign(scope, value, options?)` | Adds an assignment                     |
| `.whoIsOn(at)`                    | The assigned value, or `undefined`     |
| `.explain(at)`                    | The assignment and reasons at `at`     |
| `.shifts(from, to?)`              | A lazy stream of assigned intervals    |
| `.validate(from, to)`             | Diagnostics, including unassigned time |

`assign` appends an assignment. Later assignments win where scopes overlap.

TypeScript infers a union of the assigned values. In this example,
`whoIsOn` returns `"alice" | "bob" | "carol" | undefined`. Supply an explicit
value type when assignments come from runtime data:

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
import { parseString, parseRota, parseSchedule } from "@kensio/quando";

const restoredHours = parseSchedule(JSON.parse(JSON.stringify(openingHours)));
const restoredRota = parseRota(JSON.parse(JSON.stringify(onCall)), parseString);
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
  .setHours("2026-03-11", "09:00-15:00");
```
-->
