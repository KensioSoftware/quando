# Timelines

Timelines describe covered time as JSON-compatible local calendar days. A text
format is available for logs, terminals, and test output.

## Get timeline data

`Schedule.renderTimeline` takes a finite window and returns a `Timeline` object.
Every date-time in the result is a string, so the object can pass through
`JSON.stringify` without conversion.

```ts
import { schedule, weekdays } from "@kensio/quando";

const office = schedule({ zone: "Europe/London" }).open(
  weekdays(),
  "09:00-17:00",
);
const from = Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]");
const to = Temporal.ZonedDateTime.from("2026-03-10T00:00[Europe/London]");

const timeline = office.renderTimeline(from, to);
console.log(JSON.stringify(timeline, null, 2));
```

```json
{
  "type": "timeline",
  "zone": "Europe/London",
  "from": "2026-03-09T00:00:00+00:00[Europe/London]",
  "to": "2026-03-10T00:00:00+00:00[Europe/London]",
  "days": [
    {
      "date": "2026-03-09",
      "start": "2026-03-09T00:00:00+00:00[Europe/London]",
      "end": "2026-03-10T00:00:00+00:00[Europe/London]",
      "visibleStart": "2026-03-09T00:00:00+00:00[Europe/London]",
      "visibleEnd": "2026-03-10T00:00:00+00:00[Europe/London]",
      "covered": [
        {
          "start": "2026-03-09T09:00:00+00:00[Europe/London]",
          "end": "2026-03-09T17:00:00+00:00[Europe/London]"
        }
      ]
    }
  ]
}
```

`start` and `end` are the boundaries of the local day. `visibleStart` and
`visibleEnd` clip that day to the requested window. `covered` contains the
exact covered spans inside the visible part.

A schedule with a `zone` uses that zone for every date and date-time. A
schedule without one uses the zone from `from`.

## Render the data as text

Pass `{ format: "text" }` for the built-in text view:

```ts
console.log(office.renderTimeline(from, to, { format: "text" }));
```

```text
Time zone: Europe/London
                00:00       06:00       12:00       18:00       24:00
Mon 2026-03-09 |..................################..............| 09:00-17:00
# covered  + partly covered  . uncovered
```

Each chart cell represents thirty minutes. `+` marks a cell that is covered for
part of that period. The times on the right remain exact. The text renderer
uses the same `Timeline` object returned by the default format.

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
data.

<!-- card
```ts
const timeline = office.renderTimeline(from, to);
```
-->
