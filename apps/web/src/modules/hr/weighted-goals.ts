export interface WeightedGoal {
  title: string;
  weight: number;
  achieved: boolean;
}
export function parseWeightedGoals(value: string): WeightedGoal[] {
  try {
    const items: unknown = JSON.parse(value);
    if (
      Array.isArray(items) &&
      items.every(
        (item) =>
          typeof item?.title === 'string' &&
          typeof item?.weight === 'number' &&
          typeof item?.achieved === 'boolean',
      )
    )
      return items as WeightedGoal[];
  } catch {
    /* Existing single goals remain editable. */
  }
  return [{ title: value, weight: 100, achieved: false }];
}
export function weightedProgress(goals: readonly WeightedGoal[]): number {
  const total = goals.reduce((sum, goal) => sum + goal.weight, 0);
  return total > 0
    ? Math.round(
        (goals.reduce(
          (sum, goal) => sum + (goal.achieved ? goal.weight : 0),
          0,
        ) /
          total) *
          10000,
      ) / 100
    : 0;
}
