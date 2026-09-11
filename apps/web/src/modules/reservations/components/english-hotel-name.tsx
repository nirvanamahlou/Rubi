'use client';
import { useEffect, useState } from 'react';
import { masterDataApi } from '@/modules/master-data/api/client';

/** Display registered English names; never rewrite the contract snapshot. */
export function EnglishHotelName({
  hotelId,
  fallback,
}: {
  hotelId?: string | undefined;
  fallback: string;
}) {
  const [loaded, setLoaded] = useState<{ id: string; name: string }>();
  useEffect(() => {
    if (!hotelId) return;
    let active = true;
    void masterDataApi
      .detail('hotels', hotelId)
      .then(({ data }) => {
        const name = data.attributes.englishName;
        if (active && typeof name === 'string' && name.trim())
          setLoaded({ id: hotelId, name: name.trim() });
      })
      .catch(() => {
        /* Keep the recorded name if reference access fails. */
      });
    return () => {
      active = false;
    };
  }, [hotelId]);
  return (
    <bdi>{loaded?.id === hotelId ? loaded?.name || fallback : fallback}</bdi>
  );
}
