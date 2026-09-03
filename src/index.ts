/** Friendly APIs for schedules, rotas, tallies, and temporal rules. */

export type { Context } from "./context.js";
export type { JsonCompatible, JsonPrimitive, JsonValue } from "./json.js";
export type { PlainRule } from "./plain-forms.js";
export type { Rule, Weekday } from "./rule.js";
export { WEEKDAYS } from "./rule.js";

export type { Built } from "./build.js";
export {
  all,
  always,
  any,
  dates,
  daysOfWeek,
  inZone,
  never,
  not,
  timeOfDay,
  weekdays,
  weekends,
} from "./build.js";
export { canonical, equals, fingerprint } from "./canonical.js";
export { parseRule } from "./parse.js";

export type { Schedule, ScheduleData, ScheduleOptions } from "./schedule.js";
export { parseSchedule, schedule } from "./schedule.js";
export type { Rota, RotaData } from "./rota.js";
export { parseRota, rota } from "./rota.js";
export type { Tally, TallyData } from "./tally.js";
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
