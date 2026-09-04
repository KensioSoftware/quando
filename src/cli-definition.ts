/** Stored Quando documents accepted by the command-line interface. */

import { readFile } from "node:fs/promises";

import type { Built } from "./build.js";
import { assertJsonValue, type JsonValue } from "./json.js";
import { parseRule } from "./parse.js";
import { parseRota, type Rota } from "./rota.js";
import type { Rule } from "./rule.js";
import { parseSchedule, type Schedule } from "./schedule.js";
import { parseTally, type Tally } from "./tally.js";

export type CliDefinition = Built<Rule> | Schedule | Rota<JsonValue> | Tally;

const RULE_TYPES = new Set([
  "always",
  "never",
  "daysOfWeek",
  "timeOfDay",
  "dates",
  "inZone",
  "all",
  "any",
  "not",
]);

/** Whether a parsed CLI definition is a rule. */
export function isRuleDefinition(
  definition: CliDefinition,
): definition is Built<Rule> {
  return RULE_TYPES.has(definition.type);
}

/** Reads and validates one stored Quando document. */
export async function readDefinition(path: string): Promise<CliDefinition> {
  const text = await readText(path);
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    throw new TypeError(
      `Could not parse "${path}" as JSON: ${messageOf(error)}`,
      { cause: error },
    );
  }
  return parseDefinition(value);
}

/** Reads the installed package version beside the compiled CLI. */
export async function readVersion(): Promise<string> {
  const packageUrl = new URL("../package.json", import.meta.url);
  const text = await readFile(packageUrl, "utf8");
  const value = JSON.parse(text) as { readonly version?: unknown };
  if (typeof value.version !== "string") {
    throw new TypeError("package.json has no string version.");
  }
  return value.version;
}

async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    throw new TypeError(`Could not read "${path}": ${messageOf(error)}`, {
      cause: error,
    });
  }
}

function parseDefinition(value: unknown): CliDefinition {
  const type = typeOf(value);
  switch (type) {
    case "schedule": {
      return parseSchedule(value);
    }
    case "rota": {
      return parseRota(value, (item, path) => {
        assertJsonValue(item, path);
        return item;
      });
    }
    case "tally": {
      return parseTally(value);
    }
    default: {
      if (typeof type === "string" && RULE_TYPES.has(type)) {
        return parseRule(value);
      }
      throw new TypeError(
        `definition.type: expected schedule, rota, tally, or a rule type, found ${JSON.stringify(type)}.`,
      );
    }
  }
}

function typeOf(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("definition: expected a Quando document object.");
  }
  return (value as Record<string, unknown>)["type"];
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
