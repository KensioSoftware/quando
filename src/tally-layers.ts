import { always } from "./build.js";
import { cascade, layer, replace, type Layer } from "./cascade.js";
import type { LayerOptions } from "./layer-options.js";
import type { RuleData } from "./rule.js";

/** Adds a finite contribution during a scope. */
export function contribution(
  scope: RuleData,
  amount: number,
  options?: LayerOptions,
): Layer<number> {
  if (!Number.isFinite(amount)) {
    throw new RangeError("A tally amount must be a finite number.");
  }
  return layer(scope, amount, options);
}

/** Replaces earlier contributions with a fixed count during a scope. */
export function fixedCount(
  scope: RuleData,
  amount: number,
  options?: LayerOptions,
): Layer<number> {
  const constant = contribution(always(), amount);
  return replace(scope, cascade(constant), options);
}
