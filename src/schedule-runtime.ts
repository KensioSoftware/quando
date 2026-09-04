import { all, inZone } from "./build.js";
import { type Layer, cascade, layer, replace } from "./cascade.js";
import { withMethods } from "./fluent.js";
import type { LayerOptions } from "./layer-options.js";
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
  options: LayerOptions | undefined,
): Layer<boolean> {
  const when =
    hours === undefined ? asDays(scope) : all(asDays(scope), asHours(hours));
  return layer(inScheduleZone(when, zone), true, options);
}

function closure(
  scope: PlainRule,
  zone: string | undefined,
  options: LayerOptions | undefined,
): Layer<boolean> {
  return layer(inScheduleZone(asDays(scope), zone), false, options);
}

function changedHours(
  day: PlainRule,
  hours: PlainRule,
  zone: string | undefined,
  options: LayerOptions | undefined,
): Layer<boolean> {
  const days = inScheduleZone(asDays(day), zone);
  const open = inScheduleZone(asHours(hours), zone);
  return replace(days, open, options);
}

function isLayerOptions(value: unknown): value is LayerOptions {
  return typeof value === "object" && value !== null && !("type" in value);
}

/** Restores schedule methods on validated schedule data. */
export function restoreSchedule(data: ScheduleData): Schedule {
  const { cascade: document, zone } = data;
  const append = (next: Layer<boolean>): Schedule =>
    restoreSchedule({ ...data, cascade: cascade(...document.layers, next) });

  return withMethods(data, {
    open: (
      scope: PlainRule,
      hoursOrOptions?: PlainRule | LayerOptions,
      options?: LayerOptions,
    ) => {
      const hasOptions = isLayerOptions(hoursOrOptions);
      const hours = hasOptions ? undefined : hoursOrOptions;
      return append(
        opening(scope, hours, zone, hasOptions ? hoursOrOptions : options),
      );
    },
    closed: (scope: PlainRule, options?: LayerOptions) =>
      append(closure(scope, zone, options)),
    hoursOn: (day: PlainRule, hours: PlainRule, options?: LayerOptions) =>
      append(changedHours(day, hours, zone, options)),
    ...scheduleQueries(document, zone),
    toJSON: () => ({ ...data }),
  });
}
