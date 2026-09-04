import { assertFalse, assertIdentical, assertTrue } from "@kensio/smartass";
import { faker } from "@faker-js/faker";
import { describe, it } from "vitest";

import {
  all,
  always,
  any,
  between,
  dates,
  daysOfMonth,
  daysOfWeek,
  inZone,
  monthsOfYear,
  never,
  nthDayOfWeekInMonth,
  not,
  onOrAfter,
  timeOfDay,
  weekdays,
} from "./build.js";
import { canonical, equals, fingerprint } from "./canonical.js";
import { parseRule } from "./parse.js";
import { cascade, layer, merged, replace, whenever } from "./cascade.js";
import type { Rule } from "./rule.js";

describe("putting a rule in canonical form", () => {
  /** What a rule looks like once canonicalised. */
  const formOf = (rule: Rule): string => JSON.stringify(canonical(rule));

  describe("flattening", () => {
    it("lifts a nested all into the one around it", () => {
      // Given what `.except()` builds, which is `all(this, not(any(…)))` and
      // so puts an `all` inside an `all`.
      const rule = all(all(daysOfWeek("monday"), daysOfWeek("tuesday")));

      // When it is canonicalised.
      // Then there is one `all` where there were two.
      assertIdentical(
        formOf(rule),
        '{"type":"all","rules":[' +
          '{"type":"daysOfWeek","days":["monday"]},' +
          '{"type":"daysOfWeek","days":["tuesday"]}]}',
      );
    });

    it("unwraps a combinator holding one rule", () => {
      // Given an `any` with a single operand, which is what filtering a list
      // down to one leaves behind.
      const rule = any(daysOfWeek("monday"));

      // When it is canonicalised.
      // Then the wrapper is gone. It said nothing.
      assertIdentical(formOf(rule), '{"type":"daysOfWeek","days":["monday"]}');
    });
  });

  describe("the constants", () => {
    it("drops the one that adds nothing", () => {
      // Given an `all` carrying `always`, and an `any` carrying `never`.
      const monday = daysOfWeek("monday");
      const intersection = all(monday, always());
      const union = any(monday, never());

      // When each is canonicalised.
      // Then the constant is gone, because intersecting with all of time and
      // uniting with none of it both leave the other operand alone.
      assertIdentical(
        formOf(intersection),
        '{"type":"daysOfWeek","days":["monday"]}',
      );
      assertIdentical(formOf(union), '{"type":"daysOfWeek","days":["monday"]}');
    });

    it("settles on the one that dominates", () => {
      // Given an `all` carrying `never`, and an `any` carrying `always`.
      const monday = daysOfWeek("monday");
      const intersection = all(monday, never());
      const union = any(monday, always());

      // When each is canonicalised.
      // Then the whole rule is that constant, whatever else it held.
      assertIdentical(formOf(intersection), '{"type":"never"}');
      assertIdentical(formOf(union), '{"type":"always"}');
    });

    it("reads an empty combinator as its identity", () => {
      // Given the two empty combinators, as filtering every rule out gives.
      // When each is canonicalised.
      // Then each becomes the constant it stands for.
      assertIdentical(formOf(all()), '{"type":"always"}');
      assertIdentical(formOf(any()), '{"type":"never"}');
    });
  });

  describe("negation", () => {
    it("cancels a double one", () => {
      // Given a rule negated twice, which composing complements produces.
      const rule = not(not(daysOfWeek("monday")));

      // When it is canonicalised.
      // Then both are gone.
      assertIdentical(formOf(rule), '{"type":"daysOfWeek","days":["monday"]}');
    });

    it("turns the complement of a constant into the other one", () => {
      // Given the complements of all of time and of none of it.
      const nothing = not(always());
      const everything = not(never());

      // When each is canonicalised.
      // Then each is written as the constant it is.
      assertIdentical(formOf(nothing), '{"type":"never"}');
      assertIdentical(formOf(everything), '{"type":"always"}');
    });
  });

  describe("ordering and duplicates", () => {
    it("puts days in calendar order", () => {
      // Given the same days written in two orders. Alphabetical order would
      // put Friday first, which is not an order anyone reads a week in.
      const written = daysOfWeek("friday", "monday", "wednesday");

      // When it is canonicalised.
      // Then the week reads forwards.
      assertIdentical(
        formOf(written),
        '{"type":"daysOfWeek","days":["monday","wednesday","friday"]}',
      );
    });

    it("drops a day said twice", () => {
      // Given a list that a merge of two rotas might produce.
      // When it is canonicalised.
      // Then the repeat is gone. A day covered twice is covered once.
      assertIdentical(
        formOf(daysOfWeek("monday", "monday")),
        '{"type":"daysOfWeek","days":["monday"]}',
      );
    });

    it("puts months in calendar order", () => {
      // Given the summer written back to front. Alphabetical order would put
      // April first, which is not an order anyone reads a year in.
      const written = monthsOfYear("august", "june", "july");

      // When it is canonicalised.
      // Then the year reads forwards.
      assertIdentical(
        formOf(written),
        '{"type":"monthsOfYear","months":["june","july","august"]}',
      );
    });

    it("orders days from the start of the month before days from the end", () => {
      // Given a payday rule written in the order it was thought of, with a
      // repeat from merging two sources.
      const paydays = daysOfMonth(-1, 15, 1, 15);

      // When it is canonicalised.
      // Then the days counted forwards come first, each said once, and the day
      // counted back from the end follows them.
      assertIdentical(
        formOf(paydays),
        '{"type":"daysOfMonth","days":[1,15,-1]}',
      );
    });

    it("keeps a day from the end apart from the date it happens to fall on", () => {
      // Given the last day of the month and the 31st, which agree in March and
      // disagree in February.
      // When both are canonicalised.
      // Then they stay two rules. Deciding they are one means knowing which
      // month is being asked about, and canonical form never evaluates.
      assertFalse(equals(daysOfMonth(-1), daysOfMonth(31)));
    });

    it("orders the weekdays of an occurrence and keeps the count", () => {
      // Given the first weekend day of the month, written back to front with
      // a repeat.
      const monthly = nthDayOfWeekInMonth(1, "sunday", "saturday", "sunday");

      // When it is canonicalised.
      // Then the days read forwards, once each, and the count is untouched.
      assertIdentical(
        formOf(monthly),
        '{"type":"nthDayOfWeekInMonth","nth":1,"days":["saturday","sunday"]}',
      );
    });

    it("keeps a count from the end apart from one from the start", () => {
      // Given the fourth Friday and the last Friday. They agree in a month
      // with four Fridays and disagree in one with five.
      // When both are canonicalised.
      // Then they stay two rules, for the same reason the last day of the
      // month stays apart from the 31st.
      assertFalse(
        equals(
          nthDayOfWeekInMonth(-1, "friday"),
          nthDayOfWeekInMonth(4, "friday"),
        ),
      );
    });

    it("sorts dates and drops repeats", () => {
      // Given holidays gathered from two sources, out of order and
      // overlapping.
      const holidays = dates("2026-12-26", "2026-12-25", "2026-12-25");

      // When it is canonicalised.
      // Then they run forwards, once each.
      assertIdentical(
        formOf(holidays),
        '{"type":"dates","dates":["2026-12-25","2026-12-26"]}',
      );
    });

    it("writes the ends of a range one way", () => {
      // Given the same range with one end written the long way round.
      const written = between("2026-04-01", "2026-04-30");
      const same = parseRule({
        type: "dateRange",
        from: "2026-04-01",
        to: "2026-04-30",
      });

      // When both are canonicalised.
      // Then they compare equal, and an open end stays absent.
      assertTrue(equals(written, same));
      assertIdentical(
        formOf(onOrAfter("2026-04-01")),
        '{"type":"dateRange","from":"2026-04-01"}',
      );
    });

    it("orders the operands of a combinator", () => {
      // Given the same intersection written both ways round. `all` is
      // commutative, so the two say the same thing.
      const oneWay = all(daysOfWeek("tuesday"), daysOfWeek("monday"));
      const other = all(daysOfWeek("monday"), daysOfWeek("tuesday"));

      // When both are canonicalised.
      // Then they are the same document.
      assertIdentical(formOf(oneWay), formOf(other));
    });

    it("drops an operand said twice", () => {
      // Given a rule intersected with itself, which composing rule sets
      // produces.
      const twice = all(daysOfWeek("monday"), daysOfWeek("monday"));

      // When it is canonicalised.
      // Then one copy is left. Intersection is idempotent.
      assertIdentical(formOf(twice), '{"type":"daysOfWeek","days":["monday"]}');
    });
  });

  describe("writing a Temporal value one way", () => {
    it("reads two spellings of a time as one", () => {
      // Given the same window written with and without seconds, which is what
      // one hand-written rule and one machine-written rule look like.
      const written = timeOfDay("09:00", "17:00");
      const spelledOut = timeOfDay("09:00:00", "17:00:00");

      // When both are canonicalised.
      // Then they agree.
      assertTrue(equals(written, spelledOut));
    });

    it("leaves a value it cannot read alone", () => {
      // Given a rule holding a time that will not parse, as a bad database
      // row would. Canonical form is used for cache keys, so it has to be
      // total. `parseRule` is the place that refuses a document.
      const broken: Rule = {
        type: "timeOfDay",
        from: "half five",
        to: "17:00",
      };

      // When it is canonicalised.
      // Then the unreadable value comes back untouched, with the readable one
      // beside it written out.
      assertIdentical(
        formOf(broken),
        '{"type":"timeOfDay","from":"half five","to":"17:00:00"}',
      );
    });
  });

  describe("what it keeps", () => {
    it("keeps a zone, and keeps two zones apart", () => {
      // Given the same days read in two places.
      const days = daysOfWeek("monday", "tuesday");
      const london = inZone("Europe/London", days);
      const tokyo = inZone("Asia/Tokyo", days);

      // When both are canonicalised.
      // Then the zone survives, and the two rules stay different. They are
      // different schedules.
      assertIdentical(
        formOf(london),
        '{"type":"inZone","zone":"Europe/London","rule":{"type":"daysOfWeek","days":["monday","tuesday"]}}',
      );
      assertFalse(equals(london, tokyo));
    });

    it("keeps the ends of a window in the order they were written", () => {
      // Given a night shift, which wraps past midnight.
      // When it is canonicalised.
      // Then the ends are left where they are. Sorting them would turn a
      // night shift into a day.
      assertIdentical(
        formOf(timeOfDay("22:00", "06:00")),
        '{"type":"timeOfDay","from":"22:00:00","to":"06:00:00"}',
      );
    });
  });

  describe("equality", () => {
    it("holds for a rule built two ways", () => {
      // Given opening hours built up in two sittings, which is what composing
      // a rule from stored pieces gives, against the same thing written out.
      const built = all(all(weekdays()), timeOfDay("09:00", "17:00"));
      const written = all(timeOfDay("09:00:00", "17:00:00"), weekdays());

      // When they are compared.
      // Then they are equal, which they are not as written documents.
      assertTrue(equals(built, written));
      assertFalse(JSON.stringify(built) === JSON.stringify(written));
    });

    it("does not hold for two rules that merely cover the same time", () => {
      // Given all of time, and the seven days of the week. They cover exactly
      // the same time.
      const everything = always();
      const everyDay = daysOfWeek(
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      );

      // When they are compared.
      // Then they are not equal. Equality here is about what a rule says, and
      // deciding the other question means evaluating both over all of time.
      assertFalse(equals(everything, everyDay));
    });
  });

  describe("fingerprint", () => {
    it("is the same string for two rules that say the same thing", () => {
      // Given a rule and a differently written version of it, as two rows of
      // a cache might hold.
      const built = weekdays().and(timeOfDay("09:00", "17:00"));
      const nested = all(all(weekdays()), timeOfDay("09:00:00", "17:00:00"));

      // When each is fingerprinted.
      // Then one key reaches both.
      assertIdentical(fingerprint(built), fingerprint(nested));
    });
  });

  describe("cascades", () => {
    it("canonicalises every scope and keeps the layers in order", () => {
      // Given a rota whose scopes are written untidily. Order is a cascade's
      // meaning, so reordering the layers would change the answer.
      const alice = faker.person.firstName();
      const bob = faker.person.firstName();
      const untidyWeek = all(daysOfWeek("friday", "monday"));
      const rota = cascade(
        layer(untidyWeek, alice, {
          label: "Primary support",
          comment: "Handles Monday and Friday incidents.",
        }),
        layer(dates("2026-03-11"), bob),
      );

      // When it is canonicalised.
      // Then the scopes are tidied and the layers are where they were.
      assertIdentical(
        JSON.stringify(canonical(rota)),
        '{"type":"cascade","layers":[' +
          `{"scope":{"type":"daysOfWeek","days":["monday","friday"]},"value":"${alice}","label":"Primary support","comment":"Handles Monday and Friday incidents."},` +
          `{"scope":{"type":"dates","dates":["2026-03-11"]},"value":"${bob}"}]}`,
      );
    });

    it("drops a merge of override, which is the default said twice", () => {
      // Given the same two layers, one cascade naming the default merge and
      // one saying nothing.
      const layers = [layer(weekdays(), 1), layer(dates("2026-03-11"), 2)];
      const named = merged("override", ...layers);
      const silent = cascade(...layers);

      // When both are canonicalised.
      // Then they are the same document, because they always meant the same.
      assertTrue(equals(named, silent));
    });

    it("keeps explanation context in cascade identity", () => {
      // Given two assignments with the same rule and value but different labels.
      const primary = cascade(
        layer(weekdays(), "alice", { label: "Primary support" }),
      );
      const escalation = cascade(
        layer(weekdays(), "alice", { label: "Escalation support" }),
      );

      // When their complete cascade documents are compared.
      // Then different explanations make them different definitions.
      assertFalse(equals(primary, escalation));
    });

    it("keeps a merge that changes the answer", () => {
      // Given two cascades differing only in how their overlaps combine.
      const layers = [layer(weekdays(), 1), layer(dates("2026-03-11"), 2)];

      // When they are compared.
      // Then they are not equal. The Wednesday holds three under one and two
      // under the other.
      const adding = merged("sum", ...layers);
      const displacing = cascade(...layers);
      assertFalse(equals(adding, displacing));
    });

    it("reaches into a replacement", () => {
      // Given a schedule whose override holds an untidy scope.
      const nested = all(all(weekdays()));
      const untidy = whenever(nested);
      const openingHours = cascade(
        layer(weekdays(), true),
        replace(dates("2026-03-11"), untidy),
      );

      // When it is canonicalised.
      // Then the cascade inside the replacing layer has been tidied too.
      assertIdentical(
        JSON.stringify(canonical(openingHours)),
        '{"type":"cascade","layers":[' +
          '{"scope":{"type":"daysOfWeek","days":' +
          '["monday","tuesday","wednesday","thursday","friday"]},"value":true},' +
          '{"scope":{"type":"dates","dates":["2026-03-11"]},"replace":' +
          '{"type":"cascade","layers":[{"scope":{"type":"daysOfWeek","days":' +
          '["monday","tuesday","wednesday","thursday","friday"]},"value":true}]}}]}',
      );
    });
  });
});
