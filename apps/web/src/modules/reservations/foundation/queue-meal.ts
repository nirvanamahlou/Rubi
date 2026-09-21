import type { RequestView } from './model';

export function hotelMealLabel(attributes: Record<string, unknown>): string {
  for (const field of ['mealServiceCodes', 'mealServiceNames']) {
    const value = attributes[field];
    if (typeof value !== 'string') continue;
    const parts = [
      ...new Set(
        value
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean),
      ),
    ];
    if (parts.length) return parts.join(' / ');
  }
  return '';
}

export function queueMealName(
  row: RequestView,
  names: Record<string, string>,
): string | undefined {
  // A specifically contracted service must never be replaced by the hotel's other plans.
  if (row.mealServiceId)
    return names[`meal-services:${row.mealServiceId}`] || row.mealServiceName;
  return (
    row.mealServiceName || names[`hotel-meals:${row.hotelId}`] || undefined
  );
}
