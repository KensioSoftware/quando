import type { Cascade } from "./cascade.js";
import { parseCascade, type ValueParser } from "./parse-cascade.js";
import { asZone } from "./parse-fields.js";
import { fail } from "./parse-shape.js";

/** Reads the shared envelope of a schedule, rota, or tally. */
export function parseDomain<V>(
  value: unknown,
  type: "schedule" | "rota" | "tally",
  parseValue: ValueParser<V>,
  path: string,
): { cascade: Cascade<V>; zone?: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail(path, `expected a ${type} object.`);
  }
  const node = value as Record<string, unknown>;
  if (node["type"] !== type) {
    return fail(`${path}.type`, `expected "${type}".`);
  }
  const extra = Object.keys(node).find(
    (field) => !["type", "cascade", "zone"].includes(field),
  );
  if (extra !== undefined) {
    return fail(`${path}.${extra}`, `unknown ${type} field.`, "unknown-field");
  }
  const zone = node["zone"];
  if (zone !== undefined && typeof zone !== "string") {
    return fail(`${path}.zone`, "expected a string.");
  }
  const cascade = parseCascade(node["cascade"], parseValue, `${path}.cascade`);
  const expected = type === "tally" ? "sum" : "override";
  if ((cascade.merge ?? "override") !== expected) {
    return fail(`${path}.cascade.merge`, `a ${type} uses ${expected}.`);
  }
  return {
    cascade,
    ...(zone === undefined ? {} : { zone: asZone(zone, `${path}.zone`) }),
  };
}
