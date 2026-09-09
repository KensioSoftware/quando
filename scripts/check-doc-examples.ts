import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Compiles and runs marked documentation examples against the packed package. */
function checkExamples(consumer: string): void {
  const compiler = path.resolve("node_modules/@typescript/native/bin/tsc");
  for (const file of pages("docs")) {
    const markdown = readFileSync(file, "utf8");
    const examples = markdown.matchAll(
      /<!-- example: ([\w-]+) -->\s*```ts\n([\s\S]*?)\n```/gu,
    );
    for (const match of examples) {
      const [, name, source] = match;
      if (name === undefined || source === undefined) {
        continue;
      }
      const target = path.join(consumer, `${name}.mts`);
      writeFileSync(target, source);
      execFileSync(
        process.execPath,
        [
          compiler,
          "--ignoreConfig",
          "--strict",
          "--exactOptionalPropertyTypes",
          "--module",
          "NodeNext",
          "--target",
          "ES2023",
          "--lib",
          "ESNext,DOM",
          "--skipLibCheck",
          target,
        ],
        { stdio: "inherit" },
      );
      const actual = execFileSync(
        process.execPath,
        [target.replace(/\.mts$/u, ".mjs")],
        { encoding: "utf8" },
      ).trim();
      const expected = [...source.matchAll(/^\/\/ (.+)$/gmu)]
        .map((line) => line[1])
        .join("\n");
      if (actual !== expected) {
        throw new Error(
          `${file} (${name}): expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
        );
      }
      process.stdout.write(`Checked ${file} (${name})\n`);
    }
  }
}

function pages(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? pages(file)
      : entry.name === "README.md"
        ? [file]
        : [];
  });
}

const consumer = process.argv[2];
if (consumer === undefined) {
  throw new Error("Pass the packed-package consumer directory.");
}
checkExamples(path.resolve(consumer));
