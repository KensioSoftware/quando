/** Semantic diagnostics for rules and cascades inside a finite window. */

import { asCascade, type CascadeLike } from "./cascade.js";
import type { Context } from "./context.js";
import { coverageDiagnostics } from "./coverage-diagnostics.js";
import type { Interval } from "./interval.js";
import { intervals } from "./interpret.js";
import { layerDiagnostics } from "./layer-diagnostics.js";
import type { Rule } from "./rule.js";
import { checkWindow } from "./validation.js";

/** A finite context used for semantic validation. */
export interface ValidationWindow extends Context {
  readonly to: Temporal.ZonedDateTime;
}

/** Options for semantic validation. */
export interface ValidationOptions {
  readonly requireFullCoverage?: boolean;
}

/** A problem found while evaluating a definition. */
export type ValidationDiagnostic =
  | {
      readonly code: "inactive-rule";
      readonly message: string;
    }
  | {
      readonly code: "inactive-layer" | "shadowed-layer";
      readonly path: string;
      readonly message: string;
    }
  | {
      readonly code: "uncovered-time";
      readonly interval: Interval;
      readonly message: string;
    };

/** Finds semantic problems inside a finite validation window. */
export function validate(
  source: Rule | CascadeLike<unknown>,
  window: ValidationWindow,
  options: ValidationOptions = {},
): readonly ValidationDiagnostic[] {
  assertWindow(window);
  if (isRule(source)) {
    return hasAny(intervals(source, window))
      ? []
      : [
          {
            code: "inactive-rule",
            message: "The rule covers no time in the validation window.",
          },
        ];
  }

  const cascade = asCascade(source);
  return [
    ...layerDiagnostics(cascade, window),
    ...(options.requireFullCoverage === true
      ? coverageDiagnostics(cascade, window)
      : []),
  ];
}

function assertWindow(window: Context): asserts window is ValidationWindow {
  checkWindow(window.from, window.to);
  if (window.to === undefined) {
    throw new RangeError("Validation requires a finite window with `to`.");
  }
}

function isRule(source: Rule | CascadeLike<unknown>): source is Rule {
  return !("cascade" in source) && source.type !== "cascade";
}

function hasAny(source: Iterable<unknown>): boolean {
  return source[Symbol.iterator]().next().done !== true;
}
