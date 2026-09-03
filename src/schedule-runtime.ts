import { all, inZone } from "./build.js";
import { type Layer, cascade, layer, replace } from "./cascade.js";
import { withMethods } from "./fluent.js";
import { asDays, asHours, type PlainRule } from "./plain-forms.js";
import type { Rule } from "./rule.js";
import { scheduleQueries } from "./schedule-queries.js";
import type { Schedule, ScheduleData } from "./schedule-types.js";

function inScheduleZone(rule: Rule, zone: string | undefined): Rule {
  return zone === undefined ? rule : inZone(zone, rule);
}

function opening(
  scope: PlainRule,
  hours: PlainRule | undefined,
  zone: string | undefined,
): Layer<boolean> {
  const when =
    hours === undefined ? asDays(scope) : all(asDays(scope), asHours(hours));
  return layer(inScheduleZone(when, zone), true);
}

function closure(scope: PlainRule, zone: string | undefined): Layer<boolean> {
  return layer(inScheduleZone(asDays(scope), zone), false);
}

function changedHours(
  day: PlainRule,
  hours: PlainRule,
  zone: string | undefined,
): Layer<boolean> {
  const days = inScheduleZone(asDays(day), zone);
  const open = inScheduleZone(asHours(hours), zone);
  return replace(days, open);
}

/** Restores schedule methods on validated schedule data. */
export function restoreSchedule(data: ScheduleData): Schedule {
  const { cascade: document, zone } = data;
  const append = (next: Layer<boolean>): Schedule =>
    restoreSchedule({ ...data, cascade: cascade(...document.layers, next) });

  return withMethods(data, {
    open: (scope: PlainRule, hours?: PlainRule) =>
      append(opening(scope, hours, zone)),
    closed: (scope: PlainRule) => append(closure(scope, zone)),
    hoursOn: (day: PlainRule, hours: PlainRule) =>
      append(changedHours(day, hours, zone)),
    ...scheduleQueries(document),
    toJSON: () => ({ ...data }),
  });
}
