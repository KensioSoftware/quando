/** Reading the rules that count what has already happened. */

import { asPeriod, asZone } from "./validation.js";
import { asCount, asExactGap, asGap } from "./occurrence-validation.js";
import type {
  AtMostRule,
  AtMostTimeRule,
  Period,
  SpacedByRule,
} from "./rule.js";

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
  const zone = zonePartOf(node, path);
  const window = windowOf(node, path, asGap);

  return "per" in window
    ? { type: "atMost", count, per: window.per, ...zone }
    : { type: "atMost", count, within: window.within, ...zone };
}

/**
 * A cap on total time, which names its window the same two ways a count cap
 * does. Both of its durations have to be exact. See `asExactGap`.
 */
export function parseAtMostTimeRule(
  node: Record<string, unknown>,
  path: string,
): AtMostTimeRule {
  const total = asExactGap(
    asString(node["total"], `${path}.total`),
    `${path}.total`,
  );
  const zone = zonePartOf(node, path);
  const window = windowOf(node, path, asExactGap);

  return "per" in window
    ? { type: "atMostTime", total, per: window.per, ...zone }
    : { type: "atMostTime", total, within: window.within, ...zone };
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

/** Either field a cap names its window with, and never both or neither. */
function windowOf(
  node: Record<string, unknown>,
  path: string,
  gap: (value: string, path: string) => string,
): { readonly per: Period } | { readonly within: string } {
  const per = node["per"];
  const within = node["within"];

  if (per !== undefined && within !== undefined) {
    throw new TypeError(
      `${path}: a cap counts in calendar buckets (\`per\`) or in a rolling ` +
        "window (`within`), and this names both.",
    );
  }
  if (per !== undefined) {
    return { per: asPeriod(asString(per, `${path}.per`), `${path}.per`) };
  }
  if (within !== undefined) {
    return {
      within: gap(asString(within, `${path}.within`), `${path}.within`),
    };
  }
  throw new TypeError(
    `${path}: a cap needs a window. Give \`per\` a calendar period such as ` +
      '"days", or `within` an ISO duration such as "PT24H".',
  );
}

/** The zone a cap is read in, when it names one. */
function zonePartOf(
  node: Record<string, unknown>,
  path: string,
): { readonly zone?: string } {
  return node["zone"] === undefined
    ? {}
    : { zone: asZone(asString(node["zone"], `${path}.zone`), `${path}.zone`) };
}
