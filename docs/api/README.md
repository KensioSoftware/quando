# API

Quando separates its common API, low-level core, and storage parsers across
three package entry points.

## Root entry point

Import these names from `@kensio/quando`.

### Schedule

```ts
function schedule(options?: { zone?: string }): Schedule;
function parseSchedule(value: unknown, path?: string): Schedule;
```

| Method                               | Result                                       |
| ------------------------------------ | -------------------------------------------- |
| `open(scope, hours?)`                | Adds opening hours                           |
| `closed(scope)`                      | Closes the whole scope                       |
| `hoursOn(day, hours)`                | Replaces the hours within a day              |
| `isOpen(at)`                         | Returns whether the schedule is open         |
| `opensNext(at, search?)`             | Returns the current or next complete opening |
| `addOpenTime(from, amount, search?)` | Advances through open time                   |
| `openDuration(from, to)`             | Measures open time in a window               |

`Schedule` contains a `cascade: Cascade<boolean>` property. Its JSON form uses
the `schedule` type tag and retains the optional zone.

### Rota

```ts
function rota<V = never>(): Rota<V>;
function parseRota<V>(
  value: unknown,
  parseValue: ValueParser<V>,
  path?: string,
): Rota<V>;
```

| Method                 | Result                          |
| ---------------------- | ------------------------------- |
| `assign(scope, value)` | Assigns a value within a scope  |
| `swap(day, value)`     | Assigns a replacement for a day |
| `whoIsOn(at)`          | Returns the assigned value      |
| `shifts(from, to?)`    | Returns valued intervals        |

### Tally

```ts
function tally(): Tally;
function parseTally(value: unknown, path?: string): Tally;
```

| Method                   | Result                                |
| ------------------------ | ------------------------------------- |
| `plus(scope, amount)`    | Adds an amount within a scope         |
| `exactly(scope, amount)` | Replaces the amount within a scope    |
| `at(at)`                 | Returns the amount at an instant      |
| `least(from, to)`        | Returns the lowest amount in a window |
| `counts(from, to?)`      | Returns valued intervals              |

### Rule builders

| Function                     | Rule                                 |
| ---------------------------- | ------------------------------------ |
| `always()`                   | All time                             |
| `never()`                    | No time                              |
| `daysOfWeek(...days)`        | Whole days by weekday                |
| `weekdays()`                 | Monday through Friday                |
| `weekends()`                 | Saturday and Sunday                  |
| `timeOfDay(from, to, zone?)` | A daily wall-clock window            |
| `dates(...dates)`            | Whole named dates                    |
| `all(...rules)`              | Intersection                         |
| `any(...rules)`              | Union                                |
| `not(rule)`                  | Complement                           |
| `inZone(zone, rule)`         | Evaluates a rule subtree in one zone |

Every builder validates its immediate inputs and returns `Built<R>`. A built
rule has non-enumerable `.and`, `.or`, and `.except` methods.

```ts
function parseRule(value: unknown, path?: string): Built<Rule>;
```

### Queries

```ts
function activeAt<V>(
  covers: Covers<V>,
  at: Temporal.ZonedDateTime,
  context?: Omit<Context, "from" | "to">,
): boolean;

function nextCoveredInterval<V>(
  covers: Covers<V>,
  context: Context,
  search?: Search,
): Interval | undefined;

function coveredDuration<V>(
  covers: Covers<V>,
  context: Context,
): Temporal.Duration;

function advanceBy<V>(
  from: Temporal.ZonedDateTime,
  amount: Temporal.Duration,
  options: { during: Covers<V> } & Search & Omit<Context, "from" | "to">,
): Temporal.ZonedDateTime | undefined;
```

```ts
interface Search {
  readonly within?: Temporal.Duration;
  readonly complete?: boolean;
}
```

The two searching queries use `DEFAULT_SEARCH_LIMIT` when the caller provides
no finite range. Exhausting that guard throws `SearchLimitExceededError`.

### Comparison

`canonical`, `equals`, and `fingerprint` compare the stored meaning of rules and
cascades. They perform syntactic normalisation without evaluating an unbounded
timeline.

### JSON values

`JsonValue` describes stored values. `JsonCompatible<T>` checks an application
type without requiring an index signature, so named interfaces work as rota
values.

## Core entry point

Import these names from `@kensio/quando/core`.

### Cascades

```ts
function cascade<V>(...layers: Layer<V>[]): Cascade<V>;
function layer<V>(scope: Rule, value: V & JsonCompatible<V>): ConstantLayer<V>;
function replace<V>(
  scope: Rule,
  replacement: Cascade<V & JsonCompatible<V>>,
): ReplacingLayer<V>;
function resolve<V>(cascade: CascadeLike<V>, context: Context): ValuedStream<V>;
```

`merged` has strategy-specific overloads. `sum`, `max`, and `min` accept
numbers. `concat` accepts arrays. `override` accepts any `JsonValue`.

`asCascade` returns the document behind a cascade façade. `assigned` selects
the intervals carrying one value. `valueAt` and `nextValue` query cascade
values.

### Rule evaluation

```ts
function intervals(rule: Rule, context: Context): IntervalStream;
```

An `Interval` has optional `start` and `end` values. Undefined endpoints mean
the interval is unbounded in that direction. Streams are ordered,
non-overlapping, half-open, and coalesced.

The core exports `clip`, `complement`, `intersect`, `union`, `contains`,
`duration`, `isEmpty`, `take`, and interval comparison helpers.

## Parsing entry point

Import these names from `@kensio/quando/parsing`.

```ts
parseRule;
parseSchedule;
parseRota;
parseTally;
parseCascade;
asString;
asBoolean;
fail;
```

Every parser accepts `unknown`, rejects unknown fields, and reports the path to
an invalid value.

## Context

```ts
interface Context {
  readonly from: Temporal.ZonedDateTime;
  readonly to?: Temporal.ZonedDateTime;
  readonly disambiguation?: "compatible" | "earlier" | "later" | "reject";
}
```

The `from` zone supplies the default zone. `to` must be at or after `from`.
`disambiguation` controls ambiguous and nonexistent wall-clock times.

<!-- card
```ts
const openingHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00");
```
-->
