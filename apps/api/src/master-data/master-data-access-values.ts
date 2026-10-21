/** Generic Master Data form values use strings, including empty nullable values. */
export function masterDataAccessValues(
  values: Readonly<Record<string, unknown>>,
) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      value === null || value === undefined
        ? ''
        : typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean' ||
            Array.isArray(value)
          ? String(value)
          : value,
    ]),
  );
}
