---
description: "Render Quando schedules and time-based values as text timelines."
---

# Timelines

Use a timeline to inspect a schedule's coverage day by day.
`timeline(source, window)` returns JSON-compatible data. `renderTimeline(data)`
formats that data as text without evaluating the rules again.

## Evaluate and render

<!-- example: timeline -->

```ts
import { renderTimeline, schedule } from "@kensio/quando";

const office = schedule({ zone: "Europe/London" }).open(
  "mon-fri",
  "09:00-17:00",
);
const from = Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]");
const to = from.add({ days: 1 });
const data = office.timeline(from, to);

console.log(data.days[0]?.date);
// 2026-03-09
renderTimeline(data);
```

Both endpoints are required. The window includes `from` and excludes `to`.
A schedule groups days in its configured zone. The standalone query uses the
zone of `window.from`.

Each `TimelineDay` contains its date and covered intervals. Its `start` and
`end` describe the full local day. Its `visibleStart` and `visibleEnd` are
clipped to the requested window.

Timestamps are strings. A day with no covered intervals is closed. A local day
can span 23 or 25 elapsed hours when the clocks change.

## Select an assignment

```ts
import { assigned, rota, timeline } from "@kensio/quando";

const onCall = rota().assign("mon-fri", "alice");
const data = timeline(assigned(onCall, "alice"), { from, to });
```

Use `whereValueMatches` to select object values by a field. The selection
preserves an attached custom-rule registry. Timeline evaluation throws
`BeyondHorizonError` if coverage is unknown.

The [CLI](../cli/) exposes the same operation as `quando timeline` with
`--format json` or `--format text`.

<!-- card
```ts
const data = office.timeline(from, to);
console.log(renderTimeline(data));
```
-->
