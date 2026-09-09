import { storedJSON } from "#test/stored-json.js";
import { inWindow, when } from "#test/intervals.js";
import {
  assertArrayLength,
  assertFalse,
  assertIdentical,
  assertInstanceOf,
  assertNonNullable,
  assertStringIncludes,
  assertThrowsError,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";
import {
  always,
  atMostOccurrences,
  availableSlots,
  BeyondHorizonError,
  coveredDuration,
  customRule,
  dates,
  defineCustomRule,
  firstAvailableSlot,
  isActiveAt,
  knownThrough,
  parseRota,
  parseSchedule,
  parseString,
  parseTally,
  possibilities,
  renderTimeline,
  rota,
  sameDefinition,
  schedule,
  SearchLimitExceededError,
  tally,
  timeline,
  timeOfDayRange,
  UnresolvedOutcomeError,
  weekdays,
  whereValueMatches,
} from "./index.js";
import { intervals } from "./interpret.js";

describe("the public query contracts", () => {
  it("keeps a Friday overnight shift attached to Friday after storage", () => {
    // Given a shift starting on Friday evening.
    const original = schedule({ zone: "Europe/London" }).open(
      "fri",
      "22:00-06:00",
    );

    // When its definition is stored and restored.
    const restored = parseSchedule(storedJSON(original));

    // Then it covers Friday evening and Saturday morning only.
    assertFalse(restored.isOpen(when("2026-03-13T01:00")));
    assertTrue(restored.isOpen(when("2026-03-13T23:00")));
    assertTrue(restored.isOpen(when("2026-03-14T01:00")));
    assertFalse(restored.isOpen(when("2026-03-14T06:00")));
    assertTrue(sameDefinition(original.cascade, restored.cascade));
    assertIdentical(restored.explain(when("2026-03-14T01:00")).value, true);
  });

  it("measures overnight hours through a clock change", () => {
    // Given a Saturday night shift crossing the spring clock change.
    const nights = schedule({ zone: "Europe/London" }).open(
      "sat",
      "22:00-06:00",
    );

    // When its elapsed opening time is measured.
    const duration = nights.openDuration(
      when("2026-03-28T21:00"),
      when("2026-03-29T07:00"),
    );

    // Then the eight wall-clock hours occupy seven elapsed hours.
    assertIdentical(duration.total("hours"), 7);
  });

  it("sets overnight hours on a selected date", () => {
    // Given ordinary weekday hours replaced by one overnight shift.
    const office = schedule()
      .open("mon-fri", "09:00-17:00")
      .setHours("2026-03-13", "22:00-06:00");

    // When the replacement date and following morning are queried.
    const daytime = office.isOpen(when("2026-03-13T12:00"));
    const overnight = office.isOpen(when("2026-03-14T02:00"));

    // Then only the replacement hours remain for that date.
    assertFalse(daytime);
    assertTrue(overnight);
  });

  it("keeps attached custom rules in standalone and selected-value queries", () => {
    // Given a named rule attached to a schedule and a stored rota.
    const rule = customRule("office");
    const rules = {
      office: {
        intervals: () => [
          { start: when("2026-03-09T09:00"), end: when("2026-03-09T17:00") },
        ],
      },
    };
    const office = schedule().open(rule).withCustomRules(rules);
    const onCall = parseRota(
      storedJSON(rota().assign(rule, { id: "alice" })),
      (value) => {
        const record = value as { id: unknown };
        return { id: parseString(record.id, "id") };
      },
    ).withCustomRules(rules);

    // When both sources are queried through standalone functions.
    const at = when("2026-03-09T12:00");
    const alice = whereValueMatches(onCall, (person) => person.id === "alice");

    // Then the attached registry and logical value selection are preserved.
    assertTrue(isActiveAt(office, at));
    assertTrue(isActiveAt(alice, at));
    assertIdentical(
      coveredDuration(
        alice,
        inWindow("2026-03-09T00:00", "2026-03-10T00:00"),
      ).total("hours"),
      8,
    );
    assertFalse(
      isActiveAt(office, at, { rules: { office: { intervals: () => [] } } }),
    );
  });

  it("accepts occurrence history through schedule methods", () => {
    // Given a schedule whose rule needs an explicit occurrence history.
    const office = schedule().open(atMostOccurrences(1, { per: "day" }));
    const at = when("2026-03-09T12:00");

    // When an empty history and a used allowance are supplied.
    const empty = office.isOpen(at, { occurrences: [] });
    const used = office.isOpen(at, { occurrences: [{ at }] });

    // Then the two histories give their respective answers.
    assertTrue(empty);
    assertFalse(used);
    assertIdentical(office.explain(at, { occurrences: [] }).value, true);
  });

  it("returns definite slot endpoints from a duration property bag", () => {
    // Given an opening with enough room for a half-hour appointment.
    const office = schedule().open("mon", "09:00-17:00");
    const from = when("2026-03-09T10:00");

    // When the first available slot is searched for with one options argument.
    const slot = firstAvailableSlot(
      office,
      { minutes: 30 },
      { from, within: { hours: 1 } },
    );

    // Then both endpoints are present after checking that the slot exists.
    assertNonNullable(slot);
    assertTrue(slot.start.equals(from));
    assertTrue(slot.end.equals(from.add({ minutes: 30 })));
  });

  it("distinguishes clipped intervals from complete openings", () => {
    // Given a search ending while the office is still open.
    const office = schedule().open("mon", "09:00-17:00");
    const from = when("2026-03-09T10:00");

    // When the same opening is requested with each end policy.
    const clipped = office.nextOpenInterval(from, { within: { minutes: 30 } });
    const complete = office.nextOpenInterval(from, {
      within: { minutes: 30 },
      intervalEnd: "complete",
      endWithin: { hours: 8 },
    });

    // Then the default respects the search boundary and complete finds closing time.
    assertTrue(clipped?.end?.equals(from.add({ minutes: 30 })) ?? false);
    assertTrue(complete?.end?.equals(when("2026-03-09T17:00")) ?? false);
    assertInstanceOf(
      assertThrowsError(() =>
        schedule()
          .open(always())
          .nextOpenInterval(from, {
            intervalEnd: "complete",
            endWithin: { hours: 1 },
          }),
      ),
      SearchLimitExceededError,
    );
  });

  it("refuses unknown availability instead of returning an empty answer", () => {
    // Given coverage whose knowledge ends before the query window.
    const unknown = knownThrough("2026-03-08", always());
    const window = inWindow("2026-03-09T09:00", "2026-03-09T10:00");

    // When point, slot, interval, and timeline queries need that coverage.
    const queries = [
      () => isActiveAt(unknown, window.from),
      () => firstAvailableSlot(unknown, { minutes: 30 }, window),
      () =>
        availableSlots(unknown, window, {
          every: { minutes: 15 },
          lasting: { minutes: 30 },
        }),
      () => [...intervals(unknown, window)],
      () => timeline(unknown, window),
    ];

    // Then every query reports the knowledge boundary.
    for (const query of queries) {
      assertInstanceOf(assertThrowsError(query), BeyondHorizonError);
    }
  });

  it("includes zero counts and preserves tally settings through storage", () => {
    // Given a London tally with a negative count for one hour.
    const original = tally({ zone: "Europe/London" })
      .plus(timeOfDayRange("09:00", "10:00"), 5)
      .setCount(timeOfDayRange("09:00", "10:00"), -2);
    const staff = parseTally(storedJSON(original));
    const from = when("2026-03-09T08:00");
    const to = when("2026-03-09T11:00");

    // When counts and their minimum are read across surrounding unassigned time.
    const spans = [...staff.countIntervals(from, to)];

    // Then zeros fill the gaps and the negative count remains the minimum.
    assertIdentical(staff.zone, "Europe/London");
    assertArrayLength(spans, 3);
    assertIdentical(spans.map(({ value }) => value).join(","), "0,-2,0");
    assertIdentical(staff.minimumCount(from, to), -2);
    assertIdentical(staff.totalBetween(from, to, "hour"), -2);
  });

  it("carries estimates through schedule arithmetic without losing outcomes", () => {
    // Given weekday opening hours and two possible amounts of working time.
    const office = schedule().open(weekdays(), "09:00-17:00");
    const from = when("2026-03-09T09:00");

    // When the estimate is advanced through the schedule.
    const result = office.addOpenTime(
      from,
      possibilities([{ hours: 1 }, { hours: 2 }]),
    );
    const days = office.addOpenDays(from, possibilities([1, 2]));

    // Then every possible arrival survives, or the failing outcome is named.
    assertArrayLength(result.values, 2);
    assertArrayLength(days.values, 2);
    assertTrue(result.values[1].equals(from.add({ hours: 2 })));
    const error = assertThrowsError(() =>
      office.addOpenTime(from, possibilities([{ hours: 1 }, { hours: 2 }]), {
        within: { hours: 1 },
      }),
    );
    assertInstanceOf(error, UnresolvedOutcomeError);
    assertIdentical((error.outcome as { hours: number }).hours, 2);
  });

  it("validates custom options before typed callbacks use them", () => {
    // Given a custom definition whose callbacks expect a parsed date.
    const holiday = defineCustomRule({
      parseOptions: parseString,
      intervals: (context, date) => intervals(dates(date), context),
      describe: (date) => `Holiday on ${date}`,
      knownThrough: () => "2026-12-31",
    });
    const office = schedule()
      .open(customRule("holiday", "2026-03-09"))
      .withCustomRules({ holiday });

    // When the rule is evaluated and explained.
    const at = when("2026-03-09T10:00");

    // Then both callbacks receive the parsed option.
    assertTrue(office.isOpen(at));
    assertStringIncludes(office.explain(at).summary, "2026-03-09");
    assertInstanceOf(
      assertThrowsError(() =>
        isActiveAt(customRule("holiday", 2), at, { rules: { holiday } }),
      ),
      TypeError,
    );
  });

  it("renders timeline data after the rule has been discarded", () => {
    // Given evaluated timeline data stored as JSON.
    const data = timeline(
      schedule().open("mon", "09:00-17:00"),
      inWindow("2026-03-09T00:00", "2026-03-10T00:00"),
    );

    // When the stored data is rendered without its source definition.
    const restored = storedJSON(data) as typeof data;
    const text = renderTimeline(restored);

    // Then the text retains the evaluated opening hours.
    assertStringIncludes(text, "09:00-17:00");
  });
});
