# Constraints

Every other rule answers "is this instant permitted?" from the instant alone.
A constraint answers it from a history.

```ts
import {
  activeAt,
  all,
  atMost,
  explainRule,
  nextCoveredInterval,
  spacedBy,
} from "@kensio/quando";

// At most four in any twenty-four hours, and four hours apart.
const dosing = all(atMost(4, "PT24H"), spacedBy("PT4H"));
```

"At most 4 doses a day, 4 hours apart", "90 days in any rolling 180", "100
requests a minute" and "11 hours between shifts" are all constraints on a
pattern of occurrences. Once the history is known, each of them is an ordinary
set of times, which is why they compose with everything else and every query
works on them unchanged.

## The history goes on the context

```ts
const at = (iso: string): Temporal.ZonedDateTime =>
  Temporal.ZonedDateTime.from(`${iso}[Europe/London]`);

const taken = ["08:00", "12:00", "16:00", "20:00"].map((hour) => ({
  at: at(`2026-03-10T${hour}`),
}));

activeAt(dosing, at("2026-03-10T21:00"), { occurrences: taken }); // false

nextCoveredInterval(dosing, {
  from: at("2026-03-10T20:30"),
  occurrences: taken,
});
// 2026-03-11T08:00:00+00:00[Europe/London]
```

An `Occurrence` is `{ at }` for a moment and `{ at, lasting }` for something
that went on. Spacing measures from the end of one to the start of the next,
so a shift counts from when it finished.

**A history is a plain array, kept well away from the interval algebra.** Two
doses at the same minute are two doses, and a stream would coalesce them into
one. The count is the whole question.

## Leaving the history out is an error

```ts
activeAt(dosing, at("2026-03-10T21:00"));
// MissingOccurrencesError: The "atMost" rule counts what has already
//   happened, and the context carries no `occurrences`. Pass the history as
//   `occurrences` on the context, or `occurrences: []` if nothing has
//   happened yet.
```

Absent and empty mean different things. `occurrences: []` reports an empty
history, so everything is permitted. Leaving the field out says the caller
forgot, and answering that permissively would report a fifth dose as fine
because nobody mentioned the four already taken.

## `atMost` counts, two ways

The argument's shape says which, and the document keeps the two in separate
fields so that every reader of it sees the same thing.

```ts
atMost(4, "days"); // {"type":"atMost","count":4,"per":"days"}
atMost(4, "PT24H"); // {"type":"atMost","count":4,"within":"PT24H"}
```

**`per` counts in calendar buckets** (`"days"`, `"weeks"`, `"months"`,
`"years"`) and starts again at each boundary. Weeks run from Monday. Add
`{ zone }` to say which clock the boundaries fall on.

**`within` counts in a rolling window**, written as an ISO duration. Nothing
resets. The oldest occurrence falls out the far end as time passes, so four
doses ending at eight in the evening allow a fifth at eight the next morning
rather than at midnight.

A full calendar bucket is closed for the whole of itself, including the part
before the occurrences that filled it. A day that is already full stays full
whichever end of it is asked about.

## `spacedBy` separates

```ts
spacedBy("PT4H"); // {"type":"spacedBy","gap":"PT4H"}
```

Read both ways round. An instant four hours before an occurrence is as close
as one four hours after, and exactly four hours is far enough either way.

## It explains itself

```ts
explainRule(dosing, at("2026-03-10T21:00"), {
  occurrences: taken,
}).conditions.map((one) => one.description);
// [
//   "There are already 4 occurrences in the 24 hours up to this instant,
//    which is the most allowed.",
//   "The nearest occurrence is 1 hour away, which is closer than the 4 hours
//    allowed.",
// ]
```

This is why a constraint is a rule the library knows rather than a
[custom rule](../rules/), which could only give its own name back. "Why not
now?" is the question people actually have.

## Composing

A constraint is a rule, so it goes anywhere one goes:

```ts
const shifts = all(weekdays(), atMost(5, "weeks"), spacedBy("PT11H"));
```

`opensNext` says when the next shift may start, `firstOpenSlot` finds a window
long enough, and `validate` reports on the whole thing. None of them needed
anything adding.

## Limits

**A constraint answers the marginal question.** "May I, next, given what has
happened?" Checking a whole proposed plan is a different question, because with
a rolling window each planned day changes whether the next one is allowed. That
wants a separate entry point, still to come.

**One history per query.** A context carries one `occurrences` array. A
document constraining two different series wants two queries, one per series.

**Caps count occurrences.** "90 days in any rolling 180" caps total _duration_
instead, and that wants a rule of its own, still to come.

[`toCron`](../cron/) and [`toRRule`](../recurrence/) both refuse a constraint,
and say why. Each notation describes a pattern on the calendar, and a history
has nowhere to go in one.

<!-- card
```ts
const dosing = all(atMost(4, "PT24H"), spacedBy("PT4H"));
activeAt(dosing, now, { occurrences: taken });
```
-->
