# Schedules and rotas

Two ways of saying the common things in the words they are usually said in: a
`schedule` for when something is open, and a `rota` for who or what holds when.

Both are [cascades](../cascades/) underneath, and that is not an implementation
detail you are being asked to ignore — it is the escape hatch. Anything these
cannot say, the cascade underneath can, and getting to it means calling a
different function on the same object rather than starting again.

## A schedule

```ts
import { schedule, weekdays } from "@kensio/quando";

const openingHours = schedule()
  .open(weekdays(), "09:00-17:00")
  .closed("2026-03-10")
  .hoursOn("2026-03-11", "09:00-15:00");

console.log(
  openingHours.isOpen(
    Temporal.ZonedDateTime.from("2026-03-09T10:00[Europe/London]"),
  ),
);
console.log(
  openingHours.isOpen(
    Temporal.ZonedDateTime.from("2026-03-10T10:00[Europe/London]"),
  ),
);
console.log(
  openingHours.isOpen(
    Temporal.ZonedDateTime.from("2026-03-11T15:30[Europe/London]"),
  ),
);
```

```text
true
false
false
```

Read that top to bottom and it is the sentence you would say: open weekdays nine
to five, closed on the tenth, and on the eleventh we close at three.

**The order you say it in is the precedence.** Each line outranks the ones above
it, which is why "closed on the tenth" beats "open weekdays" without having to
say so. That is the same rule cascades follow, arrived at by writing the
sentence in the obvious order rather than by knowing anything about layers.

The third answer is the one worth pausing on. Half past three on the eleventh is
**shut**, because `.hoursOn(…)` says _these hours instead_ rather than _these
hours as well_. The usual five o'clock does not show through underneath it.

## Asking a schedule things

```ts
import { schedule, weekdays } from "@kensio/quando";

const openingHours = schedule().open(weekdays(), "09:00-17:00");

const fridayEvening = Temporal.ZonedDateTime.from(
  "2026-03-13T18:00[Europe/London]",
);
const opening = openingHours.opensNext(fridayEvening);

console.log(opening?.start?.toString());

const week = openingHours.openBetween(
  Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
);
console.log(week.toString());
```

```text
2026-03-16T09:00:00+00:00[Europe/London]
PT40H
```

|                           |                                                  |
| ------------------------- | ------------------------------------------------ |
| `.isOpen(at)`             | whether it is open at that moment                |
| `.opensNext(at, within?)` | the next stretch it is open, or the one it is in |
| `.openBetween(from, to)`  | how long it is open between two moments          |

`opensNext` gives back the stretch it is already in when you ask during opening
hours, rather than skipping to tomorrow — "when does it next open" should
answer "it is open".

A schedule that is _never_ open has no answer to give and no way to discover
that, so pass `within` when that is a possibility. It is the same caveat as
[termination](../queries/#termination) elsewhere.

`within` bounds how far to look, not what is found. Ask at eight in the morning
with two hours to look and you get the nine o'clock opening ending at five —
its real closing time — rather than one ending at ten where the search stopped.
That is a deliberate difference from [`next`](../queries/#next) on a rule, which
clips its answer to the window it was given like everything else in the core:
here the horizon is a search bound, and reporting it as a closing time would be
a wrong answer rather than a partial one.

## A rota

The same shape with the value left open: a rota assigns a person, a tariff
assigns a rate, a roster assigns how many are working.

```ts
import { rota, weekdays, weekends } from "@kensio/quando";

const onCall = rota()
  .assign(weekdays(), "alice")
  .assign(weekends(), "bob")
  .swap("2026-03-11", "carol");

console.log(
  onCall.whoIsOn(
    Temporal.ZonedDateTime.from("2026-03-09T10:00[Europe/London]"),
  ),
);
console.log(
  onCall.whoIsOn(
    Temporal.ZonedDateTime.from("2026-03-11T10:00[Europe/London]"),
  ),
);

const from = Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]");
const to = Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]");

for (const { start, end, value } of onCall.shifts(from, to)) {
  console.log(
    `${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}: ${value}`,
  );
}
```

```text
alice
carol
2026-03-09T00:00:00 → 2026-03-11T00:00:00: alice
2026-03-11T00:00:00 → 2026-03-12T00:00:00: carol
2026-03-12T00:00:00 → 2026-03-14T00:00:00: alice
2026-03-14T00:00:00 → 2026-03-16T00:00:00: bob
```

|                         |                                                       |
| ----------------------- | ----------------------------------------------------- |
| `.assign(scope, value)` | these times belong to this one                        |
| `.swap(day, value)`     | a swap: this day goes to this one instead             |
| `.whoIsOn(at)`          | who is on at that moment, or `undefined` if nobody is |
| `.shifts(from, to?)`    | each stretch and who has it; endless without a `to`   |

`whoIsOn` here is typed `"alice" | "bob" | "carol" | undefined`, not `string` —
the names accumulate as they are assigned, so a `switch` over who is on call can
be exhaustive. Ask for `rota<string>()` when the names are not known up front,
or `rota<number>()` for a tariff.

Nobody being on is `undefined` rather than an error: a rota need not cover every
moment, and an unassigned moment has no value. Say so with a layer if "nobody"
is meaningful in your domain.

## It really is a cascade

This is the part that makes the friendly layer safe to start with. A `Schedule`
_is_ a `Cascade<boolean>` and a `Rota<V>` _is_ a `Cascade<V>` — the same trick
that makes a built rule an ordinary rule. So the core reads one directly:

```ts
import { resolve, schedule, weekdays } from "@kensio/quando";

const openingHours = schedule()
  .open(weekdays(), "09:00-17:00")
  .hoursOn("2026-03-11", "09:00-15:00");

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-12T00:00[Europe/London]"),
};

for (const { start, end, value } of resolve(openingHours, week)) {
  console.log(
    `${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}: ${value}`,
  );
}

console.log(openingHours.type);
console.log(openingHours.layers.length);
```

```text
2026-03-09T09:00:00 → 2026-03-09T17:00:00: true
2026-03-10T09:00:00 → 2026-03-10T17:00:00: true
2026-03-11T09:00:00 → 2026-03-11T15:00:00: true
cascade
2
```

It serialises to exactly the document the hand-written cascade would. There is
no conversion step and no second format.

Coming back is where this needs saying carefully, because the same trick that
makes it work is what limits it. `JSON.stringify` omits methods — that is why a
schedule serialises as clean data — so what `JSON.parse` hands back is the
cascade, without `.isOpen` or anything else on it:

```ts
import { type Cascade, resolve, schedule, weekdays } from "@kensio/quando";

const openingHours = schedule().open(weekdays(), "09:00-17:00");

const stored = JSON.stringify(openingHours);
const back = JSON.parse(stored) as Cascade<boolean>;

console.log(JSON.stringify(back) === stored);

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-10T00:00[Europe/London]"),
};
for (const { start, end, value } of resolve(back, week)) {
  console.log(
    `${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}: ${value}`,
  );
}

console.log("isOpen" in back);
```

```text
true
2026-03-09T09:00:00 → 2026-03-09T17:00:00: true
false
```

So a stored schedule is read by `resolve` and by everything else that takes a
cascade, and that is the whole of what it can be read by today. Two things
follow, and neither is hidden anywhere else:

- **Nothing checks it.** [`parseRule`](../serialisation/) reads rules, not
  cascades, and there is no `parseCascade` yet — the `as` in that example is a
  promise you are making, not one the library keeps. Validate at your own
  boundary until there is one.
- **There is no reviving it.** Nothing turns a cascade back into a `Schedule`,
  so the methods are gone for good on that value. Keep the building code as the
  source of truth if you want them, and treat the JSON as what you store and
  resolve.

## The plain forms

`"09:00-17:00"` stands for `timeOfDay("09:00", "17:00")`, and `"2026-03-11"` for
`dates("2026-03-11")`. Anywhere either is accepted a rule is accepted too, so
`.open(weekdays(), timeOfDay("22:00", "06:00"))` gives you a night shift that no
compact string would express as clearly.

Unlike the rule layer, these check what they are given straight away:

```ts
import { schedule, weekdays } from "@kensio/quando";

try {
  schedule().open(weekdays(), "9 til 5");
} catch (error) {
  console.log(String(error));
}

try {
  schedule().closed("Christmas");
} catch (error) {
  console.log(String(error));
}
```

```text
RangeError: "9 til 5" is not a range of times: it has 0 dashes rather than one. Expected something like "09:00-17:00".
RangeError: "Christmas" is not a date. Expected something like "2026-03-11", or a rule such as weekdays().
```

That is a deliberate difference from [`timeOfDay`](../rules/#timeofday), which
takes any string and complains when the rule is evaluated. These forms exist to
be typed by hand, and a hand-typed mistake is worth catching where it was typed.

## When to drop to the core

Reach past these when you need something they do not say:

- **A value that is not "open" or a single assignment per moment** — anything
  needing a nested override inside an override, which is
  [`replace`](../cascades/#overrides-which-a-plain-value-cannot-express) with a
  cascade rather than a rule.
- **The set algebra** — `all`, `any`, `not`, and `.except(…)` for
  opening-hours-minus-holidays. See [rules](../rules/).
- **The other queries** — `advanceBy` in particular, which answers "three
  working hours from now" and takes a rule. See [queries](../queries/).

Nothing is lost by starting here and moving down later; it is the same document
either way.

<!-- card
```ts
const openingHours = schedule()
  .open(weekdays(), "09:00-17:00")
  .closed(bankHolidays)
  .hoursOn("2026-03-11", "09:00-15:00");
```
-->
