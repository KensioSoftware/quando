import { endpoints } from "#test/property-intervals.js";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canonical } from "./canonical.js";
import { intervals } from "./interpret.js";
import { WEEKDAYS, type RuleData } from "./rule.js";

describe("canonical rule laws", () => {
  const days = fc.array(fc.constantFrom(...WEEKDAYS), { maxLength: 9 });
  const hours = fc.integer({ min: 0, max: 23 });
  const leaf: fc.Arbitrary<RuleData> = fc.oneof(
    fc.constant<RuleData>({ type: "always" }),
    fc.constant<RuleData>({ type: "never" }),
    days.map((selected): RuleData => ({ type: "daysOfWeek", days: selected })),
    fc
      .tuple(hours, fc.integer({ min: 1, max: 23 }))
      .map(([from, length]): RuleData => ({
        type: "timeOfDay",
        from: `${String(from).padStart(2, "0")}:00`,
        to: `${String((from + length) % 24).padStart(2, "0")}:00`,
      })),
    fc
      .array(fc.integer({ min: 1, max: 31 }), { maxLength: 5 })
      .map((selected): RuleData => ({ type: "daysOfMonth", days: selected })),
  );
  function rules(depth: number): fc.Arbitrary<RuleData> {
    if (depth === 0) {
      return leaf;
    }
    const child = rules(depth - 1);
    const children = fc.array(child, { maxLength: 3 });
    return fc.oneof(
      leaf,
      children.map((selected): RuleData => ({ type: "all", rules: selected })),
      children.map((selected): RuleData => ({ type: "any", rules: selected })),
      child.map((rule): RuleData => ({ type: "not", rule })),
      child.map((rule): RuleData => ({
        type: "inZone",
        zone: "Asia/Tokyo",
        rule,
      })),
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

describe("the counterexamples that got away", () => {
  /**
   * Each of these was found by the property test above, which draws a fresh
   * seed every run and so cannot be relied on to find it again. Pinned here
   * so a regression fails the same way every time.
   */
  it("keeps a wrapping window whole across a spring clock change", () => {
    // Given a window from 02:00 to 01:00 over the week London loses an hour,
    // wrapped in the double negation canonicalisation cancels.
    const inner: RuleData = { type: "timeOfDay", from: "02:00", to: "01:00" };
    const rule: RuleData = { type: "not", rule: { type: "not", rule: inner } };
    const from = Temporal.ZonedDateTime.from("2026-03-27T00:00[Europe/London]");
    const context = { from, to: from.add({ days: 7 }) };

    // When the canonical form is read alongside the document it came from.
    // Then they cover the same time. They did not while the generator handed
    // back the two nights the missing hour ran together as two intervals,
    // because the complements either side of it coalesced them and the bare
    // rule did not.
    const normalized = canonical(rule);
    expect(endpoints(intervals(normalized, context))).toStrictEqual(
      endpoints(intervals(rule, context)),
    );
  });
});
