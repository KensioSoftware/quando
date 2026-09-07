# Getting started

This guide builds a weekly schedule, adds two exceptions, and queries the
result.

## Requirements

Quando reads `Temporal` from the global scope and imports no polyfill of its
own. Node 26 has a global `Temporal`, as do Chrome 144, Edge 144 and Firefox 139.

Install the package:

```bash
npm install @kensio/quando
```

TypeScript projects must include `ESNext` in the compiler libraries:

```json
{
  "compilerOptions": {
    "lib": ["ESNext"]
  }
}
```

The `engines` field floors at Node 22. That number is the oldest Node the
published JavaScript runs on. What Quando actually needs is a global
`Temporal`, and a version range has no way to say so. Older Node and current
Safari take the polyfill route below.

### Runtimes without global `Temporal`

Node 22, Node 24 and Safari have no global `Temporal`. Install
[`temporal-polyfill`](https://www.npmjs.com/package/temporal-polyfill) and
assign it to `globalThis.Temporal` before Quando loads. This is a supported
configuration (the test suite runs on Node 22 this way), and the AWS Lambda
`nodejs22.x` and `nodejs24.x` runtimes are the usual reason for it.

```bash
npm install temporal-polyfill
```

Put the assignment in a module of its own:

```ts
// temporal-global.ts
import { Temporal } from "temporal-polyfill";

globalThis.Temporal ??= Temporal;
```

Import that module ahead of Quando:

```ts
import "./temporal-global.js";
import { schedule, weekdays } from "@kensio/quando";
```

Two details make the separate module worth the trouble. Importing
`temporal-polyfill` leaves `globalThis` alone. The assignment is what installs
the global.

A module also evaluates all of its imports before its own first statement. An
assignment written beside a Quando import therefore runs too late:

```ts
// Wrong. Quando is evaluated before the assignment reaches the global.
import { Temporal } from "temporal-polyfill";
import { schedule } from "@kensio/quando";

globalThis.Temporal ??= Temporal;
```

```text
ReferenceError: Temporal is not defined
```

`??=` keeps a native `Temporal` where the runtime already has one. The same
entry point then works on Node 26 and on Node 22.

The `quando` command reads the same global. Preload the module to run it on a
runtime that lacks one:

```bash
node --import ./temporal-global.js node_modules/.bin/quando timeline opening-hours.json \
  --from '2026-03-09T00:00[Europe/London]' \
  --to '2026-03-10T00:00[Europe/London]'
```

Bundling the polyfill would charge every consumer for it, including the
majority whose runtime already has `Temporal`. Reading the global leaves that
cost with the runtimes that need it.

## Create a schedule

```ts
import { schedule, weekdays } from "@kensio/quando";

const openingHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00")
  .closed("2026-12-25")
  .hoursOn("2026-12-24", "09:00-15:00");
```

`open` combines a scope with a range of local times. Here the scope is Monday
through Friday. The next two calls add exceptions for Christmas Day and
Christmas Eve.

Later methods take precedence within their scope. This makes the definition
read from the usual case to its exceptions.

## Ask whether it is open

All query instants are `Temporal.ZonedDateTime` values.

```ts
const placed = Temporal.ZonedDateTime.from("2026-03-13T16:55[Europe/London]");

console.log(openingHours.isOpen(placed));
```

```text
true
```

The schedule is open at 16:55 on that Friday. Closing time is excluded because
Quando uses half-open intervals.

## Find the next opening

```ts
const fridayEvening = placed.add({ hours: 2 });
const next = openingHours.opensNext(fridayEvening);

console.log(next?.start?.toString());
```

```text
2026-03-16T09:00:00+00:00[Europe/London]
```

The next opening begins at 09:00 on Monday.

## Add working time

`addOpenTime` moves through open periods and skips closed periods.

```ts
const dispatch = openingHours.addOpenTime(
  placed,
  Temporal.Duration.from({ hours: 3 }),
);

console.log(dispatch?.toString());
```

```text
2026-03-16T11:55:00+00:00[Europe/London]
```

Five minutes count on Friday. The remaining two hours and fifty-five minutes
finish on Monday.

## Measure open time

```ts
const from = Temporal.ZonedDateTime.from("2026-03-09T00:00[Europe/London]");
const to = Temporal.ZonedDateTime.from("2026-03-16T00:00[Europe/London]");

console.log(openingHours.openDuration(from, to).toString());
```

```text
PT40H
```

The window includes `from` and excludes `to`.

## Store and restore the schedule

The schedule is JSON-compatible data with non-enumerable methods attached.
Store it with the JSON tools you already use, then pass the stored value to
`parseSchedule`.

```ts
import { parseSchedule } from "@kensio/quando";

const stored = JSON.stringify(openingHours);
const restored = parseSchedule(JSON.parse(stored));

console.log(restored.isOpen(placed));
```

```text
true
```

`parseSchedule` validates the complete document and restores the schedule
methods.

## Continue reading

[Schedules and rotas](../schedules/) covers the other domain methods.
[Rules](../rules/) explains how to describe custom periods. [Queries](../queries/)
covers the standalone query functions.

<!-- card
```ts
const openingHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00")
  .closed("2026-12-25");
```
-->
