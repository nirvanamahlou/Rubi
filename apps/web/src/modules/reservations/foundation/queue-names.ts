'use client';
import { useEffect, useState } from 'react';
import { masterDataApi } from '@/modules/master-data/api/client';
import type { RequestView } from './model';
import { hotelMealLabel, queueMealName } from './queue-meal';
import { queueHotelName, queueHotels } from './queue-hotels';
export function useQueueNames(
  rows: readonly RequestView[],
  refreshRevision = 0,
) {
  const key = JSON.stringify(
    [
      ...new Set(
        rows
          .flatMap((row) => [
            ...queueHotels(row).map((hotel) =>
              hotel.hotelId ? `hotels:${hotel.hotelId}` : '',
            ),
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
    revision: number;
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
            'reservations',
          );
          const english = data.attributes.englishName;
          if (resource === 'hotels') {
            names[`hotel-meals:${id}`] = hotelMealLabel(data.attributes);
            const stars = data.attributes.starRating ?? data.attributes.stars;
            if (typeof stars === 'number' || typeof stars === 'string')
              names[`hotel-stars:${id}`] = String(stars);
          }
          names[item] =
            typeof english === 'string' && english.trim()
              ? english.trim()
              : resource === 'meal-services'
                ? data.code || data.name
                : data.name;
        } catch {
          /* Snapshot fallback; an unavailable name must not conceal a request. */
        }
      }
    }
    void Promise.all(
      Array.from({ length: Math.min(6, entries.length) }, worker),
    ).then(() => {
      if (active) setLoaded({ key, names, revision: refreshRevision });
    });
    return () => {
      active = false;
    };
  }, [key, refreshRevision]);
  const names = loaded?.key === key ? loaded.names : {};
  return {
    ready:
      key === '[]' ||
      (loaded?.key === key && loaded.revision === refreshRevision),
    rows: rows.map((row) => ({
      ...row,
      mealServiceName: queueMealName(row, names),
      hotelStars: row.hotelStars || names[`hotel-stars:${row.hotelId}`],
      hotelName: queueHotelName(row, names),
      ...(names[`cities:${row.destinationId}`]
        ? { destination: names[`cities:${row.destinationId}`]! }
        : {}),
    })),
  };
}
