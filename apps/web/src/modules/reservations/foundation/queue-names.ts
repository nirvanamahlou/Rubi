'use client';
import { useEffect, useState } from 'react';
import { masterDataApi } from '@/modules/master-data/api/client';
import type { RequestView } from './model';
export function useQueueNames(rows: readonly RequestView[]) {
  const key = JSON.stringify(
    [
      ...new Set(
        rows
          .flatMap((row) => [
            row.hotelId ? `hotels:${row.hotelId}` : '',
            row.destinationId ? `cities:${row.destinationId}` : '',
            row.mealServiceId ? `meal-services:${row.mealServiceId}` : '',
          ])
          .filter(Boolean),
      ),
    ].sort(),
  );
  const [loaded, setLoaded] = useState<{
    key: string;
    names: Record<string, string>;
  }>();
  useEffect(() => {
    let active = true;
    const entries = JSON.parse(key) as string[];
    const names: Record<string, string> = {};
    let next = 0;
    async function worker() {
      while (active && next < entries.length) {
        const item = entries[next++]!;
        const [resource, id] = item.split(':');
        try {
          const { data } = await masterDataApi.detail(
            resource as 'hotels' | 'cities' | 'meal-services',
            id!,
          );
          const english = data.attributes.englishName;
          names[item] =
            typeof english === 'string' && english.trim()
              ? english.trim()
              : data.name;
        } catch {
          /* Snapshot fallback; an unavailable name must not conceal a request. */
        }
      }
    }
    void Promise.all(
      Array.from({ length: Math.min(6, entries.length) }, worker),
    ).then(() => {
      if (active) setLoaded({ key, names });
    });
    return () => {
      active = false;
    };
  }, [key]);
  const names = loaded?.key === key ? loaded.names : {};
  return {
    ready: key === '[]' || loaded?.key === key,
    rows: rows.map((row) => ({
      ...row,
      ...(names[`meal-services:${row.mealServiceId}`]
        ? { mealServiceName: names[`meal-services:${row.mealServiceId}`]! }
        : {}),
      ...(names[`hotels:${row.hotelId}`]
        ? { hotelName: names[`hotels:${row.hotelId}`]! }
        : {}),
      ...(names[`cities:${row.destinationId}`]
        ? { destination: names[`cities:${row.destinationId}`]! }
        : {}),
    })),
  };
}
