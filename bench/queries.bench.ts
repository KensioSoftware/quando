/**
 * What the common questions cost.
 *
 * These are a baseline to compare against, not a gate. They run on demand with
 * `pnpm bench` and no CI job reads them, because a shared runner's timings say
 * more about the runner than about the change. The gate that does run is in
 * [date-runs.test.ts](../src/date-runs.test.ts), and it asserts a ratio rather
 * than a time.
 *
 * The workloads are the shapes an application actually asks about: is it open
 * now, when does it next open, how much time is in this window, and where does
 * a deadline land.
 */

import { bench, describe } from "vitest";

import { dates, timeOfDay, weekdays } from "../src/build.js";
import { canonical } from "../src/canonical.js";
import { intervals } from "../src/interpret.js";
import { parseRule } from "../src/parse.js";
import type { Rule } from "../src/rule.js";
import { parseSchedule, schedule } from "../src/schedule.js";

const ZONE = "Europe/London";

const at = (iso: string): Temporal.ZonedDateTime =>
  Temporal.ZonedDateTime.from(`${iso}[${ZONE}]`);

/** Pulls a lazy stream to the end. Leaving it unread would time nothing. */
const drain = (stream: Iterable<unknown>): number => {
  let seen = 0;
  for (const item of stream) {
    if (item !== undefined) {
      seen++;
    }
  }
  return seen;
};

/** Two decades of closures, the size a national holiday list reaches. */
const holidays = (): string[] => {
  const start = Temporal.PlainDate.from("2015-01-01");
  return Array.from({ length: 160 }, (_, index) =>
    start.add({ days: index * 46 }).toString(),
  );
};

const office = schedule({ zone: ZONE }).open(weekdays(), "09:00-17:00");
const withHolidays = office.closed(dates(...holidays()));

const MIDWEEK = at("2026-06-17T10:00");
const FRIDAY_EVENING = at("2026-06-19T18:30");

describe("a point in time", () => {
  bench("isOpen", () => {
    office.isOpen(MIDWEEK);
  });

  bench("isOpen, closed on 160 holidays", () => {
    withHolidays.isOpen(MIDWEEK);
  });

  bench("explain", () => {
    office.explain(MIDWEEK);
  });
});

describe("searching forward", () => {
  bench("opensNext, from a Friday evening", () => {
    office.opensNext(FRIDAY_EVENING);
  });

  bench("firstOpenSlot, four hours", () => {
    office.firstOpenSlot(FRIDAY_EVENING, Temporal.Duration.from({ hours: 4 }));
  });

  bench("addOpenTime, 200 working hours", () => {
    office.addOpenTime(FRIDAY_EVENING, Temporal.Duration.from({ hours: 200 }));
  });
});

describe("a window", () => {
  const YEAR_START = at("2026-01-01T00:00");
  const YEAR_END = at("2027-01-01T00:00");
  const rule = weekdays().and(timeOfDay("09:00", "17:00"));

  bench("a year of intervals", () => {
    drain(intervals(rule, { from: YEAR_START, to: YEAR_END }));
  });

  bench("openDuration over a year", () => {
    office.openDuration(YEAR_START, YEAR_END);
  });

  const HALF_AN_HOUR = Temporal.Duration.from({ minutes: 30 });

  bench("openSlots, half-hour appointments over a month", () => {
    drain(
      office.openSlots(YEAR_START, at("2026-02-01T00:00"), {
        every: HALF_AN_HOUR,
        lasting: HALF_AN_HOUR,
      }),
    );
  });
});

describe("documents", () => {
  const written = JSON.stringify(withHolidays);
  const rule: Rule = weekdays().and(timeOfDay("09:00", "17:00"));
  const writtenRule = JSON.stringify(rule);

  bench("writing a schedule as JSON", () => {
    JSON.stringify(withHolidays);
  });

  bench("reading a schedule back", () => {
    parseSchedule(JSON.parse(written));
  });

  bench("parseRule on an office rule", () => {
    parseRule(JSON.parse(writtenRule) as unknown);
  });

  bench("canonical of an office rule", () => {
    canonical(rule);
  });
});
