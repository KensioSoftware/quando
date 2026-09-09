import { ParseError } from "./parse-shape.js";

/** Gives validation failures from shared builders the parser's error shape. */
export function parsed<T>(path: string, read: () => T): T {
  try {
    return read();
  } catch (error) {
    if (
      error instanceof ParseError ||
      !(error instanceof TypeError || error instanceof RangeError)
    ) {
      throw error;
    }
    const separator = error.message.indexOf(": ");
    const location = error.message.slice(0, separator);
    if (separator !== -1 && location.startsWith(path)) {
      throw new ParseError(
        location,
        "invalid-value",
        error.message.slice(separator + 2),
      );
    }
    throw new ParseError(path, "invalid-value", error.message);
  }
}
