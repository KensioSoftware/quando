# Explain a result

An explanation shows how a schedule, rota, tally, or cascade reaches its value
at one instant.

## Explain a schedule

Call `explain` with the same instant you would pass to `isOpen`:

```ts
import { schedule, weekdays } from "@kensio/quando";

const openingHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00")
  .closed("2026-12-25");

const christmasMorning = Temporal.ZonedDateTime.from(
  "2026-12-25T10:00[Europe/London]",
);
const explanation = openingHours.explain(christmasMorning);

console.log(explanation.value);
// false

console.log(explanation.steps.map(({ path }) => path));
// ["layers[0]", "layers[1]"]
```

Both layers match Christmas morning. The first opens an ordinary weekday. The
second closes Christmas Day and has higher priority.

`explanation.value` follows the schedule API and is always a boolean. A time
with no matching layer is closed, with an empty `steps` array.

## Read the steps

An assignment step contains the rule that matched and the running result:

```ts
const last = explanation.steps.at(-1);

if (last?.type === "assignment") {
  console.log(last.path);
  // layers[1]

  console.log(last.scope);
  // { type: "dates", dates: ["2026-12-25"] }

  console.log(last.value);
  // false

  console.log(last.result);
  // false
}
```

The `scope` is the rule that made the layer apply. Applications can render the
rule in their own words or associate the stable `path` with a label such as
"Christmas Day".

Steps appear in cascade order. The `result` field shows the value after each
assignment. This matters for tallies and other cascades that merge overlapping
values:

```ts
import { tally, weekdays } from "@kensio/quando";

const staffing = tally().plus(weekdays(), 3).plus("2026-03-11", 2);
const wednesday = Temporal.ZonedDateTime.from(
  "2026-03-11T10:00[Europe/London]",
);
const staffingExplanation = staffing.explain(wednesday);

console.log(staffingExplanation.value);
// 5
```

The two assignment steps have results of `3` and `5`.

## Read replacements

A replacement owns its whole scope. Its step contains an explanation for the
nested cascade:

```ts
const shortened = schedule()
  .open(weekdays(), "09:00-17:00")
  .hoursOn("2026-03-11", "09:00-15:00");

const afterClosing = Temporal.ZonedDateTime.from(
  "2026-03-11T15:30[Europe/London]",
);
const shortenedExplanation = shortened.explain(afterClosing);
const replacement = shortenedExplanation.steps[0];

if (replacement?.type === "replacement") {
  console.log(replacement.path);
  // layers[1]

  console.log(replacement.explanation.steps);
  // []
}
```

The matching replacement removes the lower weekday hours. Its nested
definition assigns nothing after 15:00. The schedule is closed. Lower layers
covered by a matching replacement are absent from the steps because they take
no part in the result.

Nested step paths include the replacement boundary, such as
`layers[1].replace.layers[0]`.

## Explain rotas and tallies

The same method is available on each high-level API:

```ts
const onCall = rota().assign(weekdays(), "alice");
onCall.explain(wednesday).value;
// "alice"

staffing.explain(wednesday).value;
// 5
```

A rota explanation has an `undefined` value when nobody is assigned. A tally
explanation has a value of zero when no line matches. These values agree with
`whoIsOn` and `at`.

## Explain a cascade

The core entry point exports the standalone function:

```ts
import { cascade, explain, layer } from "@kensio/quando/core";

const onCall = cascade(layer(weekdays(), "alice"));
const explanation = explain(onCall, wednesday);
```

Standalone cascade explanations use `undefined` for an unassigned instant.
They also include the cascade's effective `merge` strategy.

An explanation evaluates one instant. Use `resolve` when you need every value
over a window, and use [validation](../validation/) to find inactive or
shadowed layers across a finite period.

<!-- card
```ts
const explanation = openingHours.explain(at);
```
-->
