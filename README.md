# Quando

Declarative temporal rules for schedules, deadlines, constraints, and exceptions.

Quando answers one question: **given these rules about time, when does something
happen?** `Temporal` tells you what a moment _is_; Quando tells you when
something _occurs_ — "weekdays nine to five, except bank holidays", and then
what that implies about now, about a window, and about three working hours from
here.

```bash
npm install @kensio/quando
```

Requires a runtime with `Temporal`: **Node 26 or later**, or a browser that
implements it. Quando reads the global rather than importing a polyfill, so it
has no runtime dependencies; anywhere without `Temporal` natively can load
`temporal-polyfill` first and everything here works untouched.

## A rule

```ts
import { timeOfDay, weekdays } from "@kensio/quando";

const openingHours = weekdays().and(timeOfDay("09:00", "17:00"));
```

There is no build step to that: it is already the rule, a plain JSON-shaped
object with methods hanging off it. `JSON.stringify` gives you a document you
can store, and `parseRule` gives you the rule back.

## Four questions

```ts
import { activeAt, advanceBy, elapsed, next } from "@kensio/quando";

const friday = Temporal.ZonedDateTime.from("2026-03-13T16:55[Europe/London]");

// Is it open?
activeAt(openingHours, friday);
// → true

// When does it next open?
next(openingHours, { from: friday.add({ hours: 2 }) })?.start?.toString();
// → 2026-03-16T09:00:00+00:00[Europe/London]

// How much opening is there this week?
elapsed(openingHours, {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
}).toString();
// → PT40H

// Three hours of packing that only count while it is open — when is it done?
advanceBy(friday, Temporal.Duration.from({ hours: 3 }), {
  during: openingHours,
})?.toString();
// → 2026-03-16T11:55:00+00:00[Europe/London]
```

That last one is why the library exists, and it is the one that is genuinely
awkward to do by hand.

## Or say it the way you would say it

For opening hours and rotas there is a plainer front door, which builds the same
thing:

```ts
import { rota, schedule, weekdays, weekends } from "@kensio/quando";

const openingHours = schedule()
  .open(weekdays(), "09:00-17:00")
  .closed("2026-12-25")
  .hoursOn("2026-03-11", "09:00-15:00"); // close early, just that day

openingHours.isOpen(friday);
// → true

const onCall = rota().assign(weekdays(), "alice").assign(weekends(), "bob");

onCall.whoIsOn(friday);
// → "alice"
```

Each line outranks the ones above it, so exceptions read in the order you would
say them. See [schedules and rotas](docs/schedules/).

## Why intervals

A rule does not answer about an instant — it produces the intervals over which
it holds. Anything that samples has to choose a step size, trading correctness
against speed, and every derived question becomes the same loop. Producing
intervals turns those loops into arithmetic: working time in a window is a sum,
three working days from now is a walk, and a rule that can never be satisfied
yields nothing instead of never finishing.

[Concepts](docs/concepts/) has the long version.

## Documentation

[quandojs.dev](https://quandojs.dev), which is built from [`docs/`](docs/) in
this repository:

- [Getting started](docs/getting-started/) — requirements, install, first query
- [Concepts](docs/concepts/) — the model, and why it is that shape
- [Rules](docs/rules/) — every rule type, and what each produces
- [Queries](docs/queries/) — the four questions, and termination
- [Time zones](docs/time-zones/) — wall clock against elapsed time
- [Serialisation](docs/serialisation/) — the JSON form and its boundary
- [Schedules and rotas](docs/schedules/) — opening hours and who is on, plainly
- [Cascades](docs/cascades/) — layers carrying values, resolved by precedence
- [Merging](docs/merging/) — overlap that adds rather than displaces
- [API](docs/api/) — everything the package exports

## What it is not

Not a date library — `Temporal` is that, and Quando is built on it. Not a
scheduler: Quando calculates _when_ and never fires anything, so its answer is
your scheduler's input. Not storage, and not a holiday data provider; calendar
data belongs in satellite packages so that the core carries none.

Estimates and a command line are designed and not yet built.

## Licence

[Apache-2.0](LICENSE).
