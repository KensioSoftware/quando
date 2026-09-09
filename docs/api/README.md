# API reference

Import ordinary application APIs from `@kensio/quando`. Advanced cascade and
interval operations live in `@kensio/quando/core`, which also exports the root
API. `@kensio/quando/parsing` provides document and value parsers.

## Shared types and options

| Type                | Meaning                                                      |
| ------------------- | ------------------------------------------------------------ |
| `Rule`              | A fluent rule with `.and`, `.or`, and `.except`              |
| `RuleData`          | The JSON-compatible rule-node union                          |
| `RuleInput`         | A rule or a supported expression string                      |
| `DurationInput`     | A Temporal duration, ISO duration string, or duration object |
| `EvaluationOptions` | `rules`, `occurrences`, and `disambiguation`                 |
| `Context`           | Evaluation options plus `from` and optional `to`             |
| `QueryWindow`       | Evaluation options plus required `from` and `to`             |
| `CoverageSource<V>` | A rule, boolean cascade, schedule, or value selection        |
| `Interval`          | `start` and `end`, either of which can be unbounded          |
| `Slot`              | A fitted interval with required `start` and `end`            |
| `ValueInterval<V>`  | An interval carrying a `value`                               |

All instants are `Temporal.ZonedDateTime`. Windows include their start and
exclude their end. Public type names are exported beside the functions that
use them. Concrete rule-node types and calendar-name unions are also exported.

`Search` has `within?: DurationInput`, `intervalEnd?: "clipped" | "complete"`,
and `endWithin?: DurationInput`. The latter two control interval queries.
An explicit start-search limit returns `undefined` when no answer fits. An
unspecified limit uses `DEFAULT_SEARCH_LIMIT` (100 years) and throws
`SearchLimitExceededError` if exhausted. A complete-end search always throws
if it cannot establish the end within its limit.

## Schedules

`schedule({ zone? })` starts empty. Methods return new schedules, leaving the
previous definition available. `ScheduleData` is the stored form.
`ScheduleOptions`, `ScheduleSearch`, `OpenDayOptions`, and `ScheduleChanges`
name the construction, search, day-counting, and comparison contracts.

| Method                                   | Result or effect                           |
| ---------------------------------------- | ------------------------------------------ |
| `open(scope, hours?, layerOptions?)`     | Add open periods                           |
| `closed(scope, layerOptions?)`           | Close periods                              |
| `setHours(scope, hours, layerOptions?)`  | Replace the selected dates' hours          |
| `isOpen(at, options?)`                   | Boolean                                    |
| `nextOpenInterval(from, options?)`       | Current or next interval, or `undefined`   |
| `firstOpenSlot(from, lasting, options?)` | `Slot` or `undefined`                      |
| `openSlots(from, to, options)`           | Lazy candidate slots                       |
| `addOpenTime(from, amount, options?)`    | Arrival instant or estimate                |
| `addOpenDays(from, count, options?)`     | Arrival instant or estimate                |
| `openDuration(from, to, options?)`       | Elapsed duration                           |
| `openDayCount(from, to, options?)`       | Count of local dates with any opening      |
| `changesTo(next, from, to, options?)`    | `opened` and `closed` interval streams     |
| `timeline(from, to, options?)`           | `Timeline` data                            |
| `explain(at, options?)`                  | Value, summary, and trace                  |
| `validate(from, to, options?)`           | Contextual diagnostics                     |
| `withCustomRules(registry)`              | Derived schedule with executable callbacks |
| `toJSON()`                               | `ScheduleData`                             |

Query options accept `EvaluationOptions`. Slot options add `every` and
`lasting`. Search queries add `within`. Day arithmetic adds `startingDay`.
`LayerOptions` contains optional `label` and `comment`. See [schedules](../schedules/).

## Rotas and tallies

`rota({ zone? })` infers its assignment values as you chain calls. `rota<V>()`
constrains later assignments to `V`. `tally({ zone? })` combines numeric values.
All three domain objects accept the same zone option and evaluation settings.

| Rota method                           | Result or effect                               |
| ------------------------------------- | ---------------------------------------------- |
| `assign(scope, value, layerOptions?)` | Add a higher-priority assignment               |
| `whoIsOn(at, options?)`               | Assigned value or `undefined`                  |
| `shifts(from, to?, options?)`         | Lazy assigned intervals                        |
| `explain(at, options?)`               | Assignment and trace                           |
| `validate(from, to, options?)`        | Diagnostics. Full coverage required by default |
| `withCustomRules(registry)`           | Attach callbacks                               |
| `toJSON()`                            | `RotaData<V>`                                  |

| Tally method                             | Result or effect                  |
| ---------------------------------------- | --------------------------------- |
| `plus(scope, amount, layerOptions?)`     | Add a numeric contribution        |
| `setCount(scope, amount, layerOptions?)` | Replace the total in the scope    |
| `countAt(at, options?)`                  | Number, defaulting to zero        |
| `minimumCount(from, to, options?)`       | Lowest count, including zero gaps |
| `countIntervals(from, to, options?)`     | Lazy counts including zero gaps   |
| `totalBetween(from, to, unit, options?)` | Sum of count × elapsed units      |
| `explain(at, options?)`                  | Total and contribution trace      |
| `validate(from, to, options?)`           | Diagnostics                       |
| `withCustomRules(registry)`              | Attach callbacks                  |
| `toJSON()`                               | `TallyData`                       |

See [rotas](../schedules/#build-a-rota) and [tallies](../accumulation/).

## Rule builders

| Builder                                             | Coverage                                          |
| --------------------------------------------------- | ------------------------------------------------- |
| `always()`, `never()`                               | All time or no time                               |
| `weekdays()`, `weekends()`                          | Monday–Friday or Saturday–Sunday                  |
| `daysOfWeek(...days)`                               | Named weekdays                                    |
| `daysOfMonth(...days)`                              | Month days. Negatives count backward from the end |
| `nthDayOfWeekInMonth(n, day)`                       | A counted weekday, such as the last Friday        |
| `monthsOfYear(...months)`                           | Named Gregorian months                            |
| `monthCodes(...codes)`                              | Calendar month codes                              |
| `everyNthPeriod(n, period, options)`                | Repeating calendar periods with an anchor         |
| `timeOfDayRange(from, to, zone?)`                   | Local clock range, possibly overnight             |
| `dates(...dates)`                                   | Named dates                                       |
| `datesBetween(from, to, zone?)`                     | Inclusive date range                              |
| `onOrAfter(date, zone?)`, `onOrBefore(date, zone?)` | Inclusive date bounds                             |
| `all(...rules)`, `any(...rules)`, `not(rule)`       | Intersection, union, and exclusion                |
| `inZone(zone, rule)`, `inCalendar(calendar, rule)`  | Evaluate a subtree on a clock or calendar         |
| `knownThrough(date, rule)`                          | Declare an inclusive knowledge horizon            |
| `customRule(name, options?, zone?)`                 | Refer to an executable custom definition          |

Builder results are fluent `Rule` values and also valid `RuleData`.
`.and`, `.or`, and `.except` compose them. Combining a weekday and an overnight
clock rule with `.and` means both predicates hold at the queried instant.
`open(day, hours)` supplies starting-day ownership for shifts. See [rules](../rules/).

## Standalone queries

| Function                                               | Result                                                   |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `isActiveAt(source, at, options?)`                     | Boolean                                                  |
| `nextCoveredInterval(source, context, search?)`        | Interval or `undefined`                                  |
| `firstAvailableSlot(source, lasting, options)`         | Slot or `undefined`. Options include `from` and `within` |
| `availableSlots(source, window, { every, lasting })`   | Lazy finite slot stream                                  |
| `coveredDuration(source, window)`                      | Elapsed duration                                         |
| `coveredDayCount(source, window)`                      | Covered local dates                                      |
| `addCoveredTime(from, amount, { during, ...options })` | Arrival or estimate                                      |
| `addCoveredDays(from, count, { during, ...options })`  | Arrival or estimate                                      |
| `coverageChanges(before, after, window)`               | `added` and `removed` streams                            |
| `accumulate(cascade, window, unit)`                    | Numeric value × elapsed time                             |
| `assigned(cascade, value)`                             | Coverage selection using `Object.is`                     |
| `whereValueMatches(cascade, predicate)`                | Coverage selection by predicate                          |
| `unknownIntervals(rule, context)`                      | Intervals with missing coverage knowledge                |
| `unknownValueIntervals(cascade, context)`              | Intervals with unresolved values                         |

`window` means a finite `QueryWindow`. Streams are consumed once. Scalar
arithmetic can return `undefined`. Estimate arithmetic must resolve every
outcome or throw `UnresolvedOutcomeError` with the outcome and search limit. See [queries](../queries/).

## Constraints

`atMostOccurrences(count, { per, zone? })` limits calendar-bucket counts.
Use `{ within, zone? }` for a rolling window. `per` uses singular names: `"day"`,
`"week"`, `"month"`, or `"year"`. `atMostOccupiedTime(amount, options)` limits
occupied elapsed time. `minimumGap(duration)` measures end-to-start spacing.

`allowsPlan(rule, plan, { occurrences, ...options })` checks complete candidate
occurrences. `firstBreach` returns a `Breach` with `index`, `occurrence`, `at`,
and `explanation`, or `undefined`. Missing history throws
`MissingOccurrencesError`. An empty history is `[]`. See [constraints](../constraints/).

## Explanations, validation, and timelines

`explainRule(rule, at, options?)` returns a `RuleExplanation` with `status`,
`description`, and child `conditions`. Status is `"matched"`, `"unmatched"`,
or `"unknown"`. Domain explanations expose `value`, short `summary`, full
`details`, `steps`, and `skipped`. Unknown domain values throw.

`validate(source, window, { requireFullCoverage? })` returns diagnostics with
`code`, `message`, `severity`, and the evaluated `window`. Layer findings also
include `path`. Uncovered-time findings include `interval`. See [validation](../validation/).

`timeline(source, window)` and `schedule.timeline(from, to)` return `Timeline`
data. `renderTimeline(data)` returns text. The renderer never evaluates a
source. See [timelines](../timelines/) and [CLI](../cli/).

## Parsing and custom rules

`parseRule`, `parseSchedule`, `parseRota`, `parseTally`, and `parseCascade` accept
decoded `unknown` data. `parseRota` and `parseCascade` also take a `ValueParser<V>`.
`parseString` and `parseBoolean` validate primitive values. `ParseError` carries
`path` and `code`. See [serialisation](../serialisation/).

`parseRuleExpression(text)` reads Quando's small expression grammar.
`parseCron(text, options?)` covers firing minutes. `parseRRule(text, options)`
requires `start` and accepts `zone` and `duration`. `parseRRule(written)` accepts
a complete successful export. `toCron` and `toRRule` return `ok: true` with the
notation fields, or `ok: false` with a `reason`. Consult the
[cron](../cron/) and [RRULE limits](../recurrence/#limits) before conversion.

`defineCustomRule({ parseOptions, intervals, describe?, knownThrough? })`
returns a `CustomRuleType` with typed callback options. Place definitions in a
`RuleRegistry`. Interval callbacks must yield sorted, non-overlapping spans.
Touching spans merge and results are clipped. Evaluation stops reading once
it can establish the requested window's result. A finite callback is valid too.

## Estimates

| Function                                           | Meaning                                           |
| -------------------------------------------------- | ------------------------------------------------- |
| `possibilities(values)`                            | Discrete possible outcomes with no probabilities  |
| `chances(outcomes)`                                | Outcomes with probabilities totaling one          |
| `certainly(value)`                                 | One outcome with probability one                  |
| `assumeUniform(estimate)`                          | Explicitly assign equal probabilities             |
| `mapOutcomes(estimate, mapper)`                    | Map values while preserving probability mass      |
| `combineIndependentOutcomes(left, right, combine)` | Combine under an independence assumption          |
| `possibleValues(estimate, order?)`                 | Sorted distinct values                            |
| `chanceBefore(distribution, value, order?)`        | Probability of an earlier outcome                 |
| `median`, `mode`, `quantile`                       | Distribution summaries                            |
| `isDistribution`                                   | Narrow an estimate to a distribution              |
| `naturalOrder`                                     | Comparator for supported naturally ordered values |

`Estimate<V>` is `Possibilities<V> | Distribution<V>`. A possibilities value
such as `[1, 3]` does not contain 2. See [uncertainty](../uncertainty/).

## Comparison and core operations

`canonical` normalizes a rule or cascade. `sameDefinition` compares canonical
forms. It does not prove equal coverage. `fingerprint` returns the complete
canonical JSON string. Use `coverageChanges` for evaluated differences within
a window. See [comparison](../comparing/).

Core exports `cascade`, `layer`, `replace`, `merged`, `whenever`, `resolve`,
`intervals`, `valueAt`, `nextValueInterval`, `asCascade`, `isCascade`, and
`bounds`. `nextValueInterval` accepts a bounded search. `resolve` yields known
assigned intervals and omits unknown regions. Inspect `unknownValueIntervals`
when consuming it directly. Public `intervals` refuses unknown coverage.

Interval operations include `union`, `intersect`, `difference`, `complement`,
`clip`, `overlay`, `take`, `contains`, `duration`, `isEmpty`, `compareStarts`,
`compareEnds`, `startsBeforeEnd`, and `startsAtOrBeforeEnd`. Unbounded core
streams require careful consumption. An empty recurring intersection may not
terminate without `to`. See [cascades](../cascades/) and [merging](../merging/).

<!-- card
```ts
const slot = office.firstOpenSlot(from, { minutes: 30 }, {
  within: { days: 14 },
});
```
-->
