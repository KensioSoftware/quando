/** Reading the rules that count what has already happened. */

import { asCount, asGap } from "./occurrence-validation.js";
import { asPeriod, asZone } from "./validation.js";
import type { AtMostRule, SpacedByRule } from "./rule.js";

/**
 * A cap, which names its window one way or the other and never both.
 *
 * `per` counts in calendar buckets and `within` counts in a rolling stretch.
 * A document holding both says two different things at once, and one holding
 * neither leaves the window unsaid. Each is refused, because picking for the
 * writer would be a guess about which was meant.
 */
export function parseAtMostRule(
  node: Record<string, unknown>,
  path: string,
): AtMostRule {
  const count = asCount(
    asNumber(node["count"], `${path}.count`),
    `${path}.count`,
  );
  const zone =
    node["zone"] === undefined
      ? {}
      : {
          zone: asZone(asString(node["zone"], `${path}.zone`), `${path}.zone`),
        };
  const per = node["per"];
  const within = node["within"];

  if (per !== undefined && within !== undefined) {
    throw new TypeError(
      `${path}: a cap counts in calendar buckets (\`per\`) or in a rolling ` +
        "window (`within`), and this names both.",
    );
  }
  if (per !== undefined) {
    return {
      type: "atMost",
      count,
      per: asPeriod(asString(per, `${path}.per`), `${path}.per`),
      ...zone,
    };
  }
  if (within !== undefined) {
    return {
      type: "atMost",
      count,
      within: asGap(asString(within, `${path}.within`), `${path}.within`),
      ...zone,
    };
  }
  throw new TypeError(
    `${path}: a cap needs a window. Give \`per\` a calendar period such as ` +
      '"days", or `within` an ISO duration such as "PT24H".',
  );
}

/** A spacing, which is one duration and nothing else. */
export function parseSpacedByRule(
  node: Record<string, unknown>,
  path: string,
): SpacedByRule {
  return {
    type: "spacedBy",
    gap: asGap(asString(node["gap"], `${path}.gap`), `${path}.gap`),
  };
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== "number") {
    throw new TypeError(`${path}: expected a number.`);
  }
  return value;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${path}: expected a string.`);
  }
  return value;
}
