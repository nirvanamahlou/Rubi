import { describe, expect, it } from 'vitest';
import { parseWeightedGoals, weightedProgress } from './weighted-goals';
describe('weighted employee goals', () => {
  it('uses the achieved share of total weight, including non-normalized weights', () => {
    expect(
      weightedProgress([
        { title: 'A', weight: 30, achieved: true },
        { title: 'B', weight: 70, achieved: false },
      ]),
    ).toBe(30);
    expect(
      weightedProgress([
        { title: 'A', weight: 1, achieved: true },
        { title: 'B', weight: 3, achieved: false },
      ]),
    ).toBe(25);
    expect(weightedProgress([])).toBe(0);
  });
  it('retains legacy goals and saved checklist completion', () => {
    expect(parseWeightedGoals('فروش بیشتر')[0]?.title).toBe('فروش بیشتر');
    const goals = [{ title: 'A', weight: 30, achieved: true }];
    expect(parseWeightedGoals(JSON.stringify(goals))).toEqual(goals);
  });
});
