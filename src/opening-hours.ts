import { all, any, timeOfDayRange } from "./build.js";
import type { RuleData } from "./rule.js";

/** Attaches overnight hours to the date on which they begin. */
export function openingHours(scope: RuleData, hours: RuleData): RuleData {
  if (hours.type === "any" && hasOvernightHours(hours)) {
    return any(...hours.rules.map((rule) => openingHours(scope, rule)));
  }
  if (
    hours.type !== "timeOfDay" ||
    Temporal.PlainTime.compare(hours.from, hours.to) < 0
  ) {
    return all(scope, hours);
  }
  const late = all(scope, timeOfDayRange(hours.from, "00:00", hours.zone));
  if (Temporal.PlainTime.compare(hours.to, "00:00") === 0) {
    return late;
  }
  const tomorrow: RuleData = { type: "shiftDays", days: 1, rule: scope };
  return any(
    late,
    all(tomorrow, timeOfDayRange("00:00", hours.to, hours.zone)),
  );
}

export function hasOvernightHours(hours: RuleData): boolean {
  return hours.type === "any"
    ? hours.rules.some(hasOvernightHours)
    : hours.type === "timeOfDay" &&
        hours.to !== "00:00" &&
        Temporal.PlainTime.compare(hours.from, hours.to) > 0;
}

/** Finds the following-day portions owned by the selected starting dates. */
export function overnightPortion(
  rule: RuleData,
  dates: RuleData,
): RuleData | undefined {
  switch (rule.type) {
    case "shiftDays": {
      return { ...rule, rule: all(rule.rule, dates) };
    }
    case "inZone":
    case "inCalendar": {
      const child = overnightPortion(rule.rule, dates);
      return child === undefined ? undefined : { ...rule, rule: child };
    }
    case "any":
    case "all": {
      const portions = rule.rules.flatMap((child, index) => {
        const portion = overnightPortion(child, dates);
        if (portion === undefined) {
          return [];
        }
        return rule.type === "any"
          ? [portion]
          : [
              all(
                ...rule.rules.map((sibling, at) =>
                  at === index ? portion : sibling,
                ),
              ),
            ];
      });
      return portions.length === 0 ? undefined : any(...portions);
    }
    case "always":
    case "never":
    case "dates":
    case "dateRange":
    case "daysOfWeek":
    case "daysOfMonth":
    case "nthDayOfWeekInMonth":
    case "monthsOfYear":
    case "monthCodes":
    case "every":
    case "timeOfDay":
    case "atMost":
    case "atMostTime":
    case "spacedBy":
    case "custom":
    case "known":
    case "not": {
      return undefined;
    }
  }
}
