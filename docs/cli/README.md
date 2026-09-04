# Command-line interface

The `quando` command reads stored definitions and runs timelines,
explanations, and validation.

## Run the command

Install Quando in the current project, then run its local executable:

```bash
npm install @kensio/quando
npx quando --help
```

Every query reads one JSON file. The file contains a definition produced by
`JSON.stringify` or written in Quando's documented JSON format.

This example creates `opening-hours.json`:

```js
import { writeFile } from "node:fs/promises";
import { schedule, weekdays } from "@kensio/quando";

const openingHours = schedule({ zone: "Europe/London" })
  .open(weekdays(), "09:00-17:00", { label: "Regular hours" })
  .closed("2026-12-25", {
    label: "Christmas Day",
    comment: "The office is closed.",
  });

await writeFile(
  "opening-hours.json",
  JSON.stringify(openingHours, undefined, 2),
);
```

## Return a timeline

`timeline` returns JSON by default:

```bash
npx quando timeline opening-hours.json \
  --from '2026-03-09T00:00[Europe/London]' \
  --to '2026-03-10T00:00[Europe/London]'
```

```json
{
  "type": "timeline",
  "zone": "Europe/London",
  "from": "2026-03-09T00:00:00+00:00[Europe/London]",
  "to": "2026-03-10T00:00:00+00:00[Europe/London]",
  "days": [
    {
      "date": "2026-03-09",
      "start": "2026-03-09T00:00:00+00:00[Europe/London]",
      "end": "2026-03-10T00:00:00+00:00[Europe/London]",
      "visibleStart": "2026-03-09T00:00:00+00:00[Europe/London]",
      "visibleEnd": "2026-03-10T00:00:00+00:00[Europe/London]",
      "covered": [
        {
          "start": "2026-03-09T09:00:00+00:00[Europe/London]",
          "end": "2026-03-09T17:00:00+00:00[Europe/London]"
        }
      ]
    }
  ]
}
```

Pass `--format text` for the text view built from the same timeline data:

```bash
npx quando timeline opening-hours.json \
  --from '2026-03-09T00:00[Europe/London]' \
  --to '2026-03-10T00:00[Europe/London]' \
  --format text
```

```text
Time zone: Europe/London
                00:00       06:00       12:00       18:00       24:00
Mon 2026-03-09 |..................################..............| 09:00-17:00
# covered  + partly covered  . uncovered
```

`timeline` accepts a schedule or a rule. Rotas and tallies carry values. A
coverage timeline would need to say which value to select.

## Explain an instant

`explain` returns the complete structured explanation as JSON. Text output
returns its readable summary:

```bash
npx quando explain opening-hours.json \
  --at '2026-12-25T11:00[Europe/London]' \
  --format text
```

```text
The schedule is closed on 2026-12-25 at 11:00 in Europe/London. Regular hours. The rule uses Europe/London. Every condition matches. Friday is a weekday. 11:00 falls within the 09:00-17:00 window. This layer makes the schedule open. Christmas Day. The office is closed. The rule uses Europe/London. The date is 2026-12-25. This higher-priority layer changes the schedule from open to closed.
```

Schedules, rotas, tallies, and rules can all be explained. Labels and comments
stored with layers appear in both formats.

## Validate a finite window

`validate` returns a JSON array of diagnostics:

```bash
npx quando validate opening-hours.json \
  --from '2026-12-21T00:00[Europe/London]' \
  --to '2026-12-28T00:00[Europe/London]'
```

```json
[]
```

The command exits with status 0 when the array is empty. It prints diagnostics
and exits with status 1 when it finds a problem. Pass `--format text` to print
one readable diagnostic per line.

Schedule validation permits closed time. Rota validation reports periods when
nobody is assigned. Tally validation checks the reachability of its layers.
Rule validation reports a rule that covers no time in the requested window.

## Dates and output

`--at`, `--from`, and `--to` accept `Temporal.ZonedDateTime` strings. Include
the time zone in square brackets:

```text
2026-03-09T09:00[Europe/London]
```

JSON is written to standard output. The command writes errors to standard error
and exits with status 1. Run `npx quando <command> --help` for the options
accepted by one command.

<!-- card
```bash
quando explain opening-hours.json \
  --at '2026-12-25T11:00[Europe/London]' \
  --format text
```
-->
