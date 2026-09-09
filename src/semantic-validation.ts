/** Semantic diagnostics for rules and cascades inside a finite window. */

import { asCascade, type CascadeLike } from "./cascade.js";
import type { Context } from "./context.js";
import { coverageDiagnostics } from "./coverage-diagnostics.js";
import type { Interval } from "./interval.js";
import { intervals } from "./interpret.js";
import { layerDiagnostics } from "./layer-diagnostics.js";
import type { RuleData } from "./rule.js";
import { checkWindow } from "./validation.js";
import { evaluationOptions } from "./evaluation-options.js";

/** A finite context used for semantic validation. */
export interface ValidationWindow extends Context {
  readonly to: Temporal.ZonedDateTime;
}

/** Options for semantic validation. */
export interface ValidationOptions {
  readonly requireFullCoverage?: boolean;
}

/** A problem found while evaluating a definition. */
export interface DiagnosticContext {
  readonly severity: "info" | "warning" | "error";
  readonly window: { readonly from: string; readonly to: string };
}

export type ValidationDiagnostic = DiagnosticContext & DiagnosticFinding;

/** A finding before its window and severity are attached. */
export type DiagnosticFinding =
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
  source: RuleData | CascadeLike<unknown>,
  window: ValidationWindow,
  options: ValidationOptions = {},
): readonly ValidationDiagnostic[] {
  const read = evaluationOptions(source, window);
  assertWindow(read);
  return findings(source, read, options).map((finding) => ({
    ...finding,
    severity:
      finding.code === "uncovered-time"
        ? "error"
        : finding.code === "shadowed-layer"
          ? "warning"
          : "info",
    window: { from: read.from.toString(), to: read.to.toString() },
  }));
}

function findings(
  source: RuleData | CascadeLike<unknown>,
  read: ValidationWindow,
  options: ValidationOptions,
): readonly DiagnosticFinding[] {
  if (isRule(source)) {
    return hasAny(intervals(source, read))
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
    ...layerDiagnostics(cascade, read),
    ...((options.requireFullCoverage ??
    ("cascade" in source && "type" in source && source.type === "rota"))
      ? coverageDiagnostics(cascade, read)
      : []),
  ];
}

function assertWindow(window: Context): asserts window is ValidationWindow {
  checkWindow(window.from, window.to);
  if (window.to === undefined) {
    throw new RangeError("Validation requires a finite window with `to`.");
  }
}

function isRule(source: RuleData | CascadeLike<unknown>): source is RuleData {
  return !("cascade" in source) && source.type !== "cascade";
}

function hasAny(source: Iterable<unknown>): boolean {
  return source[Symbol.iterator]().next().done !== true;
}
