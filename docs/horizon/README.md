# Horizons

Ask most schedule libraries whether you are open on a Tuesday in 2029 and they
answer yes, because it is a Tuesday. Nobody has loaded 2029's holidays.

```ts
import {
  activeAt,
  all,
  dates,
  knownThrough,
  not,
  uncertain,
  weekdays,
} from "@kensio/quando";

const at = (iso: string): Temporal.ZonedDateTime =>
  Temporal.ZonedDateTime.from(`${iso}[Europe/London]`);

const holidays = knownThrough("2026-12-31", dates("2026-12-25"));
const open = all(weekdays(), not(holidays));
```

`knownThrough` says how far a subtree counts as evidence. The named day is
included, the way it is in [`onOrBefore`](../rules/). Inside the horizon
everything answers the way it always did.

```ts
activeAt(open, at("2026-03-09T10:00")); // true
```

Past the horizon a query refuses.

```ts
activeAt(open, at("2029-04-03T10:00"));
// BeyondHorizonError: activeAt() cannot answer for 2029-04-03T10:00:00: the
// rules stop being known before then. Use uncertain() to read where the answer
// runs out, or widen the horizon the rules declare.
```

## The refusal is narrow

A missing holiday cannot open a weekend. A Saturday past the same horizon still
gets an answer.

```ts
activeAt(open, at("2029-04-07T10:00")); // false
```

Quando refuses only where the missing data could have changed what came back.
Every rule carries two bounds through evaluation, the times it certainly covers
and the times it might, and unknown is the gap between them. `all` intersects
both bounds, `any` unions both, and `not` swaps them.

## Reading where the answer runs out

`uncertain` returns the stretches that fall between the two bounds.

```ts
const week = { from: at("2029-04-02T00:00"), to: at("2029-04-09T00:00") };

[...uncertain(open, week)];
// [{ start: 2029-04-02T00:00, end: 2029-04-07T00:00 }]
```

That week runs Monday to Monday, and only the five weekdays come back. The
weekend is settled. For a rule with no horizon anywhere in it, `uncertain` is
always empty.

## A table declares its own horizon

The realistic case lives in the registry. A stored schedule names a holiday
table without knowing how far that table was loaded, and the code holding it
knows exactly.

```ts
const holidayTable: CustomRuleType = {
  intervals: (context) => loadedHolidays(context),
  known: () => "2026-12-31",
};

const schedule = all(weekdays(), not(custom("holidays")));

activeAt(schedule, at("2029-04-03T10:00"), {
  rules: { holidays: holidayTable },
});
// BeyondHorizonError
```

`known` is optional. A rule type without one vouches for all of time, which is
what every rule type did before horizons existed.

## A horizon is not a scope

`onOrBefore("2026-12-31")` makes a subtree cover no time past that date. That
is a confident answer of "no". A horizon says there is no answer at all. The
two are different, and the difference is the whole reason the rule type exists.

## Explanations carry the third state

```ts
const account = explainRule(open, at("2029-04-03T10:00"));

account.known; // false
account.matched; // false
account.description;
// "Whether this matches is not known. The rules stop being known before this
//  time."
```

`known` is `true` for every rule that declares no horizon. Where it is `false`,
read `matched` as an absence of evidence.

## Storage

A horizon is ordinary data. It stores, travels and canonicalises with the rest
of the rule.

```json
{
  "type": "known",
  "through": "2026-12-31",
  "rule": { "type": "dates", "dates": ["2026-12-25"] }
}
```

[`toCron`](../cron/) and [`toRRule`](../recurrence/) both refuse a rule
carrying one, and say why. Each notation states a recurrence as though it held
forever, and writing the rule out would drop the horizon.

## Limits

A cascade assigns values, and unknown inside one means not knowing which value
holds. That is a third state on every span, and it is a larger change than the
one that landed. Every query over a cascade refuses a layer whose scope
declares a horizon, raising `UnknownValueError`. Ask about the rule directly
until that lands.

<!-- card
```ts
const open = all(weekdays(), not(knownThrough("2026-12-31", holidays)));
activeAt(open, tuesdayIn2029); // BeyondHorizonError
```
-->
