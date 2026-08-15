# Serialisation

A rule is a JSON document. Not a document it can be exported to — one it _is_,
from the moment you build it. That is what makes storing a rule in a database,
sending it over an API, keeping it in a config file, or letting someone edit it
in a form cost nothing at all.

Quando reads and writes no storage. It gives you a rule from JSON and JSON from
a rule, and everything in between is yours.

## The builder is the document

`weekdays().and(timeOfDay("09:00", "17:00"))` is an ordinary rule object with
three methods hanging off it. `JSON.stringify` omits function-valued properties,
so what comes out is exactly the document a hand-written rule would be — no
`.build()` step, nothing to unwrap, and no builder type to convert out of:

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

Two things are worth reading off that. `.except(…)` really is
`all(this, not(any(…)))`, spelled out — the nesting is the method's definition
rather than an artefact. And an `all` has landed inside an `all`, which is
harmless and means what it says; there is no canonical form yet, so a document
is not a fingerprint you can compare two rules by.

## `parseRule` is the boundary

What comes back from storage is not a `Rule`, it is whatever a database row, an
API body or a form actually held. `parseRule` is the one place that turns the
second into the first:

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

`parseRule` takes `unknown` and returns `Rule`, which is the shape a validating
boundary should have: everything downstream of it can be written against a type
that is known to hold, and nothing downstream has to check again.

What comes back is a plain rule, without the builder's methods — they are added
by the builder functions, and JSON has no way to carry them. Compose a parsed
rule with `all`, `any` and `not` instead:

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

A rule survives the round trip intact, which is the property everything else
here depends on.

## Bad documents fail loudly, and say where

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

Every message carries a path, so a rule nested six deep reports as
`rule.rules[2].rules[0].days[3]` rather than as a puzzle. Pass your own root
name as the second argument if `rule` is not what you call it.

## Why an unknown field is an error

The first of those is the one that matters. `zonee` could have been dropped
quietly, and the document would have parsed as a perfectly valid rule with _no_
zone — which is a different schedule, read in whatever zone the query happened
to use, with nothing said about it. A field exists to change what a rule means,
so ignoring one you do not recognise is agreeing to get the answer wrong
quietly.

The cost is real and taken deliberately: a document written by a _later_ version
of Quando, carrying a field this one has not heard of, is rejected rather than
tolerated. That is the right way round for a library whose whole job is being
precise about time, but it does mean rolling a schema forward needs the readers
updated before the writers.

## What parsing does not check

Shape and vocabulary only: is it an object, is the type one that exists, are
those really days of the week, does that parse as a time, is that a zone the
runtime knows.

What a rule _means_ is checked when it is evaluated. A `timeOfDay` whose ends
are equal parses happily and throws when read, and that is on purpose — saying
it in both places would give the two places somewhere to disagree, and the
parser is not the thing that knows what a rule does.

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
