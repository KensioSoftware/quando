import type { LayerOptions } from "./layer-options.js";

/** Writes caller-supplied context as sentences. */
export function annotationDescription(options: LayerOptions): string {
  return [options.label, options.comment]
    .filter((text): text is string => text !== undefined)
    .map((text) => sentence(text))
    .join(" ");
}

function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/u.test(trimmed) ? trimmed : `${trimmed}.`;
}
