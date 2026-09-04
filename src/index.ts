/** Friendly APIs for schedules, rotas, tallies, and temporal rules. */

export type { Context } from "./context.js";
export type { JsonCompatible, JsonPrimitive, JsonValue } from "./json.js";
export type { PlainRule } from "./plain-forms.js";
export type { Month, Rule, Weekday } from "./rule.js";
export { MONTHS, WEEKDAYS } from "./rule.js";

export type { Built } from "./build.js";
export {
  all,
  always,
  any,
  dates,
  daysOfMonth,
  daysOfWeek,
  inZone,
  monthsOfYear,
  never,
  not,
  timeOfDay,
  weekdays,
  weekends,
} from "./build.js";
export { canonical, equals, fingerprint } from "./canonical.js";
export type { CronOptions } from "./cron.js";
export { parseCron } from "./cron.js";
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
  TimelineOptions,
  TimelineOutput,
  TimelineSpan,
} from "./timeline.js";
export { renderTimeline, TIMELINE_FORMATS } from "./timeline.js";

export type {
  AssignmentStep,
  Explanation,
  ExplanationStep,
  ReplacementStep,
  RuleExplanation,
  SkippedLayer,
} from "./explain.js";
export type { LayerOptions } from "./layer-options.js";

export type { SlotOptions } from "./availability.js";
export { firstGap, slots } from "./availability.js";

export type {
  Schedule,
  ScheduleChanges,
  ScheduleData,
  ScheduleExplanation,
  ScheduleOptions,
} from "./schedule.js";
export { parseSchedule, schedule } from "./schedule.js";
export type { Rota, RotaData } from "./rota.js";
export { parseRota, rota } from "./rota.js";
export type { Tally, TallyData, TallyExplanation } from "./tally.js";
export { parseTally, tally } from "./tally.js";

export { asBoolean, asString } from "./parse-shape.js";
export type { Search } from "./query.js";
export {
  activeAt,
  advanceBy,
  coveredDuration,
  DEFAULT_SEARCH_LIMIT,
  nextCoveredInterval,
  SearchLimitExceededError,
} from "./query.js";
