/** Sunday-first, matching Gregorian UTC weekday numbers. Dates are Tehran calendar dates. */
export const HR_WEEKDAYS = [
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
  'شنبه',
] as const;

export function hrShiftMatchesDate(
  values: readonly string[],
  date: string,
): boolean {
  return Boolean(
    values[7] &&
    values[8] &&
    values[7] <= date &&
    values[8] >= date &&
    (!values[9] ||
      values[9] === HR_WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]),
  );
}
