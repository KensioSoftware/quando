# Concepts

Quando answers one question: **given these rules about time, when does something
happen?**

That is a different question from the one a date library answers. `Temporal`
tells you what a moment _is_ — what day it falls on, what it looks like in
Tokyo, how far it is from another moment. Quando tells you _when something
occurs_, given rules like "weekdays, nine to five, except bank holidays, and we
close early on the eleventh".

This page is the model rather than the API. [Rules](../rules/) and
[queries](../queries/) are the API, and [getting started](../getting-started/)
is the shortest way into it. Read this one when you want to know why any of that
is shaped the way it is.

## A rule produces intervals, not answers

The obvious way to model "is the warehouse open?" is a function from a moment to
a yes or no. It is also the wrong way, and the reason is worth understanding
because everything else follows from it.

A function that can only be asked about one instant can only be _sampled_. Ask
it how much working time falls between Friday afternoon and Tuesday morning and
there is nothing it can do but step forward in small increments, testing as it
goes. Every derived question — how long until the next opening, what is three
working days from now, when is the next cut-off — becomes the same loop.

That has consequences you feel as a user. The step size becomes a setting you
have to choose, trading correctness against speed: too coarse and a half past
nine opening does not exist, too fine and a year takes half a million tests.
Answers land on the wrong side of boundaries. A rule that can never be satisfied
does not report a problem, it simply never finishes.

So a Quando rule does not answer about an instant. It produces the **intervals**
over which it holds:

```text
weekdays 09:00–17:00, for the week of 2026-03-09:

  Mon ▓▓▓▓▓▓▓▓        Tue ▓▓▓▓▓▓▓▓        Wed ▓▓▓▓▓▓▓▓
  Thu ▓▓▓▓▓▓▓▓        Fri ▓▓▓▓▓▓▓▓        Sat                 Sun
```

Now the derived questions stop being loops and start being arithmetic. Working
time between two moments is the total length of the intervals between them.
Three working days from now is a walk along the intervals until the budget runs
out. The next opening is the next interval. A rule that can never be satisfied
produces nothing, which is an answer rather than a hang.

There is no step size, because nothing is being sampled. Intervals are half
open — they include their start and exclude their end — so a day that ends at
17:00 and one that begins at 17:00 do not overlap and nothing falls in a crack.

## Rules combine

Rules compose with the operations you would expect, and because a rule is a set
of intervals, these really are set operations:

|       |                                             |
| ----- | ------------------------------------------- |
| `all` | intersection — every rule must hold         |
| `any` | union — at least one must hold              |
| `not` | complement — the times a rule does not hold |

"Weekdays and nine to five" is an intersection. "Saturdays or bank holidays" is
a union. "Not during the shutdown" is a complement. Those three, plus the rules
that select time in the first place, are the whole language — see
[rules](../rules/).

## Overrides, and where the set operations strain

Set operations express a great deal, and exceptions are the shape you reach for
most: opening hours _except_ holidays is `all(hours, not(holidays))`, common
enough that `.except(…)` exists for it.

The strain shows with an override rather than an exception. Consider: weekdays
nine to five, but on the eleventh we close at three. Said as sets, you have to
carve the day out of the base rule and add it back with different hours:

```ts
import { dates, intervals, timeOfDay, weekdays } from "@kensio/quando";

const closesEarly = dates("2026-03-11");

const openingHours = weekdays()
  .and(timeOfDay("09:00", "17:00"))
  .except(closesEarly)
  .or(closesEarly.and(timeOfDay("09:00", "15:00")));

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-14T00:00[Europe/London]"),
};

for (const { start, end } of intervals(openingHours, week)) {
  console.log(`${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}`);
}
```

```text
2026-03-09T09:00:00 → 2026-03-09T17:00:00
2026-03-10T09:00:00 → 2026-03-10T17:00:00
2026-03-11T09:00:00 → 2026-03-11T15:00:00
2026-03-12T09:00:00 → 2026-03-12T17:00:00
2026-03-13T09:00:00 → 2026-03-13T17:00:00
```

That is the right answer, and it names the eleventh twice — once to remove it,
once to put it back. What you meant was simpler: _on the eleventh, ignore the
usual hours and use these instead._

## Layers, which are the answer to that

The answer is **layers**, ordered like the rules in a stylesheet: each says
where it applies and what applies there, and the last one to claim a moment
wins.

```text
  1. weekdays 09:00–17:00         ← the usual hours
  2. bank holidays: closed        ← an exception
  3. the 11th: 09:00–15:00        ← an override, wins inside its own day
```

Because a layer carries a value rather than merely open or closed, the same
machinery answers questions that are not yes-or-no — who is on call this week,
what the electricity tariff is at three in the morning, how many staff are
rostered — with a plain schedule being the case where the value is _open_.

This is what a [cascade](../cascades/) is, and it is why rules deliberately have
no value of their own: a rule that carried one would make `not` meaningless, and
the set algebra with it. Values belong to assignment, which is a separate
concept sitting on top of the same intervals.

What overlap means is still only half answered. A cascade settles it by
precedence, which is what a rota and a schedule need. Quantities that should
_add_ rather than displace — three staff plus two — need a merge function, and
that is the open question.

## Rules are data

A rule is a JSON document. That means you can store rules in a database, ship
them over an API, keep them in a config file, or let people edit them in a form —
and Quando has no opinion about which.

Quando does not read or write storage. It parses rules from JSON, and serialises
them back, and everything in between is your concern. See
[serialisation](../serialisation/), where the useful detail is that the builder
produces the document rather than something that has to be converted into one.

## What a rule cannot say

Everything above answers one shape of question: **is this moment permitted?**
A rule is a set of times, and every query reads that set.

A whole category of real rule sits outside it. These constrain a _pattern of
occurrences_ rather than the individual moments in one:

- At most four doses a day, at least four hours apart.
- Ninety days in any rolling period of a hundred and eighty.
- Nine hours of driving a day, with a break after four and a half.
- A hundred requests a minute.

Caps per window, minimum spacing and rolling-window totals are constraint
satisfaction over a schedule, which is a different problem from an interval
set. The last kind also needs _history_ as an input, and nothing else in the
design does. Quando has no answer for any of them today, and saying which
library to reach for is more use than a partial one.

A related gap is worth naming for the same reason. Ask Quando whether a shop is
open on a Tuesday in 2029 and it says yes, because it is a Tuesday, even where
nobody has loaded that year's holidays. A rule set that declared how far ahead
it is valid, and answered _unknown_ past that, would be a better answer for
forward planning. It changes the return type of every query, so it is a
question for a later major version rather than a patch.

## What Quando does not do

It does not fire anything. Quando calculates _when_; it never acts. There are no
timers and no event loop. If something needs to happen at the time Quando
calculates, that is your scheduler's job, and Quando's answer is its input.

It is also not a date library. `Temporal` is, and Quando is built on it rather
than replacing it. Times that go in and come out are `Temporal` values.

<!-- card
```ts
const openingHours = weekdays()
  .and(timeOfDay("09:00", "17:00"))
  .except(closesEarly)
  .or(closesEarly.and(timeOfDay("09:00", "15:00")));
```
-->
