# API

This page lists the public exports from `@kensio/quando`. The package has one
entry point:

```ts
import { activeAt, timeOfDay, weekdays } from "@kensio/quando";
```

Types and runtime values use the same entry point.

## Building rules

Each builder returns a [`Built<R>`](#built). This is a rule with `.and`, `.or`,
and `.except` methods. See [rules](../rules/).

|                                                                            |                                      |
| -------------------------------------------------------------------------- | ------------------------------------ |
| `always(): Built<AlwaysRule>`                                              | all of time                          |
| `never(): Built<NeverRule>`                                                | no time at all                       |
| `daysOfWeek(...days: readonly Weekday[]): Built<DaysOfWeekRule>`           | whole days, by day of the week       |
| `weekdays(): Built<DaysOfWeekRule>`                                        | Monday to Friday                     |
| `weekends(): Built<DaysOfWeekRule>`                                        | Saturday and Sunday                  |
| `timeOfDay(from: string, to: string, zone?: string): Built<TimeOfDayRule>` | a wall-clock window in each day      |
| `dates(...days: readonly string[]): Built<DatesRule>`                      | whole days, by date                  |
| `all(...rules: readonly Rule[]): Built<AllRule>`                           | intersection; with none, all of time |
| `any(...rules: readonly Rule[]): Built<AnyRule>`                           | union; with none, no time at all     |
| `not(rule: Rule): Built<NotRule>`                                          | complement                           |
| `inZone<R>(rule: R, zone: string): Built<R>`                               | the same rule, read in a named zone  |

`inZone` accepts `DaysOfWeekRule`, `DatesRule`, and `TimeOfDayRule`. TypeScript
rejects other rule types because they have no zone field.

Times, dates, and zone names use the formats accepted by `Temporal`. Examples
include `"09:00"`, `"2026-03-14"`, and `"Europe/London"`.

### `Built`

```ts
type Built<R extends Rule> = R & {
  readonly and: (...others: readonly Rule[]) => Built<AllRule>;
  readonly or: (...others: readonly Rule[]) => Built<AnyRule>;
  readonly except: (...others: readonly Rule[]) => Built<AllRule>;
};
```

`.except(...)` creates `all(this, not(any(...)))`. A `Built<R>` is also an `R`,
so it can be passed anywhere a `Rule` is accepted and serialises as rule data.

## Reading rules

### `intervals(rule: Rule, context: Context): IntervalStream`

Returns the times covered by a rule within a context. The intervals are ordered,
coalesced, and clipped to the context window. The stream is lazy and can be
endless when the context has no end. Results use the zone from `context.from`.

### `Context`

```ts
interface Context {
  readonly from: Temporal.ZonedDateTime;
  readonly to?: Temporal.ZonedDateTime;
  readonly location?: { readonly latitude: number; readonly longitude: number };
  readonly locale?: string;
}
```

`from` sets the evaluation start and the default time zone. `to` sets an
optional end. See [termination](../queries/#termination) for cases that need a
bounded context.

The current built-in rules do not use `location` or `locale`. They are reserved
for rules and descriptions that need this context.

## Queries

See [queries](../queries/).

|                                                                         |                                         |
| ----------------------------------------------------------------------- | --------------------------------------- |
| `activeAt(rule, at, context?): boolean`                                 | whether a rule covers an instant        |
| `elapsed(rule, context): Temporal.Duration`                             | how much time a rule covers in a window |
| `next(rule, context, search?): Interval \| undefined`                   | the next stretch a rule covers          |
| `advanceBy(from, amount, options): Temporal.ZonedDateTime \| undefined` | where an amount of that time gets you   |

Each query accepts a `Covers<V>`. This can be a `Rule` or a cascade narrowed to
one value with `assigned`. See
[querying cascades](../cascades/#asking-a-cascade-the-four-questions).

```ts
type Covers<V> = Rule | Assigned<V>;

interface Assigned<V> {
  readonly cascade: Cascade<V>;
  readonly is: V;
}

function assigned<V>(cascade: Cascade<V>, is: V): Assigned<V>;

function activeAt<V>(
  covers: Covers<V>,
  at: Temporal.ZonedDateTime,
  context?: Omit<Context, "from" | "to">,
): boolean;

function elapsed<V>(covers: Covers<V>, context: Context): Temporal.Duration;

function next<V>(
  covers: Covers<V>,
  context: Context,
  search?: Search,
): Interval | undefined;

function advanceBy<V>(
  from: Temporal.ZonedDateTime,
  amount: Temporal.Duration,
  options: { readonly during: Covers<V> } & Search &
    Omit<Context, "from" | "to">,
): Temporal.ZonedDateTime | undefined;
```

### Querying cascade values

|                                                          |                                    |
| -------------------------------------------------------- | ---------------------------------- |
| `valueAt<V>(cascade, at, context?): V \| undefined`      | what a cascade assigns at a moment |
| `nextValue<V>(cascade, context): Valued<V> \| undefined` | the next stretch, and its value    |

`elapsed` throws a `RangeError` when the context has no `to`. `advanceBy` throws
a `RangeError` for negative amounts and calendar units such as years, months,
weeks, or days.

### `Search`

```ts
interface Search {
  readonly within?: Temporal.Duration;
}
```

`within` sets a search horizon relative to the start. It can shorten a context
but cannot extend one.

## Serialisation

### `parseRule(value: unknown, path?: string): Rule`

Validates unknown data and returns a `Rule`. Invalid data causes a `TypeError`
that includes the failing path. `path` defaults to `"rule"`. See
[serialisation](../serialisation/).

### `parseCascade<V>(value, parseValue: ValueParser<V>, path?): Cascade<V>`

Validates unknown data and returns a `Cascade<V>`. `parseValue` validates each
domain value. `path` defaults to `"cascade"`.

### `ValueParser<V>`

The type is `(value: unknown, path: string) => V`. It returns a validated value
or throws. Quando exports three helpers:

|                                              |                                             |
| -------------------------------------------- | ------------------------------------------- |
| `asString(value: unknown, path: string)`     | a string, for a rota of names               |
| `asBoolean(value: unknown, path: string)`    | a boolean, for a schedule                   |
| `fail(path: string, problem: string): never` | throws in the form the rest of parsing uses |

### Comparing

|                                     |                                         |
| ----------------------------------- | --------------------------------------- |
| `canonical(rule): Rule`             | the one form of a rule that says this   |
| `canonical<V>(cascade): Cascade<V>` | the same for a cascade, layers in place |
| `fingerprint<V>(value): string`     | a stable key, equal for equal meanings  |
| `equals<V>(left, right): boolean`   | whether two say the same thing          |

Comparison is syntactic. Rules that cover the same times through different rule
types can compare as unequal. See [comparing](../comparing/).

## Schedules and rotas

These types add domain-specific methods to cascades. A `Schedule` is a
`Cascade<boolean>`. A `Rota<V>` is a `Cascade<V>`. A `Tally` is a summing
`Cascade<number>`. See [schedules and rotas](../schedules/) and
[merging](../merging/#count-with-tally).

|                                                        |                                                           |
| ------------------------------------------------------ | --------------------------------------------------------- |
| `schedule(): Schedule`                                 | an empty schedule, open for nothing                       |
| `.open(scope: PlainRule, hours?: PlainRule): Schedule` | open during these times                                   |
| `.closed(scope: PlainRule): Schedule`                  | closed for the whole of these                             |
| `.hoursOn(day: PlainRule, hours: PlainRule): Schedule` | these hours on this day, in place of what was said before |
| `.isOpen(at): boolean`                                 | whether it is open at that moment                         |
| `.opensNext(at, within?): Interval \| undefined`       | the next stretch it is open                               |
| `.openBetween(from, to): Temporal.Duration`            | how long it is open between two moments                   |
| `rota<V = never>(): Rota<V>`                           | an empty rota, nobody on                                  |
| `.assign(scope: PlainRule, value: W): Rota<V \| W>`    | these times belong to this one                            |
| `.swap(day: PlainRule, value: W): Rota<V \| W>`        | a swap: this day goes to this one                         |
| `.whoIsOn(at): V \| undefined`                         | who is on at that moment                                  |
| `.shifts(from, to?): ValuedStream<V>`                  | each stretch and who has it                               |
| `tally(): Tally`                                       | an empty tally, nobody on                                 |
| `.plus(scope: PlainRule, amount: number): Tally`       | that much more, on top of what covers the same time       |
| `.exactly(scope: PlainRule, amount: number): Tally`    | that many there, in place of what was said above          |
| `.at(at): number`                                      | how many at that moment, zero where nothing claims it     |
| `.least(from, to): number`                             | the thinnest cover in a window, counting a gap as zero    |
| `.counts(from, to?): ValuedStream<number>`             | each stretch and how many are on for it                   |

`assign` and `swap` use a `const` type parameter. Literal values accumulate in
the return type. Use `rota<string>()` when values are only known at runtime.

```ts
type PlainRule = Rule | string;
```

Where hours are expected, a string such as `"09:00-17:00"` becomes a time
window. Where a scope is expected, a string such as `"2026-03-11"` becomes a
date. These strings are validated when the method is called. A full `Rule` is
also accepted.

## Cascades

Cascades contain ordered layers that assign values. See
[cascades](../cascades/).

|                                                                       |                                                                              |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `cascade<V>(...layers: readonly Layer<V>[]): Cascade<V>`              | an ordered list of layers, lowest priority first                             |
| `layer<V>(scope: Rule, value: V): ConstantLayer<V>`                   | one value, across the whole of a scope                                       |
| `replace<V>(scope: Rule, replacement: Cascade<V>): ReplacingLayer<V>` | a scope claimed outright, with what holds inside it given by another cascade |
| `replace(scope: Rule, replacement: Rule): ReplacingLayer<boolean>`    | the same, taking the rule a schedule means                                   |
| `whenever(rule: Rule): Cascade<boolean>`                              | true while a rule holds, unassigned elsewhere                                |
| `merged<V>(strategy: MergeStrategy, ...layers): Cascade<V>`           | the same as `cascade`, with overlaps combined rather than displaced          |
| `isCascade<V>(value: Rule \| Cascade<V>): value is Cascade<V>`        | tells a cascade from a rule                                                  |
| `resolve<V>(cascade: Cascade<V>, context: Context): ValuedStream<V>`  | the values a cascade assigns                                                 |
| `overlay<V>(under, over, merge: Merge<V>): ValuedStream<V>`           | two valued streams laid over one another                                     |

```ts
interface Cascade<V> {
  readonly type: "cascade";
  readonly merge?: MergeStrategy;
  readonly layers: readonly Layer<V>[];
}

type MergeStrategy = "override" | "sum" | "max" | "min" | "concat";

type Merge<V> = (under: V, over: V) => V;

type Layer<V> = ConstantLayer<V> | ReplacingLayer<V>;

interface ConstantLayer<V> {
  readonly scope: Rule;
  readonly value: V;
}

interface ReplacingLayer<V> {
  readonly scope: Rule;
  readonly replace: Cascade<V>;
}

interface Valued<V> extends Interval {
  readonly value: V;
}

type ValuedStream<V> = Iterable<Valued<V>>;
```

`Valued<V>` extends `Interval`. The `duration`, `contains`, and `isEmpty`
helpers accept it. A `ValuedStream<V>` follows the `IntervalStream` contract and
coalesces touching intervals with values that match under `Object.is`.

By default, the last layer that covers a moment wins. A named
[merge strategy](../merging/) combines overlapping values.

## Rule types

A plain `Rule` is one of eight tagged object types:

```ts
type Rule =
  | AlwaysRule
  | NeverRule
  | DaysOfWeekRule
  | TimeOfDayRule
  | DatesRule
  | AllRule
  | AnyRule
  | NotRule;
```

|                  |                                                                   |
| ---------------- | ----------------------------------------------------------------- |
| `AlwaysRule`     | `{ type: "always" }`                                              |
| `NeverRule`      | `{ type: "never" }`                                               |
| `DaysOfWeekRule` | `{ type: "daysOfWeek", days: readonly Weekday[], zone?: string }` |
| `TimeOfDayRule`  | `{ type: "timeOfDay", from: string, to: string, zone?: string }`  |
| `DatesRule`      | `{ type: "dates", dates: readonly string[], zone?: string }`      |
| `AllRule`        | `{ type: "all", rules: readonly Rule[] }`                         |
| `AnyRule`        | `{ type: "any", rules: readonly Rule[] }`                         |
| `NotRule`        | `{ type: "not", rule: Rule }`                                     |

`Weekday` is the union of `"monday"` through `"sunday"`. `WEEKDAYS` is a readonly
tuple containing those values in calendar order.

## Intervals

The package also exports its lower-level interval types and functions.

### `Interval`

```ts
interface Interval {
  readonly start: Temporal.ZonedDateTime | undefined;
  readonly end: Temporal.ZonedDateTime | undefined;
}
```

Intervals are half-open and use the form `[start, end)`. An undefined `start`
means the unbounded past. An undefined `end` means the unbounded future.

### `IntervalStream`

```ts
type IntervalStream = Iterable<Interval>;
```

Every producer must return intervals in ascending start order. The intervals
must be non-overlapping and coalesced. The operations below rely on this
contract and do not validate the whole stream.

A descending stream does not satisfy the contract.

|                                                    |                                                    |
| -------------------------------------------------- | -------------------------------------------------- |
| `intersect(left, right): IntervalStream`           | the times both cover                               |
| `union(left, right): IntervalStream`               | the times either covers, coalesced                 |
| `complement(source): IntervalStream`               | the gaps, plus the unbounded stretches at each end |
| `clip(source, window: Interval): IntervalStream`   | a stream limited to a window                       |
| `take<T>(source: Iterable<T>, count: number): T[]` | the first `count` items of any sequence            |

Each operation is lazy and reads only as much source data as it needs. `clip`
can therefore stop after its window ends without consuming an infinite source.

```ts
import {
  complement,
  contains,
  duration,
  intersect,
  type Interval,
  union,
} from "@kensio/quando";

const at = (iso: string): Temporal.ZonedDateTime =>
  Temporal.ZonedDateTime.from(`${iso}[Europe/London]`);

const morning: Interval[] = [
  { start: at("2026-03-09T09:00"), end: at("2026-03-09T12:00") },
];
const afternoon: Interval[] = [
  { start: at("2026-03-09T11:00"), end: at("2026-03-09T17:00") },
];

for (const { start, end } of intersect(morning, afternoon)) {
  console.log(`${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}`);
}
for (const { start, end } of union(morning, afternoon)) {
  console.log(`${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}`);
}
for (const { start, end } of complement(morning)) {
  console.log(`${start?.toPlainDateTime()} → ${end?.toPlainDateTime()}`);
}

const [first] = morning;
console.log(contains(first!, at("2026-03-09T12:00")));
console.log(duration(first!)?.toString());
```

```text
2026-03-09T11:00:00 → 2026-03-09T12:00:00
2026-03-09T09:00:00 → 2026-03-09T17:00:00
undefined → 2026-03-09T09:00:00
2026-03-09T12:00:00 → undefined
false
PT3H
```

The undefined endpoints in the complement represent the unbounded past and
future. `contains` returns `false` at 12:00 because the interval excludes its
end.

### Interval helpers

|                                                      |                                                        |
| ---------------------------------------------------- | ------------------------------------------------------ |
| `contains(interval, at): boolean`                    | whether an instant falls inside, end excluded          |
| `duration(interval): Temporal.Duration \| undefined` | exact elapsed length, or `undefined` if unbounded      |
| `isEmpty(interval): boolean`                         | whether it contains no time at all                     |
| `compareStarts(a, b): number`                        | compare two starts, `undefined` sorting first          |
| `compareEnds(a, b): number`                          | compare two ends, `undefined` sorting last             |
| `startsBeforeEnd(start, end): boolean`               | strictly before: what makes an interval non-empty      |
| `startsAtOrBeforeEnd(start, end): boolean`           | at or before: what separates touching from overlapping |

`compareStarts` sorts an undefined endpoint first. `compareEnds` sorts one
last. The two functions differ because undefined has a different meaning at
each end of an interval.

`duration` measures exact elapsed time. See [time zones](../time-zones/) for
examples across clock changes.

## Planned features

The package does not yet include estimates, backward search over an unbounded
past, custom rule types, rule set diffing, or a command-line interface.

<!-- card
```ts
import { activeAt, timeOfDay, weekdays } from "@kensio/quando";

const rule: Rule = weekdays().and(timeOfDay("09:00", "17:00"));
const open: boolean = activeAt(rule, when);
```
-->
