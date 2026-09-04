import {
  accumulate,
  advanceBy,
  type CoverageChanges,
  coverageChanges,
  type Explanation,
  type ElapsedUnit,
  ELAPSED_UNITS,
  firstGap,
  type LayerOptions,
  renderTimeline,
  rota,
  type RuleExplanation,
  type SkippedLayer,
  schedule,
  type ScheduleChanges,
  slots,
  type Timeline,
  type TimelineFormat,
  type TimelineOptions,
  TIMELINE_FORMATS,
  type ValidationDiagnostic,
  type ValidationOptions,
  type ValidationWindow,
  validate,
  tally,
  weekdays,
} from "../src/index.js";
import { explainRule, layer, merged } from "../src/core.js";

interface Duty {
  readonly person: string;
  readonly level: number;
}

const start = Temporal.ZonedDateTime.from("2026-03-09T09:00[Europe/London]");
const office = schedule().open(weekdays(), "09:00-17:00");
const explanationOptions: LayerOptions = {
  label: "Regular office hours",
  comment: "The office handles appointments during these hours.",
};
const labelledOffice = schedule()
  .open(weekdays(), "09:00-17:00", explanationOptions)
  .closed("2026-12-25", { label: "Christmas Day" });
const halfHour = Temporal.Duration.from({ minutes: 30 });
const end = start.add({ days: 1 });
const validationWindow: ValidationWindow = { from: start, to: end };
const validationOptions: ValidationOptions = { requireFullCoverage: true };
const accumulationUnit: ElapsedUnit = ELAPSED_UNITS[0];
const timelineFormat: TimelineFormat = TIMELINE_FORMATS[0];
const timelineOptions: TimelineOptions = { format: timelineFormat };

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
const diagnostics: readonly ValidationDiagnostic[] = validate(
  office,
  validationWindow,
  validationOptions,
);
const explanation: Explanation<boolean> = office.explain(start);
const ruleExplanation: RuleExplanation = explainRule(weekdays(), start);
const skippedLayer: SkippedLayer | undefined = explanation.skipped[0];
const explanationSummary: string = labelledOffice.explain(start).summary;
const explainedOpen: boolean = office.explain(start).value;
const explainedAssignment: string | undefined = rota()
  .assign(weekdays(), "alice")
  .explain(start).value;
const explainedCount: number = tally().plus(weekdays(), 3).explain(start).value;
const staff = tally().plus(weekdays(), 3);
const staffAtStart: number = staff.countAt(start);
const accumulated: number = accumulate(
  staff,
  { from: start, to: end },
  accumulationUnit,
);
const staffHours: number = staff.totalBetween(start, end, "hour");
const ruleTimeline: Timeline = renderTimeline(weekdays(), {
  from: start,
  to: end,
});
const optionalTimeline: Timeline | string = renderTimeline(
  weekdays(),
  { from: start, to: end },
  timelineOptions,
);
const textTimeline: string = renderTimeline(
  weekdays(),
  { from: start, to: end },
  { format: "text" },
);
const scheduleTimeline: Timeline = office.renderTimeline(start, end);
office.validate(start, end);
office.explain(start);
rota().assign(weekdays(), "alice").validate(start, end);
rota().assign(weekdays(), "alice").explain(start);
tally().plus(weekdays(), 3).validate(start, end);
tally().plus(weekdays(), 3).explain(start);
void diagnostics;
void explanation;
void ruleExplanation;
void skippedLayer;
void explanationSummary;
void explainedOpen;
void explainedAssignment;
void explainedCount;
void staffAtStart;
void accumulated;
void staffHours;
void ruleTimeline;
void optionalTimeline;
void textTimeline;
void scheduleTimeline;
rota().assign(weekdays(), { person: "alice", level: 2 });
rota<Duty>().assign(weekdays(), { person: "alice", level: 2 });
rota().assign(weekdays(), "alice", { label: "Primary support" });
tally().plus(weekdays(), 3, { comment: "The usual weekday crew." });
layer(weekdays(), "alice", { label: "Primary support" });
merged("sum", layer(weekdays(), 2), layer(weekdays(), 3));
merged(
  "concat",
  layer(weekdays(), ["alice"] as const),
  layer(weekdays(), ["bob"] as const),
);

// @ts-expect-error Calendar units are ambiguous for elapsed-time accumulation.
staff.totalBetween(start, end, "day");

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
