---
description: "Declare how far Quando rules are known and detect queries beyond that horizon."
---

# Horizons

A knowledge horizon marks the last date for which a rule has complete data.
Use it when a schedule depends on a holiday list or another dataset that only
covers a limited period.

```ts
import {
  isActiveAt,
  all,
  dates,
  knownThrough,
  not,
  unknownIntervals,
  weekdays,
} from "@kensio/quando";

const at = (iso: string): Temporal.ZonedDateTime =>
  Temporal.ZonedDateTime.from(`${iso}[Europe/London]`);

const holidays = knownThrough("2026-12-31", dates("2026-12-25"));
const open = all(weekdays(), not(holidays));
```

`knownThrough` applies a horizon to the rule it wraps. The named date is
included, as it is in [`onOrBefore`](../rules/). In this example, the holiday
list is complete through 31 December 2026. Queries within that period evaluate
normally.

```ts
isActiveAt(open, at("2026-03-09T10:00")); // true
```

A query throws `BeyondHorizonError` if its answer depends on the holiday list
past that date:

```ts
isActiveAt(open, at("2029-04-03T10:00"));
// BeyondHorizonError: isActiveAt() cannot answer for 2029-04-03T10:00:00: the
// rules stop being known before then. Use unknownIntervals() to read where the answer
// runs out, or widen the horizon the rules declare.
```

<a id="the-refusal-is-narrow"></a>

## Answers that remain known

The schedule requires a weekday. A Saturday is therefore closed even when its
holiday status is unknown:

```ts
isActiveAt(open, at("2029-04-07T10:00")); // false
```

Quando throws only when missing data could change the answer. During
evaluation, it tracks the time a rule certainly covers and the time it might
cover. The difference is unknown coverage. `all` intersects these bounds,
and `any` unions them. For `not`, certain coverage is everything outside the
inner rule's possible coverage. Possible coverage is everything outside its
certain coverage.

<a id="reading-where-the-answer-runs-out"></a>

## Find periods with unknown coverage

`unknownIntervals` returns the periods where the available data cannot
determine whether the rule applies:

```ts
const week = { from: at("2029-04-02T00:00"), to: at("2029-04-09T00:00") };

[...unknownIntervals(open, week)];
// [{ start: 2029-04-02T00:00, end: 2029-04-07T00:00 }]
```

The query window runs from Monday to Monday. Only the five weekdays have
unknown coverage because the weekend is known to be closed. A rule with no
horizons has no unknown intervals.

<a id="a-table-declares-its-own-horizon"></a>

## Declare a horizon on a custom rule

A custom rule can declare the horizon of the dataset it reads. The stored
schedule then refers to the rule by name, while the registry supplies both the
data and its horizon:

```ts
const holidayTable: CustomRuleType = {
  intervals: (context) => loadedHolidays(context),
  knownThrough: () => "2026-12-31",
};

const schedule = all(weekdays(), not(customRule("holidays")));

isActiveAt(schedule, at("2029-04-03T10:00"), {
  rules: { holidays: holidayTable },
});
// BeyondHorizonError
```

The `knownThrough` callback is optional. Without it, Quando treats the custom
rule's answers as known for all dates.

<a id="a-horizon-is-not-a-scope"></a>

## Date bounds and knowledge horizons

`onOrBefore("2026-12-31")` excludes all time after that date. Use it when a
schedule ends on a known date.

`knownThrough("2026-12-31", rule)` leaves later coverage unknown. Use it when
the rule's data ends on that date but the schedule may continue.

<a id="explanations-carry-the-third-state"></a>

## Read unknown status in explanations

```ts
const account = explainRule(open, at("2029-04-03T10:00"));

account.status; // "unknown"
account.description;
// "Whether this matches is not known. The rules stop being known before this
//  time."
```

`status` distinguishes missing knowledge from a known match or rejection.
Read it before presenting an answer.

## Storage

A horizon is part of the rule's JSON data. It is preserved during storage,
parsing, and canonicalisation:

```json
{
  "type": "known",
  "through": "2026-12-31",
  "rule": { "type": "dates", "dates": ["2026-12-25"] }
}
```

[`toCron`](../cron/) and [`toRRule`](../recurrence/) return `ok: false` for a
rule with a knowledge horizon. Neither format can preserve unknown coverage.

## Cascades

A cascade has an unknown result when missing data could change its assigned
value. `unknownValueIntervals` returns those periods. `resolve` omits them
from its output.

```ts
const schedule = {
  type: "cascade",
  layers: [
    { scope: weekdays(), value: "open" },
    { label: "holidays", scope: holidays, value: "closed" },
  ],
};

[...unknownValueIntervals(schedule, week)];
// the whole week: past its horizon the holiday layer might claim any of it

valueAt(schedule, at("2029-04-03T10:00"));
// BeyondHorizonError: valueAt() cannot answer for 2029-04-03T10:00:00 …
```

The whole week has unknown values, including the weekend. The holiday layer
has the highest priority. Beyond its horizon, it might assign `"closed"` on
any date, including a Saturday that would otherwise have no assigned value.

<a id="a-layer-that-could-not-have-changed-the-answer"></a>

### Higher-priority layers can determine the answer

Reverse the layer order to give the known weekday layer higher priority:

```ts
const schedule = {
  type: "cascade",
  layers: [
    { label: "holidays", scope: holidays, value: "closed" },
    { scope: weekdays(), value: "open" },
  ],
};

[...resolve(schedule, week)];
// [{ start: Mon, end: Sat, value: "open" }]

[...unknownValueIntervals(schedule, week)];
// [{ start: Sat, end: Mon }]

valueAt(schedule, at("2029-04-03T10:00")); // "open"
```

Weekday values are now known because the later weekday layer overrides any
value from the holiday layer. Weekend values remain unknown because only the
holiday layer could assign them.

<a id="merges-that-add-contributions-up"></a>

### Unknown contributions in merged cascades

The `sum`, `max`, `min`, and `concat` strategies use contributions from every
matching layer. An unknown contribution makes the merged result unknown:

```ts
const headcount = {
  type: "cascade",
  merge: "sum",
  layers: [
    { scope: always(), value: 1 },
    { scope: knownThrough("2026-12-31", always()), value: 1 },
  ],
};

[...resolve(headcount, week)]; // nothing settled past the horizon
```

<!-- card
```ts
const open = all(weekdays(), not(knownThrough("2026-12-31", holidays)));
isActiveAt(open, tuesdayIn2029); // BeyondHorizonError
```
-->
