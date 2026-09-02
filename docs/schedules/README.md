# Schedules and rotas

Use a `Schedule` for opening hours and a `Rota` for assigning values such as
people or prices to times.

Both types extend [cascades](../cascades/). You can pass them directly to
cascade functions such as `resolve` for lower-level operations.

## A schedule

```ts
import { schedule, weekdays } from "@kensio/quando";

const openingHours = schedule()
  .open(weekdays(), "09:00-17:00")
  .closed("2026-03-10")
  .hoursOn("2026-03-11", "09:00-15:00");

console.log(
  openingHours.isOpen(
    Temporal.ZonedDateTime.from("2026-03-09T10:00[Europe/London]"),
  ),
);
console.log(
  openingHours.isOpen(
    Temporal.ZonedDateTime.from("2026-03-10T10:00[Europe/London]"),
  ),
);
console.log(
  openingHours.isOpen(
    Temporal.ZonedDateTime.from("2026-03-11T15:30[Europe/London]"),
  ),
);
```

```text
true
false
false
```

The schedule is open from 09:00 to 17:00 on weekdays. It is closed on 10 March
and closes at 15:00 on 11 March.

Method order sets precedence. Each new line overrides earlier lines within its
scope. The closure on 10 March therefore overrides the weekday opening hours.

`.hoursOn()` replaces the normal hours for its scope. The schedule is closed at
15:30 on 11 March.

## Asking a schedule things

```ts
import { schedule, weekdays } from "@kensio/quando";

const openingHours = schedule().open(weekdays(), "09:00-17:00");

const fridayEvening = Temporal.ZonedDateTime.from(
  "2026-03-13T18:00[Europe/London]",
);
const opening = openingHours.opensNext(fridayEvening);

console.log(opening?.start?.toString());

const week = openingHours.openBetween(
  Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
);
console.log(week.toString());
```

```text
2026-03-16T09:00:00+00:00[Europe/London]
PT40H
```

|                           |                                                  |
| ------------------------- | ------------------------------------------------ |
| `.isOpen(at)`             | whether it is open at that moment                |
| `.opensNext(at, within?)` | the next stretch it is open, or the one it is in |
| `.openBetween(from, to)`  | how long it is open between two moments          |

When the schedule is already open, `opensNext` returns the current opening. The
returned interval starts at the requested time.

A schedule that never opens can search forever. Pass `within` when this is
possible. See [query termination](../queries/#termination).

`within` limits the search for the start of an opening. The returned interval
keeps its full end. A search from 08:00 with a two-hour bound can return the full
09:00 to 17:00 opening. The lower-level [`next`](../queries/#next) query clips
its result to the context window.

## A rota

A rota assigns a value over time. The value might be a person, a tariff, or
another domain value.

```ts
import { rota, weekdays, weekends } from "@kensio/quando";

const onCall = rota()
  .assign(weekdays(), "alice")
  .assign(weekends(), "bob")
  .swap("2026-03-11", "carol");

console.log(
  onCall.whoIsOn(
    Temporal.ZonedDateTime.from("2026-03-09T10:00[Europe/London]"),
  ),
);
console.log(
  onCall.whoIsOn(
    Temporal.ZonedDateTime.from("2026-03-11T10:00[Europe/London]"),
  ),
);

const from = Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]");
const to = Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]");

for (const { start, end, value } of onCall.shifts(from, to)) {
  console.log(
    `${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}: ${value}`,
  );
}
```

```text
alice
carol
2026-03-09T00:00:00 → 2026-03-11T00:00:00: alice
2026-03-11T00:00:00 → 2026-03-12T00:00:00: carol
2026-03-12T00:00:00 → 2026-03-14T00:00:00: alice
2026-03-14T00:00:00 → 2026-03-16T00:00:00: bob
```

|                         |                                                       |
| ----------------------- | ----------------------------------------------------- |
| `.assign(scope, value)` | these times belong to this one                        |
| `.swap(day, value)`     | a swap: this day goes to this one instead             |
| `.whoIsOn(at)`          | who is on at that moment, or `undefined` if nobody is |
| `.shifts(from, to?)`    | each stretch and who has it; endless without a `to`   |

In this example, `whoIsOn` returns
`"alice" | "bob" | "carol" | undefined`. The literal types accumulate as values
are assigned. Use `rota<string>()` when the names are only known at runtime, or
`rota<number>()` for numeric values.

`whoIsOn` returns `undefined` for an unassigned moment. Assign an explicit value
if your domain needs to distinguish an unassigned moment from a value such as
`"nobody"`.

## Schedules and rotas are cascades

A `Schedule` is a `Cascade<boolean>`. A `Rota<V>` is a `Cascade<V>`. Cascade
functions can read both directly:

```ts
import { resolve, schedule, weekdays } from "@kensio/quando";

const openingHours = schedule()
  .open(weekdays(), "09:00-17:00")
  .hoursOn("2026-03-11", "09:00-15:00");

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-12T00:00[Europe/London]"),
};

for (const { start, end, value } of resolve(openingHours, week)) {
  console.log(
    `${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}: ${value}`,
  );
}

console.log(openingHours.type);
console.log(openingHours.layers.length);
```

```text
2026-03-09T09:00:00 → 2026-03-09T17:00:00: true
2026-03-10T09:00:00 → 2026-03-10T17:00:00: true
2026-03-11T09:00:00 → 2026-03-11T15:00:00: true
cascade
2
```

A schedule serialises to the same JSON format as a hand-written cascade.

`JSON.stringify` omits methods. After `JSON.parse`, the value is a plain cascade
without schedule methods such as `.isOpen`:

```ts
import { type Cascade, resolve, schedule, weekdays } from "@kensio/quando";

const openingHours = schedule().open(weekdays(), "09:00-17:00");

const stored = JSON.stringify(openingHours);
const back = JSON.parse(stored) as Cascade<boolean>;

console.log(JSON.stringify(back) === stored);

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-10T00:00[Europe/London]"),
};
for (const { start, end, value } of resolve(back, week)) {
  console.log(
    `${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}: ${value}`,
  );
}

console.log("isOpen" in back);
```

```text
true
2026-03-09T09:00:00 → 2026-03-09T17:00:00: true
false
```

A stored schedule can be parsed and used as a cascade:

- Validate stored data with
  [`parseCascade`](../serialisation/#parse-values-with-parsecascade).
  Pass `asBoolean` for a stored schedule.
- A parsed cascade has no `Schedule` methods. Use cascade functions such as
  `resolve` with the parsed value.

## The plain forms

The string `"09:00-17:00"` represents `timeOfDay("09:00", "17:00")`. The string
`"2026-03-11"` represents `dates("2026-03-11")`. You can pass a full rule in the
same positions. For example, use `timeOfDay("22:00", "06:00")` for a night
shift.

The plain string forms are validated when the method is called:

```ts
import { schedule, weekdays } from "@kensio/quando";

try {
  schedule().open(weekdays(), "9 til 5");
} catch (error) {
  console.log(String(error));
}

try {
  schedule().closed("Christmas");
} catch (error) {
  console.log(String(error));
}
```

```text
RangeError: "9 til 5" is not a range of times: it has 0 dashes rather than one. Expected something like "09:00-17:00".
RangeError: "Christmas" is not a date. Expected something like "2026-03-11", or a rule such as weekdays().
```

The lower-level [`timeOfDay`](../rules/#timeofday) builder checks semantic errors
when the rule is evaluated.

## When to use the lower-level APIs

Use the lower-level APIs for the following cases:

- Nested overrides and values beyond the vocabulary of schedules and rotas. Use
  [`replace`](../cascades/#replace-earlier-layers-within-a-scope) with a
  cascade.
- Rule set operations such as `all`, `any`, `not`, and `.except()`. See
  [rules](../rules/).
- Queries such as `advanceBy`. See [queries](../queries/).

The same schedule or rota value can be passed to cascade functions later.

<!-- card
```ts
const openingHours = schedule()
  .open(weekdays(), "09:00-17:00")
  .closed(bankHolidays)
  .hoursOn("2026-03-11", "09:00-15:00");
```
-->
