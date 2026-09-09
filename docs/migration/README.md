# Migrating from 1.x

This revision changes public names and query contracts. Update imports and
method calls together. Existing stored definitions keep their JSON tags.

## Names

| Previous API             | Revised API                       |
| ------------------------ | --------------------------------- |
| `hoursOn`                | `setHours`                        |
| `opensNext`              | `nextOpenInterval`                |
| `tally.exactly`          | `tally.setCount`                  |
| `tally.least`            | `tally.minimumCount`              |
| `tally.counts`           | `tally.countIntervals`            |
| `rota.swap`              | `rota.assign`                     |
| `tally.at`               | `tally.countAt`                   |
| `timeOfDay`              | `timeOfDayRange`                  |
| `between`                | `datesBetween`                    |
| `every`                  | `everyNthPeriod`                  |
| `custom`                 | `customRule`                      |
| `withRules`              | `withCustomRules`                 |
| `activeAt`               | `isActiveAt`                      |
| `firstGap`               | `firstAvailableSlot`              |
| `slots`                  | `availableSlots`                  |
| `advanceBy`              | `addCoveredTime`                  |
| `advanceByCoveredDays`   | `addCoveredDays`                  |
| `atMost`                 | `atMostOccurrences`               |
| `atMostTime`             | `atMostOccupiedTime`              |
| `spacedBy`               | `minimumGap`                      |
| `admits`                 | `allowsPlan`                      |
| `uncertain`              | `unknownIntervals`                |
| `uncertainValues`        | `unknownValueIntervals`           |
| `spread` / `Spread`      | `possibilities` / `Possibilities` |
| `support`                | `possibleValues`                  |
| `naturally`              | `naturalOrder`                    |
| `combineOutcomes`        | `combineIndependentOutcomes`      |
| `equals`                 | `sameDefinition`                  |
| `parseTerms`             | `parseRuleExpression`             |
| `asString` / `asBoolean` | `parseString` / `parseBoolean`    |
| `nextValue`              | `nextValueInterval`               |
| `Covers`                 | `CoverageSource`                  |
| `Valued`                 | `ValueInterval`                   |
| `PlainRule`              | `RuleInput`                       |
| `Built<R>`               | `Rule<R>`                         |
| Stored-data `Rule`       | `RuleData`                        |

Keep the slot cadence option `every` and the expression grammar's `every:`.
These are distinct from the renamed `everyNthPeriod` function.

## Query arguments and results

Durations accept objects such as `{ minutes: 30 }`, ISO strings, or Temporal
durations. Search methods take a named options object:

```ts
office.firstOpenSlot(from, { minutes: 30 }, { within: { days: 14 } });
firstAvailableSlot(office, { minutes: 30 }, { from, within: { days: 14 } });
atMostOccurrences(4, { per: "day" });
atMostOccurrences(4, { within: { hours: 24 } });
```

Finite queries require `to` in TypeScript and at runtime. This includes
`availableSlots`, `coveredDuration`, `coveredDayCount`, `coverageChanges`,
`accumulate`, `timeline`, and `tally.countIntervals`. A returned `Slot` has
definite endpoints. Iterators are consumed once.

`nextOpenInterval` and `nextCoveredInterval` return an interval clipped to the
search by default. Replace `complete: true` with `intervalEnd: "complete"` and
optionally set `endWithin` to bound the search for its end. Both automatic
searches default to 100 years. Explicit start searches return `undefined` on
failure. Automatic limits and unresolved complete ends throw
`SearchLimitExceededError`.

Domain queries accept `occurrences`, `rules`, and `disambiguation`. Standalone
queries and value selectors preserve attached custom-rule settings. Explicit
settings take precedence. Select JSON object values with `whereValueMatches`.
`assigned` continues to compare values using `Object.is`.

Schedule arithmetic now accepts `Estimate` inputs, including variables typed
as the union. An unresolved estimate throws `UnresolvedOutcomeError` with its
`outcome`, `operation`, and `within` limit. No outcomes are removed.

## Timelines, explanations, and diagnostics

Replace `office.renderTimeline(from, to)` with `office.timeline(from, to)`.
Replace standalone `renderTimeline(source, window)` with `timeline(source, window)`.
For text, pass the resulting data to `renderTimeline(data)`.

Rule explanations expose `status: "matched" | "unmatched" | "unknown"` in
place of `matched` and `known`. Cascade and domain explanations have a short
`summary` and full `details`, with structured `steps` and `skipped` retained.
Domain explanations throw when the value cannot be known.

Diagnostics include `severity` and their evaluated `window`. Inactive rules
and layers are informational. CLI validation exits successfully for information
alone. Warnings and errors still fail. Rota validation requests full coverage
by default through both its method and the standalone function.

## Behavior corrections

- Friday overnight opening hours now run from Friday evening into Saturday.
  `setHours` replaces the selected starting day's overnight spillover too.
- Whole-plan occupied-time checks include each complete candidate booking.
  A booking that exceeds the allowance can fail partway through itself.
- Queries refuse answers that depend on coverage beyond a knowledge horizon.
  Use `unknownIntervals`, `unknownValueIntervals`, or core `bounds` to inspect
  missing knowledge deliberately.
- `countIntervals` includes zero-count gaps. `minimumCount` preserves negative
  counts while accounting for those gaps.
- `parseRRule(written)` consumes a successful export's start, duration, and zone.
  Timestamp `UNTIL` bounds are rejected. Export of timed rules with an upper
  date bound is also refused until that precision can be preserved.

## Stored definitions

Existing JSON discriminants such as `"timeOfDay"`, `"every"`, `"atMost"`, and
`"spread"` are unchanged. Do not run a text replacement over stored JSON.
Definitions need no migration for these API renames.

New rotas and tallies can store an optional `zone`. New overnight schedules
use the additive `shiftDays` rule node. Older releases reject those new forms.
Upgrade every reader before sharing newly written definitions. Existing
overnight definitions retain their old meaning when parsed. Rebuild them with
the revised schedule API to adopt starting-day ownership.

Parsers now throw `ParseError` with `path` and `code`. They still accept decoded
data, so parse JSON text first. Custom callbacks remain outside the document. Reattach them with `withCustomRules`. Rename a custom definition's `known`
callback to `knownThrough`. `defineCustomRule` ties validated options to the
types of its evaluation, description, and horizon callbacks.

<!-- card
```ts
office.setHours("2026-12-24", "09:00-15:00");
staff.setCount(weekdays(), 3);
```
-->
