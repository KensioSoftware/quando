# Concepts

Quando answers one question: **given these rules about time, when does something
happen?**

That is a different question from the one a date library answers. `Temporal`
tells you what a moment _is_ — what day it falls on, what it looks like in
Tokyo, how far it is from another moment. Quando tells you _when something
occurs_, given rules like "weekdays, nine to five, except bank holidays, and we
close early on the fourteenth".

This page describes the model. Quando is still in design, so treat the code here
as illustration rather than as an API you can call today.

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

```
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
a union. "Not during the shutdown" is a complement.

## Layers, for exceptions

Set operations are not enough, and the gap shows up the moment you have a real
schedule.

Consider: weekdays nine to five, but on the fourteenth we close at three. That
is not an intersection, a union, or a complement of the base rule — not unless
you work out for yourself that the difference is the two hours between three and
five, and write _that_. Which means you have to know the base hours in order to
express the exception, and change the exception whenever the base changes.

What you actually mean is: _on the fourteenth, ignore the usual hours and use
these instead._ So rules stack in **layers**, like the rules in a stylesheet.
Each layer says where it applies and what applies there, and the last layer to
claim a moment wins:

```
  1. weekdays 09:00–17:00        ← the usual hours
  2. bank holidays: closed        ← an exception
  3. the 14th: 09:00–15:00        ← an override, wins inside its own day
```

Layers are ordered, and the order is part of the meaning. What a layer applies
can itself be a rule, which is what makes the third line above possible: it
replaces the day's hours rather than punching a hole in them.

## Layers can carry values

A schedule is a special case. Once layers can carry a value, the same machinery
answers questions that are not yes-or-no:

- who is on call this week
- what the electricity tariff is at three in the morning
- how many staff are rostered

A plain schedule is the case where the value is simply _open_ or _closed_.

## Rules are data

A rule is a JSON document. That means you can store rules in a database, ship
them over an API, keep them in a config file, or let people edit them in a form —
and Quando has no opinion about which.

Quando does not read or write storage. It parses rules from JSON, and serialises
them back, and everything in between is your concern.

## What Quando does not do

It does not fire anything. Quando calculates _when_; it never acts. There are no
timers and no event loop. If something needs to happen at the time Quando
calculates, that is your scheduler's job, and Quando's answer is its input.

It is also not a date library. `Temporal` is, and Quando is built on it rather
than replacing it. Times that go in and come out are `Temporal` values.

<!-- card
```json
[
  { "scope": "weekdays 09:00-17:00", "value": "open" },
  { "scope": "holidays:gb",          "value": "closed" },
  { "scope": "2026-03-14",           "value": "09:00-15:00" }
]
```
-->
