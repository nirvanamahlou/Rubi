import type { ProductInput } from './catalog';
import {
  moveDefinitionToDate,
  repeatDefinition,
  type RepeatCadence,
} from './preview';

export function repeatedDefinitions(
  source: ProductInput,
  startDate: string,
  cadence: RepeatCadence,
  count: number,
): ProductInput[] {
  if (!Number.isSafeInteger(count) || count < 1 || count > 24)
    throw new Error('تعداد بلیط باید بین ۱ تا ۲۴ باشد.');
  const first = moveDefinitionToDate(source, startDate);
  return Array.from({ length: count }, (_, index) =>
    index === 0 ? first : repeatDefinition(first, cadence, index),
  );
}

// Keep successful checkpoints and stable IDs when a later request fails.
export async function publishRepeatedProducts<T extends { id: string }>(
  items: readonly T[],
  completed: Set<string>,
  publish: (item: T) => Promise<void>,
  onPublished: (item: T) => void,
) {
  for (const item of items) {
    if (completed.has(item.id)) continue;
    await publish(item);
    completed.add(item.id);
    onPublished(item);
  }
}
