/** Friendly APIs for schedules, rotas, tallies, and temporal rules. */

export type { Context, EvaluationOptions, QueryWindow } from "./context.js";
export type * from "./rule.js";
export type { DurationInput } from "./duration-input.js";
export type { Interval } from "./interval.js";
export type { ValueInterval } from "./cascade.js";
export type { CoverageSource, Assigned, ValueSelection } from "./assigned.js";
export { assigned, whereValueMatches } from "./assigned.js";
export type { ValueParser } from "./parse-cascade.js";
export type { AdvanceOptions } from "./advance.js";
export type { CalendarPeriod } from "./occurrence-builders.js";
export { ParseError } from "./parse-shape.js";
export { UnresolvedOutcomeError } from "./estimate-query.js";
export type { JsonCompatible, JsonPrimitive, JsonValue } from "./json.js";
export type { RuleInput } from "./plain-forms.js";
export type {
  CustomRule,
  InCalendarRule,
  KnownRule,
  Month,
  AtMostTimeRule,
  MonthCode,
  Period,
  RuleData,
  Weekday,
} from "./rule.js";
export { MONTH_CODES, MONTHS, PERIODS, WEEKDAYS } from "./rule.js";

export type { Rule } from "./build.js";
export type { EveryOptions } from "./every-builders.js";
export type { AtMostOptions } from "./occurrence-builders.js";
export {
  all,
  always,
  any,
  atMostOccurrences,
  atMostOccupiedTime,
  datesBetween,
  customRule,
  dates,
  daysOfMonth,
  daysOfWeek,
  everyNthPeriod,
  inCalendar,
  inZone,
  monthCodes,
  monthsOfYear,
  never,
  not,
  nthDayOfWeekInMonth,
  onOrAfter,
  onOrBefore,
  minimumGap,
  timeOfDayRange,
  weekdays,
  weekends,
} from "./build.js";
export { canonical, sameDefinition, fingerprint } from "./canonical.js";
export { knownThrough } from "./horizon.js";
export { BeyondHorizonError } from "./horizon-guard.js";
export { unknownValueIntervals } from "./resolve.js";
export { unknownIntervals } from "./bounds.js";
export { CustomRuleStreamError } from "./custom-rule-stream.js";
export type {
  CustomRuleType,
  CustomRuleDefinition,
  RuleRegistry,
} from "./custom-rules.js";
export { defineCustomRule } from "./custom-rules.js";
export { UnknownCustomRuleError } from "./custom-rules.js";
export type { CronOptions } from "./cron.js";
export { parseCron } from "./cron.js";
export type { CronExport, WrittenCron } from "./cron-export.js";
export { toCron } from "./cron-export.js";
export type { RRuleOptions } from "./rrule.js";
export { parseRRule } from "./rrule.js";
export type {
  RRuleExport,
  ToRRuleOptions,
  WrittenRRule,
} from "./rrule-export.js";
export { toRRule } from "./rrule-export.js";
export { parseRuleExpression } from "./terms.js";
export type { Occurrence } from "./occurrence.js";
export { MissingOccurrencesError } from "./occurrence.js";
export type { Unwritable } from "./export-result.js";
export { parseRule } from "./parse.js";

export type {
  ValidationDiagnostic,
  ValidationOptions,
  ValidationWindow,
} from "./semantic-validation.js";
export { validate } from "./semantic-validation.js";

export type { CoverageChanges } from "./coverage-changes.js";
export { coverageChanges } from "./coverage-changes.js";

export type { ElapsedUnit } from "./accumulate.js";
export { accumulate, ELAPSED_UNITS } from "./accumulate.js";

export type {
  Timeline,
  TimelineDay,
  TimelineFormat,
  TimelineSpan,
} from "./timeline.js";
export { timeline, renderTimeline, TIMELINE_FORMATS } from "./timeline.js";
export { explainRule } from "./explain.js";

export type {
  AssignmentStep,
  Explanation,
  ExplanationStep,
  ReplacementStep,
  RuleExplanation,
  SkippedLayer,
} from "./explain.js";
export type { LayerOptions } from "./layer-options.js";

export type { Slot, SlotOptions } from "./availability.js";
export { firstAvailableSlot, availableSlots } from "./availability.js";

export type {
  Schedule,
  ScheduleChanges,
  ScheduleData,
  ScheduleExplanation,
  ScheduleOptions,
  ScheduleSearch,
  QueryArrival,
} from "./schedule.js";
export { parseSchedule, schedule } from "./schedule.js";
export type { OpenDayOptions } from "./schedule-days.js";
export type { Rota, RotaData, RotaOptions } from "./rota.js";
export { parseRota, rota } from "./rota.js";
export type {
  Tally,
  TallyData,
  TallyExplanation,
  TallyOptions,
} from "./tally.js";
export { parseTally, tally } from "./tally.js";

export { parseBoolean, parseString } from "./parse-shape.js";
export type { Search } from "./query.js";
export {
  isActiveAt,
  addCoveredTime,
  coveredDuration,
  DEFAULT_SEARCH_LIMIT,
  nextCoveredInterval,
  SearchLimitExceededError,
} from "./query.js";
export type { Breach } from "./plan.js";
export { allowsPlan, firstBreach } from "./plan.js";
export type { CoveredDayOptions, StartingDay } from "./covered-days.js";
export { addCoveredDays, coveredDayCount } from "./covered-days.js";

export type {
  Distribution,
  Estimate,
  Outcome,
  Possibilities,
} from "./estimate.js";
export {
  assumeUniform,
  certainly,
  chances,
  isDistribution,
  possibilities,
} from "./estimate.js";
export type { Order } from "./estimate-order.js";
export { naturalOrder } from "./estimate-order.js";
export {
  combineIndependentOutcomes,
  mapOutcomes,
} from "./estimate-outcomes.js";
export {
  chanceBefore,
  median,
  mode,
  quantile,
  possibleValues,
} from "./estimate-views.js";
