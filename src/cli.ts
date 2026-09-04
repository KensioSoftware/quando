#!/usr/bin/env node

import { runCli } from "./cli-command.js";

try {
  const result = await runCli(process.argv.slice(2));
  process.stdout.write(`${result.output}\n`);
  process.exitCode = result.exitCode;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`quando: ${message}\n`);
  process.exitCode = 1;
}
