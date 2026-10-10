/**
 * Chooses X-axis labels for dense trend charts without allowing the final,
 * mandatory label to collide with the last periodic label.
 */
export function trendAxisLabelIndexes(labelCount: number): number[] {
  if (labelCount <= 0) return [];

  const visibleLabelStep = labelCount > 12 ? Math.ceil(labelCount / 8) : 1;
  const periodicIndexes = Array.from(
    { length: labelCount },
    (_, index) => index,
  ).filter((index) => index % visibleLabelStep === 0);
  const lastIndex = labelCount - 1;
  const lastPeriodicIndex = periodicIndexes.at(-1);
  const minimumSafeDistance = Math.max(
    2,
    Math.ceil(visibleLabelStep / 2),
  );

  if (lastPeriodicIndex === lastIndex) return periodicIndexes;

  if (
    lastPeriodicIndex !== undefined &&
    lastIndex - lastPeriodicIndex < minimumSafeDistance
  ) {
    return [...periodicIndexes.slice(0, -1), lastIndex];
  }

  return [...periodicIndexes, lastIndex];
}
