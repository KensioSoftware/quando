import { inWindow, render } from "#test/intervals.js";
import {
  assertArrayLength,
  assertIdentical,
  assertInstanceOf,
  assertThrowsError,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { dates } from "./build.js";
import { parseCron } from "./cron.js";
import { intervals } from "./interpret.js";
import { take } from "./stream.js";

describe("reading a cron expression as a rule", () => {
  /** Monday 2026-03-09 to the Monday after it. */
  const WEEK = inWindow("2026-03-09T00:00", "2026-03-16T00:00");

  const read = (expression: string, context = WEEK): string =>
    render(intervals(parseCron(expression), context));

  /** The message from a cron expression that should not parse. */
  const complaintAbout = (expression: string): string => {
    const error = assertThrowsError(() => parseCron(expression));
    assertInstanceOf(error, TypeError);
    return error.message;
  };

  describe("what a firing time covers", () => {
    it("covers the minute a run starts in", () => {
      // Given the most ordinary cron line there is, over one day.
      const monday = inWindow("2026-03-09T00:00", "2026-03-10T00:00");

      // When it is read.
      // Then it covers one minute. Cron fires at an instant and a rule covers
      // time, and the minute the run starts in is the honest reading.
      assertIdentical(
        read("0 9 * * *", monday),
        "[2026-03-09T09:00:00,2026-03-09T09:01:00)",
      );
    });

    it("joins neighbouring minutes into one window", () => {
      // Given every minute of the 9 o'clock hour.
      const monday = inWindow("2026-03-09T00:00", "2026-03-10T00:00");

      // When it is read.
      // Then one window comes back rather than sixty touching each other.
      assertIdentical(
        read("* 9 * * *", monday),
        "[2026-03-09T09:00:00,2026-03-09T10:00:00)",
      );
    });

    it("keeps stepped minutes apart", () => {
      // Given a quarter-hourly job, over one hour.
      const hour = inWindow("2026-03-09T09:00", "2026-03-09T10:00");

      // When it is read.
      // Then four separate minutes come back.
      assertIdentical(
        read("*/15 * * * *", hour),
        "[2026-03-09T09:00:00,2026-03-09T09:01:00) " +
          "[2026-03-09T09:15:00,2026-03-09T09:16:00) " +
          "[2026-03-09T09:30:00,2026-03-09T09:31:00) " +
          "[2026-03-09T09:45:00,2026-03-09T09:46:00)",
      );
    });

    it("runs the last minute of the day up to midnight", () => {
      // Given a job at 23:59, which is the one minute whose end is the next
      // day and has no clock time above it.
      const monday = inWindow("2026-03-09T00:00", "2026-03-10T00:00");

      // When it is read.
      // Then it ends at midnight rather than failing to be written.
      assertIdentical(
        read("59 23 * * *", monday),
        "[2026-03-09T23:59:00,2026-03-10T00:00:00)",
      );
    });

    it("covers all of a window when it runs every minute", () => {
      // Given the expression that fires every minute of every day.
      const day = inWindow("2026-03-09T00:00", "2026-03-10T00:00");

      // When it is read.
      // Then the whole window is covered as one interval. Written as clock
      // times it would be a window from 00:00 to 00:00, which is the one
      // `timeOfDay` refuses.
      assertIdentical(
        read("* * * * *", day),
        "[2026-03-09T00:00:00,2026-03-10T00:00:00)",
      );
    });
  });

  describe("the calendar fields", () => {
    it("selects days of the week, counting from Sunday", () => {
      // Given a weekday-morning job written the way cron numbers days.
      // When the week is read.
      // Then Monday to Friday come back, one minute each.
      const runs = read("0 9 * * 1-5").split(" ");
      assertArrayLength(runs, 5);
      assertIdentical(runs[0], "[2026-03-09T09:00:00,2026-03-09T09:01:00)");
      assertIdentical(runs[4], "[2026-03-13T09:00:00,2026-03-13T09:01:00)");
    });

    it("reads Sunday as both 0 and 7", () => {
      // Given the two numbers cron accepts for Sunday.
      // When each is read over a week.
      // Then both land on the Sunday.
      const sunday = "[2026-03-15T09:00:00,2026-03-15T09:01:00)";
      assertIdentical(read("0 9 * * 0"), sunday);
      assertIdentical(read("0 9 * * 7"), sunday);
    });

    it("takes day and month names", () => {
      // Given names rather than numbers, in the case cron files use.
      // When they are read over a week in March.
      // Then the named day comes back.
      assertIdentical(
        read("0 9 * MAR WED"),
        "[2026-03-11T09:00:00,2026-03-11T09:01:00)",
      );
    });

    it("selects a day of the month", () => {
      // Given a monthly job on the 11th.
      // When the week containing it is read.
      // Then it runs once.
      assertIdentical(
        read("30 6 11 * *"),
        "[2026-03-11T06:30:00,2026-03-11T06:31:00)",
      );
    });

    it("skips a month too short to reach the day", () => {
      // Given a job on the 30th, over a February that has 28 days.
      const february = inWindow("2026-02-01T00:00", "2026-03-01T00:00");

      // When it is read.
      // Then it never runs, which is what cron does.
      assertIdentical(read("0 0 30 * *", february), "");
    });
  });

  describe("both day fields restricted", () => {
    it("runs on either day, which is the rule nobody expects", () => {
      // Given the 13th of the month and every Friday. POSIX says a run
      // happens when either field matches, so this is not Friday the 13th.
      // April 2026 makes the difference plain: the 13th is a Monday, so
      // reading this as an intersection would give no runs at all.
      const april = inWindow("2026-04-01T00:00", "2026-05-01T00:00");

      // When April is read. Its Fridays are the 3rd, 10th, 17th and 24th.
      const runs = read("0 0 13 * 5", april).split(" ");

      // Then the four Fridays and the 13th all run.
      assertArrayLength(runs, 5);
      assertIdentical(runs[0], "[2026-04-03T00:00:00,2026-04-03T00:01:00)");
      assertIdentical(runs[2], "[2026-04-13T00:00:00,2026-04-13T00:01:00)");
      assertIdentical(runs[4], "[2026-04-24T00:00:00,2026-04-24T00:01:00)");
    });

    it("intersects when only one day field is restricted", () => {
      // Given the same 13th with the weekday field left open.
      const march = inWindow("2026-03-01T00:00", "2026-04-01T00:00");

      // When March is read.
      // Then only the 13th runs.
      assertIdentical(
        read("0 0 13 * *", march),
        "[2026-03-13T00:00:00,2026-03-13T00:01:00)",
      );
    });

    it("treats a range covering every day as a restriction", () => {
      // Given a day-of-week field naming all seven days, and a day of the
      // month. `0-6` is not `*`, so cron reads both fields as restricted and
      // runs on either.
      const march = inWindow("2026-03-01T00:00", "2026-04-01T00:00");

      // When March is read.
      // Then it runs every day, because every weekday matches.
      const runs = read("0 0 13 * 0-6", march).split(" ");
      assertArrayLength(runs, 31);
    });
  });

  describe("shorthands", () => {
    it("expands the named ones", () => {
      // Given the shorthands, over a window containing the new year.
      const newYear = inWindow("2025-12-30T00:00", "2026-01-03T00:00");

      // When each is read.
      // Then it stands for the expression it names.
      assertIdentical(
        read("@yearly", newYear),
        "[2026-01-01T00:00:00,2026-01-01T00:01:00)",
      );
      assertIdentical(
        read("@monthly", newYear),
        "[2026-01-01T00:00:00,2026-01-01T00:01:00)",
      );
      assertIdentical(read("@daily", newYear).split(" ").length, 4);
    });

    it("takes @midnight and @annually as the aliases they are", () => {
      // Given the two spellings with the same meaning as another shorthand.
      const newYear = inWindow("2025-12-30T00:00", "2026-01-03T00:00");

      // When each is read.
      // Then it matches the one it aliases.
      assertIdentical(read("@midnight", newYear), read("@daily", newYear));
      assertIdentical(read("@annually", newYear), read("@yearly", newYear));
    });

    it("runs hourly", () => {
      // Given the hourly shorthand over three hours.
      const morning = inWindow("2026-03-09T09:00", "2026-03-09T12:00");

      // When it is read.
      // Then it runs on each hour.
      assertArrayLength(read("@hourly", morning).split(" "), 3);
    });
  });

  describe("time zones", () => {
    it("runs on the daemon's clock, not the reader's", () => {
      // Given a job at 09:00 in Tokyo, read from a London context. Tokyo is
      // nine hours ahead in March.
      const tokyoMorning = parseCron("0 9 * * *", { zone: "Asia/Tokyo" });
      const monday = inWindow("2026-03-09T00:00", "2026-03-10T00:00");

      // When the London day is read.
      // Then the run shows at midnight London time.
      assertIdentical(
        render(intervals(tokyoMorning, monday)),
        "[2026-03-09T00:00:00,2026-03-09T00:01:00)",
      );
    });

    it("refuses a zone the runtime has not heard of", () => {
      // Given a zone that no database of zones knows.
      // When the expression is parsed.
      // Then it fails where the mistake is, not at query time.
      assertThrowsError(() => parseCron("0 9 * * *", { zone: "Mars/Olympus" }));
    });
  });

  describe("refusing an expression", () => {
    it("counts the fields", () => {
      // Given four fields, and given six.
      // When each is parsed.
      // Then the message says how many were found and what they are for.
      assertIdentical(
        complaintAbout("0 9 * *"),
        "cron: expected five fields (minute hour day-of-month month day-of-week), found 4",
      );
      assertIdentical(
        complaintAbout("0 0 9 * * *"),
        "cron: expected five fields (minute hour day-of-month month day-of-week), found 6",
      );
    });

    it("names the field that is out of range", () => {
      // Given an hour that does not exist on a 24-hour clock.
      // When it is parsed.
      // Then the field is named along with the range it accepts.
      assertIdentical(
        complaintAbout("0 25 * * *"),
        "hour: 25 is out of range for the hour field. Expected 0 to 23",
      );
    });

    it("refuses a range that runs backwards", () => {
      // Given an overnight window written the way a person would say it.
      // When it is parsed.
      // Then it is refused with the way to write it instead. Cron ranges do
      // not wrap, and reading this as one would invent runs.
      assertIdentical(
        complaintAbout("0 22-6 * * *"),
        'hour: "22-6" runs backwards. Cron ranges do not wrap, so write two entries separated by a comma',
      );
    });

    it("refuses a step that is not a whole number", () => {
      // Given a step written as a fraction, and one written as zero.
      // When each is parsed.
      // Then both are refused. A zero step would never advance.
      assertIdentical(
        complaintAbout("*/0 * * * *"),
        'minute: "*/0" has a step that is not a whole number',
      );
      assertIdentical(
        complaintAbout("*/1.5 * * * *"),
        'minute: "*/1.5" has a step that is not a whole number',
      );
    });

    it("refuses an empty entry in a list", () => {
      // Given a trailing comma, which a generated crontab line often has.
      // When it is parsed.
      // Then it is refused rather than read as one fewer entry.
      assertIdentical(
        complaintAbout("0,30, * * * *"),
        'minute: "0,30," has an empty entry',
      );
    });

    it("names an unknown shorthand", () => {
      // Given @reboot, which is the shorthand with no time meaning at all,
      // and one that does not exist.
      // When each is parsed.
      // Then the message lists the ones that do.
      assertTrue(
        complaintAbout("@reboot").startsWith(
          'cron: "@reboot" is not a cron shorthand.',
        ),
      );
      assertTrue(complaintAbout("@fortnightly").includes("@yearly"));
    });

    it("names a value that is not a number or a name", () => {
      // Given a month written the way a person would say it, and a minute
      // written as a word. Only some fields take names, and the message says
      // which kind it wanted.
      // When each is parsed.
      // Then both are refused, and each says what would have worked.
      assertIdentical(
        complaintAbout("0 9 * Martius *"),
        'month: "Martius" is not a month name or number',
      );
      assertIdentical(
        complaintAbout("half-past * * * *"),
        'minute: "half" is not a whole number',
      );
    });
  });

  describe("what it is for", () => {
    it("answers the next five runs, skipping holidays", () => {
      // Given a weekday-morning batch job and a week of shutdown over Easter.
      const batch = parseCron("0 6 * * 1-5");
      const shutdown = dates("2026-04-03", "2026-04-06");
      const running = batch.except(shutdown);

      // When the next five runs from the start of that week are taken.
      const from = inWindow("2026-03-30T00:00");
      const next = [...take(intervals(running, from), 5)];

      // Then Good Friday and Easter Monday are missing from them, and the run
      // after the break is the Tuesday.
      assertIdentical(
        render(next),
        "[2026-03-30T06:00:00,2026-03-30T06:01:00) " +
          "[2026-03-31T06:00:00,2026-03-31T06:01:00) " +
          "[2026-04-01T06:00:00,2026-04-01T06:01:00) " +
          "[2026-04-02T06:00:00,2026-04-02T06:01:00) " +
          "[2026-04-07T06:00:00,2026-04-07T06:01:00)",
      );
    });

    it("answers whether a job is running at an instant", () => {
      // Given a job at 09:00 on weekdays.
      const job = parseCron("0 9 * * 1-5");

      // When two instants a minute apart are checked.
      // Then the firing minute is covered and the one after it is not.
      const inside = render(
        intervals(job, inWindow("2026-03-09T09:00", "2026-03-09T09:00:30")),
      );
      const outside = render(
        intervals(job, inWindow("2026-03-09T09:01", "2026-03-09T09:01:30")),
      );
      assertIdentical(inside, "[2026-03-09T09:00:00,2026-03-09T09:00:30)");
      assertIdentical(outside, "");
    });
  });
});
