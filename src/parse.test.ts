import {
  assertIdentical,
  assertInstanceOf,
  assertThrowsError,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { parseRule } from "./parse.js";

describe("parsing a rule from JSON", () => {
  /** The message from parsing something that should not parse. */
  const complaintAbout = (value: unknown): string => {
    const error = assertThrowsError(() => parseRule(value));
    assertInstanceOf(error, TypeError);
    return error.message;
  };

  describe("a valid rule", () => {
    it("takes the simple ones", () => {
      // Given the two rules that carry no fields at all.
      // When each is parsed.
      // Then each comes back as the document it went in as.
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
      // Given a document three levels deep, with a zone and a complement in it.
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

      // When it is parsed and serialised again.
      // Then nothing has moved. A stored rule survives the round trip.
      assertIdentical(
        JSON.stringify(parseRule(document)),
        JSON.stringify(document),
      );
    });

    it("keeps an absent zone absent rather than undefined", () => {
      // Given a rule with no zone in it.
      // When it is parsed and serialised.
      // Then the field is still missing. A present `undefined` would make two
      // equivalent rules compare as different documents.
      assertIdentical(
        JSON.stringify(parseRule({ type: "dates", dates: ["2026-03-14"] })),
        '{"type":"dates","dates":["2026-03-14"]}',
      );
    });

    it("takes empty rule lists", () => {
      // Given combinators with nothing in them, as a filtered list would give.
      // When each is parsed.
      // Then both are accepted. They are the identities, and refusing them
      // would make building from a list a special case.
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
      // Given three things that are not rule objects, as a database column or
      // an API body might actually hold.
      // When each is parsed.
      // Then the message names the shape that arrived.
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
      // Given a type that sounds plausible and does not exist.
      // When it is parsed.
      // Then the message says so and enumerates what would have worked.
      assertIdentical(
        complaintAbout({ type: "weekdays" }),
        'rule.type: "weekdays" is not a rule type. ' +
          "Expected one of always, never, daysOfWeek, timeOfDay, dates, all, any, not",
      );
    });

    it("names a bad day, and which one", () => {
      // Given a day list where the second entry is not a day.
      // When it is parsed.
      // Then the message carries the index, so a long list is searchable.
      assertIdentical(
        complaintAbout({ type: "daysOfWeek", days: ["monday", "funday"] }),
        'rule.days[1]: "funday" is not a day of the week. ' +
          "Expected one of monday, tuesday, wednesday, thursday, friday, saturday, sunday",
      );
    });

    it("names a bad time", () => {
      // Given a time written the way it would be said out loud.
      // When it is parsed.
      // Then the message shows the shape it wanted.
      assertIdentical(
        complaintAbout({ type: "timeOfDay", from: "half nine", to: "17:00" }),
        'rule.from: "half nine" is not a time of day. Expected something like "09:00"',
      );
    });

    it("names a bad date", () => {
      // Given a date with a month and a day that cannot exist.
      // When it is parsed.
      // Then it is refused with an example of the form.
      assertIdentical(
        complaintAbout({ type: "dates", dates: ["2026-13-45"] }),
        'rule.dates[0]: "2026-13-45" is not a date. Expected something like "2026-03-14"',
      );
    });

    it("names an unknown zone as the rule is read", () => {
      // Given a zone that no database of zones has heard of.
      // When the rule is parsed.
      // Then it fails here, while the document is in front of whoever wrote it,
      // and not hours later when a query needs an answer.
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
      // Given a fault buried two levels down in a list.
      const document = {
        type: "all",
        rules: [
          { type: "daysOfWeek", days: ["monday"] },
          { type: "any", rules: [{ type: "dates", dates: ["not a date"] }] },
        ],
      };

      // When it is parsed.
      // Then the path leads to the exact entry. A rule six deep reports as a
      // location and not as a puzzle.
      assertIdentical(
        complaintAbout(document),
        'rule.rules[1].rules[0].dates[0]: "not a date" is not a date. ' +
          'Expected something like "2026-03-14"',
      );
    });

    it("refuses a misspelled field rather than quietly dropping it", () => {
      // Given a zone with a typo in the field name. This is the dangerous one:
      // dropping it would parse as a valid rule with no zone, read in whatever
      // zone the query used, and nothing would have said so.
      // When it is parsed.
      // Then it is refused, with the fields the type does take.
      assertIdentical(
        complaintAbout({
          type: "timeOfDay",
          from: "09:00",
          to: "17:00",
          zonee: "Europe/London",
        }),
        "rule.zonee: is not a field of a timeOfDay rule. Expected from, to, zone",
      );
    });

    it("refuses a field the rule type has no business with", () => {
      // Given a zone on `always`, which has no fields, and on `all`, which has
      // one that is not a zone.
      // When each is parsed.
      // Then both are refused, and each message says what that type holds.
      assertIdentical(
        complaintAbout({ type: "always", zone: "Europe/London" }),
        "rule.zone: is not a field of a always rule, which takes none",
      );
      assertIdentical(
        complaintAbout({ type: "all", rules: [], zone: "Europe/London" }),
        "rule.zone: is not a field of a all rule. Expected rules",
      );
    });

    it("finds a stray field inside the nesting too", () => {
      // Given a plausible-looking `timezone` on a nested leaf.
      // When the document is parsed.
      // Then the check reaches inside, and the path says where.
      assertIdentical(
        complaintAbout({
          type: "all",
          rules: [
            { type: "dates", dates: ["2026-03-14"], timezone: "Europe/London" },
          ],
        }),
        "rule.rules[0].timezone: is not a field of a dates rule. Expected dates, zone",
      );
    });

    it("complains about the wrong shape in a field", () => {
      // Given fields holding the wrong kind of thing: a bare string where a
      // list belongs, a number where a day belongs, an object where a rule list
      // belongs, and a number as the type tag.
      // When each is parsed.
      // Then each message names the field and what arrived in it.
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
});
