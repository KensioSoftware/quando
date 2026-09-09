import {
  addCoveredDays,
  addCoveredTime,
  availableSlots,
  coveredDuration,
  firstAvailableSlot,
  rota,
  schedule,
  tally,
  weekdays,
  possibilities,
  type Distribution,
  type DurationInput,
  type Estimate,
  type Rule,
  type RuleData,
  type Slot,
  type Possibilities,
} from "../src/index.js";

/** Consumer contracts checked by build:check. */
export function checkDxTypes(
  at: Temporal.ZonedDateTime,
  days: Estimate<number>,
  durations: Estimate<DurationInput>,
): void {
  const rule: Rule = weekdays();
  rule.and(weekdays());
  const data: RuleData = rule;
  const office = schedule().open(data);
  const selected = rota<"alice">().assign(weekdays(), "alice");
  // @ts-expect-error Explicit value types constrain every assignment.
  selected.assign(weekdays(), "bob");
  const inferred = rota().assign(weekdays(), "alice").assign(weekdays(), 2);
  const person: "alice" | 2 | undefined = inferred.whoIsOn(at);
  const arrival: Estimate<Temporal.ZonedDateTime> = addCoveredDays(at, days, {
    during: office,
  });
  const elapsed: Estimate<Temporal.ZonedDateTime> = addCoveredTime(
    at,
    durations,
    { during: office },
  );
  const methodArrival: Estimate<Temporal.ZonedDateTime> = office.addOpenDays(
    at,
    days,
  );
  const methodElapsed: Estimate<Temporal.ZonedDateTime> = office.addOpenTime(
    at,
    durations,
  );
  const scalar: Temporal.ZonedDateTime | undefined = office.addOpenTime(at, {
    hours: 1,
  });
  const discrete: Possibilities<Temporal.ZonedDateTime> = office.addOpenDays(
    at,
    possibilities([1, 2]),
  );
  const weighted = durations as Distribution<DurationInput>;
  const distribution: Distribution<Temporal.ZonedDateTime> = office.addOpenTime(
    at,
    weighted,
  );
  const slot: Slot | undefined = firstAvailableSlot(
    office,
    { minutes: 30 },
    { from: at, within: { days: 1 } },
  );
  slot?.start.toString();
  slot?.end.toString();
  office.isOpen(at, { occurrences: [] });
  tally().countAt(at, { occurrences: [] });
  // @ts-expect-error Totals require a finite end.
  coveredDuration(office, { from: at });
  availableSlots(
    office,
    // @ts-expect-error Public slot iteration requires a finite end.
    { from: at },
    { every: { minutes: 15 }, lasting: { minutes: 30 } },
  );
  void [
    person,
    arrival,
    elapsed,
    methodArrival,
    methodElapsed,
    scalar,
    discrete,
    distribution,
  ];
}
