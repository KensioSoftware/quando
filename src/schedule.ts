import { cascade } from "./cascade.js";
import { parseCascade } from "./parse-cascade.js";
import { asBoolean } from "./parse-shape.js";
import { restoreSchedule } from "./schedule-runtime.js";
import type { Schedule, ScheduleOptions } from "./schedule-types.js";
import { asZone } from "./validation.js";

export type {
  Schedule,
  ScheduleData,
  ScheduleOptions,
} from "./schedule-types.js";

/** Creates empty opening hours in an optional local time zone. */
export function schedule(options: ScheduleOptions = {}): Schedule {
  const zone =
    options.zone === undefined ? undefined : asZone(options.zone, "zone");
  return restoreSchedule({
    type: "schedule",
    cascade: cascade<boolean>(),
    ...(zone === undefined ? {} : { zone }),
  });
}

/** Reads stored opening hours and restores their methods. */
export function parseSchedule(value: unknown, path = "schedule"): Schedule {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${path}: expected a schedule object.`);
  }
  const node = value as Record<string, unknown>;
  if (node["type"] !== "schedule") {
    throw new TypeError(`${path}.type: expected "schedule".`);
  }
  const unknown = Object.keys(node).find(
    (field) => !["type", "cascade", "zone"].includes(field),
  );
  if (unknown !== undefined) {
    throw new TypeError(`${path}.${unknown}: unknown schedule field.`);
  }

  const zone = parseZone(node["zone"], path);
  const document = parseCascade(node["cascade"], asBoolean, `${path}.cascade`);
  if (document.merge !== undefined && document.merge !== "override") {
    throw new TypeError(`${path}.cascade.merge: a schedule uses override.`);
  }
  return restoreSchedule({
    type: "schedule",
    cascade: document,
    ...(zone === undefined ? {} : { zone }),
  });
}

function parseZone(value: unknown, path: string): string | undefined {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "string") {
    throw new TypeError(`${path}.zone: expected a string.`);
  }
  return asZone(value, `${path}.zone`);
}
