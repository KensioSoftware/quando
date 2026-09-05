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

    it("takes the calendar rules a stored quarter-end schedule holds", () => {
      // Given the last day of March, as it would sit in a database row.
      const document = {
        type: "all",
        rules: [
          { type: "monthsOfYear", months: ["march", "june"] },
          { type: "daysOfMonth", days: [-1], zone: "Europe/London" },
        ],
      };

      // When it is parsed and serialised again.
      // Then nothing has moved, negative day and all.
      assertIdentical(
        JSON.stringify(parseRule(document)),
        JSON.stringify(document),
      );
    });

    it("takes the nth day of the week a stored meeting holds", () => {
      // Given the last Friday of the month, as a database row would carry it.
      const document = {
        type: "nthDayOfWeekInMonth",
        nth: -1,
        days: ["friday"],
        zone: "Europe/London",
      };

      // When it is parsed and serialised again.
      // Then nothing has moved.
      assertIdentical(
        JSON.stringify(parseRule(document)),
        JSON.stringify(document),
      );
    });

    it("takes a stored recurrence", () => {
      // Given a fortnightly cycle as a database row would carry it.
      const document = {
        type: "every",
        interval: 2,
        period: "weeks",
        anchor: "2026-03-09",
        zone: "Europe/London",
      };

      // When it is parsed and serialised again.
      // Then nothing has moved.
      assertIdentical(
        JSON.stringify(parseRule(document)),
        JSON.stringify(document),
      );
    });

    it("takes a date range with one end open", () => {
      // Given a schedule that starts on a date and never stops.
      const document = { type: "dateRange", from: "2026-04-01" };

      // When it is parsed and serialised again.
      // Then the open end stays absent rather than becoming a null.
      assertIdentical(
        JSON.stringify(parseRule(document)),
        '{"type":"dateRange","from":"2026-04-01"}',
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
          "Expected one of always, never, daysOfWeek, daysOfMonth, nthDayOfWeekInMonth, " +
          "monthsOfYear, every, timeOfDay, dates, dateRange, inZone, all, any, not",
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

    it("names a bad month, and which one", () => {
      // Given a month list where the second entry is spelled the French way.
      // When it is parsed.
      // Then the message carries the index and the twelve real names.
      assertIdentical(
        complaintAbout({
          type: "monthsOfYear",
          months: ["august", "octobre"],
        }),
        'rule.months[1]: "octobre" is not a month. Expected one of ' +
          "january, february, march, april, may, june, july, august, " +
          "september, october, november, december",
      );
    });

    it("names a day of the month outside the month", () => {
      // Given a day no month reaches, and a zero.
      // When each is parsed.
      // Then both are refused, with the range spelled out rather than implied.
      assertIdentical(
        complaintAbout({ type: "daysOfMonth", days: [1, 32] }),
        "rule.days[1]: 32 is not a day of the month. " +
          "Expected 1 to 31, or -1 to -31 counting back from the end",
      );
      assertIdentical(
        complaintAbout({ type: "daysOfMonth", days: [0] }),
        "rule.days[0]: 0 is not a day of the month. " +
          "Expected 1 to 31, or -1 to -31 counting back from the end",
      );
    });

    it("refuses a single day of the month sent without its array", () => {
      // Given one day written bare, which is the shape a hand-edited config
      // arrives in.
      // When it is parsed.
      // Then the array is asked for rather than the value being wrapped, so
      // the document and the type agree on one shape.
      assertIdentical(
        complaintAbout({ type: "daysOfMonth", days: 1 }),
        "rule.days: expected an array, found number",
      );
    });

    it("refuses a day of the month written as a string", () => {
      // Given a day sent as JSON text, which is how a form field arrives.
      // When it is parsed.
      // Then it is refused rather than coerced, because "1" and 1 reaching the
      // same rule is how a form starts silently disagreeing with an API.
      assertIdentical(
        complaintAbout({ type: "daysOfMonth", days: ["1"] }),
        "rule.days[0]: expected a number, found string",
      );
    });

    it("names an occurrence outside a month", () => {
      // Given a sixth occurrence, and one written as text.
      // When each is parsed.
      // Then both are refused, with the range spelled out.
      assertIdentical(
        complaintAbout({
          type: "nthDayOfWeekInMonth",
          nth: 6,
          days: ["monday"],
        }),
        "rule.nth: 6 is not an occurrence in a month. " +
          "Expected 1 to 5, or -1 to -5 counting back from the end",
      );
      assertIdentical(
        complaintAbout({
          type: "nthDayOfWeekInMonth",
          nth: "1",
          days: ["monday"],
        }),
        "rule.nth: expected a number, found string",
      );
    });

    it("names a bad period and a bad interval", () => {
      // Given a period written singular, and an interval of zero.
      // When each is parsed.
      // Then each is refused with what would have worked.
      assertIdentical(
        complaintAbout({
          type: "every",
          interval: 2,
          period: "week",
          anchor: "2026-03-09",
        }),
        'rule.period: "week" is not a period. Expected one of days, weeks, months, years',
      );
      assertIdentical(
        complaintAbout({
          type: "every",
          interval: 0,
          period: "weeks",
          anchor: "2026-03-09",
        }),
        "rule.interval: 0 is not an interval. Expected 1 or more",
      );
    });

    it("refuses a date range with neither end", () => {
      // Given a range whose bounds were both filtered out.
      // When it is parsed.
      // Then it is refused. All of time written the long way is `always`, and
      // a range with no bounds is more likely a dropped field than an intent.
      assertIdentical(
        complaintAbout({ type: "dateRange" }),
        "rule: a date range needs a from, a to, or both",
      );
    });

    it("refuses a stored date range that ends before it starts", () => {
      // Given two dates the wrong way round in a stored document.
      // When it is parsed.
      // Then it is refused here rather than covering no time at query time.
      assertIdentical(
        complaintAbout({
          type: "dateRange",
          from: "2026-04-30",
          to: "2026-04-01",
        }),
        "rule: a date range must not end before it starts",
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
