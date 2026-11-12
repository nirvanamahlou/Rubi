'use client';
import { useState } from 'react';
import type { MasterDataRecord, TourPackageInputV1 } from '@nora/contracts';
import { Button, Input } from '@/components/ui';
import { SearchableReference } from '@/modules/sales/components/searchable-reference';

export function TourDestinations({
  value,
  countries,
  cities,
  onChange,
}: {
  value: TourPackageInputV1;
  countries: readonly MasterDataRecord[];
  cities: readonly MasterDataRecord[];
  onChange: (value: TourPackageInputV1) => void;
}) {
  const [selectedCountries, setSelectedCountries] = useState<
    Record<number, string>
  >({});
  const cityCountry = (cityId: string) =>
    String(
      cities.find((city) => city.id === cityId)?.attributes.countryId ?? '',
    );
  const countryAt = (index: number, cityId: string) =>
    selectedCountries[index] ?? cityCountry(cityId);
  if (!value.details?.isCombined) return null;
  const stays = value.details.destinations ?? [
    { cityId: value.destinationId, nights: 1 },
    { cityId: '', nights: 1 },
  ];
  const save = (next: typeof stays) =>
    onChange({
      ...value,
      destinationId: next[0]?.cityId ?? '',
      hotelIds: [],
      details: { ...value.details, version: 1, destinations: next },
    });
  return (
    <section
      className="col-span-full grid gap-3 rounded-xl border bg-secondary/30 p-4"
      aria-label="مقصدهای تور ترکیبی"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold">مقصدها و اقامت‌ها</h3>
        <Button
          type="button"
          variant="outline"
          disabled={stays.length >= 10}
          onClick={() => save([...stays, { cityId: '', nights: 1 }])}
        >
          افزودن مقصد
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        اقامت‌ها از شروع تور، به ترتیب و پشت‌سرهم هستند. نرخ هر مقصد برای شب‌های
        همان اقامت خوانده می‌شود.
      </p>
      <div className="grid items-end gap-3 rounded-xl border bg-surface p-3 md:grid-cols-[auto_1fr_1fr]">
        <strong>مبدأ</strong>
        <SearchableReference
          label="کشور مبدأ"
          value={countryAt(-1, value.originId)}
          options={countries}
          onChange={(countryId) => {
            setSelectedCountries((current) => ({
              ...current,
              [-1]: countryId,
            }));
            onChange({ ...value, originId: '' });
          }}
        />
        <SearchableReference
          label="شهر مبدأ"
          value={value.originId}
          options={cities.filter(
            (city) =>
              cityCountry(city.id) === countryAt(-1, value.originId) &&
              Boolean(countryAt(-1, value.originId)),
          )}
          onChange={(originId) => onChange({ ...value, originId })}
        />
      </div>
      {stays.map((stay, index) => (
        <div
          key={index}
          className="grid items-end gap-3 rounded-xl border bg-surface p-3 md:grid-cols-[auto_1fr_1fr_120px_auto]"
        >
          <strong>مقصد {index + 1}</strong>
          <SearchableReference
            label={`کشور مقصد ${index + 1}`}
            value={countryAt(index, stay.cityId)}
            options={countries}
            onChange={(countryId) => {
              setSelectedCountries((current) => ({
                ...current,
                [index]: countryId,
              }));
              save(
                stays.map((s, i) => (i === index ? { ...s, cityId: '' } : s)),
              );
            }}
          />
          <SearchableReference
            label={`شهر مقصد ${index + 1}`}
            value={stay.cityId}
            options={cities.filter(
              (c) =>
                Boolean(countryAt(index, stay.cityId)) &&
                cityCountry(c.id) === countryAt(index, stay.cityId) &&
                !stays.some((s, i) => i !== index && s.cityId === c.id),
            )}
            onChange={(cityId) =>
              save(stays.map((s, i) => (i === index ? { ...s, cityId } : s)))
            }
          />
          <label className="grid gap-1 text-sm">
            تعداد شب
            <Input
              type="number"
              min={1}
              max={365}
              value={stay.nights || ''}
              onChange={(e) =>
                save(
                  stays.map((s, i) =>
                    i === index ? { ...s, nights: Number(e.target.value) } : s,
                  ),
                )
              }
            />
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={stays.length <= 2}
            onClick={() => {
              setSelectedCountries((current) =>
                Object.fromEntries(
                  Object.entries(current)
                    .filter(([key]) => Number(key) !== index)
                    .map(([key, country]) => [
                      Number(key) > index ? Number(key) - 1 : Number(key),
                      country,
                    ]),
                ),
              );
              save(stays.filter((_, i) => i !== index));
            }}
          >
            حذف مقصد
          </Button>
        </div>
      ))}
      <strong className="text-sm">
        جمع اقامت: {stays.reduce((n, s) => n + s.nights, 0)} شب
      </strong>
    </section>
  );
}
