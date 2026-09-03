# Explain a result

An explanation says what a schedule, rota, tally, or cascade resolved to, why
its contributing rules applied, and why other rules did not.

## Read a complete explanation

Call `explain` with the same instant you would pass to `isOpen`:

```ts
import { schedule, weekdays } from "@kensio/quando";

const openingHours = schedule()
  .open(weekdays(), "09:00-17:00")
  .closed("2026-12-25");

const christmasMorning = Temporal.ZonedDateTime.from(
  "2026-12-25T10:00[Europe/London]",
);
const explanation = openingHours.explain(christmasMorning);

console.log(explanation.summary);
```

```text
The schedule is closed on 2026-12-25 at 10:00 in Europe/London. Every condition matches. Friday is a weekday. 10:00 falls within the 09:00-17:00 window. This layer makes the schedule open. The date is 2026-12-25. This higher-priority layer changes the schedule from open to closed.
```

Quando produces this text from the rules, their priority, and the instant being
explained. It describes day-of-week, date, time-of-day, zone, set operations,
replacement, and merge behaviour without caller-written text.

`explanation.value` contains the same result as `isOpen`. A schedule always
returns `true` or `false`. An unmatched schedule is closed and its summary
describes why each candidate layer did not apply.

## Add business context

Quando can explain that a date matched. Your application knows that the date is
Christmas Day. Add a `label`, a `comment`, or both when you add the layer:

```ts
const openingHours = schedule()
  .open(weekdays(), "09:00-17:00", {
    label: "Regular office hours",
  })
  .closed("2026-12-25", {
    label: "Christmas Day",
    comment: "The office is closed for the public holiday.",
  });
```

The label and comment appear in `summary` and on the corresponding step. They
are stored in the schedule document and survive `JSON.stringify`, parsing, and
later explanation.

The same final options object works with rota and tally methods:

```ts
import { rota, tally, weekdays } from "@kensio/quando";

const onCall = rota().assign(weekdays(), "alice", {
  label: "Primary support",
  comment: "Alice handles weekday incidents.",
});

const staffing = tally().plus("2026-03-11", 2, {
  label: "Delivery cover",
});
```

For an all-day opening, the options object can take the place of the hours:

```ts
schedule().open(weekdays(), { label: "Twenty-four-hour weekday service" });
```

## Inspect the structured result

Each matching step has its readable `description` and a structured `match`:

```ts
const final = explanation.steps.at(-1);

console.log(final?.description);
// The date is 2026-12-25. This higher-priority layer changes the schedule from open to closed.

console.log(final?.match);
// {
//   matched: true,
//   description: "The date is 2026-12-25.",
//   conditions: [],
//   rule: { type: "dates", dates: ["2026-12-25"] }
// }
```

Compound rules have one nested `condition` for each part. An `any` explanation
shows which alternatives matched. A `not` explanation shows whether the
excluded condition matched. Applications can render these fields in another
language or in a different layout.

Assignment steps also contain `value` and the running `result`. Tally steps say
how much each layer adds and show the running total. Replacement steps contain
the nested explanation and say that lower-priority layers were removed.

`explanation.skipped` accounts for layers that did not contribute. Its `reason`
is `"did-not-match"` when the rule failed or `"replaced"` when a matching
higher-priority replacement removed it. Each skipped layer has the same
automatic rule explanation, label, comment, and diagnostic path as a matching
step.

The `path` field remains available for diagnostics and source mapping. It is not
the user-facing explanation.

## Explain a rule or cascade

The core entry point exposes both levels directly:

```ts
import { cascade, explain, explainRule, layer } from "@kensio/quando/core";

const weekdayMatch = explainRule(weekdays(), christmasMorning);
const onCall = cascade(
  layer(weekdays(), "alice", { label: "Primary support" }),
);
const assignment = explain(onCall, christmasMorning);
```

Standalone cascade explanations use `undefined` when no value is assigned.
They include the effective merge strategy and describe how each matching value
changes the running result.

An explanation evaluates one instant. Use `resolve` for every value in a window
and [validation](../validation/) for inactive or shadowed layers.

<!-- card
```ts
const explanation = openingHours.explain(at);
console.log(explanation.summary);
```
-->
