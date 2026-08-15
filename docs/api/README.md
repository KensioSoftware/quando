# API

Everything `@kensio/quando` exports, and nothing else. There is one entry point:

```ts
import { activeAt, timeOfDay, weekdays } from "@kensio/quando";
```

Types are exported alongside the functions, so `import type { Rule }` works from
the same place.

## Building rules

Each of these returns a [`Built<R>`](#built): the rule itself, with `and`, `or`
and `except` on it. See [rules](../rules/).

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

`inZone` is constrained to the rule types that have a zone —
`DaysOfWeekRule | DatesRule | TimeOfDayRule` — so applying one to an `all` is a
compile error rather than a silently ignored field.

Times are `"09:00"`, dates are `"2026-03-14"`, and zones are IANA names like
`"Europe/London"`. All three are the strings `Temporal` accepts, because that is
what parses them.

### `Built`

```ts
type Built<R extends Rule> = R & {
  readonly and: (...others: readonly Rule[]) => Built<AllRule>;
  readonly or: (...others: readonly Rule[]) => Built<AnyRule>;
  readonly except: (...others: readonly Rule[]) => Built<AllRule>;
};
```

`.except(…)` is `all(this, not(any(…)))`. A `Built<R>` is an `R`, so it can go
anywhere a `Rule` can and serialises as one.

## Reading rules

### `intervals(rule: Rule, context: Context): IntervalStream`

The times a rule covers within a context, in ascending order, coalesced, and
clipped to the context's window. Lazy, and endless if the context has no end and
the rule recurs. Every interval comes back read in `context.from`'s zone.

### `Context`

```ts
interface Context {
  readonly from: Temporal.ZonedDateTime;
  readonly to?: Temporal.ZonedDateTime;
  readonly location?: { readonly latitude: number; readonly longitude: number };
  readonly locale?: string;
}
```

`from` is where evaluation begins and — since a `ZonedDateTime` carries one —
the zone any rule that does not name its own is read in. `to` is optional
because a recurrence genuinely has no end; see
[termination](../queries/#termination) for when you need it anyway.

`location` and `locale` are carried but unused so far. They are declared because
a rule about sunrise will need coordinates and a rendered description will need
a locale, and widening a bare parameter into an object later would break every
caller.

## Queries

See [queries](../queries/).

|                                                                         |                                         |
| ----------------------------------------------------------------------- | --------------------------------------- |
| `activeAt(rule, at, context?): boolean`                                 | whether a rule covers an instant        |
| `elapsed(rule, context): Temporal.Duration`                             | how much time a rule covers in a window |
| `next(rule, context, search?): Interval \| undefined`                   | the next stretch a rule covers          |
| `advanceBy(from, amount, options): Temporal.ZonedDateTime \| undefined` | where an amount of rule-time gets you   |

```ts
function activeAt(
  rule: Rule,
  at: Temporal.ZonedDateTime,
  context?: Omit<Context, "from" | "to">,
): boolean;

function elapsed(rule: Rule, context: Context): Temporal.Duration;

function next(
  rule: Rule,
  context: Context,
  search?: Search,
): Interval | undefined;

function advanceBy(
  from: Temporal.ZonedDateTime,
  amount: Temporal.Duration,
  options: { readonly during: Rule } & Search & Omit<Context, "from" | "to">,
): Temporal.ZonedDateTime | undefined;
```

`elapsed` throws a `RangeError` on a context with no `to`. `advanceBy` throws a
`RangeError` on a negative amount, or on one carrying years, months, weeks or
days.

### `Search`

```ts
interface Search {
  readonly within?: Temporal.Duration;
}
```

How far a search runs, from where it starts. Narrows only: a context that
already ends before the horizon keeps its own end.

## Serialisation

### `parseRule(value: unknown, path?: string): Rule`

A rule from unknown JSON, or a `TypeError` naming what is wrong and where.
`path` is the root name used in messages, and defaults to `"rule"`. See
[serialisation](../serialisation/).

## Schedules and rotas

The domain layer over cascades: a `Schedule` is a `Cascade<boolean>` and a
`Rota<V>` is a `Cascade<V>`, so everything below reads one. See
[schedules and rotas](../schedules/).

|                                                        |                                         |
| ------------------------------------------------------ | --------------------------------------- |
| `schedule(): Schedule`                                 | an empty schedule, open for nothing     |
| `.open(scope: PlainRule, hours?: PlainRule): Schedule` | open during these times                 |
| `.closed(scope: PlainRule): Schedule`                  | closed for the whole of these           |
| `.on(day: PlainRule, hours: PlainRule): Schedule`      | on this day, these hours instead        |
| `.isOpen(at): boolean`                                 | whether it is open at that moment       |
| `.opensNext(at, within?): Interval \| undefined`       | the next stretch it is open             |
| `.openBetween(from, to): Temporal.Duration`            | how long it is open between two moments |
| `rota<V = never>(): Rota<V>`                           | an empty rota, nobody on                |
| `.assign(scope: PlainRule, value: W): Rota<V \| W>`    | these times belong to this one          |
| `.on(day: PlainRule, value: W): Rota<V \| W>`          | a swap                                  |
| `.whoIsOn(at): V \| undefined`                         | who is on at that moment                |
| `.shifts(from, to?): ValuedStream<V>`                  | each stretch and who has it             |

`assign` and `on` take a `const` type parameter, so the value type accumulates
as literals: two names in gives `"alice" | "bob" | undefined` out rather than
`string`. Declare it — `rota<string>()` — when the values are not known up
front.

```ts
type PlainRule = Rule | string;
```

A string is a `"09:00-17:00"` window where hours are expected, and a
`"2026-03-11"` day where a scope is expected. Both are checked when written,
unlike the rule layer, which checks when evaluated — these exist to be typed by
hand. Anywhere a `PlainRule` is accepted, a `Rule` is accepted too.

## Cascades

Ordered layers carrying values, resolved by precedence. What schedules and rotas
are made of, and what to reach for when their vocabulary runs out. See
[cascades](../cascades/).

|                                                                       |                                                                              |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `cascade<V>(...layers: readonly Layer<V>[]): Cascade<V>`              | an ordered list of layers, lowest priority first                             |
| `layer<V>(scope: Rule, value: V): ConstantLayer<V>`                   | one value, across the whole of a scope                                       |
| `replace<V>(scope: Rule, replacement: Cascade<V>): ReplacingLayer<V>` | a scope claimed outright, with what holds inside it given by another cascade |
| `replace(scope: Rule, replacement: Rule): ReplacingLayer<boolean>`    | the same, taking the rule a schedule means                                   |
| `whenever(rule: Rule): Cascade<boolean>`                              | true while a rule holds, unassigned elsewhere                                |
| `isCascade<V>(value: Rule \| Cascade<V>): value is Cascade<V>`        | tells a cascade from a rule                                                  |
| `resolve<V>(cascade: Cascade<V>, context: Context): ValuedStream<V>`  | the values a cascade assigns                                                 |

```ts
interface Cascade<V> {
  readonly type: "cascade";
  readonly layers: readonly Layer<V>[];
}

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

`Valued<V>` extends `Interval`, so `duration`, `contains` and `isEmpty` read one
unchanged. A `ValuedStream<V>` keeps the same contract as an `IntervalStream`,
with one addition: touching intervals carrying the same value are merged, so
where two intervals do touch, the values on either side of the boundary differ.

Overlap between layers is settled by precedence — the last layer to claim a
moment wins — and there is no merge function for quantities yet.

## Rule types

The data behind the builders. A `Rule` is one of eight tagged objects, and
nothing more — no methods, no class, no hidden state.

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

`Weekday` is `"monday" | … | "sunday"`, and `WEEKDAYS` is the same seven as a
readonly tuple in calendar order, exported so that iterating the days of the
week does not mean writing them out again.

## Intervals

The layer everything above is built from, exported because it is useful on its
own — a stream of intervals from anywhere at all can go through these.

### `Interval`

```ts
interface Interval {
  readonly start: Temporal.ZonedDateTime | undefined;
  readonly end: Temporal.ZonedDateTime | undefined;
}
```

Half open: `[start, end)`. Either end may be `undefined`, meaning unbounded —
position says which, so an absent `start` is the unbounded past and an absent
`end` the unbounded future.

### `IntervalStream`

```ts
type IntervalStream = Iterable<Interval>;
```

**The contract, which every producer must uphold:** intervals arrive in
_ascending_ order of start, do not overlap, and are already coalesced. The
operations below are single-pass sweeps and rely on all three; a stream that
breaks one produces wrong answers rather than errors.

Ascending is stated rather than implied because a descending stream is a real
thing to want later — "when did this last open" — and one would satisfy every
other clause here while being read wrongly by all of it.

|                                                    |                                                    |
| -------------------------------------------------- | -------------------------------------------------- |
| `intersect(left, right): IntervalStream`           | the times both cover                               |
| `union(left, right): IntervalStream`               | the times either covers, coalesced                 |
| `complement(source): IntervalStream`               | the gaps, plus the unbounded stretches at each end |
| `clip(source, window: Interval): IntervalStream`   | a stream limited to a window                       |
| `take<T>(source: Iterable<T>, count: number): T[]` | the first `count` items of any sequence            |

Every one of them is lazy, pulling from its sources only as far as it needs.
`clip` is intersection with a one-interval stream, which is where its early stop
comes from: once the window is consumed there is nothing left to intersect
against, so an infinite source is never drained.

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

The `undefined`s in the complement are the unbounded past and the unbounded
future. `contains` is `false` at 12:00 because the interval excludes its end.

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

There are two comparison functions rather than one because `undefined` means
opposite things in the two positions, and a single function taking both would
need telling which it was looking at anyway.

`duration` is exact rather than wall clock: it measures how long an interval
lasted, which across a clock change is not what the clock says. See
[time zones](../time-zones/).

## Not here yet

Designed, not built, and so deliberately absent from the package: merging
values that should add rather than displace, `parseCascade` for the JSON
boundary a cascade does not yet have, queries that take a cascade rather than a
rule, estimates and uncertainty, backward search over an unbounded past, custom
rule types, a canonical form for comparing rules, and the command line. Nothing
above depends on them arriving.

<!-- card
```ts
import { activeAt, timeOfDay, weekdays } from "@kensio/quando";

const rule: Rule = weekdays().and(timeOfDay("09:00", "17:00"));
const open: boolean = activeAt(rule, when);
```
-->
