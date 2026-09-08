/**
 * Comma lists and dashed ranges inside one term.
 *
 * This is the rule that makes an additive notation work at all, and cron found
 * it first. A union lives inside a term and an intersection lives between
 * them. `mon-fri,sun` is one term naming six days. Putting `mon` and `fri` in
 * two terms would ask for days that were both, and no day is.
 *
 * A range wraps, so `fri-mon` is the four days it reads as. Nobody writing a
 * weekend down should have to think about where the list starts.
 */

/**
 * The members a comma list of singles and dashed ranges names, in the order
 * the vocabulary holds them, each once.
 *
 * `read` turns one written word into a member, and `undefined` from it is what
 * says the whole term is something else.
 */
export function listed<T>(
  term: string,
  vocabulary: readonly T[],
  read: (word: string) => T | undefined,
): readonly T[] | undefined {
  const picked = new Set<T>();

  for (const part of term.split(",")) {
    const ends = part.split("-");
    if (ends.length > 2) {
      return undefined;
    }
    const [fromWord = "", toWord] = ends;
    const from = read(fromWord);
    if (from === undefined) {
      return undefined;
    }
    if (toWord === undefined) {
      picked.add(from);
      continue;
    }
    const to = read(toWord);
    if (to === undefined) {
      return undefined;
    }
    for (const member of spanning(vocabulary, from, to)) {
      picked.add(member);
    }
  }

  return vocabulary.filter((member) => picked.has(member));
}

/** The members from one to another, wrapping around the end of the list. */
function spanning<T>(vocabulary: readonly T[], from: T, to: T): readonly T[] {
  const start = vocabulary.indexOf(from);
  const end = vocabulary.indexOf(to);
  const length = vocabulary.length;
  const count = ((end - start + length) % length) + 1;
  return Array.from({ length: count }, (_, step) => {
    // Non-null because the index is taken modulo the length of the list.
    const member = vocabulary[(start + step) % length];
    return member;
  }).filter((member): member is T => member !== undefined);
}
