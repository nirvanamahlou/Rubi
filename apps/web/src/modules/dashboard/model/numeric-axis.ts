/** A common zero-aware scale for signed monetary series. */
export function dashboardNumericAxis(values: readonly number[]) {
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(0, ...values);
  const span = maximum - minimum || 1;
  const position = (value: number) => ((value - minimum) / span) * 100;
  return {
    minimum,
    maximum: maximum === minimum ? minimum + 1 : maximum,
    position,
  };
}
