import { inWindow, when } from "#test/intervals.js";
import {
  assertIdentical,
  assertInstanceOf,
  assertStringIncludes,
  assertThrowsError,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { dates, timeOfDay, weekdays } from "./build.js";
import { advanceByCoveredDays, coveredDayCount } from "./covered-days.js";
import { schedule } from "./schedule.js";

describe("counting whole days a rule covers", () => {
  describe("coveredDayCount", () => {
    it("counts each open date once when a run of them coalesces", () => {
      // Given a schedule open for whole weekdays, which the interval stream
      // hands over as one Monday-to-Saturday interval per week.
      const allDay = weekdays();

      // When the days in one week are counted.
      const days = coveredDayCount(
        allDay,
        inWindow("2026-03-09T00:00", "2026-03-16T00:00"),
      );

      // Then five days are counted, not the one interval they arrive in.
      assertIdentical(days, 5);
    });

    it("counts a day covered for an hour the same as a day covered for eight", () => {
      // Given a week of office hours, and the same week with Wednesday cut to
      // an hour.
      const office = weekdays().and(timeOfDay("09:00", "17:00"));
      const shortWednesday = schedule({ zone: "Europe/London" })
        .open(weekdays(), "09:00-17:00")
        .hoursOn("2026-03-11", "09:00-10:00");
      const week = inWindow("2026-03-09T00:00", "2026-03-16T00:00");

      // When both are counted in days.
      // Then the short Wednesday is still a working day. A covered day is a
      // date the business happens on, whatever length it runs to.
      assertIdentical(coveredDayCount(office, week), 5);
      assertIdentical(coveredDayCount(shortWednesday, week), 5);
    });

    it("counts one day for hours that run past midnight into the next", () => {
      // Given a night shift running from ten at night until six.
      const nightShift = timeOfDay("22:00", "06:00");

      // When the calendar day the shift starts on is counted on its own.
      const days = coveredDayCount(
        nightShift,
        inWindow("2026-03-09T00:00", "2026-03-10T00:00"),
      );

      // Then Monday is one covered day. The window holds the tail of Sunday
      // night and the head of Monday night, and both fall on the one date.
      assertIdentical(days, 1);
    });

    it("leaves out a day whose covered time starts exactly at the window end", () => {
      // Given office hours and a window ending the moment Tuesday opens.
      const office = weekdays().and(timeOfDay("09:00", "17:00"));

      // When the days are counted.
      const days = coveredDayCount(
        office,
        inWindow("2026-03-09T00:00", "2026-03-10T09:00"),
      );

      // Then only Monday counts. The window is half open, and the instant
      // Tuesday opens lies outside it.
      assertIdentical(days, 1);
    });

    it("counts the day a clock change shortens as one day", () => {
      // Given the London week that loses an hour on the Sunday.
      const everyDay = timeOfDay("00:00", "23:59");

      // When its days are counted.
      const days = coveredDayCount(
        everyDay,
        inWindow("2026-03-29T00:00", "2026-04-05T00:00"),
      );

      // Then the week holds seven days. A 23-hour day is a day.
      assertIdentical(days, 7);
    });

    it("refuses a window with no end", () => {
      // Given a context that never stops.
      const office = weekdays().and(timeOfDay("09:00", "17:00"));

      // When its covered days are counted.
      const error = assertThrowsError(() =>
        coveredDayCount(office, inWindow("2026-03-09T00:00")),
      );

      // Then it is refused, the same as measuring covered time forever.
      assertInstanceOf(error, RangeError);
    });
  });

  describe("advanceByCoveredDays", () => {
    /** Open every weekday, with a week of it closed for a shutdown. */
    const businessDays = (): ReturnType<typeof schedule> =>
      schedule({ zone: "Europe/London" })
        .open(weekdays())
        .closed(dates("2026-05-12", "2026-05-13", "2026-05-14", "2026-05-15"));

    it("lands on the second open day, not the second open interval", () => {
      // Given whole-day opening hours with a shutdown coalescing the weeks
      // around it, and a Saturday to start from.
      const saturday = when("2026-05-16T00:00");

      // When two open days are added.
      const reached = advanceByCoveredDays(saturday, 2, {
        during: businessDays(),
      });

      // Then it is the Tuesday. Stepping to the end of each covered interval
      // would have skipped a week for each of the two days.
      assertIdentical(reached?.toPlainDate().toString(), "2026-05-19");
    });

    it("skips the starting day by default", () => {
      // Given a Monday morning while the office is open.
      const office = weekdays().and(timeOfDay("09:00", "17:00"));
      const monday = when("2026-03-09T10:00");

      // When one open day is added.
      const reached = advanceByCoveredDays(monday, 1, { during: office });

      // Then it is Tuesday. Deadlines and delivery promises do not count the
      // day of the act.
      assertIdentical(reached?.toPlainDate().toString(), "2026-03-10");
    });

    it("counts the starting day when asked to and it is still open", () => {
      // Given the same Monday morning.
      const office = weekdays().and(timeOfDay("09:00", "17:00"));
      const monday = when("2026-03-09T10:00");

      // When one open day is added, counting the day it starts on.
      const reached = advanceByCoveredDays(monday, 1, {
        during: office,
        startingDay: "included",
      });

      // Then the answer is that same Monday morning. Same-day delivery is one
      // working day under this convention.
      assertIdentical(reached?.toString(), monday.toString());
    });

    it("passes over the starting day once its open time has gone", () => {
      // Given a Monday evening, after the office has shut.
      const office = weekdays().and(timeOfDay("09:00", "17:00"));
      const mondayEvening = when("2026-03-09T18:00");

      // When one open day is added, counting the day it starts on.
      const reached = advanceByCoveredDays(mondayEvening, 1, {
        during: office,
        startingDay: "included",
      });

      // Then it is Tuesday. Counting runs forward from the instant asked
      // about, so an answer can never fall behind it.
      assertIdentical(reached?.toPlainDate().toString(), "2026-03-10");
    });

    it("answers with the instant the day opens", () => {
      // Given office hours and a Friday afternoon order.
      const office = weekdays().and(timeOfDay("09:00", "17:00"));
      const ordered = when("2026-03-13T16:55");

      // When three working days are added.
      const delivery = advanceByCoveredDays(ordered, 3, { during: office });

      // Then it is Wednesday at nine, the first moment of open time on the
      // day the count lands.
      assertIdentical(
        delivery?.toString(),
        when("2026-03-18T09:00").toString(),
      );
    });

    it("carries the weekend and a holiday without counting either", () => {
      // Given weekday opening with the Monday closed for a bank holiday.
      const openingHours = schedule({ zone: "Europe/London" })
        .open(weekdays(), "09:00-17:00")
        .closed("2026-05-04");
      const friday = when("2026-05-01T09:30");

      // When two open days are added.
      const reached = advanceByCoveredDays(friday, 2, { during: openingHours });

      // Then it is the Wednesday. Four calendar days pass and two of them are
      // working days.
      assertIdentical(reached?.toPlainDate().toString(), "2026-05-06");
    });

    it("counts days rather than lengths across a clock change", () => {
      // Given whole-day opening over the London spring clock change.
      const everyDay = timeOfDay("00:00", "23:59");
      const beforeTheChange = when("2026-03-28T12:00");

      // When two days are added.
      const reached = advanceByCoveredDays(beforeTheChange, 2, {
        during: everyDay,
      });

      // Then it is the 30th. The 29th is 23 hours long and still one day,
      // which is why a duration in days is refused and this is not.
      assertIdentical(reached?.toPlainDate().toString(), "2026-03-30");
    });

    it("stays put when no days are asked for", () => {
      // Given a Saturday, when the office is shut.
      const office = weekdays().and(timeOfDay("09:00", "17:00"));
      const saturday = when("2026-03-14T10:00");

      // When no days are added.
      const reached = advanceByCoveredDays(saturday, 0, { during: office });

      // Then the answer is where it started.
      assertIdentical(reached?.toString(), saturday.toString());
    });

    it("refuses part of a day, which is an elapsed duration", () => {
      // Given office hours.
      const office = weekdays().and(timeOfDay("09:00", "17:00"));

      // When half a day is asked for.
      const error = assertThrowsError(() =>
        advanceByCoveredDays(when("2026-03-09T10:00"), 1.5, { during: office }),
      );

      // Then it is refused, and pointed at the query that measures time.
      assertInstanceOf(error, RangeError);
      assertStringIncludes(error.message, "advanceBy()");
    });

    it("refuses to go backwards", () => {
      // Given office hours.
      const office = weekdays().and(timeOfDay("09:00", "17:00"));

      // When a negative count is asked for.
      const error = assertThrowsError(() =>
        advanceByCoveredDays(when("2026-03-09T10:00"), -1, { during: office }),
      );

      // Then it is refused.
      assertInstanceOf(error, RangeError);
      assertStringIncludes(error.message, "backwards");
    });

    it("fails safely when an unbounded search has no answer", () => {
      // Given a rule that covers nothing at all, and no horizon.
      // When a day is asked for.
      const error = assertThrowsError(() =>
        advanceByCoveredDays(when("2026-03-09T10:00"), 1, {
          during: { type: "never" },
        }),
      );

      // Then the safety limit reports itself rather than the search running on.
      assertStringIncludes(error.message, "advanceByCoveredDays()");
    });

    it("returns undefined once the caller has supplied the horizon", () => {
      // Given office hours and a search stopping on the same day.
      const office = weekdays().and(timeOfDay("09:00", "17:00"));

      // When one open day is asked for within six hours.
      const reached = advanceByCoveredDays(when("2026-03-09T10:00"), 1, {
        during: office,
        within: Temporal.Duration.from({ hours: 6 }),
      });

      // Then there is no answer, and no error. The caller set the limit.
      assertUndefined(reached);
    });
  });

  describe("the two day queries together", () => {
    it("counts the days it advanced over", () => {
      // Given office hours, a Friday afternoon, and a count of working days.
      const office = weekdays().and(timeOfDay("09:00", "17:00"));
      const ordered = when("2026-03-13T16:55");
      const days = 4;

      // When the count is advanced over, and the days up to the end of the
      // day it lands on are counted back.
      const reached = advanceByCoveredDays(ordered, days, {
        during: office,
        startingDay: "included",
      });
      const endOfThatDay = reached
        ?.toPlainDate()
        .add({ days: 1 })
        .toZonedDateTime("Europe/London");
      const counted = coveredDayCount(office, {
        from: ordered,
        ...(endOfThatDay === undefined ? {} : { to: endOfThatDay }),
      });

      // Then the count comes back the same. Advancing by days and counting
      // days read the same calendar.
      assertIdentical(counted, days);
    });
  });
});
