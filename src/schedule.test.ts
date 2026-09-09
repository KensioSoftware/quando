import { inWindow, render, when } from "#test/intervals.js";
import {
  assertArrayEmpty,
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertInstanceOf,
  assertStringIncludes,
  assertThrowsError,
  assertTrue,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { all, dates, timeOfDayRange, weekdays } from "./build.js";
import { cascade, layer, replace } from "./cascade.js";
import { resolve } from "./resolve.js";
import { parseSchedule, schedule } from "./schedule.js";

describe("a schedule", () => {
  /** Monday 2026-03-09 to the Monday after it. */
  const WEEK = inWindow("2026-03-09T00:00", "2026-03-16T00:00");

  /** Weekdays nine to five, closing at three on the Wednesday. */
  const openingHours = () =>
    schedule()
      .open(weekdays(), "09:00-17:00")
      .setHours("2026-03-11", "09:00-15:00");

  it("keeps its cascade as explicit data", () => {
    // Given the same opening hours said twice, once in the domain vocabulary
    // and once as the layers underneath it.
    const usualHours = all(weekdays(), timeOfDayRange("09:00", "17:00"));
    const early = replace(
      dates("2026-03-11"),
      timeOfDayRange("09:00", "15:00"),
    );
    const byHand = cascade(layer(usualHours, true), early);

    // When its underlying data is read.
    // Then the cascade matches the low-level form.
    assertIdentical(
      JSON.stringify(openingHours().cascade),
      JSON.stringify(byHand),
    );
  });

  it("can be resolved by the core, being one", () => {
    // Given the opening hours and a week to read them over.
    // When the core resolver is handed the schedule directly.
    const assigned = [...resolve(openingHours(), WEEK)];
    const open = assigned.filter((period) => period.value);

    // Then the week comes back with the Wednesday shortened.
    assertIdentical(
      render(open),
      "[2026-03-09T09:00:00,2026-03-09T17:00:00) " +
        "[2026-03-10T09:00:00,2026-03-10T17:00:00) " +
        "[2026-03-11T09:00:00,2026-03-11T15:00:00) " +
        "[2026-03-12T09:00:00,2026-03-12T17:00:00) " +
        "[2026-03-13T09:00:00,2026-03-13T17:00:00)",
    );
  });

  it("restores its methods and zone after storage", () => {
    // Given London opening hours that have passed through JSON storage.
    const stored = JSON.stringify(
      schedule({ zone: "Europe/London" }).open(weekdays(), "09:00-17:00"),
    );

    // When the stored schedule is parsed and extended.
    const restored = parseSchedule(JSON.parse(stored)).closed("2026-03-10");

    // Then its zone and methods still govern the answer.
    assertIdentical(restored.zone, "Europe/London");
    assertFalse(restored.isOpen(when("2026-03-10T10:00")));
    assertTrue(restored.isOpen(when("2026-03-11T10:00")));
  });

  it("keeps explanation labels and comments through storage", () => {
    // Given labelled opening hours and a commented closure stored as JSON.
    const original = schedule()
      .open(weekdays(), "09:00-17:00", { label: "Regular office hours" })
      .closed("2026-12-25", {
        label: "Christmas Day",
        comment: "The office is closed for the public holiday.",
      });

    // When the stored schedule is restored and Christmas morning is explained.
    const stored = JSON.stringify(original);
    const restored = parseSchedule(JSON.parse(stored));
    const explanation = restored.explain(when("2026-12-25T10:00"));

    // Then both annotations remain in the readable explanation.
    assertIdentical(explanation.steps[0]?.label, "Regular office hours");
    assertIdentical(explanation.steps[1]?.label, "Christmas Day");
    assertIdentical(
      explanation.steps[1].comment,
      "The office is closed for the public holiday.",
    );
    assertStringIncludes(explanation.details, "Regular office hours.");
    assertStringIncludes(explanation.details, "Christmas Day.");
  });

  it("adds covered time through its own API", () => {
    // Given weekday opening hours and a Monday afternoon start.
    const office = schedule().open(weekdays(), "09:00-17:00");

    // When two open hours are added.
    const reached = office.addOpenTime(
      when("2026-03-09T16:00"),
      Temporal.Duration.from({ hours: 2 }),
    );

    // Then the closed night is skipped.
    assertIdentical(
      reached?.toPlainDateTime().toString(),
      "2026-03-10T10:00:00",
    );
  });

  it("opens for whole days when given no hours", () => {
    // Given a schedule with days named and no hours inside them.
    const everyWeekday = schedule().open(weekdays(), {
      label: "Twenty-four-hour weekday service",
    });

    // When it is asked about three in the morning on a Monday.
    // Then it is open. A day with no hours given is open for all of it.
    assertTrue(everyWeekday.isOpen(when("2026-03-09T03:00")));
    assertIdentical(
      everyWeekday.explain(when("2026-03-09T03:00")).steps[0]?.label,
      "Twenty-four-hour weekday service",
    );
  });

  it("accepts an empty options object for whole-day opening", () => {
    // Given a whole-day opening with no explanation fields.
    const everyWeekday = schedule().open(weekdays(), {});

    // When Monday morning is queried.
    // Then the empty options object is not mistaken for an hours rule.
    assertTrue(everyWeekday.isOpen(when("2026-03-09T03:00")));
  });

  describe("reading it in the order it is said", () => {
    /** Open weekdays nine to five, closed Tuesday, closing early Wednesday. */
    const asSaid = () =>
      schedule()
        .open(weekdays(), "09:00-17:00")
        .closed("2026-03-10")
        .setHours("2026-03-11", "09:00-15:00");

    it("is open during the usual hours", () => {
      // Given the schedule as said out loud.
      // When a Monday morning is asked about, which nothing later touches.
      // Then the usual hours hold.
      assertTrue(asSaid().isOpen(when("2026-03-09T10:00")));
    });

    it("is shut on the day said to be closed", () => {
      // Given the same schedule.
      // When the Tuesday is asked about.
      // Then the closure wins over the weekday hours said before it.
      assertFalse(asSaid().isOpen(when("2026-03-10T10:00")));
    });

    it("explains which opening-hours lines settled a moment", () => {
      // Given the same schedule, with usual hours followed by a closure.
      // When a time during the closure is explained.
      const explanation = asSaid().explain(when("2026-03-10T10:00"));

      // Then its closed value and both matching lines are visible.
      assertFalse(explanation.value);
      assertIdentical(explanation.steps[0]?.type, "assignment");
      assertIdentical(explanation.steps[1]?.type, "assignment");
      assertIdentical(explanation.steps[0].path, "layers[0]");
      assertIdentical(explanation.steps[1].path, "layers[1]");
      assertStringIncludes(
        explanation.details,
        "The schedule is closed on 2026-03-10 at 10:00 in Europe/London.",
      );
      assertStringIncludes(explanation.details, "Tuesday is a weekday.");
      assertStringIncludes(explanation.details, "The date is 2026-03-10.");
      assertStringIncludes(
        explanation.details,
        "changes the schedule from open to closed",
      );
    });

    it("explains why ordinary closed time has no matching lines", () => {
      // Given the same schedule.
      // When a Sunday is explained.
      const explanation = asSaid().explain(when("2026-03-15T10:00"));

      // Then the schedule is closed and each rejected line says why.
      assertFalse(explanation.value);
      assertArrayEmpty(explanation.steps);
      assertArrayLength(explanation.skipped, 3);
      assertStringIncludes(explanation.details, "Sunday is not a weekday.");
      assertStringIncludes(explanation.details, "This layer does not apply.");
    });

    it("keeps the replaced hours on the day they were replaced", () => {
      // Given the same schedule.
      // When two in the afternoon on the Wednesday is asked about.
      // Then it is open, inside the replacement hours.
      assertTrue(asSaid().isOpen(when("2026-03-11T14:00")));
      assertStringIncludes(
        asSaid().explain(when("2026-03-11T14:00")).details,
        "replaces lower-priority schedule layers",
      );
    });

    it("explains when overlapping openings keep the schedule open", () => {
      // Given two opening layers that cover the same time.
      const overlapping = schedule()
        .open(weekdays(), "09:00-17:00")
        .open("2026-03-11", "09:00-12:00");

      // When their overlap is explained.
      const explanation = overlapping.explain(when("2026-03-11T10:00"));

      // Then the second layer is described as preserving the open state.
      assertStringIncludes(
        explanation.details,
        "This layer keeps the schedule open.",
      );
    });

    it("does not let the usual hours show through a replaced day", () => {
      // Given the same schedule, whose Wednesday closes at three.
      // When half past three that day is asked about.
      // Then it is shut. That is the difference between "these hours instead"
      // and "shut from three to five as well as the usual hours".
      assertFalse(asSaid().isOpen(when("2026-03-11T15:30")));
    });
  });

  describe("asking a schedule questions", () => {
    it("says how long it is open between two moments", () => {
      // Given the opening hours, with two hours dropped from the Wednesday.
      // When the week is measured.
      const open = openingHours().openDuration(
        WEEK.from,
        when("2026-03-16T00:00"),
      );

      // Then it comes to five days of eight hours, less the two.
      assertIdentical(open.toString(), "PT38H");
    });

    it("finds the next opening", () => {
      // Given a Friday evening, after closing.
      // When the next opening is asked for.
      const next = openingHours().nextOpenInterval(when("2026-03-13T18:00"));

      // Then it is Monday morning, over the weekend.
      assertIdentical(
        next?.start?.toPlainDateTime().toString(),
        "2026-03-16T09:00:00",
      );
    });

    it("gives back the stretch it is already in", () => {
      // Given a Monday mid-morning, inside opening hours.
      // When the next opening is asked for.
      const next = openingHours().nextOpenInterval(when("2026-03-09T10:00"));

      // Then the answer starts where the asking did. "When does it next open"
      // should answer "it is open".
      assertIdentical(
        next?.start?.toPlainDateTime().toString(),
        "2026-03-09T10:00:00",
      );
    });

    it("gives the whole opening even when the horizon stops inside it", () => {
      // Given an hour before opening, and two hours of horizon to look in.
      const twoHours = Temporal.Duration.from({ hours: 2 });

      // When the next opening is asked for within that horizon.
      const next = openingHours().nextOpenInterval(when("2026-03-09T08:00"), {
        within: twoHours,
        intervalEnd: "complete",
      });

      // Then it ends at five, when the day really closes. The horizon bounds
      // how far to look. Reporting it as a closing time would be wrong.
      assertIdentical(
        next?.end?.toPlainDateTime().toString(),
        "2026-03-09T17:00:00",
      );
    });

    it("finds nothing when the horizon is too short", () => {
      // Given a Friday evening and two hours to look in.
      const soon = Temporal.Duration.from({ hours: 2 });

      // When the next opening is asked for.
      const next = openingHours().nextOpenInterval(when("2026-03-13T18:00"), {
        within: soon,
      });

      // Then there is none to give. Monday is well past the horizon.
      assertUndefined(next);
    });

    it("finds the first opening that fits a slot", () => {
      // Given one hour left in Wednesday's shortened opening.
      const wednesday = when("2026-03-11T14:00");
      const twoHours = Temporal.Duration.from({ hours: 2 });

      // When a two-hour open slot is requested.
      const slot = openingHours().firstOpenSlot(wednesday, twoHours);

      // Then it starts at Thursday's opening.
      assertIdentical(
        render(slot === undefined ? [] : [slot]),
        "[2026-03-12T09:00:00,2026-03-12T11:00:00)",
      );
    });

    it("bounds an open-slot search with a duration", () => {
      // Given a Friday evening and a two-hour search horizon.
      const friday = when("2026-03-13T18:00");
      const lasting = Temporal.Duration.from({ hours: 1 });
      const within = Temporal.Duration.from({ hours: 2 });

      // When the first open slot is requested within that horizon.
      const slot = openingHours().firstOpenSlot(friday, lasting, { within });

      // Then Monday's opening is outside the search.
      assertUndefined(slot);
    });

    it("produces open slots inside a finite window", () => {
      // Given the last hour of Wednesday's shortened opening.
      const from = when("2026-03-11T14:00");
      const to = when("2026-03-11T16:00");

      // When half-hour slots are requested every fifteen minutes.
      const found = openingHours().openSlots(from, to, {
        every: Temporal.Duration.from({ minutes: 15 }),
        lasting: Temporal.Duration.from({ minutes: 30 }),
      });

      // Then every fitting slot ends by the three o'clock closure.
      assertIdentical(
        render(found),
        "[2026-03-11T14:00:00,2026-03-11T14:30:00) " +
          "[2026-03-11T14:15:00,2026-03-11T14:45:00) " +
          "[2026-03-11T14:30:00,2026-03-11T15:00:00)",
      );
    });

    it("reports how its opening times change", () => {
      // Given usual hours and a revision that moves Wednesday one hour later.
      const before = schedule().open(weekdays(), "09:00-17:00");
      const after = before.setHours("2026-03-11", "10:00-18:00");
      const from = when("2026-03-11T00:00");
      const to = when("2026-03-12T00:00");

      // When the old schedule is compared with the revision.
      const changed = before.changesTo(after, from, to);

      // Then the last hour opened and the first hour closed.
      assertIdentical(
        render(changed.opened),
        "[2026-03-11T17:00:00,2026-03-11T18:00:00)",
      );
      assertIdentical(
        render(changed.closed),
        "[2026-03-11T09:00:00,2026-03-11T10:00:00)",
      );
    });

    it("validates its layers without treating closed time as a gap", () => {
      // Given ordinary weekday opening hours with an active exception.
      const hours = openingHours();

      // When the schedule is validated over its representative week.
      const diagnostics = hours.validate(WEEK.from, when("2026-03-16T00:00"));

      // Then every layer is active and ordinary closed time is accepted.
      assertArrayEmpty(diagnostics);
    });

    it("is shut when nothing has been said about it", () => {
      // Given a schedule with nothing said about it at all.
      // When any moment is asked about.
      // Then it is shut. An empty schedule opens for nothing.
      assertFalse(schedule().isOpen(when("2026-03-09T10:00")));
    });

    it("steps over a closed day when looking for the next opening", () => {
      // Given a schedule whose Tuesday is claimed and shut. The closure sits
      // in the stream carrying false, and both questions have to see it and
      // keep looking.
      const withClosure = schedule()
        .open(weekdays(), "09:00-17:00")
        .closed("2026-03-10");

      // When the next opening after Monday evening is asked for, and the week
      // is measured.
      const next = withClosure.nextOpenInterval(when("2026-03-09T18:00"));
      const week = withClosure.openDuration(
        WEEK.from,
        when("2026-03-16T00:00"),
      );

      // Then the Tuesday is stepped over, and its eight hours are uncounted.
      assertIdentical(
        next?.start?.toPlainDateTime().toString(),
        "2026-03-11T09:00:00",
      );
      assertIdentical(week.toString(), "PT32H");
    });
  });

  describe("counting whole open days", () => {
    it("counts each open date in a window", () => {
      // Given weekday opening hours with the Tuesday closed.
      const openWeekdays = schedule({ zone: "Europe/London" })
        .open(weekdays(), "09:00-17:00")
        .closed("2026-03-10");

      // When the open days in the week are counted.
      const days = openWeekdays.openDayCount(
        when("2026-03-09T00:00"),
        when("2026-03-16T00:00"),
      );

      // Then there are four. A count of days answers a question the duration
      // cannot, because a day is not a fixed length of time.
      assertIdentical(days, 4);
    });

    it("adds whole open days to reach a working-day deadline", () => {
      // Given weekday opening hours and a Friday afternoon order.
      const openWeekdays = schedule({ zone: "Europe/London" }).open(
        weekdays(),
        "09:00-17:00",
      );

      // When three working days are added.
      const delivery = openWeekdays.addOpenDays(when("2026-03-13T16:55"), 3);

      // Then it is Wednesday morning, when the doors open on the day the
      // count lands.
      assertIdentical(
        delivery?.toString(),
        when("2026-03-18T09:00").toString(),
      );
    });

    it("counts the days on the schedule's own calendar", () => {
      // Given London opening hours, and a Tokyo instant late on the London
      // Tuesday. Tokyo has already reached Wednesday.
      const london = schedule({ zone: "Europe/London" }).open(
        weekdays(),
        "09:00-17:00",
      );
      const inTokyo = when("2026-03-10T21:00").withTimeZone("Asia/Tokyo");

      // When one open day is added.
      const reached = london.addOpenDays(inTokyo, 1);

      // Then it is the London Wednesday, read back in the caller's zone. A
      // day belongs to the wall calendar the schedule is written on.
      assertIdentical(reached?.timeZoneId, "Asia/Tokyo");
      assertIdentical(
        reached.withTimeZone("Europe/London").toString(),
        when("2026-03-11T09:00").toString(),
      );
    });

    it("takes the starting-day convention through the schedule", () => {
      // Given weekday opening hours and a Monday mid-morning.
      const openWeekdays = schedule({ zone: "Europe/London" }).open(
        weekdays(),
        "09:00-17:00",
      );
      const monday = when("2026-03-09T10:00");

      // When one open day is added each way.
      const excluded = openWeekdays.addOpenDays(monday, 1);
      const included = openWeekdays.addOpenDays(monday, 1, {
        startingDay: "included",
      });

      // Then the default moves to Tuesday and the other stays on Monday.
      assertIdentical(excluded?.toPlainDate().toString(), "2026-03-10");
      assertIdentical(included?.toPlainDate().toString(), "2026-03-09");
    });

    it("returns undefined when a bounded search finds no open day", () => {
      // Given a schedule that never opens, and a week to look in.
      const neverOpen = schedule({ zone: "Europe/London" });

      // When one open day is asked for.
      const reached = neverOpen.addOpenDays(when("2026-03-09T10:00"), 1, {
        within: Temporal.Duration.from({ days: 7 }),
      });

      // Then there is none to give.
      assertUndefined(reached);
    });
  });

  describe("the plain forms it accepts", () => {
    it("refuses a range that is not one", () => {
      // Given hours written the way someone would say them.
      // When they are given to a schedule.
      const error = assertThrowsError(() =>
        schedule().open(weekdays(), "9 til 5"),
      );

      // Then it is refused where it was written, with the shape it wanted.
      assertInstanceOf(error, RangeError);
      assertStringIncludes(error.message, 'a time range such as "09:00-17:00"');
    });

    it("refuses a range with a typo in it rather than reading it as a rule", () => {
      // Given a range whose second half is not a time.
      const error = assertThrowsError(() =>
        schedule().open(weekdays(), "09:00-half"),
      );

      // Then it is refused. A term holding a colon is usually a qualifier,
      // and taking this one as a custom rule named "09" would be a schedule
      // that runs and covers the wrong time.
      assertStringIncludes(error.message, 'cannot read "09:00-half"');
    });

    it("refuses a date that is not one, and says what it nearly was", () => {
      // Given a holiday named instead of dated.
      // When the schedule is told it is closed then.
      const error = assertThrowsError(() => schedule().closed("Christmas"));

      // Then it is refused, naming the term that failed.
      assertStringIncludes(error.message, 'cannot read "Christmas"');
    });

    it("takes a whole line of terms as one scope", () => {
      // Given office hours written as one string.
      const office = schedule({ zone: "Europe/London" }).open(
        "mon-fri 09:00-17:00",
      );

      // When a Tuesday lunchtime and a Sunday lunchtime are asked about.
      // Then the days and the hours both narrowed it, from one argument.
      assertTrue(office.isOpen(when("2026-03-10T12:00")));
      assertFalse(office.isOpen(when("2026-03-15T12:00")));
    });

    it("takes a rule wherever it takes a string", () => {
      // Given a night shift, which no compact range would express as clearly.
      const nightShift = timeOfDayRange("22:00", "06:00");
      const nights = schedule().open(weekdays(), nightShift);

      // When two in the morning is asked about, inside the wrapped window.
      // Then it is open.
      assertTrue(nights.isOpen(when("2026-03-10T02:00")));
    });
  });

  describe("stored forms it refuses", () => {
    const rejected = (value: unknown): string => {
      const error = assertThrowsError(() => parseSchedule(value));
      assertInstanceOf(error, TypeError);
      return error.message;
    };

    it("requires an object", () => {
      // Given values that cannot hold schedule fields.
      // When each is parsed.
      // Then each is rejected at the schedule boundary.
      for (const value of [null, [], "schedule"]) {
        assertStringIncludes(rejected(value), "expected a schedule object");
      }
    });

    it("requires its tag and known fields", () => {
      // Given a document with the wrong tag and one with a misspelt field.
      const wrongTag = { type: "rota", cascade: cascade<boolean>() };
      const unknownField = {
        type: "schedule",
        cascade: cascade<boolean>(),
        timezone: "Europe/London",
      };

      // When each is parsed.
      // Then the message names the broken field.
      assertStringIncludes(rejected(wrongTag), ".type");
      assertStringIncludes(rejected(unknownField), ".timezone");
    });

    it("requires a string zone and override semantics", () => {
      // Given a numeric zone and a summing schedule document.
      const numericZone = {
        type: "schedule",
        cascade: cascade<boolean>(),
        zone: 7,
      };
      const summing = {
        type: "schedule",
        cascade: { type: "cascade", merge: "sum", layers: [] },
      };

      // When each is parsed.
      // Then the domain-specific requirement is reported.
      assertStringIncludes(rejected(numericZone), ".zone");
      assertStringIncludes(rejected(summing), "a schedule uses override");
    });
  });
});
