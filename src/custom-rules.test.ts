import { inWindow, render, span, when } from "#test/intervals.js";
import {
  assertArrayEmpty,
  assertArrayEquals,
  assertFalse,
  assertIdentical,
  assertInstanceOf,
  assertStringIncludes,
  assertThrowsError,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { custom, weekdays } from "./build.js";
import { canonical, fingerprint } from "./canonical.js";
import { CustomRuleStreamError } from "./custom-rule-stream.js";
import {
  type CustomRuleType,
  type RuleRegistry,
  UnknownCustomRuleError,
} from "./custom-rules.js";
import { intervals } from "./interpret.js";
import type { Interval } from "./interval.js";
import { parseRule } from "./parse.js";
import { activeAt, coveredDuration } from "./query.js";
import { explainRule } from "./rule-explanation.js";
import { rota } from "./rota.js";
import { schedule } from "./schedule.js";
import type { Schedule } from "./schedule-types.js";
import { tally } from "./tally.js";
import { toCron } from "./cron-export.js";

describe("a rule the application supplies", () => {
  /** Yields exactly the intervals it was built with, in the order given. */
  const yielding = (...spans: readonly Interval[]): CustomRuleType => ({
    intervals: () => spans,
  });

  /** One whole named date, read in the context's zone. */
  const wholeDates = (): CustomRuleType => ({
    intervals: (context, options) => {
      const dates = Array.isArray(options) ? options : [];
      const zone = context.from.timeZoneId;
      return dates.map((date) => ({
        start: Temporal.PlainDate.from(String(date)).toZonedDateTime({
          timeZone: zone,
          plainTime: "00:00",
        }),
        end: Temporal.PlainDate.from(String(date))
          .add({ days: 1 })
          .toZonedDateTime({ timeZone: zone, plainTime: "00:00" }),
      }));
    },
    describe: (options) =>
      `The dates ${JSON.stringify(options)} are claimed by the application.`,
  });

  describe("evaluating one", () => {
    it("covers the times its registered type yields", () => {
      // Given a rule type the application supplies, and a document naming it.
      const rules: RuleRegistry = { shutdown: wholeDates() };
      const closure = custom("shutdown", ["2026-03-10", "2026-03-12"]);

      // When the rule is evaluated with that registry on the context.
      const covered = intervals(closure, {
        ...inWindow("2026-03-09T00:00", "2026-03-16T00:00"),
        rules,
      });

      // Then the two days come back as the application drew them.
      assertIdentical(
        render(covered),
        "[2026-03-10T00:00:00,2026-03-11T00:00:00) [2026-03-12T00:00:00,2026-03-13T00:00:00)",
      );
    });

    it("composes with the rest of the rule language", () => {
      // Given weekday opening with an application-supplied shutdown removed.
      const rules: RuleRegistry = { shutdown: wholeDates() };
      const office = weekdays().except(custom("shutdown", ["2026-03-11"]));

      // When the week is measured.
      const open = coveredDuration(office, {
        ...inWindow("2026-03-09T00:00", "2026-03-16T00:00"),
        rules,
      });

      // Then four of the five weekdays are left. A custom rule is a rule, and
      // `except` neither knows nor cares which kind it was handed.
      assertIdentical(open.toString(), "PT96H");
    });

    it("works inside a schedule, through a query that carries the registry", () => {
      // Given opening hours closed by an application-supplied rule.
      const rules: RuleRegistry = { shutdown: wholeDates() };
      const office = schedule({ zone: "Europe/London" })
        .open(weekdays(), "09:00-17:00")
        .closed(custom("shutdown", ["2026-03-11"]));

      // When two Wednesdays are asked about.
      // Then the shutdown closes the first and the second is untouched.
      assertFalse(activeAt(office, when("2026-03-11T10:00"), { rules }));
      assertTrue(activeAt(office, when("2026-03-18T10:00"), { rules }));
    });

    it("reads its own zone the way `inZone` does", () => {
      // Given a rule type that reports the zone it was handed, and a document
      // naming Tokyo.
      let seen = "";
      const rules: RuleRegistry = {
        probe: {
          intervals: (context) => {
            seen = context.from.timeZoneId;
            return [];
          },
        },
      };

      // When it is evaluated from a London context.
      const covered = [
        ...intervals(custom("probe", undefined, "Asia/Tokyo"), {
          ...inWindow("2026-03-09T00:00", "2026-03-10T00:00"),
          rules,
        }),
      ];

      // Then it read the instants in Tokyo, and covered nothing. A custom
      // rule never has to know the zone field exists.
      assertArrayEmpty(covered);
      assertIdentical(seen, "Asia/Tokyo");
    });

    it("is clipped to the window, however far its own stream runs", () => {
      // Given a type that yields one interval running past the window.
      const rules: RuleRegistry = {
        forever: yielding(span("2026-03-01T00:00", undefined)),
      };

      // When it is evaluated in a bounded window.
      const covered = intervals(custom("forever"), {
        ...inWindow("2026-03-09T00:00", "2026-03-10T00:00"),
        rules,
      });

      // Then the answer stops at the window. Termination is the interpreter's
      // to guarantee rather than a third party's to remember.
      assertIdentical(
        render(covered),
        "[2026-03-09T00:00:00,2026-03-10T00:00:00)",
      );
    });

    it("merges touching intervals a type left separate", () => {
      // Given a type yielding two days that meet at midnight.
      const rules: RuleRegistry = {
        pair: yielding(
          span("2026-03-09T00:00", "2026-03-10T00:00"),
          span("2026-03-10T00:00", "2026-03-11T00:00"),
        ),
      };

      // When it is evaluated.
      const covered = intervals(custom("pair"), {
        ...inWindow("2026-03-09T00:00", "2026-03-12T00:00"),
        rules,
      });

      // Then one interval comes back, the same answer `dates` gives for two
      // consecutive days. Coalescing is part of the stream contract and can
      // be repaired without buffering, so it is.
      assertIdentical(
        render(covered),
        "[2026-03-09T00:00:00,2026-03-11T00:00:00)",
      );
    });

    it("refuses a stream that runs backwards", () => {
      // Given a type yielding a later day before an earlier one.
      const rules: RuleRegistry = {
        muddled: yielding(
          span("2026-03-11T00:00", "2026-03-12T00:00"),
          span("2026-03-09T00:00", "2026-03-10T00:00"),
        ),
      };

      // When it is evaluated.
      const error = assertThrowsError(() => [
        ...intervals(custom("muddled"), {
          ...inWindow("2026-03-09T00:00", "2026-03-13T00:00"),
          rules,
        }),
      ]);

      // Then it is refused by name. Sorting a stream means buffering it, and
      // the sweeps would otherwise give a wrong answer rather than an error.
      assertInstanceOf(error, CustomRuleStreamError);
      assertStringIncludes(error.message, "muddled");
    });

    it("refuses a stream that overlaps itself", () => {
      // Given two intervals sharing an afternoon.
      const rules: RuleRegistry = {
        doubled: yielding(
          span("2026-03-09T09:00", "2026-03-09T17:00"),
          span("2026-03-09T12:00", "2026-03-09T20:00"),
        ),
      };

      // When it is evaluated.
      const error = assertThrowsError(() => [
        ...intervals(custom("doubled"), {
          ...inWindow("2026-03-09T00:00", "2026-03-10T00:00"),
          rules,
        }),
      ]);

      // Then it is refused.
      assertInstanceOf(error, CustomRuleStreamError);
    });

    it("says which names it does hold when the rule is not one of them", () => {
      // Given a registry holding a different rule type.
      const rules: RuleRegistry = { shutdown: wholeDates() };

      // When a document naming an absent type is evaluated.
      const error = assertThrowsError(() =>
        activeAt(custom("easter"), when("2026-03-09T10:00"), { rules }),
      );

      // Then the message names what was asked for and what is there.
      assertInstanceOf(error, UnknownCustomRuleError);
      assertIdentical(error.ruleName, "easter");
      assertStringIncludes(error.message, "shutdown");
    });

    it("does not find a rule type on the prototype of the registry", () => {
      // Given a registry holding one rule, and a document naming a method
      // every object inherits.
      const rules: RuleRegistry = { shutdown: wholeDates() };

      // When it is evaluated.
      const error = assertThrowsError(() =>
        activeAt(custom("toString"), when("2026-03-09T10:00"), { rules }),
      );

      // Then it is unknown, rather than a function found on `Object.prototype`
      // and called somewhere further in with the reason lost.
      assertInstanceOf(error, UnknownCustomRuleError);
      assertIdentical(error.ruleName, "toString");
    });

    it("says what to do when no registry was passed at all", () => {
      // Given a query with no rules on its context.
      // When a custom rule is evaluated.
      const error = assertThrowsError(() =>
        activeAt(custom("easter"), when("2026-03-09T10:00")),
      );

      // Then the message points at the field the registry belongs in.
      assertInstanceOf(error, UnknownCustomRuleError);
      assertStringIncludes(error.message, "`rules` on the context");
    });
  });

  describe("the document it stores as", () => {
    it("survives a JSON round trip without the code that runs it", () => {
      // Given a custom rule built with options and a zone.
      const written = custom("shutdown", { region: "gb" }, "Europe/London");

      // When it is stored and read back in a process holding no registry.
      const stored = JSON.stringify(written);
      const restored = parseRule(JSON.parse(stored));

      // Then the document is intact. Storing and forwarding a rule needs no
      // ability to evaluate it.
      assertIdentical(
        JSON.stringify(restored),
        '{"type":"custom","name":"shutdown","options":{"region":"gb"},"zone":"Europe/London"}',
      );
    });

    it("refuses a document with no name to look a type up by", () => {
      // Given a custom rule document missing its name.
      const error = assertThrowsError(() =>
        parseRule({ type: "custom", options: 1 }),
      );

      // Then the message names the field.
      assertStringIncludes(error.message, "rule.name");
    });

    it("refuses options that would not survive storage", () => {
      // Given options holding a value JSON drops.
      const error = assertThrowsError(() =>
        parseRule({ type: "custom", name: "shutdown", options: { run: 1n } }),
      );

      // Then it is refused at the boundary, where a rule document is checked.
      assertStringIncludes(error.message, "rule.options");
    });

    it("hashes the same whichever order its options were written in", () => {
      // Given the same options written two ways.
      const first = custom("shutdown", { region: "gb", year: 2026 });
      const second = custom("shutdown", { year: 2026, region: "gb" });

      // When both are canonicalised.
      // Then they are one rule. A cache key that depended on key order would
      // miss on documents that say the same thing.
      assertIdentical(fingerprint(first), fingerprint(second));
      assertIdentical(
        JSON.stringify(canonical(first)),
        JSON.stringify(canonical(second)),
      );
    });

    it("sorts option keys at every depth and leaves arrays alone", () => {
      // Given options nesting an object inside an array inside an object.
      const written = custom("shutdown", {
        regions: ["scotland", "england"],
        window: { to: "2026-03-12", from: "2026-03-10" },
      });

      // When it is canonicalised.
      const stable = canonical(written);

      // Then the object keys read in order and the array keeps the order it
      // was given. Position is what an array says.
      assertIdentical(
        JSON.stringify(stable),
        '{"type":"custom","name":"shutdown","options":' +
          '{"regions":["scotland","england"],' +
          '"window":{"from":"2026-03-10","to":"2026-03-12"}}}',
      );
    });

    it('keeps a "__proto__" option, which JSON carries as ordinary data', () => {
      // Given stored options holding that key. Written through JSON, because a
      // literal would set the prototype rather than a property.
      const stored =
        '{"type":"custom","name":"shutdown",' +
        '"options":{"region":"gb","__proto__":{"region":"scotland"}}}';

      // When the document is parsed and canonicalised.
      const restored = parseRule(JSON.parse(stored));
      const stable = canonical(restored);

      // Then the key survives with its value, and sorts where a code-unit
      // ordering puts it. Assigning keys one at a time would have handed this
      // one to the inherited setter and dropped it.
      assertIdentical(
        JSON.stringify(stable),
        '{"type":"custom","name":"shutdown",' +
          '"options":{"__proto__":{"region":"scotland"},"region":"gb"}}',
      );
    });

    it("carries a document with no options through untouched", () => {
      // Given a stored custom rule naming nothing but its type.
      const stored = JSON.stringify({ type: "custom", name: "easter" });

      // When it is parsed and canonicalised.
      const restored = parseRule(JSON.parse(stored));

      // Then the absent options stay absent rather than becoming a null.
      assertIdentical(JSON.stringify(restored), stored);
      assertIdentical(JSON.stringify(canonical(restored)), stored);
    });
  });

  describe("inside a schedule, rota or tally", () => {
    const LONDON = "Europe/London";

    const day = (date: string): Temporal.ZonedDateTime =>
      Temporal.ZonedDateTime.from(`${date}T00:00[${LONDON}]`);

    /** Christmas Day 2026, the way a holiday package would ship it. */
    const bankHolidays = (): RuleRegistry => ({
      bankHolidays: {
        intervals: () => [{ start: day("2026-12-25"), end: day("2026-12-26") }],
        describe: () => "It is a bank holiday.",
      },
    });

    const christmasMorning = (): Temporal.ZonedDateTime =>
      day("2026-12-25").add({ hours: 10 });

    const closedForHolidays = (): Schedule =>
      schedule({ zone: LONDON })
        .open(weekdays(), "09:00-17:00")
        .closed(custom("bankHolidays"))
        .withRules(bankHolidays());

    it("answers a schedule question the registry is needed for", () => {
      // Given office hours closed by a holiday package's rule type.
      const office = closedForHolidays();

      // When Christmas morning and Christmas Eve are asked about.
      // Then the holiday closes the first and leaves the second alone.
      assertFalse(office.isOpen(christmasMorning()));
      assertTrue(office.isOpen(day("2026-12-24").add({ hours: 10 })));
    });

    it("keeps searching forward through a custom rule", () => {
      // Given the same schedule, asked on the morning it is shut.
      const office = closedForHolidays();

      // When the next opening is looked for.
      const next = office.opensNext(christmasMorning());

      // Then it skips the holiday and the weekend after it. A search that
      // could not read the holiday would have answered Boxing Day.
      assertIdentical(
        next?.start?.toString(),
        "2026-12-28T09:00:00+00:00[Europe/London]",
      );
    });

    it("puts the rule type's own sentence in the account", () => {
      // Given the same schedule.
      const office = closedForHolidays();

      // When the closed morning is explained.
      const explanation = office.explain(christmasMorning());

      // Then the type's sentence appears where the reason belongs, so the
      // account says why rather than naming a rule it could not read.
      assertFalse(explanation.value);
      assertStringIncludes(explanation.summary, "It is a bank holiday.");
    });

    it("carries the registry to a rota and a tally too", () => {
      // Given the same holiday used to assign cover and to count staffing.
      const registry = bankHolidays();
      const onCall = rota<string>()
        .assign(weekdays(), "alice")
        .assign(custom("bankHolidays"), "bob")
        .withRules(registry);
      const staffing = tally()
        .plus(weekdays(), 2)
        .plus(custom("bankHolidays"), 5)
        .withRules(registry);

      // When Christmas morning is asked about.
      // Then the later assignment wins and the amounts add up.
      assertIdentical(onCall.whoIsOn(christmasMorning()), "bob");
      assertIdentical(staffing.countAt(christmasMorning()), 7);
    });

    it("survives the methods that derive a new schedule", () => {
      // Given a registry attached before the layer that needs it.
      const office = schedule({ zone: LONDON })
        .withRules(bankHolidays())
        .open(weekdays(), "09:00-17:00")
        .closed(custom("bankHolidays"));

      // When the closed morning is asked about.
      // Then it answers. Every builder method returns a new schedule, and the
      // registry travels with each one.
      assertFalse(office.isOpen(christmasMorning()));
    });

    it("keeps the registry out of the stored document", () => {
      // Given a schedule holding a registry.
      const office = closedForHolidays();

      // When it is stored.
      const stored = JSON.stringify(office.toJSON());

      // Then the document holds what it always held. A registry is code, and
      // a document carrying it would not be a document. The scope still names
      // the rule, which is the half that stores.
      assertArrayEquals(Object.keys(JSON.parse(stored) as object), [
        "type",
        "cascade",
        "zone",
      ]);
      assertStringIncludes(stored, '"type":"custom","name":"bankHolidays"');
    });

    it("names both ways of supplying one when none is there", () => {
      // Given the same schedule with no registry attached.
      const office = schedule({ zone: LONDON }).closed(custom("bankHolidays"));

      // When it is asked about.
      const error = assertThrowsError(() => office.isOpen(christmasMorning()));

      // Then the message names the route this object actually offers, as well
      // as the context one the core queries take.
      assertInstanceOf(error, UnknownCustomRuleError);
      assertStringIncludes(error.message, "withRules()");
    });
  });

  describe("what it cannot do", () => {
    it("cannot be written as cron, and says why", () => {
      // Given a rule holding a custom type.
      const written = toCron(custom("easter"));

      // When it is written as cron.
      // Then it is refused with the reason. A notation carries what the
      // document says, and this document says a name.
      assertFalse(written.ok);
      assertStringIncludes(written.reason, "easter");
      assertStringIncludes(written.reason, "lives in code");
    });

    it("explains itself with the sentence its type supplies", () => {
      // Given a type that describes its own options.
      const rules: RuleRegistry = { shutdown: wholeDates() };

      // When a matching instant is explained.
      const explanation = explainRule(
        custom("shutdown", ["2026-03-11"]),
        when("2026-03-11T10:00"),
        { rules },
      );

      // Then the type's own sentence leads, and Quando says whether it held.
      assertTrue(explanation.matched);
      assertStringIncludes(explanation.description, "claimed by the");
      assertStringIncludes(explanation.description, "matches at this instant");
    });

    it("explains itself by name when its type supplies no sentence", () => {
      // Given a type with no description and a rule that does not match.
      const rules: RuleRegistry = { quiet: yielding() };

      // When an instant is explained.
      const explanation = explainRule(
        custom("quiet"),
        when("2026-03-11T10:00"),
        {
          rules,
        },
      );

      // Then the account names the rule rather than leaving a blank where
      // every other rule gives a reason.
      assertFalse(explanation.matched);
      assertStringIncludes(explanation.description, '"quiet"');
      assertStringIncludes(explanation.description, "does not match");
    });
  });
});
