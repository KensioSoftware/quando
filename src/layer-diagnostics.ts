/** Diagnostics for cascade layers inside a validation window. */

import { all, always, any, not } from "./build.js";
import type { Cascade, Layer } from "./cascade.js";
import { intervals } from "./interpret.js";
import type { Rule } from "./rule.js";
import type {
  ValidationDiagnostic,
  ValidationWindow,
} from "./semantic-validation.js";

/** Finds inactive and fully shadowed layers, including replacements. */
export function layerDiagnostics(
  cascade: Cascade<unknown>,
  window: ValidationWindow,
): readonly ValidationDiagnostic[] {
  return inspectLayers(cascade, window, always(), "");
}

function inspectLayers(
  cascade: Cascade<unknown>,
  window: ValidationWindow,
  region: Rule,
  prefix: string,
): readonly ValidationDiagnostic[] {
  const diagnostics: ValidationDiagnostic[] = [];
  for (const [index, layer] of cascade.layers.entries()) {
    const path = `${prefix}layers[${index}]`;
    const scope = all(region, layer.scope);
    if (!hasAny(intervals(scope, window))) {
      diagnostics.push({
        code: "inactive-layer",
        path,
        message: `${path} covers no time in its effective validation region.`,
      });
      continue;
    }
    const visible = all(region, visibleScope(cascade, layer, index));
    if (!hasAny(intervals(visible, window))) {
      diagnostics.push({
        code: "shadowed-layer",
        path,
        message: `${path} is fully hidden by higher-priority layers in the validation window.`,
      });
      continue;
    }
    if ("replace" in layer) {
      diagnostics.push(
        ...inspectLayers(layer.replace, window, visible, `${path}.replace.`),
      );
    }
  }
  return diagnostics;
}

function visibleScope(
  cascade: Cascade<unknown>,
  layer: Layer<unknown>,
  index: number,
): Rule {
  const above = cascade.layers.slice(index + 1);
  const hiding =
    cascade.merge === undefined || cascade.merge === "override"
      ? above
      : above.filter((candidate) => "replace" in candidate);

  if (hiding.length === 0) {
    return layer.scope;
  }
  const scopes = hiding.map((candidate) => candidate.scope);
  const hidden = any(...scopes);
  return all(layer.scope, not(hidden));
}

function hasAny(source: Iterable<unknown>): boolean {
  return source[Symbol.iterator]().next().done !== true;
}
