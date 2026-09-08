/**
 * What a term that will not read says about itself.
 *
 * Every message names the term, says where in the string it was, and gives a
 * form that would have worked. Reading a notation throws where writing one
 * returns a reason. [export-result.ts](./export-result.ts) describes that
 * split.
 */

import { nearestWord } from "./terms-words.js";

/** A term that cannot be read, with the nearest word that would have been. */
export function unreadableTerm(term: string, at: string): never {
  // `split` with a limit, so the word comes back from a join and there is no
  // index to read.
  const word = term.split(":", 1).join("");
  const nearest = nearestWord(word);
  const help =
    nearest === undefined
      ? "Expected a weekday, a month, a time range such as " +
        '"09:00-17:00", a date, or a qualifier such as "day:" or "every:".'
      : `Did you mean "${nearest}"?`;
  throw new RangeError(`${at}: cannot read "${term}". ${help}`);
}

/** A term that reads, but says something the notation cannot hold twice. */
export function repeatedTerm(
  what: string,
  first: string,
  second: string,
): never {
  throw new RangeError(
    `A rule is read in one ${what}, and this names two: ` +
      `"${first}" and "${second}".`,
  );
}

/** A term whose shape is right and whose content is not. */
export function badTerm(term: string, at: string, problem: string): never {
  throw new RangeError(`${at}: "${term}" ${problem}.`);
}
