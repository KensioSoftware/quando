import { opening, closure, changedHours } from "./schedule-layers.js";
import { type Layer, cascade } from "./cascade.js";
import type { Context } from "./context.js";
import type { RuleRegistry } from "./custom-rules.js";
import { withMethods } from "./fluent.js";
import { withEvaluationOptions } from "./evaluation-options.js";
import { isLayerOptions, type LayerOptions } from "./layer-options.js";
import type { RuleInput } from "./plain-forms.js";
import { scheduleQueries } from "./schedule-queries.js";
import type { Schedule, ScheduleData } from "./schedule-types.js";

/**
 * Restores schedule methods on validated schedule data.
 *
 * `read` is what the schedule carries that its document cannot: the registry
 * a `custom` rule in one of its scopes is looked up in. It travels with every
 * derived schedule and stays out of `data`, which is what `toJSON` returns.
 */
export function restoreSchedule(
  data: ScheduleData,
  read?: Omit<Context, "from" | "to">,
): Schedule {
  const { cascade: document, zone } = data;
  const append = (next: Layer<boolean>): Schedule =>
    restoreSchedule(
      { ...data, cascade: cascade(...document.layers, next) },
      read,
    );

  return withEvaluationOptions(
    withMethods(data, {
      open: (
        scope: RuleInput,
        hoursOrOptions?: RuleInput | LayerOptions,
        options?: LayerOptions,
      ) => {
        const hasOptions = isLayerOptions(hoursOrOptions);
        const hours = hasOptions ? undefined : hoursOrOptions;
        return append(
          opening(scope, hours, zone, hasOptions ? hoursOrOptions : options),
        );
      },
      closed: (scope: RuleInput, options?: LayerOptions) =>
        append(closure(scope, zone, options)),
      setHours: (day: RuleInput, hours: RuleInput, options?: LayerOptions) =>
        append(changedHours(document.layers, day, hours, zone, options)),
      withCustomRules: (rules: RuleRegistry) =>
        restoreSchedule(data, { ...read, rules }),
      ...scheduleQueries(document, zone, read),
      toJSON: () => ({ ...data }),
    }),
    read,
  );
}
