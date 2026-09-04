#!/usr/bin/env bash
#
# What `pnpm publish` would actually upload, checked before it can be uploaded.
#
# `files` in package.json and the `exports` map are two lists that have to agree
# and nothing else makes them: a path can be exported and not packed, and the
# failure shows up as a bare "Cannot find module" for whoever installs it. That
# is the wrong place to find out, so it is found out here instead.
#
# Run by `pnpm check` and by the build job in both workflows.

set -euo pipefail

cd "$(dirname "$0")/../.."

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Builds the tarball for real — prepack runs, so this is the same dist/ a
# publish would ship — and leaves it somewhere the repository will not notice.
tarball="$(pnpm pack --pack-destination "$tmp" | tail -n 1)"

contents="$(tar --list --file "$tarball")"

# npm rewrites every path in a tarball under `package/`.
expected=(
  package/package.json
  package/README.md
  package/LICENSE
  package/dist/cli.js
  package/dist/index.js
  package/dist/index.d.ts
  package/dist/core.js
  package/dist/core.d.ts
  package/dist/parsing.js
  package/dist/parsing.d.ts
)

missing=()
for path in "${expected[@]}"; do
  grep --quiet --line-regexp --fixed-strings "$path" <<<"$contents" ||
    missing+=("$path")
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing from the tarball:" >&2
  printf '  %s\n' "${missing[@]}" >&2
  echo >&2
  echo "What is in it:" >&2
  sed 's/^/  /' <<<"$contents" >&2
  exit 1
fi

# Nothing here is meant to ship test files or source maps of sources that are
# not in the tarball. Catching that is cheaper than a bug report about package
# size.
if grep --quiet --extended-regexp 'package/dist/.*\.(test|spec)\.' <<<"$contents"; then
  echo "Test files reached the tarball:" >&2
  grep --extended-regexp 'package/dist/.*\.(test|spec)\.' <<<"$contents" >&2
  exit 1
fi

# Install the tarball into an empty project. This catches export paths that
# exist in the repository but fail through Node's package resolver.
consumer="$tmp/consumer"
mkdir "$consumer"
npm install \
  --prefix "$consumer" \
  --ignore-scripts \
  --no-package-lock \
  "$tarball" >/dev/null

# Resolve declarations from the installed tarball rather than from src/. This
# catches exports whose JavaScript works while their public types do not.
cp test/package-consumer.ts.txt "$consumer/consumer.ts"
node_modules/.bin/tsc \
  --ignoreConfig \
  --noEmit \
  --strict \
  --exactOptionalPropertyTypes \
  --module NodeNext \
  --moduleResolution NodeNext \
  --target ES2023 \
  --lib ESNext \
  --skipLibCheck \
  "$consumer/consumer.ts"

(
  cd "$consumer"
  node --input-type=module --eval '
    const root = await import("@kensio/quando");
    const core = await import("@kensio/quando/core");
    const parsing = await import("@kensio/quando/parsing");
    if (typeof root.schedule !== "function") throw new Error("root export failed");
    if (typeof core.resolve !== "function") throw new Error("core export failed");
    if (typeof parsing.parseSchedule !== "function") throw new Error("parsing export failed");

    const monday = Temporal.ZonedDateTime.from("2026-03-16T10:00[Europe/London]");
    const office = root.schedule({ zone: "Europe/London" }).open(
      root.weekdays(),
      "09:00-17:00",
    );
    if (!office.isOpen(monday)) throw new Error("schedule example failed");

    const restored = root.parseSchedule(JSON.parse(JSON.stringify(office)));
    if (!restored.isOpen(monday)) throw new Error("schedule round trip failed");
  '
)

# The executable is a separate Node entry point. Running the installed bin also
# checks the npm link that consumers receive.
cli="$consumer/node_modules/.bin/quando"
"$cli" --help | grep --quiet --fixed-strings 'quando timeline <file>'
"$cli" --version | grep --quiet --extended-regexp '^[0-9]+\.[0-9]+\.[0-9]+$'

error_file="$consumer/error.txt"
if "$cli" unknown-command 2>"$error_file"; then
  echo "Unknown CLI command succeeded." >&2
  exit 1
fi
grep --quiet --fixed-strings 'quando: Unknown command "unknown-command"' \
  "$error_file"

schedule_file="$consumer/opening-hours.json"
(
  cd "$consumer"
  node --input-type=module --eval '
    import { writeFile } from "node:fs/promises";
    import { schedule, weekdays } from "@kensio/quando";

    const path = process.argv[1];
    const openingHours = schedule({ zone: "Europe/London" }).open(
      weekdays(),
      "09:00-17:00",
    );
    await writeFile(path, JSON.stringify(openingHours));
  ' "$schedule_file"
)
"$cli" timeline "$schedule_file" \
  --from '2026-03-09T00:00[Europe/London]' \
  --to '2026-03-10T00:00[Europe/London]' |
  grep --quiet --fixed-strings '"type": "timeline"'

# Published maps carry their source text. Debuggers do not need files outside
# the tarball to display a source location.
tar --extract --to-stdout --file "$tarball" package/dist/index.js.map |
  grep --quiet --fixed-strings '"sourcesContent":[' || {
    echo "dist/index.js.map has no embedded source." >&2
    exit 1
  }

echo "Tarball looks right:"
sed 's/^/  /' <<<"$contents" | sort
