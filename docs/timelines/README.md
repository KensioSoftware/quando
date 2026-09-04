# Timelines

Timelines draw covered time as local calendar days. Use them to inspect a rule,
show opening hours in logs, or include a schedule chart in a web page.

## Render a schedule as text

`Schedule.renderTimeline` takes the finite window to draw. Its default output is
plain text.

```ts
import { schedule, weekdays } from "@kensio/quando";

const office = schedule({ zone: "Europe/London" }).open(
  weekdays(),
  "09:00-17:00",
);
const from = Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]");
const to = Temporal.ZonedDateTime.from("2026-03-11T00:00[Europe/London]");

console.log(office.renderTimeline(from, to));
```

```text
Time zone: Europe/London
                00:00       06:00       12:00       18:00       24:00
Mon 2026-03-09 |..................################..............| 09:00-17:00
Tue 2026-03-10 |..................################..............| 09:00-17:00
# covered  + partly covered  . uncovered
```

Each chart cell represents thirty minutes. `+` marks a cell that is covered for
only part of that period. The times on the right remain exact.

A schedule with a `zone` renders its local dates and times in that zone. A
schedule without one uses the zone from `from`.

## Render SVG

Pass `{ format: "svg" }` to get a standalone SVG string with a title,
description, exact interval labels, and scalable day rows.

```ts
const svg = office.renderTimeline(from, to, { format: "svg" });
```

Write the string to a file, place it in an HTML response, or pass it to a UI
component that accepts SVG markup.

## Render rules and selected values

The standalone function accepts any `Covers` value. This includes rules,
boolean cascades, schedules, and one value selected from a rota.

```ts
import { assigned, renderTimeline, rota, weekdays } from "@kensio/quando/core";

const onCall = rota().assign(weekdays(), "alice").assign("2026-03-10", "bob");
const from = Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]");
const to = Temporal.ZonedDateTime.from("2026-03-11T00:00[Europe/London]");

const aliceTimeline = renderTimeline(assigned(onCall, "alice"), { from, to });
```

Rendering requires `to`. An open-ended timeline would have no finite amount of
output.

<!-- card
```ts
console.log(office.renderTimeline(from, to));
```
-->
