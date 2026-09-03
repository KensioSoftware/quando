/** Adds immutable façade methods without putting functions in the document. */
export function withMethods<D extends object, M extends object>(
  data: D,
  methods: M,
): D & M {
  const target = { ...data } as D & M;
  for (const [name, method] of Object.entries(methods)) {
    Object.defineProperty(target, name, {
      configurable: false,
      enumerable: false,
      value: method,
      writable: false,
    });
  }
  return target;
}
