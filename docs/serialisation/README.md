# Serialisation

A rule is a JSON-compatible object. You can store it in a database, send it
through an API, or keep it in a configuration file.

Quando builds and parses rule data. Your application is responsible for storage
and transport.

## The builder is the document

Builder functions return ordinary rule objects with `.and`, `.or`, and
`.except` methods. `JSON.stringify` omits these methods and returns the rule
data. No `.build()` call or conversion is needed:

```ts
import { dates, timeOfDay, weekdays } from "@kensio/quando";

const openingHours = weekdays()
  .and(timeOfDay("09:00", "17:00"))
  .except(dates("2026-12-25"));

console.log(JSON.stringify(openingHours, null, 2));
```

```text
{
  "type": "all",
  "rules": [
    {
      "type": "all",
      "rules": [
        {
          "type": "daysOfWeek",
          "days": [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday"
          ]
        },
        {
          "type": "timeOfDay",
          "from": "09:00",
          "to": "17:00"
        }
      ]
    },
    {
      "type": "not",
      "rule": {
        "type": "any",
        "rules": [
          {
            "type": "dates",
            "dates": [
              "2026-12-25"
            ]
          }
        ]
      }
    }
  ]
}
```

`.except()` creates `all(this, not(any(...)))`. The resulting JSON can contain
nested `all` rules. Use [`canonical`](../comparing/) before comparing rules or
creating a cache key.

## `parseRule` is the boundary

Treat data from storage, APIs, and forms as `unknown`. Pass it to `parseRule` to
validate it and return a `Rule`:

```ts
import { activeAt, parseRule } from "@kensio/quando";

const stored = `{
  "type": "all",
  "rules": [
    { "type": "daysOfWeek", "days": ["saturday", "sunday"] },
    { "type": "timeOfDay", "from": "10:00", "to": "16:00" }
  ]
}`;

const rule = parseRule(JSON.parse(stored));
const sunday = Temporal.ZonedDateTime.from("2026-03-15T11:00[Europe/London]");

console.log(rule.type);
console.log(activeAt(rule, sunday));
```

```text
all
true
```

After `parseRule` succeeds, downstream code can use the value as a `Rule`.

`parseRule` returns a plain rule without builder methods. Combine parsed rules
with the `all`, `any`, and `not` functions:

```ts
import { all, not, parseRule, timeOfDay } from "@kensio/quando";

const stored: unknown = {
  type: "daysOfWeek",
  days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
};

const openDays = parseRule(stored);
const openingHours = all(
  openDays,
  timeOfDay("09:00", "17:00"),
  not(timeOfDay("12:30", "13:30")),
);

const roundTripped = parseRule(JSON.parse(JSON.stringify(openingHours)));

console.log(JSON.stringify(roundTripped) === JSON.stringify(openingHours));
```

```text
true
```

The parsed rule contains the same data as the serialised rule.

## Parse values with `parseCascade`

[Schedules and rotas](../schedules/) are [cascades](../cascades/). Cascades are
also JSON-compatible objects:

```ts
import { daysOfWeek, rota } from "@kensio/quando";

const onCall = rota()
  .assign(daysOfWeek("monday", "tuesday"), "alice")
  .swap("2026-03-10", "carol");

console.log(JSON.stringify(onCall, null, 2));
```

```text
{
  "type": "cascade",
  "layers": [
    {
      "scope": {
        "type": "daysOfWeek",
        "days": [
          "monday",
          "tuesday"
        ]
      },
      "value": "alice"
    },
    {
      "scope": {
        "type": "dates",
        "dates": [
          "2026-03-10"
        ]
      },
      "value": "carol"
    }
  ]
}
```

Quando can validate every rule type itself. Cascade values belong to your
application, so `parseCascade` takes a value parser as its second argument:

```ts
import { asString, parseCascade, resolve } from "@kensio/quando";

const stored = `{
  "type": "cascade",
  "layers": [
    { "scope": { "type": "daysOfWeek", "days": ["monday", "tuesday"] },
      "value": "alice" },
    { "scope": { "type": "dates", "dates": ["2026-03-10"] },
      "value": "carol" }
  ]
}`;

const onCall = parseCascade(JSON.parse(stored), asString);

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-12T00:00[Europe/London]"),
};

for (const shift of resolve(onCall, week)) {
  console.log(`${shift.start?.toPlainDate()} ${shift.value}`);
}
```

```text
2026-03-09 alice
2026-03-10 carol
```

Use `asString` for string values and `asBoolean` for boolean values. Write a
custom parser for other value types. The `fail` helper throws a consistent
`TypeError`:

```ts
import { fail } from "@kensio/quando";

const asHeadcount = (value: unknown, path: string): number =>
  typeof value === "number" && Number.isInteger(value)
    ? value
    : fail(path, `expected a whole number of staff, found ${typeof value}`);
```

`parseCascade` returns a plain `Cascade` without methods such as `.assign` or
`.whoIsOn`. Pass the result to cascade functions such as `resolve`.

A layer must contain exactly one of `value` or `replace`. A layer created with
an undefined value loses its `value` field during `JSON.stringify` and fails
when parsed.

## Parsing errors include a path

```ts
import { parseRule } from "@kensio/quando";

const documents: unknown[] = [
  { type: "daysOfWeek", days: ["monday"], zonee: "Europe/London" },
  { type: "weekdays" },
  { type: "daysOfWeek", days: ["mondey"] },
  { type: "timeOfDay", from: "09:00", to: "half five" },
  { type: "daysOfWeek", days: ["monday"], zone: "Europe/Lundon" },
  { type: "all", rules: [{ type: "always" }, { type: "not", rule: 42 }] },
];

for (const document of documents) {
  try {
    parseRule(document);
  } catch (error) {
    console.log(String(error));
  }
}
```

```text
TypeError: rule.zonee: is not a field of a daysOfWeek rule. Expected days, zone
TypeError: rule.type: "weekdays" is not a rule type. Expected one of always, never, daysOfWeek, timeOfDay, dates, all, any, not
TypeError: rule.days[0]: "mondey" is not a day of the week. Expected one of monday, tuesday, wednesday, thursday, friday, saturday, sunday
TypeError: rule.to: "half five" is not a time of day. Expected something like "09:00"
TypeError: rule.zone: "Europe/Lundon" is not a known time zone
TypeError: rule.rules[1].rule: expected a rule object, found number
```

Every error includes the path to the invalid value. Pass a custom root name as
the second argument when `"rule"` does not match your input name.

`parseCascade` reports paths through layers and their scope rules:

```ts
import { asString, parseCascade } from "@kensio/quando";

const documents: unknown[] = [
  { type: "daysOfWeek", days: ["monday"] },
  { type: "cascade", layers: [{ scope: { type: "always" }, valeu: "alice" }] },
  { type: "cascade", layers: [{ scope: { type: "always" } }] },
  { type: "cascade", layers: [{ scope: { type: "always" }, value: 42 }] },
  { type: "cascade", layers: [{ scope: { type: "weekdays" }, value: "a" }] },
];

for (const document of documents) {
  try {
    parseCascade(document, asString);
  } catch (error) {
    console.log(String(error));
  }
}
```

```text
TypeError: cascade.type: expected "cascade", found "daysOfWeek"
TypeError: cascade.layers[0].valeu: is not a field of a layer. Expected scope, value, replace
TypeError: cascade.layers[0]: has neither a value nor a replace, so nothing holds inside its scope. A layer built with `undefined` as its value arrives this way, because `JSON.stringify` drops the field rather than writing it
TypeError: cascade.layers[0].value: expected a string, found number
TypeError: cascade.layers[0].scope.type: "weekdays" is not a rule type. Expected one of always, never, daysOfWeek, timeOfDay, dates, all, any, not
```

The first error shows what happens when a rule is passed where a cascade is
expected.

## Unknown fields are rejected

An unknown field may be a typing mistake. If `zonee` were ignored, the rule
would use the context zone and could produce the wrong schedule. `parseRule`
therefore rejects unknown fields.

This also means an older Quando version rejects documents that contain fields
introduced by a newer version. Update readers before writers when changing a
stored rule schema.

## Evaluation checks rule meaning

Parsing checks object shapes, rule types, field names, weekdays, date and time
syntax, and zone names.

Evaluation checks semantic conditions. For example, `parseRule` accepts a
`timeOfDay` rule with equal endpoints, but evaluating that rule throws a
`RangeError`.

```ts
import { parseRule } from "@kensio/quando";

console.log(
  JSON.stringify(parseRule({ type: "timeOfDay", from: "09:00", to: "09:00" })),
);
```

```text
{"type":"timeOfDay","from":"09:00","to":"09:00"}
```

See [rules](../rules/#timeofday) for what happens when that one is evaluated.

<!-- card
```json
{ "type": "all", "rules": [
  { "type": "daysOfWeek", "days": ["monday", "tuesday"] },
  { "type": "timeOfDay", "from": "09:00", "to": "17:00" }
]}
```
-->
