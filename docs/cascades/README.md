# Cascades

A rule says _when_. A cascade says _what holds when_: an ordered list of layers,
each pairing a scope with what applies inside it, resolved the way a stylesheet
is — the last layer to claim a moment wins.

That is what answers the questions a boolean schedule cannot. Who is on call.
What the tariff is at three in the morning. Which hours apply on the one day
they are different.

> For the common shapes there is a plainer way to say all of this:
> [schedules and rotas](../schedules/) puts domain words in front of everything
> on this page. What it builds _is_ a cascade, so nothing here stops being true
> — read this page when you need more than the words it gives you.

## Values live here, not on rules

A rule stays boolean on purpose. If rules carried values then every combinator
would be generic in the value, and `not` would have to answer what the
complement of a rota is — a question with no sensible answer. Keeping values in
a separate concept is what lets the [set algebra](../rules/#combining) stay
simple, and it puts values exactly where they are needed, which is assignment.

## A rota

```ts
import { cascade, dates, layer, resolve, weekdays } from "@kensio/quando";

const onCall = cascade(
  layer(weekdays(), "alice"),
  layer(dates("2026-03-11"), "bob"),
);

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

for (const { start, end, value } of resolve(onCall, week)) {
  console.log(
    `${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}: ${value}`,
  );
}
```

```text
2026-03-09T00:00:00 → 2026-03-11T00:00:00: alice
2026-03-11T00:00:00 → 2026-03-12T00:00:00: bob
2026-03-12T00:00:00 → 2026-03-14T00:00:00: alice
```

`resolve` is to a cascade what [`intervals`](../rules/#reading-a-rule) is to a
rule, and what comes back is the same kind of stream with a `value` on each
interval — ascending, non-overlapping, coalesced, lazy, and read in the
context's zone.

## Order is the meaning

Precedence is decided by position, not by how specific a scope looks. The same
two layers the other way round:

```ts
import { cascade, dates, layer, resolve, weekdays } from "@kensio/quando";

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

const swapped = cascade(
  layer(dates("2026-03-11"), "bob"),
  layer(weekdays(), "alice"),
);

for (const { start, end, value } of resolve(swapped, week)) {
  console.log(
    `${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}: ${value}`,
  );
}
```

```text
2026-03-09T00:00:00 → 2026-03-14T00:00:00: alice
```

Bob has vanished: the broad layer is above the narrow one and claims the
Wednesday too. A CSS author will find this familiar, and anyone expecting
"most specific wins" will not — so the JSON is an array, and reordering it
changes the answer.

## Unassigned time is absent, not empty

A cascade does not have to cover everything. Where no layer claims a moment,
there is no value, and `resolve` yields nothing at all rather than an interval
carrying some empty value:

```ts
import { cascade, layer, resolve, weekdays } from "@kensio/quando";

const onCall = cascade(layer(weekdays(), "alice"));

const weekend = {
  from: Temporal.ZonedDateTime.from("2026-03-14T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

console.log([...resolve(onCall, weekend)].length);
```

```text
0
```

Same reasoning as a rule yielding only the time it covers: there is no such
thing as the value of an unassigned moment. If "nobody" is a meaningful answer
in your domain, say so with a layer that assigns it.

## Overrides, which a plain value cannot express

Here is the case cascades exist for. _On the eleventh we close at three._

Writing that as `layer(dates("2026-03-11"), false)` shuts the whole day.
Writing it as a value over 15:00–17:00 forces you to know the hours you are
overriding, and to change the exception whenever the base changes — the very
thing the cascade is meant to avoid.

What you mean is: _within this scope, ignore the layers below and use this
instead._ That is `replace`:

```ts
import {
  all,
  cascade,
  dates,
  layer,
  replace,
  resolve,
  timeOfDay,
  weekdays,
} from "@kensio/quando";

const openingHours = cascade(
  layer(all(weekdays(), timeOfDay("09:00", "17:00")), true),
  replace(dates("2026-03-11"), timeOfDay("09:00", "15:00")),
);

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-14T00:00[Europe/London]"),
};

for (const { start, end, value } of resolve(openingHours, week)) {
  console.log(
    `${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}: ${value}`,
  );
}
```

```text
2026-03-09T09:00:00 → 2026-03-09T17:00:00: true
2026-03-10T09:00:00 → 2026-03-10T17:00:00: true
2026-03-11T09:00:00 → 2026-03-11T15:00:00: true
2026-03-12T09:00:00 → 2026-03-12T17:00:00: true
2026-03-13T09:00:00 → 2026-03-13T17:00:00: true
```

Three things follow from that layer claiming its whole scope. The base hours do
not show through the part the replacement left out — 15:00 to 17:00 on the
eleventh is unassigned, not open. The replacement cannot reach outside the
scope, however wide its own rule is. And what a layer replaces with is an
ordinary cascade, so overrides nest as deeply as the schedule does.

The bare rule above is sugar: `replace` stores the cascade that rule stands
for, so a stored document never needs a reader to know which form was written.
For anything other than a schedule, hand it a cascade.

## Touching intervals with one value are one interval

```ts
import { cascade, daysOfWeek, layer, resolve } from "@kensio/quando";

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};

const rota = cascade(
  layer(daysOfWeek("monday", "tuesday"), "alice"),
  layer(daysOfWeek("wednesday"), "alice"),
  layer(daysOfWeek("thursday"), "bob"),
);

for (const { start, end, value } of resolve(rota, week)) {
  console.log(
    `${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}: ${value}`,
  );
}
```

```text
2026-03-09T00:00:00 → 2026-03-12T00:00:00: alice
2026-03-12T00:00:00 → 2026-03-13T00:00:00: bob
```

Alice's two layers come back as one stretch, because the seam between them is
not a boundary in the answer. Sameness is `Object.is`, so strings, numbers and
shared references merge while two structurally-equal objects do not — the
conservative way round, since splitting an interval that could have merged is
recoverable and merging two the caller meant to keep apart is not.

## A cascade is data

Like a rule, and by the same trick:

```ts
import {
  cascade,
  dates,
  layer,
  replace,
  timeOfDay,
  weekdays,
} from "@kensio/quando";

const openingHours = cascade(
  layer(weekdays(), true),
  replace(dates("2026-03-11"), timeOfDay("09:00", "15:00")),
);

console.log(JSON.stringify(openingHours, null, 2));
```

```text
{
  "type": "cascade",
  "layers": [
    {
      "scope": {
        "type": "daysOfWeek",
        "days": [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday"
        ]
      },
      "value": true
    },
    {
      "scope": {
        "type": "dates",
        "dates": [
          "2026-03-11"
        ]
      },
      "replace": {
        "type": "cascade",
        "layers": [
          {
            "scope": {
              "type": "timeOfDay",
              "from": "09:00",
              "to": "15:00"
            },
            "value": true
          }
        ]
      }
    }
  ]
}
```

`value` and `replace` are separate fields rather than one field holding either,
and that is a runtime decision rather than a stylistic one: with a single field
the resolver would have to work out which meaning a value carries by inspecting
the shape of your own domain type, and for a cascade whose values _are_ rules
the two would be indistinguishable.

## Endless cascades

The same contract rules keep: lazy, and endless when the context has no end.

```ts
import {
  cascade,
  layer,
  resolve,
  take,
  timeOfDay,
  weekdays,
} from "@kensio/quando";

const onCall = cascade(layer(weekdays(), "alice"));

const endless = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
};

for (const { start, value } of take(resolve(onCall, endless), 2)) {
  console.log(`${start?.toPlainDateTime()}: ${value}`);
}
```

```text
2026-03-09T00:00:00: alice
2026-03-16T00:00:00: alice
```

The caveat is the one from [queries](../queries/#termination): a cascade that
assigns _nothing_ over an unbounded context has no answer to give and no way to
discover that, so bound the context when the answer might be nothing.

## Overlap that adds rather than displaces

Everything above settles an overlap by precedence. A roster wants the other
answer, and [merging](../merging/) is how a cascade asks for it.

## What is not here yet

Deliberately, and worth knowing before you build on this:

- **Queries over cascades.** `activeAt`, `elapsed`, `next` and `advanceBy` take
  a `Rule`. To ask those of a cascade, resolve it and read the stream.

<!-- card
```ts
const onCall = cascade(
  layer(weekdays(), "alice"),
  layer(dates("2026-03-11"), "bob"),
);
// → [Mon,Wed)=alice [Wed,Thu)=bob [Thu,Sat)=alice
```
-->
