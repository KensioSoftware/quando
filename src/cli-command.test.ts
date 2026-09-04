import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { faker } from "@faker-js/faker";
import {
  assertArrayLength,
  assertIdentical,
  assertStringIncludes,
  assertStringMatches,
  assertThrowsErrorAsync,
  assertTrue,
} from "@kensio/smartass";
import { describe, it } from "vitest";

import { weekdays } from "./build.js";
import { runCli } from "./cli-command.js";
import { rota } from "./rota.js";
import { schedule } from "./schedule.js";
import { tally } from "./tally.js";

describe("the Quando command-line interface", () => {
  const stored = async (value: unknown): Promise<string> => {
    const directory = await mkdtemp(path.join(tmpdir(), "quando-cli-"));
    const file = path.join(directory, `${faker.string.uuid()}.json`);
    await writeFile(file, JSON.stringify(value));
    return file;
  };

  const storedText = async (value: string): Promise<string> => {
    const directory = await mkdtemp(path.join(tmpdir(), "quando-cli-"));
    const file = path.join(directory, `${faker.string.uuid()}.json`);
    await writeFile(file, value);
    return file;
  };

  const rejected = async (arguments_: readonly string[]): Promise<string> => {
    const error = await assertThrowsErrorAsync(() => runCli(arguments_));
    return error.message;
  };

  const FROM = "2026-03-09T00:00[Europe/London]";
  const TO = "2026-03-10T00:00[Europe/London]";
  const MONDAY = "2026-03-09T11:00[Europe/London]";

  it("shows the available commands", async () => {
    // Given each documented way to ask for general help.
    // When help is requested.
    const results = await Promise.all([
      runCli(["--help"]),
      runCli(["-h"]),
      runCli(["help"]),
    ]);

    // Then every form lists the three commands and succeeds.
    for (const result of results) {
      assertIdentical(result.exitCode, 0);
      assertStringIncludes(result.output, "quando timeline");
      assertStringIncludes(result.output, "quando explain");
      assertStringIncludes(result.output, "quando validate");
    }
  });

  it("shows command-specific help without requiring other arguments", async () => {
    // Given each command with its short or long help option.
    // When its help is requested.
    const [timeline, explanation, validation] = await Promise.all([
      runCli(["timeline", "--help"]),
      runCli(["explain", "-h"]),
      runCli(["validate", "--help"]),
    ]);

    // Then each command describes its own inputs.
    assertStringIncludes(timeline.output, "quando timeline <file>");
    assertStringIncludes(explanation.output, "quando explain <file>");
    assertStringIncludes(validation.output, "quando validate <file>");
  });

  it("reports the installed package version", async () => {
    // Given the version command.
    // When the CLI reads the package beside it.
    const result = await runCli(["--version"]);

    // Then it returns a semantic version.
    assertIdentical(result.exitCode, 0);
    assertStringMatches(result.output, /^\d+\.\d+\.\d+$/u);
  });

  it("returns a schedule timeline as JSON by default", async () => {
    // Given stored weekday opening hours.
    const file = await stored(
      schedule({ zone: "Europe/London" }).open(weekdays(), "09:00-17:00"),
    );

    // When one day is rendered without naming a format.
    const result = await runCli(["timeline", file, "--from", FROM, "--to", TO]);

    // Then the output is the structured timeline data.
    const timeline = JSON.parse(result.output) as {
      readonly type: string;
      readonly zone: string;
      readonly days: readonly { readonly covered: readonly unknown[] }[];
    };
    assertIdentical(result.exitCode, 0);
    assertIdentical(timeline.type, "timeline");
    assertIdentical(timeline.zone, "Europe/London");
    assertArrayLength(timeline.days, 1);
    assertArrayLength(timeline.days[0].covered, 1);
  });

  it("renders a rule timeline as text when requested", async () => {
    // Given a stored weekday rule.
    const file = await stored(weekdays());

    // When its timeline is requested as text.
    const result = await runCli([
      "timeline",
      file,
      "--from",
      FROM,
      "--to",
      TO,
      "--format",
      "text",
    ]);

    // Then the terminal output shows that Monday is covered.
    assertIdentical(result.exitCode, 0);
    assertStringIncludes(result.output, "Mon 2026-03-09");
    assertStringIncludes(result.output, "################");
  });

  it("keeps value timelines out of an ambiguous command", async () => {
    // Given a rota whose timeline would need a selected assignee.
    const file = await stored(rota().assign(weekdays(), "alice"));

    // When it is passed to the coverage timeline command.
    const message = await rejected([
      "timeline",
      file,
      "--from",
      FROM,
      "--to",
      TO,
    ]);

    // Then the CLI refuses to guess a value and asks for a schedule or rule.
    assertStringIncludes(message, "expected a schedule or rule document");
    assertStringIncludes(message, 'found "rota"');
  });

  it("returns a schedule explanation as JSON by default", async () => {
    // Given stored opening hours with application context.
    const file = await stored(
      schedule({ zone: "Europe/London" }).open(weekdays(), "09:00-17:00", {
        label: "Customer support",
      }),
    );

    // When a covered instant is explained.
    const result = await runCli(["explain", file, "--at", MONDAY]);

    // Then the structured explanation includes its value and label.
    const explanation = JSON.parse(result.output) as {
      readonly value: boolean;
      readonly steps: readonly { readonly label?: string }[];
    };
    assertIdentical(result.exitCode, 0);
    assertTrue(explanation.value);
    assertIdentical(explanation.steps[0]?.label, "Customer support");
  });

  it("returns a rule explanation as text", async () => {
    // Given a stored weekday rule.
    const file = await stored(weekdays());

    // When Monday is explained in text.
    const result = await runCli([
      "explain",
      file,
      "--at",
      MONDAY,
      "--format",
      "text",
    ]);

    // Then the rule describes the calendar match directly.
    assertIdentical(result.exitCode, 0);
    assertIdentical(result.output, "Monday is a weekday.");
  });

  it("preserves JSON rota values in explanations", async () => {
    // Given a stored rota assigning an application object.
    const person = { name: faker.person.firstName(), level: 2 };
    const file = await stored(rota().assign(weekdays(), person));

    // When a weekday assignment is explained.
    const result = await runCli(["explain", file, "--at", MONDAY]);

    // Then the assigned object survives the CLI parser.
    const explanation = JSON.parse(result.output) as {
      readonly value: { readonly name: string; readonly level: number };
    };
    assertIdentical(explanation.value.name, person.name);
    assertIdentical(explanation.value.level, person.level);
  });

  it("parses tallies for explanation commands", async () => {
    // Given a stored tally with weekday staffing.
    const file = await stored(tally().plus(weekdays(), 3));

    // When the count is explained as text.
    const result = await runCli([
      "explain",
      file,
      "--at",
      MONDAY,
      "--format",
      "text",
    ]);

    // Then the explanation uses tally vocabulary.
    assertStringIncludes(result.output, "The total is 3");
  });

  it("returns validation diagnostics as JSON and a failing status", async () => {
    // Given a rule that cannot match during the requested week.
    const file = await stored(
      weekdays().and({
        type: "daysOfWeek",
        days: ["saturday", "sunday"],
      }),
    );

    // When the rule is validated.
    const result = await runCli(["validate", file, "--from", FROM, "--to", TO]);

    // Then the diagnostic is machine-readable and the status marks failure.
    const diagnostics = JSON.parse(result.output) as readonly {
      readonly code: string;
    }[];
    assertIdentical(result.exitCode, 1);
    assertArrayLength(diagnostics, 1);
    assertIdentical(diagnostics[0].code, "inactive-rule");
  });

  it("describes uncovered rota time with exact endpoints", async () => {
    // Given a weekday-only rota and a window that includes the weekend.
    const file = await stored(rota().assign(weekdays(), "alice"));

    // When it is validated as text.
    const result = await runCli([
      "validate",
      file,
      "--from",
      "2026-03-09T00:00[Europe/London]",
      "--to",
      "2026-03-16T00:00[Europe/London]",
      "--format",
      "text",
    ]);

    // Then the gap and its bounds are readable in the terminal.
    assertIdentical(result.exitCode, 1);
    assertStringIncludes(result.output, "uncovered-time");
    assertStringIncludes(result.output, "2026-03-14T00:00:00");
    assertStringIncludes(result.output, "2026-03-16T00:00:00");
  });

  it("accepts a valid tally", async () => {
    // Given a tally with one active layer.
    const file = await stored(tally().plus(weekdays(), 3));

    // When it is validated as text over a weekday.
    const result = await runCli([
      "validate",
      file,
      "--from",
      FROM,
      "--to",
      TO,
      "--format",
      "text",
    ]);

    // Then the command succeeds with a short human result.
    assertIdentical(result.exitCode, 0);
    assertIdentical(result.output, "No problems found.");
  });

  it("describes non-interval validation diagnostics as text", async () => {
    // Given a rule that covers no time in the window.
    const file = await stored({ type: "never" });

    // When it is validated as text.
    const result = await runCli([
      "validate",
      file,
      "--from",
      FROM,
      "--to",
      TO,
      "--format",
      "text",
    ]);

    // Then the diagnostic names its code and message.
    assertStringIncludes(result.output, "inactive-rule:");
    assertStringIncludes(result.output, "covers no time");
  });

  it("reports command and option mistakes directly", async () => {
    // Given missing, unknown, incomplete, and ambiguous command arguments.
    // When each invocation is rejected.
    const messages = await Promise.all([
      rejected([]),
      rejected([faker.word.noun()]),
      rejected(["timeline"]),
      rejected([
        "timeline",
        "one.json",
        "two.json",
        "--from",
        FROM,
        "--to",
        TO,
      ]),
      rejected(["timeline", "one.json", "--to", TO]),
      rejected(["timeline", "one.json", "--from", FROM]),
      rejected(["explain", "one.json"]),
      rejected(["explain", "one.json", "--at", "next Monday"]),
      rejected([
        "validate",
        "one.json",
        "--from",
        FROM,
        "--to",
        TO,
        "--format",
        "yaml",
      ]),
    ]);

    // Then every error names the missing or invalid input.
    assertStringIncludes(messages[0], "A command is required");
    assertStringIncludes(messages[1], "Unknown command");
    assertStringIncludes(messages[2], "requires the path to a JSON file");
    assertStringIncludes(messages[3], "accepts one JSON file");
    assertStringIncludes(messages[4], "requires --from");
    assertStringIncludes(messages[5], "requires --to");
    assertStringIncludes(messages[6], "requires --at");
    assertStringIncludes(messages[7], "zoned date-time");
    assertStringIncludes(messages[8], "json or text");
  });

  it("reports file and document errors at the boundary", async () => {
    // Given a missing file, malformed JSON, a scalar, and an unknown document.
    const missing = path.join(tmpdir(), `${faker.string.uuid()}.json`);
    const malformed = await storedText("{ definitely not JSON }");
    const scalar = await storedText("42");
    const unknown = await stored({ type: faker.word.noun() });

    // When each file is read for an explanation.
    const messages = await Promise.all(
      [missing, malformed, scalar, unknown].map((file) =>
        rejected(["explain", file, "--at", MONDAY]),
      ),
    );

    // Then each failure says what could not be read or parsed.
    assertStringIncludes(messages[0] ?? "", "Could not read");
    assertStringIncludes(messages[1] ?? "", "Could not parse");
    assertStringIncludes(
      messages[2] ?? "",
      "expected a Quando document object",
    );
    assertStringIncludes(messages[3] ?? "", "expected schedule, rota, tally");
  });
});
