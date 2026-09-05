# Validate rules and schedules

Semantic validation finds inactive rules, inactive layers, shadowed layers, and
unassigned time inside a finite window.

Builders and parsers already reject malformed data. This validation evaluates
valid definitions and finds problems in what they mean over time.

## Validate a schedule

Call `validate` on a schedule with a representative window:

```ts
import { schedule, weekdays } from "@kensio/quando";

const openingHours = schedule()
  .open(weekdays(), "09:00-17:00")
  .open(weekdays(), "10:00-16:00");

const from = Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]");
const to = Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]");

const diagnostics = openingHours.validate(from, to);
```

The second `open` call has higher priority and hides part of the first. The
first layer still supplies 09:00 to 10:00 and 16:00 to 17:00, so both layers
remain active. A later layer covering the whole weekday would make the first
one `shadowed-layer`.

A schedule expects closed time. Schedule validation checks its layers. Closed
intervals are valid schedule output.

Tallies use the same validation behaviour. Their unassigned time already reads
as zero. Tally validation checks layers without requiring full coverage.

## Find gaps in a rota

A rota expects somebody to be assigned throughout its validation window. Its
`validate` method reports every unassigned interval:

```ts
import { rota, weekdays } from "@kensio/quando";

const onCall = rota().assign(weekdays(), "alice");
const diagnostics = onCall.validate(from, to);
```

This rota returns one `uncovered-time` diagnostic for the weekend.

## Validate a rule or cascade

The standalone `validate` function accepts a rule, cascade, schedule, rota, or
tally:

```ts
import { validate, weekdays, weekends } from "@kensio/quando";

const impossibleThisWeek = weekdays().and(weekends());
const diagnostics = validate(impossibleThisWeek, { from, to });
```

Pass `requireFullCoverage` when every instant must have a cascade value:

```ts
const diagnostics = validate(
  onCall,
  { from, to },
  {
    requireFullCoverage: true,
  },
);
```

Rota validation enables this option for you.

## Read diagnostics

Every diagnostic has a stable `code` and a human-readable `message`.

| Code             | Extra data | Meaning                                          |
| ---------------- | ---------- | ------------------------------------------------ |
| `inactive-rule`  |            | The rule covers no time in the window            |
| `inactive-layer` | `path`     | The layer covers no time in its effective region |
| `shadowed-layer` | `path`     | Higher-priority layers fully hide the layer      |
| `uncovered-time` | `interval` | No cascade value is assigned during the interval |

Layer paths are relative to the cascade document, such as `layers[0]` or
`layers[2].replace.layers[0]` for a child of a replacement.

Validation descends into replacements within the part of their scope that
remains visible. A child that covers no time in that region is `inactive-layer`.
A child hidden by later layers inside its cascade is `shadowed-layer`.
Each nested cascade uses its own merge strategy.

An inactive or fully shadowed replacement gets one diagnostic. Validation skips
its descendants. A partially visible replacement has its children checked across
all surviving intervals together.

## Choose the validation window

Diagnostics describe the supplied window. An annual exception is inactive when
its date falls outside the selected week. Include the definition's normal cycle
and its dated exceptions when you need a complete report.

Validation requires `to`. A finite window lets Quando prove that a rule or
layer produces no intervals. An inactive diagnostic applies only to that
window. The same rule may match a future date.

Layer reachability includes nested replacement cascades. Override layers
hide lower layers according to their order. Overlapping layers in `sum`, `max`,
`min`, and `concat` cascades remain active because they participate in merging.
Cascade order gives every layer a distinct priority.

<!-- card
```ts
const diagnostics = onCall.validate(from, to);
```
-->
