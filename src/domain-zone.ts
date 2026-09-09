import { inZone } from "./build.js";
import type { RuleData } from "./rule.js";
import { asZone } from "./validation.js";

/** Validates an optional zone when a domain definition is constructed. */
export function domainZone(options: { readonly zone?: string }): {
  zone?: string;
} {
  return options.zone === undefined
    ? {}
    : { zone: asZone(options.zone, "zone") };
}

/** Fixes a scope to the domain clock when one was supplied. */
export function domainScope(
  rule: RuleData,
  zone: string | undefined,
): RuleData {
  return zone === undefined ? rule : inZone(zone, rule);
}
