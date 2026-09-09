import { inWindow, when } from "#test/intervals.js";
import { storedJSON } from "#test/stored-json.js";
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
import {
  always,
  any,
  atMostOccurrences,
  atMostOccupiedTime,
  BeyondHorizonError,
  coveredDuration,
  coveredDayCount,
  addCoveredDays,
  customRule,
  dates,
  defineCustomRule,
  firstAvailableSlot,
  inCalendar,
  knownThrough,
  never,
  ParseError,
  parseRota,
  parseRule,
  parseRRule,
  parseSchedule,
  parseString,
  parseTally,
  possibilities,
  UnresolvedOutcomeError,
  rota,
  schedule,
  tally,
  timeOfDayRange,
  toRRule,
  validate,
  weekdays,
} from "./index.js";
import { nextValueInterval } from "./assigned.js";
import { intervals } from "./interpret.js";
import { unknownValueIntervals } from "./resolve.js";
import { take } from "./stream.js";

describe("domain consistency and stored contracts", () => {
  it("replaces earlier overnight hours without leaving a morning opening", () => {
    // Given two Friday shifts, including an overnight one.
    const friday = any(
      timeOfDayRange("09:00", "12:00"),
      timeOfDayRange("22:00", "06:00"),
    );
    const original = schedule({ zone: "Europe/London" }).open("fri", friday);

    // When those hours are replaced and stored.
    const changed = original.setHours("2026-03-13", "10:00-14:00");
    const restored = parseSchedule(storedJSON(changed));

    // Then the replacement removes both previous periods and their spillover.
    assertFalse(restored.isOpen(when("2026-03-13T09:00")));
    assertTrue(restored.isOpen(when("2026-03-13T11:00")));
    assertFalse(restored.isOpen(when("2026-03-13T23:00")));
    assertFalse(restored.isOpen(when("2026-03-14T02:00")));
    assertTrue(restored.isOpen(when("2026-03-21T02:00")));
  });

  it("replaces overnight hours on a calendar-qualified scope", () => {
    // Given a calendar-qualified Friday with midnight and overnight ranges.
    const night = schedule()
      .open(inCalendar("iso8601", weekdays()), "22:00-00:00")
      .setHours(
        "2026-03-13",
        any(timeOfDayRange("10:00", "12:00"), timeOfDayRange("21:00", "05:00")),
      );

    // When the new Friday hours are replaced again.
    const changed = night.setHours("2026-03-13", "11:00-13:00");

    // Then Friday owns its morning spillover and midnight remains exclusive.
    assertFalse(changed.isOpen(when("2026-03-14T03:00")));
    assertFalse(changed.isOpen(when("2026-03-13T00:00")));
    assertTrue(changed.isOpen(when("2026-03-13T12:00")));
  });

  it("keeps each compared schedule's own custom registry", () => {
    // Given the same custom name with different meanings in two schedules.
    const scope = customRule("hours");
    const old = schedule()
      .open(scope)
      .withCustomRules({ hours: { intervals: () => [] } });
    const next = schedule()
      .open(scope)
      .withCustomRules({
        hours: {
          intervals: (context) => [{ start: context.from, end: context.to }],
        },
      });
    const from = when("2026-03-09T09:00");
    const to = from.add({ hours: 1 });

    // When their coverage is compared without explicit settings.
    const difference = old.changesTo(next, from, to);

    // Then the new schedule contributes the complete hour.
    assertArrayLength([...difference.opened], 1);
    assertArrayEmpty([...difference.closed]);
  });

  it("uses the same validation defaults and explicit overrides", () => {
    // Given a rota with a gap and an annual exception outside the window.
    const duty = rota({ zone: "Europe/London" }).assign("mon", "alice");
    const window = inWindow("2026-03-09T00:00", "2026-03-11T00:00");

    // When methods and standalone validation inspect it.
    const method = duty.validate(window.from, window.to);
    const standalone = validate(duty, window);
    const inactive = validate(dates("2026-12-25"), window);

    // Then defaults agree and findings retain their evaluated window.
    assertIdentical(JSON.stringify(method), JSON.stringify(standalone));
    assertIdentical(method[0]?.severity, "error");
    assertIdentical(inactive[0]?.severity, "info");
    assertIdentical(inactive[0].window.from, window.from.toString());
    assertArrayEmpty(
      duty.validate(window.from, window.to, { requireFullCoverage: false }),
    );
    assertArrayEmpty(tally().validate(window.from, window.to));
  });

  it("separates the result sentence from the full explanation", () => {
    // Given a labelled opening.
    const office = schedule().open("mon", "09:00-17:00", {
      label: "Reception",
    });

    // When an open instant is explained.
    const explanation = office.explain(when("2026-03-09T10:00"));

    // Then the summary is concise and the trace retains the label.
    assertIdentical(
      explanation.summary,
      "The schedule is open on 2026-03-09 at 10:00 in Europe/London.",
    );
    assertStringIncludes(explanation.details, "Reception");
  });

  it("refuses unknown values across every numeric and assignment query", () => {
    // Given expired knowledge, including inside a nested replacement.
    const limited = knownThrough("2026-03-09", always());
    const staff = tally().setCount(always(), 2).plus(limited, 1);
    const duty = rota().assign(limited, "alice");
    const window = inWindow("2026-03-10T00:00", "2026-03-11T00:00");

    // When answers would depend on the expired coverage.
    const queries = [
      () => staff.minimumCount(window.from, window.to),
      () => staff.totalBetween(window.from, window.to, "hour"),
      () => [...staff.countIntervals(window.from, window.to)],
      () => staff.explain(window.from),
      () => [...duty.shifts(window.from, window.to)],
      () => coveredDuration(schedule().open(limited), window),
      () => coveredDayCount(limited, window),
      () =>
        addCoveredDays(window.from, 1, {
          during: limited,
          within: { days: 2 },
        }),
      () => nextValueInterval(duty, window),
    ];

    // Then none presents an unknown result as zero or unassigned.
    for (const query of queries) {
      assertInstanceOf(assertThrowsError(query), BeyondHorizonError);
    }
    assertArrayLength([...unknownValueIntervals(staff, window)], 1);
  });

  it("reads an unbounded rota lazily when no horizon is declared", () => {
    // Given recurring assignments without an end date.
    const duty = rota().assign(weekdays(), "alice");

    // When only two shifts are requested.
    const shifts = take(duty.shifts(when("2026-03-09T00:00")), 2);

    // Then the next two weeks arrive without an exhaustive future scan.
    assertArrayLength(shifts, 2);
    assertArrayEmpty([
      ...unknownValueIntervals(duty, { from: when("2026-03-09T00:00") }),
    ]);
    assertUndefined(
      nextValueInterval(
        rota(),
        { from: when("2026-03-09T00:00") },
        { within: { days: 1 } },
      ),
    );
  });

  it("refuses to present a knowledge boundary as a confirmed interval end", () => {
    // Given coverage known through Monday, with Tuesday still unknown.
    const limited = knownThrough("2026-03-09", always());
    const office = schedule().open(limited);
    const duty = rota().assign(limited, "alice");
    const from = when("2026-03-09T12:00");

    // When an interval is requested across that knowledge boundary.
    const queries = [
      () => office.nextOpenInterval(from, { within: { days: 2 } }),
      () =>
        office.nextOpenInterval(from, {
          within: { hours: 1 },
          intervalEnd: "complete",
          endWithin: { days: 2 },
        }),
      () => nextValueInterval(duty, { from }, { within: { days: 2 } }),
    ];

    // Then the unknown end is refused, while a known clipped interval is usable.
    for (const query of queries) {
      assertInstanceOf(assertThrowsError(query), BeyondHorizonError);
    }
    const clipped = office.nextOpenInterval(from, { within: { hours: 1 } });
    assertIdentical(clipped?.end?.hour, 13);
  });

  it.each(["schedule", "rota", "tally"])(
    "reports structured %s parse failures",
    (type) => {
      // Given each kind of stored domain object.
      const parse = (value: unknown) =>
        type === "schedule"
          ? parseSchedule(value)
          : type === "rota"
            ? parseRota(value, parseString)
            : parseTally(value);
      const document =
        type === "schedule" ? schedule() : type === "rota" ? rota() : tally();

      // When its envelope or optional zone is invalid.
      for (const zone of [123, "Not/AZone"]) {
        const error = assertThrowsError(() => parse({ ...document, zone }));
        // Then the invalid field has a stable path and code.
        assertInstanceOf(error, ParseError);
        assertIdentical(error.path, `${type}.zone`);
        assertIdentical(error.code, "invalid-value");
      }
      const unknown = assertThrowsError(() =>
        parse({ ...document, extra: true }),
      );
      assertInstanceOf(unknown, ParseError);
      assertIdentical(unknown.code, "unknown-field");
    },
  );

  it("keeps zone-aware assignments through parsing", () => {
    // Given assignments interpreted on the Tokyo clock.
    const original = rota({ zone: "Asia/Tokyo" }).assign(
      "mon 09:00-17:00",
      "alice",
    );

    // When queried from London after storage.
    const restored = parseRota(storedJSON(original), parseString);

    // Then the assignment follows Tokyo business hours.
    assertIdentical(restored.whoIsOn(when("2026-03-09T01:00")), "alice");
    assertUndefined(restored.whoIsOn(when("2026-03-09T10:00")));
  });

  it("supports typed custom definitions without optional callbacks", () => {
    // Given a custom rule with only option validation and coverage.
    const rule = defineCustomRule({
      parseOptions: parseString,
      intervals: (context, value) =>
        value === "open" ? [{ start: context.from, end: context.to }] : [],
    });
    const office = schedule()
      .open(customRule("switch", "open"))
      .withCustomRules({ switch: rule });

    // When the rule is used through point, duration, and timeline queries.
    const window = inWindow("2026-03-09T09:00", "2026-03-09T10:00");

    // Then every operation uses the same parsed options.
    assertTrue(office.isOpen(window.from));
    assertIdentical(
      office.openDuration(window.from, window.to).total("hours"),
      1,
    );
    assertArrayLength(office.timeline(window.from, window.to).days, 1);
  });

  it("reports the failed estimate outcome and its search limit", () => {
    // Given an estimate that an empty schedule cannot resolve.
    const closed = schedule();
    const from = when("2026-03-09T00:00");

    // When automatic and explicit searches exhaust their limits.
    const automatic = assertThrowsError(() =>
      closed.addOpenDays(from, possibilities([1])),
    );
    const explicit = assertThrowsError(() =>
      closed.addOpenDays(from, possibilities([1]), { within: { days: 7 } }),
    );

    // Then the caller can identify the outcome and widen the appropriate limit.
    assertInstanceOf(automatic, UnresolvedOutcomeError);
    assertIdentical(automatic.within, "P100Y");
    assertInstanceOf(explicit, UnresolvedOutcomeError);
    assertIdentical(explicit.outcome, 1);
    assertIdentical(explicit.within, "P7D");
    const unknown = schedule().open(knownThrough("2026-03-08", always()));
    assertInstanceOf(
      assertThrowsError(() =>
        unknown.addOpenDays(from, possibilities([1]), { within: { days: 7 } }),
      ),
      BeyondHorizonError,
    );
  });

  it("rejects invalid cap-window choices for JavaScript callers", () => {
    // Given ambiguous or absent window choices that TypeScript already rejects.
    // When a JavaScript caller supplies them, then construction also refuses.
    // @ts-expect-error Exactly one window choice is required.
    assertThrowsError(() => atMostOccurrences(1, {}));
    assertThrowsError(() =>
      // @ts-expect-error Window choices are mutually exclusive.
      atMostOccupiedTime({ hours: 1 }, { per: "day", within: { hours: 1 } }),
    );
    assertThrowsError(() =>
      firstAvailableSlot(never(), "invalid", {
        from: when("2026-03-09T00:00"),
      }),
    );
  });
});

describe("recurrence duration fidelity", () => {
  it.each(["P1M", "P1W", "PT0S", "-PT1H", "PT25H", "P1D"])(
    "refuses an unsupported timed duration %s",
    (duration) => {
      // Given a timed recurrence whose duration cannot be represented faithfully.
      // When parsed, then the duration is refused rather than shortened.
      assertInstanceOf(
        assertThrowsError(() =>
          parseRRule("FREQ=DAILY", { start: "2026-03-09T09:00", duration }),
        ),
        ParseError,
      );
    },
  );

  it.each([
    "09:00:01",
    "09:00:00.001",
    "09:00:00.000001",
    "09:00:00.000000001",
  ])("refuses sub-minute DTSTART %s", (time) => {
    // Given a start that would lose precision in the minute recurrence model.
    // When parsed, then the start field is identified.
    const error = assertThrowsError(() =>
      parseRRule("FREQ=DAILY", { start: `2026-03-09T${time}` }),
    );
    assertInstanceOf(error, ParseError);
    assertIdentical(error.path, "start");
  });

  it("preserves full days and multiple explicit timed durations", () => {
    // Given all-day and twice-daily recurrences with explicit durations.
    const full = parseRRule("FREQ=DAILY", {
      start: "2026-03-09",
      duration: "P1D",
    });
    const split = parseRRule("FREQ=DAILY;BYHOUR=9,14;BYMINUTE=30", {
      start: "2026-03-09",
      duration: "PT2H",
    });
    const window = inWindow("2026-03-09T00:00", "2026-03-10T00:00");

    // When their coverage is measured.
    // Then durations survive and the two separate occurrences remain separate.
    assertIdentical(coveredDuration(full, window).total("hours"), 24);
    assertIdentical(coveredDuration(split, window).total("hours"), 4);
    assertArrayLength([...intervals(split, window)], 2);
    assertTrue(toRRule(full).ok);
    assertThrowsError(() =>
      parseRule({ type: "shiftDays", days: 0.5, rule: { type: "always" } }),
    );
  });
});
