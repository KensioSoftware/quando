import { endpoints } from "#test/property-intervals.js";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canonical } from "./canonical.js";
import { intervals } from "./interpret.js";
import { WEEKDAYS, type Rule } from "./rule.js";

describe("canonical rule laws", () => {
  const days = fc.array(fc.constantFrom(...WEEKDAYS), { maxLength: 9 });
  const hours = fc.integer({ min: 0, max: 23 });
  const leaf: fc.Arbitrary<Rule> = fc.oneof(
    fc.constant<Rule>({ type: "always" }),
    fc.constant<Rule>({ type: "never" }),
    days.map((selected): Rule => ({ type: "daysOfWeek", days: selected })),
    fc
      .tuple(hours, fc.integer({ min: 1, max: 23 }))
      .map(([from, length]): Rule => ({
        type: "timeOfDay",
        from: `${String(from).padStart(2, "0")}:00`,
        to: `${String((from + length) % 24).padStart(2, "0")}:00`,
      })),
    fc
      .array(fc.integer({ min: 1, max: 31 }), { maxLength: 5 })
      .map((selected): Rule => ({ type: "daysOfMonth", days: selected })),
  );
  function rules(depth: number): fc.Arbitrary<Rule> {
    if (depth === 0) {
      return leaf;
    }
    const child = rules(depth - 1);
    const children = fc.array(child, { maxLength: 3 });
    return fc.oneof(
      leaf,
      children.map((selected): Rule => ({ type: "all", rules: selected })),
      children.map((selected): Rule => ({ type: "any", rules: selected })),
      child.map((rule): Rule => ({ type: "not", rule })),
      child.map((rule): Rule => ({ type: "inZone", zone: "Asia/Tokyo", rule })),
    );
  }

  it.each(["2026-03-27", "2026-10-23", "2028-02-27"])(
    "preserves coverage and is idempotent around %s",
    (date) => {
      // Given compound rules across DST changes, month ends and a leap day.
      const from = Temporal.ZonedDateTime.from(`${date}T00:00[Europe/London]`);
      const context = { from, to: from.add({ days: 7 }) };
      const law = fc.property(rules(3), (rule) => {
        // When canonicalisation simplifies and reorders the document.
        const normalized = canonical(rule);
        // Then its intervals are unchanged and a second pass changes nothing.
        expect(endpoints(intervals(normalized, context))).toStrictEqual(
          endpoints(intervals(rule, context)),
        );
        expect(canonical(normalized)).toStrictEqual(normalized);
      });
      fc.assert(law, { numRuns: 150 });
    },
  );
});
