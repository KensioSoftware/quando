# API reference

This page lists the main public API. Start with the
[getting-started guide](../getting-started/) if you are new to Quando.

## Entry points

| Import path              | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `@kensio/quando`         | Schedules, rotas, tallies, rules, and common queries |
| `@kensio/quando/core`    | Cascades, interval streams, and low-level evaluation |
| `@kensio/quando/parsing` | Parsers for stored Quando documents                  |

The core entry point also exports everything from the root entry point.

## Root entry point

### Schedules

```ts
function schedule(options?: { zone?: string }): Schedule;
function parseSchedule(value: unknown, path?: string): Schedule;

interface ScheduleChanges {
  readonly opened: Iterable<Interval>;
  readonly closed: Iterable<Interval>;
}

interface LayerOptions {
  readonly label?: string;
  readonly comment?: string;
}
```

| Method                                  | Result                                      |
| --------------------------------------- | ------------------------------------------- |
| `open(scope, hours?, options?)`         | Add opening hours                           |
| `closed(scope, options?)`               | Close the entire scope                      |
| `hoursOn(day, hours, options?)`         | Replace the hours within a day              |
| `isOpen(at)`                            | Check one instant                           |
| `explain(at)`                           | Explain the value at one instant            |
| `opensNext(at, search?)`                | Return the current or next opening interval |
| `firstOpenSlot(from, lasting, search?)` | Return the first fitting opening interval   |
| `openSlots(from, to, options)`          | Return candidate opening intervals          |
| `addOpenTime(from, amount, search?)`    | Advance through open time                   |
| `openDuration(from, to)`                | Measure open time in a window               |
| `changesTo(next, from, to)`             | Return newly opened and closed intervals    |
| `validate(from, to)`                    | Return semantic schedule diagnostics        |
| `toJSON()`                              | Return the stored schedule data             |

`scope`, `day`, and `hours` accept a `Rule`. They also accept a date string such
as `"2026-03-11"` or a time range such as `"09:00-17:00"` in the appropriate
position.

The optional `LayerOptions` has `label` and `comment` fields. Both fields are
stored and included in explanations. `open(scope, options)` labels an all-day
opening without an `hours` argument.

### Rotas

```ts
function rota<V = never>(): Rota<V>;
function parseRota<V>(
  value: unknown,
  parseValue: ValueParser<V>,
  path?: string,
): Rota<V>;
```

| Method                           | Result                                   |
| -------------------------------- | ---------------------------------------- |
| `assign(scope, value, options?)` | Add an assignment                        |
| `swap(day, value, options?)`     | Add a replacement assignment for a day   |
| `whoIsOn(at)`                    | Return the assigned value or `undefined` |
| `explain(at)`                    | Explain the value at one instant         |
| `shifts(from, to?)`              | Return valued intervals                  |
| `validate(from, to)`             | Return diagnostics, including rota gaps  |
| `toJSON()`                       | Return the stored rota data              |

### Tallies

```ts
function tally(): Tally;
function parseTally(value: unknown, path?: string): Tally;
```

| Method                             | Result                                 |
| ---------------------------------- | -------------------------------------- |
| `plus(scope, amount, options?)`    | Add an amount                          |
| `exactly(scope, amount, options?)` | Replace lower amounts within the scope |
| `at(at)`                           | Return the amount at one instant       |
| `explain(at)`                      | Explain the value at one instant       |
| `least(from, to)`                  | Return the lowest amount in a window   |
| `counts(from, to?)`                | Return valued intervals                |
| `validate(from, to)`               | Return semantic tally diagnostics      |
| `toJSON()`                         | Return the stored tally data           |

### Rule builders

| Function                     | Covered time                         |
| ---------------------------- | ------------------------------------ |
| `always()`                   | All time                             |
| `never()`                    | No time                              |
| `daysOfWeek(...days)`        | Whole days with the named weekdays   |
| `weekdays()`                 | Monday through Friday                |
| `weekends()`                 | Saturday and Sunday                  |
| `timeOfDay(from, to, zone?)` | A daily wall-clock window            |
| `dates(...dates)`            | Whole named dates                    |
| `all(...rules)`              | Times covered by every rule          |
| `any(...rules)`              | Times covered by at least one rule   |
| `not(rule)`                  | Times outside a rule                 |
| `inZone(zone, rule)`         | A rule subtree evaluated in one zone |

Each builder validates its arguments and returns a `Built<R>`. A built rule
is a `Rule` with non-enumerable `.and`, `.or`, and `.except` methods.

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

function firstGap<V>(
  covers: Covers<V>,
  lasting: Temporal.Duration,
  context: Context,
  search?: Pick<Search, "within">,
): Interval | undefined;

function slots<V>(
  covers: Covers<V>,
  context: Context,
  options: SlotOptions,
): IntervalStream;

function coverageChanges<B, A>(
  before: Covers<B>,
  after: Covers<A>,
  context: Context,
): CoverageChanges;
```

`Covers<V>` accepts a rule, a boolean cascade, or the result of
`assigned(cascade, value)`.

```ts
interface Search {
  readonly within?: Temporal.Duration;
  readonly complete?: boolean;
}

interface SlotOptions {
  readonly every: Temporal.Duration;
  readonly lasting: Temporal.Duration;
}

interface CoverageChanges {
  readonly added: IntervalStream;
  readonly removed: IntervalStream;
}
```

`nextCoveredInterval`, `firstGap`, and `advanceBy` apply
`DEFAULT_SEARCH_LIMIT` when no finite end is supplied. They throw
`SearchLimitExceededError` if they exhaust that automatic limit. `slots`
returns a lazy stream and adds no limit.

### Comparison and JSON types

`canonical`, `equals`, and `fingerprint` compare the stored structure of
rules and cascades.

`JsonValue` describes values that JSON can preserve. `JsonCompatible<T>`
checks an application type without requiring an index signature.

### Semantic validation

```ts
function validate(
  source: Rule | CascadeLike<unknown>,
  window: ValidationWindow,
  options?: ValidationOptions,
): readonly ValidationDiagnostic[];

interface ValidationWindow extends Context {
  readonly to: Temporal.ZonedDateTime;
}

interface ValidationOptions {
  readonly requireFullCoverage?: boolean;
}
```

Diagnostic codes are `inactive-rule`, `inactive-layer`, `shadowed-layer`, and
`uncovered-time`. Layer diagnostics include a cascade-relative `path`.
Uncovered-time diagnostics include the uncovered `interval`.

The window must be finite. `requireFullCoverage` reports every interval where a
cascade assigns no value. `Rota.validate` enables it, while `Schedule.validate`
allows ordinary closed time.

## Core entry point

### Cascades

```ts
function cascade<V>(...layers: readonly Layer<V>[]): Cascade<V>;

function layer<V>(
  scope: Rule,
  value: V & JsonCompatible<V>,
  options?: LayerOptions,
): ConstantLayer<V>;

function replace<V>(
  scope: Rule,
  replacement: Cascade<V & JsonCompatible<V>>,
  options?: LayerOptions,
): ReplacingLayer<V>;

function replace(
  scope: Rule,
  replacement: Rule,
  options?: LayerOptions,
): ReplacingLayer<boolean>;

function resolve<V>(cascade: CascadeLike<V>, context: Context): ValuedStream<V>;

function explain<V>(
  cascade: CascadeLike<V>,
  at: Temporal.ZonedDateTime,
  context?: Omit<Context, "from" | "to">,
): Explanation<V>;

function explainRule(
  rule: Rule,
  at: Temporal.ZonedDateTime,
  context?: Omit<Context, "from" | "to">,
): RuleExplanation;
```

`Explanation.value` is the value at the instant, or `undefined` when the
cascade assigns nothing. `summary` is a readable account of the result. Each
step has an automatic rule-match description, optional caller context, and the
structured data used to produce the text. See
[explanations](../explanations/) for the complete shape.

`cascade` uses later-layer priority. `merged` has strategy-specific
overloads:

| Strategy            | Accepted values        |
| ------------------- | ---------------------- |
| `override`          | JSON-compatible values |
| `sum`, `max`, `min` | Numbers                |
| `concat`            | Arrays                 |

`whenever(rule, options?)` creates a boolean cascade. `asCascade` returns the
cascade document behind a supported domain object. `isCascade` checks the
cascade type tag.

`assigned(cascade, value)` selects the time assigned to one value.
`valueAt(cascade, at)` reads one instant. `nextValue(cascade, context)`
returns the next valued interval.

### Rule evaluation

```ts
function intervals(rule: Rule, context: Context): IntervalStream;
```

An `Interval` has optional `start` and `end` values. An omitted endpoint is
unbounded in that direction. Interval streams are ordered, non-overlapping,
half-open, and coalesced.

The core exports these interval operations:

- `clip`, `complement`, `difference`, `intersect`, and `union`
- `contains`, `duration`, and `isEmpty`
- `compareStarts`, `compareEnds`, `startsBeforeEnd`, and
  `startsAtOrBeforeEnd`
- `overlay` for valued streams
- `take` for reading a fixed number of stream items

## Parsing entry point

```ts
type ValueParser<V> = (value: unknown, path: string) => V;

parseRule;
parseSchedule;
parseRota;
parseTally;
parseCascade;
asString;
asBoolean;
fail;
```

Every parser accepts `unknown`, rejects unknown fields, and reports the path
to invalid data. `parseRota` and `parseCascade` require a `ValueParser` for
application values.

## Shared types

```ts
interface Context {
  readonly from: Temporal.ZonedDateTime;
  readonly to?: Temporal.ZonedDateTime;
  readonly disambiguation?: "compatible" | "earlier" | "later" | "reject";
}

interface Interval {
  readonly start: Temporal.ZonedDateTime | undefined;
  readonly end: Temporal.ZonedDateTime | undefined;
}
```

The zone carried by `Context.from` is the default evaluation zone. `to` must
represent the same instant or a later instant. `disambiguation` controls
ambiguous and nonexistent local times.

<!-- card
```ts
const openingHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00");
```
-->
