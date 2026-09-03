/** User-facing context attached to a cascade layer. */
export interface LayerOptions {
  /** A short name for the layer, such as "Christmas Day". */
  readonly label?: string;
  /** Extra context that can be shown as part of an explanation. */
  readonly comment?: string;
}

/** Checks and copies the optional context stored on a layer. */
export function checkedLayerOptions(
  options: unknown,
  path = "options",
): LayerOptions {
  if (options === undefined) {
    return {};
  }
  if (
    typeof options !== "object" ||
    options === null ||
    Array.isArray(options)
  ) {
    throw new TypeError(`${path}: expected an options object.`);
  }

  const candidate = options as Record<string, unknown>;

  const unknown = Object.keys(candidate).find(
    (field) => !["label", "comment"].includes(field),
  );
  if (unknown !== undefined) {
    throw new TypeError(`${path}.${unknown}: unknown layer option.`);
  }

  return {
    ...optionalText(candidate["label"], `${path}.label`),
    ...optionalText(candidate["comment"], `${path}.comment`, "comment"),
  };
}

/** Reads the explanation fields from a layer-shaped object. */
export function layerOptionsOf(
  source: { readonly label?: unknown; readonly comment?: unknown },
  path = "layer",
): LayerOptions {
  return checkedLayerOptions(
    {
      ...(source.label === undefined ? {} : { label: source.label as string }),
      ...(source.comment === undefined
        ? {}
        : { comment: source.comment as string }),
    },
    path,
  );
}

function optionalText(
  value: unknown,
  path: string,
  field = "label",
): LayerOptions {
  if (value === undefined) {
    return {};
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${path}: expected a non-empty string.`);
  }
  return { [field]: value };
}
