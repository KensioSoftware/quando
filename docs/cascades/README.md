# Cascades

A rule describes when something applies. A cascade assigns values during those
times. It contains an ordered list of layers, and the last layer that covers a
moment wins by default.

Cascades can represent an on-call rota, a tariff, or opening hours with
overrides.

> Start with [schedules and rotas](../schedules/) for opening hours and simple
> assignments. Those APIs build cascades and can be used with the functions on
> this page.

## Rules stay boolean

A rule only describes covered and uncovered time. This keeps operations such as
`not` well-defined. A cascade adds values on top of rules without changing the
[rule operations](../rules/#combining).

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

`resolve` returns the intervals assigned by a cascade. Each interval has a
`value`. The stream is lazy, ordered, non-overlapping, coalesced, and reported
in the context zone.

## Order is the meaning

Array order sets precedence. The specificity of a scope has no effect. This
example reverses the two layers:

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

The weekday layer comes last and therefore assigns Alice on Wednesday. Reordering
the layer array changes the result.

## Unassigned time is omitted

A cascade can leave time unassigned. `resolve` omits periods that no layer
covers:

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

Add a layer with an explicit value such as `"nobody"` when your domain needs to
represent that state.

## Replace earlier layers within a scope

Use `replace` when an exception must replace the lower layers within a scope.
For example, an office may close at 15:00 on 11 March.

Assigning `false` on that date would close the whole day. Assigning a value only
from 15:00 to 17:00 would depend on the normal opening hours.

`replace` claims the whole date and supplies a nested cascade for the hours
inside it:

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

The replacement claims its whole scope. The normal hours do not reappear after
15:00 on 11 March. The replacement cannot assign a value outside 11 March.
Because the replacement is another cascade, replacements can be nested.

When the second argument is a rule, `replace` converts it to a boolean cascade.
Pass a cascade when you need another value type.

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

Alice's adjacent intervals are coalesced into one. Values are compared with
`Object.is`. Equal strings, equal numbers, and the same object reference can be
coalesced. Separate object instances remain separate.

## Cascades are JSON-compatible data

`cascade`, `layer`, and `replace` return plain JSON-compatible objects:

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

Constant and replacing layers use separate `value` and `replace` fields. This
lets a cascade safely use another cascade or a rule as a domain value.

## Endless cascades

`resolve` is lazy. A recurring cascade produces an endless stream when the
context has no end.

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

A cascade that never assigns a value can search forever in an unbounded
context. Set `to` when the cascade may produce no result. See
[query termination](../queries/#termination).

## Asking a cascade the four questions

Use `assigned(cascade, value)` to select the times when a cascade has one value.
The result can be passed to the four [rule queries](../queries/).

This example queries the times assigned to individual people:

```ts
import {
  activeAt,
  advanceBy,
  assigned,
  cascade,
  dates,
  elapsed,
  layer,
  next,
  weekdays,
  weekends,
} from "@kensio/quando";

const onCall = cascade(
  layer(weekdays(), "alice"),
  layer(weekends(), "bob"),
  layer(dates("2026-03-11"), "carol"),
);

const week = {
  from: Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]"),
  to: Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]"),
};
const tuesday = Temporal.ZonedDateTime.from("2026-03-10T20:00[Europe/London]");
const wednesday = Temporal.ZonedDateTime.from(
  "2026-03-11T11:00[Europe/London]",
);

console.log(activeAt(assigned(onCall, "carol"), wednesday));
console.log(elapsed(assigned(onCall, "alice"), week).toString());
console.log(
  next(assigned(onCall, "bob"), { from: tuesday })?.start?.toString(),
);
console.log(
  advanceBy(tuesday, Temporal.Duration.from({ hours: 8 }), {
    during: assigned(onCall, "alice"),
  })?.toString(),
);
```

```text
true
PT96H
2026-03-14T00:00:00+00:00[Europe/London]
2026-03-12T04:00:00+00:00[Europe/London]
```

The final query adds eight hours that count only while Alice is assigned. The
Wednesday assignment to Carol is excluded, so the result falls on Thursday.

An `Assigned<V>` is a query input. It is not a serialisable `Rule`.

Values are matched with `Object.is`.

## Query the assigned value

`valueAt` and `nextValue` return the value assigned by a cascade.

```ts
import {
  cascade,
  dates,
  layer,
  nextValue,
  valueAt,
  weekdays,
  weekends,
} from "@kensio/quando";

const onCall = cascade(
  layer(weekdays(), "alice"),
  layer(weekends(), "bob"),
  layer(dates("2026-03-11"), "carol"),
);

const tuesday = Temporal.ZonedDateTime.from("2026-03-10T20:00[Europe/London]");
const wednesday = Temporal.ZonedDateTime.from(
  "2026-03-11T11:00[Europe/London]",
);

console.log(valueAt(onCall, wednesday));

const shift = nextValue(onCall, { from: tuesday });
console.log(shift?.value, shift?.start?.toString());
```

```text
carol
alice 2026-03-10T20:00:00+00:00[Europe/London]
```

`valueAt` returns the value at one moment, or `undefined` when the moment is
unassigned. `nextValue` returns the next assigned interval with its value. If
an interval is already active, it is clipped to the context start.

## Merge overlapping values

By default, a later value replaces an earlier value. Use a merged cascade when
overlapping values should be added or otherwise combined. See
[merging](../merging/).

<!-- card
```ts
const onCall = cascade(
  layer(weekdays(), "alice"),
  layer(dates("2026-03-11"), "bob"),
);
// → [Mon,Wed)=alice [Wed,Thu)=bob [Thu,Sat)=alice
```
-->
