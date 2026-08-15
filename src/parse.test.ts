import {
  assertIdentical,
  assertInstanceOf,
  assertThrowsError,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { parseRule } from "./parse.js";

/** The message from parsing something that should not parse. */
function complaintAbout(value: unknown): string {
  const error = assertThrowsError(() => parseRule(value));
  assertInstanceOf(error, TypeError);
  return error.message;
}

describe("parsing a valid rule", () => {
  it("takes the simple ones", () => {
    assertIdentical(
      JSON.stringify(parseRule({ type: "always" })),
      '{"type":"always"}',
    );
    assertIdentical(
      JSON.stringify(parseRule({ type: "never" })),
      '{"type":"never"}',
    );
  });

  it("takes a nested one", () => {
    const document = {
      type: "all",
      rules: [
        { type: "daysOfWeek", days: ["monday", "friday"] },
        {
          type: "timeOfDay",
          from: "09:00",
          to: "17:00",
          zone: "Europe/London",
        },
        { type: "not", rule: { type: "dates", dates: ["2026-12-25"] } },
      ],
    };

    assertIdentical(
      JSON.stringify(parseRule(document)),
      JSON.stringify(document),
    );
  });

  it("keeps an absent zone absent rather than undefined", () => {
    assertIdentical(
      JSON.stringify(parseRule({ type: "dates", dates: ["2026-03-14"] })),
      '{"type":"dates","dates":["2026-03-14"]}',
    );
  });

  it("takes empty rule lists", () => {
    assertIdentical(
      JSON.stringify(parseRule({ type: "all", rules: [] })),
      '{"type":"all","rules":[]}',
    );
    assertIdentical(
      JSON.stringify(parseRule({ type: "any", rules: [] })),
      '{"type":"any","rules":[]}',
    );
  });
});

describe("refusing an invalid rule", () => {
  it("says what it found instead of a rule", () => {
    assertIdentical(
      complaintAbout("weekdays"),
      "rule: expected a rule object, found string",
    );
    assertIdentical(
      complaintAbout(null),
      "rule: expected a rule object, found null",
    );
    assertIdentical(
      complaintAbout([]),
      "rule: expected a rule object, found an array",
    );
  });

  it("names an unknown type and lists the real ones", () => {
    assertIdentical(
      complaintAbout({ type: "weekdays" }),
      'rule.type: "weekdays" is not a rule type. ' +
        "Expected one of always, never, daysOfWeek, timeOfDay, dates, all, any, not",
    );
  });

  it("names a bad day, and which one", () => {
    assertIdentical(
      complaintAbout({ type: "daysOfWeek", days: ["monday", "funday"] }),
      'rule.days[1]: "funday" is not a day of the week. ' +
        "Expected one of monday, tuesday, wednesday, thursday, friday, saturday, sunday",
    );
  });

  it("names a bad time", () => {
    assertIdentical(
      complaintAbout({ type: "timeOfDay", from: "half nine", to: "17:00" }),
      'rule.from: "half nine" is not a time of day. Expected something like "09:00"',
    );
  });

  it("names a bad date", () => {
    assertIdentical(
      complaintAbout({ type: "dates", dates: ["2026-13-45"] }),
      'rule.dates[0]: "2026-13-45" is not a date. Expected something like "2026-03-14"',
    );
  });

  it("names an unknown zone, when it is read rather than when it is used", () => {
    assertIdentical(
      complaintAbout({
        type: "timeOfDay",
        from: "09:00",
        to: "17:00",
        zone: "Europe/Camelot",
      }),
      'rule.zone: "Europe/Camelot" is not a known time zone',
    );
  });

  it("points into the nesting rather than at the top", () => {
    const document = {
      type: "all",
      rules: [
        { type: "daysOfWeek", days: ["monday"] },
        { type: "any", rules: [{ type: "dates", dates: ["not a date"] }] },
      ],
    };

    assertIdentical(
      complaintAbout(document),
      'rule.rules[1].rules[0].dates[0]: "not a date" is not a date. ' +
        'Expected something like "2026-03-14"',
    );
  });

  it("complains about the wrong shape in a field", () => {
    assertIdentical(
      complaintAbout({ type: "daysOfWeek", days: "monday" }),
      "rule.days: expected an array, found string",
    );
    assertIdentical(
      complaintAbout({ type: "daysOfWeek", days: [7] }),
      "rule.days[0]: expected a string, found number",
    );
    assertIdentical(
      complaintAbout({ type: "all", rules: {} }),
      "rule.rules: expected an array of rules, found object",
    );
    assertIdentical(
      complaintAbout({ type: 7 }),
      "rule.type: expected a string, found number",
    );
  });
});
