import {
  assertArrayEquals,
  assertStringIncludes,
  assertThrowsError,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { intervals } from "./interpret.js";
import type { RuleData } from "./rule.js";
import { parseRRule } from "./rrule.js";

/**
 * RFC 5545 section 3.8.5.3 prints a worked expansion beside each of its
 * recurrence examples. Those expansions are an authority Quando had no hand in
 * writing, which is what makes them worth testing against: every other
 * assertion in this suite is a date somebody here worked out.
 *
 * Timestamp UNTIL values are replaced below with their equivalent final local
 * dates for these particular start times. Timestamp refusal is tested separately. The
 * RFC assumes the Eastern United States time zone throughout.
 */
describe("expanding the recurrences RFC 5545 works through", () => {
  const NEW_YORK = "America/New_York";

  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  /**
   * The dates an RFC expansion lists, written the way the RFC writes them.
   *
   * `"September 2,9,16"` and `"January 1-31"` are both the spec's own
   * notation. Keeping it means a reader can hold this file beside section
   * 3.8.5.3 and compare, and that converting to ISO by hand, which is where a
   * transcription error would hide, is done once here rather than per example.
   */
  const listed = (year: number, expansion: string): readonly string[] =>
    expansion.split(";").flatMap((part) => {
      const [name, days] = part.trim().split(" ");
      const month = MONTHS.indexOf(name ?? "") + 1;
      return (days ?? "").split(",").flatMap((entry) => {
        // `2` is one day and `2-30` is a run of them. Both appear in the
        // spec's expansions, sometimes in the same line.
        const [first, last] = entry.split("-").map(Number);
        const start = first ?? 0;
        const end = last ?? start;
        const run: number[] = [];
        for (let day = start; day <= end; day += 1) {
          run.push(day);
        }
        return run.map(
          (day) =>
            `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        );
      });
    });

  /** The dates a rule covers in one year, read on the recurrence's clock. */
  const occurrences = (rule: RuleData, year: number): readonly string[] =>
    [
      ...intervals(rule, {
        from: Temporal.ZonedDateTime.from(`${year}-01-01T00:00[${NEW_YORK}]`),
        to: Temporal.ZonedDateTime.from(`${year + 1}-01-01T00:00[${NEW_YORK}]`),
      }),
    ].map(
      (interval) =>
        interval.start?.withTimeZone(NEW_YORK).toPlainDate().toString() ?? "*",
    );

  /** A recurrence started at the RFC's DTSTART, on the RFC's clock. */
  const from = (start: string, text: string): RuleData =>
    parseRRule(text, { start, zone: NEW_YORK });

  describe("daily and weekly", () => {
    it("expands `Daily until December 24, 1997`", () => {
      // Given the RFC's example, DTSTART 19970902T090000.
      const daily = from("1997-09-02T09:00", "FREQ=DAILY;UNTIL=19971223");

      // When 1997 is expanded.
      // Then it matches what the RFC prints: September 2-30; October 1-25,
      // then 26-31 once the clocks go back; November 1-30; December 1-23.
      assertArrayEquals(
        occurrences(daily, 1997),
        listed(
          1997,
          "September 2-30;October 1-25;October 26-31;November 1-30;December 1-23",
        ),
      );
    });

    it("expands `Weekly until December 24, 1997`", () => {
      const weekly = from("1997-09-02T09:00", "FREQ=WEEKLY;UNTIL=19971223");

      assertArrayEquals(
        occurrences(weekly, 1997),
        listed(
          1997,
          "September 2,9,16,23,30;October 7,14,21;October 28;" +
            "November 4,11,18,25;December 2,9,16,23",
        ),
      );
    });

    it("expands `Every other week on Monday, Wednesday, and Friday`", () => {
      // Given the example that starts on Monday, September 1, 1997.
      const fortnightly = from(
        "1997-09-01T09:00",
        "FREQ=WEEKLY;INTERVAL=2;UNTIL=19971223;WKST=SU;BYDAY=MO,WE,FR",
      );

      assertArrayEquals(
        occurrences(fortnightly, 1997),
        listed(
          1997,
          "September 1,3,5,15,17,19,29;October 1,3,13,15,17;" +
            "October 27,29,31;November 10,12,14,24,26,28;December 8,10,12,22",
        ),
      );
    });

    it("expands `Every day in January, for 3 years` both ways it is written", () => {
      // Given the RFC's example, which it spells twice.
      const yearly = from(
        "1998-01-01T09:00",
        "FREQ=YEARLY;UNTIL=20000131;BYMONTH=1;BYDAY=SU,MO,TU,WE,TH,FR,SA",
      );
      const daily = from(
        "1998-01-01T09:00",
        "FREQ=DAILY;UNTIL=20000131;BYMONTH=1",
      );

      // Then both give the RFC's answer, and each other's.
      for (const year of [1998, 1999, 2000]) {
        assertArrayEquals(
          occurrences(yearly, year),
          listed(year, "January 1-31"),
        );
        assertArrayEquals(
          occurrences(daily, year),
          listed(year, "January 1-31"),
        );
      }
    });
  });

  describe("monthly", () => {
    it("expands `Monthly on the first Friday until December 24, 1997`", () => {
      const firstFriday = from(
        "1997-09-05T09:00",
        "FREQ=MONTHLY;UNTIL=19971223;BYDAY=1FR",
      );

      assertArrayEquals(
        occurrences(firstFriday, 1997),
        listed(1997, "September 5;October 3;November 7;December 5"),
      );
    });

    it("expands `Monthly on the third-to-the-last day of the month, forever`", () => {
      const thirdLast = from("1997-09-28T09:00", "FREQ=MONTHLY;BYMONTHDAY=-3");

      assertArrayEquals(
        occurrences(thirdLast, 1997),
        listed(1997, "September 28;October 29;November 28;December 29"),
      );
      assertArrayEquals(
        occurrences(thirdLast, 1998).slice(0, 2),
        listed(1998, "January 29;February 26"),
      );
    });

    it("expands `Every Tuesday, every other month`", () => {
      const everyOther = from(
        "1997-09-02T09:00",
        "FREQ=MONTHLY;INTERVAL=2;BYDAY=TU",
      );

      assertArrayEquals(
        occurrences(everyOther, 1997),
        listed(1997, "September 2,9,16,23,30;November 4,11,18,25"),
      );
      assertArrayEquals(
        occurrences(everyOther, 1998).slice(0, 9),
        listed(1998, "January 6,13,20,27;March 3,10,17,24,31"),
      );
    });

    it("expands `The first Saturday that follows the first Sunday of the month`", () => {
      const saturday = from(
        "1997-09-13T09:00",
        "FREQ=MONTHLY;BYDAY=SA;BYMONTHDAY=7,8,9,10,11,12,13",
      );

      assertArrayEquals(
        occurrences(saturday, 1997),
        listed(1997, "September 13;October 11;November 8;December 13"),
      );
      assertArrayEquals(
        occurrences(saturday, 1998).slice(0, 6),
        listed(1998, "January 10;February 7;March 7;April 11;May 9;June 13"),
      );
    });

    it("expands `Every Friday the 13th, forever`", () => {
      // The RFC's example carries an EXDATE for its own DTSTART, because a
      // recurrence set there always includes it. Quando reads `start` as the
      // point the pattern begins and nothing more, so there is nothing to
      // exclude.
      const friday13th = from(
        "1997-09-02T09:00",
        "FREQ=MONTHLY;BYDAY=FR;BYMONTHDAY=13",
      );

      assertArrayEquals(
        occurrences(friday13th, 1998),
        listed(1998, "February 13;March 13;November 13"),
      );
      assertArrayEquals(
        occurrences(friday13th, 1999),
        listed(1999, "August 13"),
      );
      assertArrayEquals(
        occurrences(friday13th, 2000),
        listed(2000, "October 13"),
      );
    });
  });

  describe("yearly", () => {
    it("expands `Every Thursday in March, forever`", () => {
      const marchThursdays = from(
        "1997-03-13T09:00",
        "FREQ=YEARLY;BYMONTH=3;BYDAY=TH",
      );

      assertArrayEquals(
        occurrences(marchThursdays, 1997),
        listed(1997, "March 13,20,27"),
      );
      assertArrayEquals(
        occurrences(marchThursdays, 1998),
        listed(1998, "March 5,12,19,26"),
      );
      assertArrayEquals(
        occurrences(marchThursdays, 1999),
        listed(1999, "March 4,11,18,25"),
      );
    });

    it("expands `Every Thursday, but only during June, July, and August`", () => {
      const summerThursdays = from(
        "1997-06-05T09:00",
        "FREQ=YEARLY;BYDAY=TH;BYMONTH=6,7,8",
      );

      assertArrayEquals(
        occurrences(summerThursdays, 1997),
        listed(1997, "June 5,12,19,26;July 3,10,17,24,31;August 7,14,21,28"),
      );
      assertArrayEquals(
        occurrences(summerThursdays, 1999),
        listed(1999, "June 3,10,17,24;July 1,8,15,22,29;August 5,12,19,26"),
      );
    });

    it("expands the U.S. Presidential Election day example", () => {
      // `Every 4 years, the first Tuesday after a Monday in November`.
      const election = from(
        "1996-11-05T09:00",
        "FREQ=YEARLY;INTERVAL=4;BYMONTH=11;BYDAY=TU;BYMONTHDAY=2,3,4,5,6,7,8",
      );

      assertArrayEquals(
        occurrences(election, 1996),
        listed(1996, "November 5"),
      );
      assertArrayEquals(
        occurrences(election, 2000),
        listed(2000, "November 7"),
      );
      assertArrayEquals(
        occurrences(election, 2004),
        listed(2004, "November 2"),
      );
    });
  });

  describe("the examples Quando refuses, and why", () => {
    const refused = (text: string, start: string): string =>
      assertThrowsError(() => parseRRule(text, { start, zone: NEW_YORK }))
        .message;

    it("refuses the ones that count occurrences", () => {
      // `Daily for 10 occurrences`, and `The third instance into the month`.
      // Counting needs the occurrences counted, which a rule does not do.
      assertStringIncludes(
        refused("FREQ=DAILY;COUNT=10", "1997-09-02T09:00"),
        "COUNT",
      );
      assertStringIncludes(
        refused("FREQ=MONTHLY;BYDAY=TU,WE,TH;BYSETPOS=3", "1997-09-04T09:00"),
        "BYSETPOS",
      );
    });

    it("refuses the parts with no rule to map onto", () => {
      // `Monday of week number 20`, and `Every third year on the 1st, 100th,
      // and 200th day`.
      assertStringIncludes(
        refused("FREQ=YEARLY;BYWEEKNO=20;BYDAY=MO", "1997-05-12T09:00"),
        "BYWEEKNO",
      );
      assertStringIncludes(
        refused(
          "FREQ=YEARLY;INTERVAL=3;BYYEARDAY=1,100,200",
          "1997-01-01T09:00",
        ),
        "BYYEARDAY",
      );
    });

    it("refuses the ones that recur faster than a day", () => {
      // `Every 3 hours from 9:00 AM to 5:00 PM`, and `Every 15 minutes`.
      assertStringIncludes(
        refused(
          "FREQ=HOURLY;INTERVAL=3;UNTIL=19970902T170000Z",
          "1997-09-02T09:00",
        ),
        "HOURLY",
      );
      assertStringIncludes(
        refused("FREQ=MINUTELY;INTERVAL=15", "1997-09-02T09:00"),
        "MINUTELY",
      );
    });
  });
});
