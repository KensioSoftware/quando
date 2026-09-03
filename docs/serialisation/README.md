# Serialisation

Quando documents use JSON-compatible data. Parsers validate stored data and
restore fluent methods.

## Rules

Rule builders attach `.and`, `.or`, and `.except` as non-enumerable methods.
Data operations see the rule fields only. `structuredClone` and JSON storage
therefore work without encountering functions.

```ts
import { dates, parseRule, timeOfDay, weekdays } from "@kensio/quando";

const openingHours = weekdays()
  .and(timeOfDay("09:00", "17:00"))
  .except(dates("2026-12-25"));

const stored = JSON.stringify(openingHours);
const restored = parseRule(JSON.parse(stored));
const withLunch = restored.except(timeOfDay("12:30", "13:30"));
```

`parseRule` checks the complete document before returning it. Errors include
the path to the invalid field:

```ts
parseRule({
  type: "all",
  rules: [
    { type: "daysOfWeek", days: ["mondey"] },
    { type: "timeOfDay", from: "09:00", to: "17:00" },
  ],
});
```

```text
TypeError: rule.rules[0].days[0]: "mondey" is not a day of the week. Expected one of monday, tuesday, wednesday, thursday, friday, saturday, sunday
```

Builders and parsers both validate dates, times, equal time endpoints, and time
zones immediately.

## Schedules

A schedule stores its domain tag, optional zone, and underlying cascade.

```ts
import { parseSchedule, schedule, weekdays } from "@kensio/quando";

const office = schedule({ zone: "Europe/London" }).open(
  weekdays(),
  "09:00-17:00",
);

const restored = parseSchedule(JSON.parse(JSON.stringify(office)));

restored.isOpen(Temporal.ZonedDateTime.from("2026-03-09T10:00[Europe/London]"));
```

`parseSchedule` requires a `schedule` document with override semantics. The
result retains the zone and every schedule method.

## Rotas

Rota values belong to the application. `parseRota` accepts a parser for those
values.

```ts
import { asString, parseRota, rota, weekdays } from "@kensio/quando";

const onCall = rota().assign(weekdays(), "alice");
const restored = parseRota(JSON.parse(JSON.stringify(onCall)), asString);

restored.assign("2026-03-11", "bob");
```

Use `asString` and `asBoolean` for those primitive types. Custom parsers can use
`fail` from `@kensio/quando/parsing` to produce the same path-based errors.

## Tallies

```ts
import { parseTally, tally, weekdays } from "@kensio/quando";

const staff = tally().plus(weekdays(), 3);
const restored = parseTally(JSON.parse(JSON.stringify(staff)));
```

`parseTally` requires finite numeric values and the `sum` strategy.

## Cascades

Low-level cascades use `parseCascade` from the parsing entry point:

```ts
import { resolve } from "@kensio/quando/core";
import { asString, parseCascade } from "@kensio/quando/parsing";

const stored: unknown = {
  type: "cascade",
  layers: [
    {
      scope: { type: "daysOfWeek", days: ["monday"] },
      value: "alice",
    },
  ],
};

const cascade = parseCascade(stored, asString);
```

`parseCascade` checks each value for JSON compatibility. It also checks values
against `sum`, `max`, `min`, and `concat` before resolution starts.

## JSON-compatible values

The exported `JsonValue` type describes stored values. `JsonCompatible<T>`
checks application types without requiring an index signature. Constructors
reject runtime values that JSON cannot preserve.

| Value                           | Result                                       |
| ------------------------------- | -------------------------------------------- |
| `undefined`, functions, symbols | Rejected because JSON drops them             |
| `bigint`                        | Rejected because JSON cannot encode it       |
| `NaN`, `Infinity`               | Rejected because JSON changes them to `null` |
| Class instances                 | Rejected because their prototype is lost     |
| Circular objects                | Rejected because JSON cannot traverse them   |

Plain objects, arrays, strings, finite numbers, booleans, and `null` are valid.

## Schema changes

Parsers reject unknown fields. A misspelt field can otherwise change the
meaning of a schedule without producing an error. Deploy readers before writers
when adding a stored field.

<!-- card
```ts
const restored = parseSchedule(
  JSON.parse(JSON.stringify(openingHours)),
);
restored.isOpen(now);
```
-->
