import { renderValued, when } from "#test/intervals.js";
import {
  assertIdentical,
  assertInstanceOf,
  assertUndefined,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { dates, weekdays, weekends } from "./build.js";
import { cascade, layer } from "./cascade.js";
import { rota } from "./rota.js";
import { take } from "./stream.js";

const ON_CALL = rota()
  .assign(weekdays(), "alice")
  .assign(weekends(), "bob")
  .swap("2026-03-11", "carol");

const MONDAY = when("2026-03-09T00:00");
const NEXT_MONDAY = when("2026-03-16T00:00");

describe("a rota", () => {
  it("is the cascade it would have been written as by hand", () => {
    const byHand = cascade(
      layer(weekdays(), "alice"),
      layer(weekends(), "bob"),
      layer(dates("2026-03-11"), "carol"),
    );

    assertIdentical(JSON.stringify(ON_CALL), JSON.stringify(byHand));
  });

  it("says who is on", () => {
    assertIdentical(ON_CALL.whoIsOn(when("2026-03-09T10:00")), "alice");
    assertIdentical(ON_CALL.whoIsOn(when("2026-03-14T10:00")), "bob");
  });

  it("gives a swapped day to whoever took it", () => {
    assertIdentical(ON_CALL.whoIsOn(when("2026-03-11T10:00")), "carol");
  });

  it("says nobody when nothing covers the moment", () => {
    const weekdaysOnly = rota().assign(weekdays(), "alice");

    assertUndefined(weekdaysOnly.whoIsOn(when("2026-03-14T10:00")));
  });

  it("hands back each stretch and who has it", () => {
    const week = ON_CALL.shifts(MONDAY, NEXT_MONDAY);

    assertIdentical(
      renderValued(week),
      "[2026-03-09T00:00:00,2026-03-11T00:00:00)=alice " +
        "[2026-03-11T00:00:00,2026-03-12T00:00:00)=carol " +
        "[2026-03-12T00:00:00,2026-03-14T00:00:00)=alice " +
        "[2026-03-14T00:00:00,2026-03-16T00:00:00)=bob",
    );
  });

  it("runs on for as long as it is asked to", () => {
    // No end given, so the shifts keep coming; taking two is what stops it.
    const rolling = rota().assign(weekdays(), "alice");
    const shifts = rolling.shifts(MONDAY);

    assertIdentical(
      renderValued(take(shifts, 2)),
      "[2026-03-09T00:00:00,2026-03-14T00:00:00)=alice " +
        "[2026-03-16T00:00:00,2026-03-21T00:00:00)=alice",
    );
  });
});

describe("the value type", () => {
  it("narrows to the names actually assigned", () => {
    // `whoIsOn` here is "alice" | "bob" | "carol" | undefined rather than
    // string, so a switch over it can be exhaustive. The annotation is the
    // assertion — it is the compiler that checks it.
    const who: "alice" | "bob" | "carol" | undefined = ON_CALL.whoIsOn(MONDAY);

    assertIdentical(who, "alice");
  });

  it("takes a declared type when the names are not known up front", () => {
    const staffing = rota<number>().assign(weekdays(), 3);
    const many: number | undefined = staffing.whoIsOn(when("2026-03-09T10:00"));

    assertIdentical(many, 3);
  });
});

describe("what it refuses", () => {
  it("says so when a day is not a date", () => {
    let thrown: unknown;
    try {
      rota().swap("next Tuesday", "alice");
    } catch (error) {
      thrown = error;
    }

    assertInstanceOf(thrown, RangeError);
  });
});
