import { parseDomain } from "./parse-domain.js";
import { fail } from "./parse-shape.js";
import type { Tally, TallyOptions } from "./tally-types.js";
import { domainZone } from "./domain-zone.js";
import { restoreTally } from "./tally-runtime.js";

export type {
  Tally,
  TallyData,
  TallyExplanation,
  TallyOptions,
} from "./tally-types.js";

/** Creates an empty tally. */
export function tally(options: TallyOptions = {}): Tally {
  return restoreTally({
    type: "tally",
    cascade: { type: "cascade", merge: "sum", layers: [] },
    ...domainZone(options),
  });
}

/** Reads a stored tally and restores its methods. */
export function parseTally(value: unknown, path = "tally"): Tally {
  return restoreTally({
    type: "tally",
    ...parseDomain(value, "tally", parseCount, path),
  });
}

function parseCount(value: unknown, path: string): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fail(path, "expected a finite number.");
}
