import { any, inZone } from "./build.js";
import {
  openingHours,
  overnightPortion,
  hasOvernightHours,
} from "./opening-hours.js";
import { type Layer, layer, replace } from "./cascade.js";
import type { LayerOptions } from "./layer-options.js";
import { asDays, asHours, type RuleInput } from "./plain-forms.js";
import type { RuleData } from "./rule.js";

function inScheduleZone(rule: RuleData, zone: string | undefined): RuleData {
  return zone === undefined ? rule : inZone(zone, rule);
}

export function opening(
  scope: RuleInput,
  hours: RuleInput | undefined,
  zone: string | undefined,
  options: LayerOptions | undefined,
): Layer<boolean> {
  const when =
    hours === undefined
      ? asDays(scope)
      : openingHours(asDays(scope), asHours(hours));
  return layer(inScheduleZone(when, zone), true, options);
}

export function closure(
  scope: RuleInput,
  zone: string | undefined,
  options: LayerOptions | undefined,
): Layer<boolean> {
  return layer(inScheduleZone(asDays(scope), zone), false, options);
}

export function changedHours(
  previous: readonly Layer<boolean>[],
  day: RuleInput,
  hours: RuleInput,
  zone: string | undefined,
  options: LayerOptions | undefined,
): Layer<boolean> {
  const selected = asDays(day);
  const days = inScheduleZone(selected, zone);
  const clock = asHours(hours);
  const oldOvernights = previous.flatMap(
    (entry) => overnightPortion(entry.scope, selected) ?? [],
  );
  if (oldOvernights.length === 0 && !hasOvernightHours(clock)) {
    return replace(days, inScheduleZone(clock, zone), options);
  }
  const open = inScheduleZone(openingHours(selected, clock), zone);
  return replace(any(days, open, ...oldOvernights), open, options);
}
