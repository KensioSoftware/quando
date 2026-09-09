# Serialisation

Quando definitions are JSON-compatible documents. You can store them with
`JSON.stringify`, read them with `JSON.parse`, and pass the result to a Quando
parser.

The parsers accept `unknown`. They validate the complete document and restore
the methods supplied by the builders.

## Rules

Rule builders add `.and`, `.or`, and `.except` as non-enumerable methods.
JSON storage sees the rule fields without seeing those functions.

```ts
import { dates, parseRule, timeOfDayRange, weekdays } from "@kensio/quando";

const openingHours = weekdays()
  .and(timeOfDayRange("09:00", "17:00"))
  .except(dates("2026-12-25"));

const stored = JSON.stringify(openingHours);
const restored = parseRule(JSON.parse(stored));

const withLunchBreak = restored.except(timeOfDayRange("12:30", "13:30"));
```

`parseRule` reports the path to an invalid field:

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

### A custom rule stores its name

A `customRule` rule names a rule type the application implements. The document
holds the name and its options, and the code that runs it arrives on
`context.rules` at query time.

```ts
import { customRule, parseRule } from "@kensio/quando";

const stored = JSON.stringify(customRule("easter", { offset: 1 }));
const restored = parseRule(JSON.parse(stored));

console.log(stored);
```

```text
{"type":"custom","name":"easter","options":{"offset":1}}
```

Parsing checks the shape and stops there. A document naming a rule type this
process has never heard of still parses, which is what lets a service store and
forward a schedule it cannot evaluate. `UnknownCustomRuleError` is raised at
evaluation instead. Options must survive a JSON round trip, and `parseRule`
refuses anything that would not. See [rules](../rules/#supply-your-own-rule-type)
for writing a rule type.

## Schedules

```ts
import { parseSchedule, schedule, weekdays } from "@kensio/quando";

const office = schedule({ zone: "Europe/London" }).open(
  weekdays(),
  "09:00-17:00",
  {
    label: "Regular office hours",
    comment: "Customers can book appointments during these hours.",
  },
);

const stored = JSON.stringify(office);
const restored = parseSchedule(JSON.parse(stored));
```

The parsed schedule retains its zone, methods, labels, and comments. An
explanation after the round trip uses the same caller-written context.

## Rotas

Rota values belong to your application. Pass a value parser to `parseRota` so
Quando can validate them.

```ts
import { parseString, parseRota, rota, weekdays } from "@kensio/quando";

const onCall = rota().assign(weekdays(), "alice");
const stored = JSON.stringify(onCall);
const restored = parseRota(JSON.parse(stored), parseString);
```

`parseString` and `parseBoolean` cover those primitive types. A custom parser
receives the value and its path:

```ts
import { rota, weekdays } from "@kensio/quando";
import { fail, parseRota, type ValueParser } from "@kensio/quando/parsing";

interface Engineer {
  readonly id: string;
}

const asEngineer: ValueParser<Engineer> = (value, path) => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string"
  ) {
    return fail(path, "expected an engineer with a string id.");
  }
  return { id: value.id };
};

const storedRota = JSON.stringify(
  rota<Engineer>().assign(weekdays(), { id: "alice" }),
);
const restored = parseRota(JSON.parse(storedRota), asEngineer);
```

## Tallies

```ts
import { parseTally, tally, weekdays } from "@kensio/quando";

const staff = tally().plus(weekdays(), 3);
const restored = parseTally(JSON.parse(JSON.stringify(staff)));
```

`parseTally` requires finite numbers and a cascade that uses the `sum`
strategy.

## Cascades

Use `parseCascade` for a low-level cascade. Supply a parser for its values.

```ts
import { parseString, parseCascade } from "@kensio/quando/parsing";

const stored: unknown = {
  type: "cascade",
  layers: [
    {
      scope: { type: "daysOfWeek", days: ["monday"] },
      value: "alice",
    },
  ],
};

const onCall = parseCascade(stored, parseString);
```

The parser checks nested replacement cascades and validates values against the
cascade's merge strategy.

## Values that can be stored

`JsonValue` describes the values supported by JSON. `JsonCompatible<T>`
checks an application type without requiring an index signature.

Valid values include strings, finite numbers, booleans, `null`, arrays, and
plain objects. Constructors reject values that JSON would lose or change:

| Value                               | Reason                      |
| ----------------------------------- | --------------------------- |
| `undefined`, functions, and symbols | JSON drops them             |
| `bigint`                            | JSON cannot encode it       |
| `NaN` and infinity                  | JSON changes them to `null` |
| Class instances                     | JSON loses their prototype  |
| Circular objects                    | JSON cannot traverse them   |
| Symbol-keyed properties             | JSON omits them             |
| Non-enumerable properties           | JSON omits them             |

## Changing a stored format

Parsers reject unknown fields. Deploy code that can read a new field before
deploying code that writes it.

Parsers throw `ParseError`, a `TypeError` with `path` and `code` fields.
`code` is `"invalid-value"` or `"unknown-field"`. All parsers take decoded
data: use `parseSchedule(JSON.parse(text))` for JSON text.

Public function renames leave existing JSON tags unchanged. See the
[migration guide](../migration/) for the additive stored forms and API changes.
After parsing a custom rule document, reattach its executable registry with
`restored.withCustomRules(registry)` before querying it.

<!-- card
```ts
const stored = JSON.stringify(openingHours);
const restored = parseSchedule(JSON.parse(stored));
```
-->
