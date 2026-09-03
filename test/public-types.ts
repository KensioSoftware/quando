import {
  advanceBy,
  type CoverageChanges,
  coverageChanges,
  firstGap,
  rota,
  schedule,
  type ScheduleChanges,
  slots,
  weekdays,
} from "../src/index.js";
import { layer, merged } from "../src/core.js";

interface Duty {
  readonly person: string;
  readonly level: number;
}

const start = Temporal.ZonedDateTime.from("2026-03-09T09:00[Europe/London]");
const office = schedule().open(weekdays(), "09:00-17:00");
const halfHour = Temporal.Duration.from({ minutes: 30 });
const end = start.add({ days: 1 });

advanceBy(start, Temporal.Duration.from({ hours: 1 }), { during: office });
firstGap(office, halfHour, { from: start });
slots(
  office,
  { from: start },
  {
    every: Temporal.Duration.from({ minutes: 15 }),
    lasting: Temporal.Duration.from({ minutes: 30 }),
  },
);
office.firstOpenSlot(start, halfHour);
office.firstOpenSlot(start, halfHour, Temporal.Duration.from({ days: 7 }));
office.openSlots(start, start.add({ hours: 1 }), {
  every: Temporal.Duration.from({ minutes: 15 }),
  lasting: halfHour,
});
const coverageChange: CoverageChanges = coverageChanges(office, weekdays(), {
  from: start,
  to: end,
});
const scheduleChange: ScheduleChanges = office.changesTo(office, start, end);
void coverageChange;
void scheduleChange;
rota().assign(weekdays(), { person: "alice", level: 2 });
rota<Duty>().assign(weekdays(), { person: "alice", level: 2 });
merged("sum", layer(weekdays(), 2), layer(weekdays(), 3));
merged(
  "concat",
  layer(weekdays(), ["alice"] as const),
  layer(weekdays(), ["bob"] as const),
);

// @ts-expect-error A sum accepts numeric layers.
merged("sum", layer(weekdays(), "alice"));

// @ts-expect-error Concat accepts array layers.
merged("concat", layer(weekdays(), "alice"));

const undefinedValue = undefined;

// @ts-expect-error Cascade values must survive JSON storage.
layer(weekdays(), undefinedValue);

// @ts-expect-error Rota values must survive JSON storage.
rota().assign(weekdays(), 1n);

// @ts-expect-error Nested functions do not survive JSON storage.
rota().assign(weekdays(), { run: () => "alice" });

// @ts-expect-error Explicit undefined properties do not survive JSON storage.
rota().assign(weekdays(), { person: undefined });
