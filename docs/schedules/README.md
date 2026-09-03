# Schedules and rotas

Schedules describe opening hours. Rotas assign JSON-compatible values over
time.

## Opening hours

```ts
import { schedule, weekdays } from "@kensio/quando";

const openingHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00")
  .closed("2026-03-10")
  .hoursOn("2026-03-11", "09:00-15:00");
```

Method order sets precedence. The closure overrides ordinary hours on 10 March.
`hoursOn` replaces the whole day's hours on 11 March.

The schedule zone supplies the default zone for rules passed to its methods.
The result stays fixed to London time when a caller asks from another zone.
A nested rule with an explicit zone can override that default.

### Schedule queries

```ts
const friday = Temporal.ZonedDateTime.from("2026-03-13T16:55[Europe/London]");

openingHours.isOpen(friday);
openingHours.opensNext(friday.add({ hours: 2 }));
openingHours.addOpenTime(friday, Temporal.Duration.from({ hours: 3 }));
openingHours.openDuration(
  Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
);
```

| Method                                | Result                                      |
| ------------------------------------- | ------------------------------------------- |
| `.isOpen(at)`                         | Whether the schedule is open at `at`        |
| `.opensNext(at, search?)`             | The current or next complete opening        |
| `.addOpenTime(from, amount, search?)` | The instant reached after open time elapses |
| `.openDuration(from, to)`             | The open time inside a window               |

`opensNext` searches up to 100 years when the caller supplies no end. It throws
`SearchLimitExceededError` when that safety limit expires. Pass a `within`
duration when an empty result is expected:

```ts
const opening = openingHours.opensNext(friday, {
  within: Temporal.Duration.from({ days: 7 }),
});
```

An explicit finite search returns `undefined` when it finds no opening.

Adding a zero duration returns the input instant. This holds during open and
closed time.

## Rotas

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

| Method                  | Result                                    |
| ----------------------- | ----------------------------------------- |
| `.assign(scope, value)` | Assigns a value within a scope            |
| `.swap(day, value)`     | Assigns a replacement value for a day     |
| `.whoIsOn(at)`          | Returns the assigned value or `undefined` |
| `.shifts(from, to?)`    | Returns each valued interval              |

Literal assignments accumulate in the result type. The example returns
`"alice" | "bob" | "carol" | undefined` from `whoIsOn`. Use `rota<string>()`
when values arrive at runtime.

Rota values must be JSON-compatible. This requirement permits safe storage and
excludes `undefined`, `bigint`, functions, class instances, non-finite numbers,
and circular objects.

## Stored forms

Schedules and rotas are façades over explicit cascade data. The `.cascade`
property exposes that data for low-level operations.

```ts
import { resolve } from "@kensio/quando/core";

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

for (const shift of resolve(onCall, week)) {
  console.log(shift.value);
}
```

Each façade has a tagged stored form. Its parser validates the stored data and
restores the methods:

```ts
import { asString, parseRota, parseSchedule } from "@kensio/quando";

const restoredHours = parseSchedule(JSON.parse(JSON.stringify(openingHours)));
const restoredRota = parseRota(JSON.parse(JSON.stringify(onCall)), asString);

restoredHours.isOpen(monday);
restoredRota.whoIsOn(monday);
```

## Plain forms

Schedule and rota methods accept dates such as `"2026-03-11"` and time ranges
such as `"09:00-17:00"`. They also accept full rules.

All authoring functions validate dates, times, equal time endpoints, and zones
when called. Query execution does not defer these errors.

Use the [cascade API](../cascades/) for custom replacement structures and merge
strategies. Use the [rule API](../rules/) for temporal composition.

<!-- card
```ts
const openingHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00")
  .closed(bankHolidays)
  .hoursOn("2026-03-11", "09:00-15:00");
```
-->
