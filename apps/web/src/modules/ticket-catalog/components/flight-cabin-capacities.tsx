'use client';
import type { Dispatch, SetStateAction } from 'react';
import { Button, FormField, Input } from '@/components/ui';
import type { Reference } from '../model/catalog';
import type { FlightCabinCapacity } from '../model/flight-cabins';
import { ReferencePicker } from './reference-picker';

export function FlightCabinCapacities({
  cabins,
  primaryCapacity,
  references,
  onReference,
  onChange,
  roundTrip = false,
  disabled = false,
}: {
  cabins: FlightCabinCapacity[];
  primaryCapacity: number;
  references: readonly Reference[];
  onReference?: ((reference: Reference) => void) | undefined;
  onChange: Dispatch<SetStateAction<FlightCabinCapacity[]>>;
  roundTrip?: boolean;
  disabled?: boolean;
}) {
  return (
    <fieldset
      disabled={disabled}
      className="space-y-3"
      aria-label="کلاس‌های پرواز و ظرفیت"
    >
      <p className="text-sm text-muted-foreground">
        هر کلاس ظرفیت و قیمت مستقل دارد.
        {roundTrip
          ? ' کلاس‌های اضافه با همین ظرفیت برای رفت و برگشت ثبت می‌شوند.'
          : ''}
      </p>
      {cabins.map((cabin, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <ReferencePicker
            id={`ticket-extra-cabin-${index}`}
            label="کلاس پروازی اضافه"
            resource="cabin-classes"
            readOnly={disabled}
            value={references.find(
              (item) =>
                item.kind === 'flightClass' && item.id === cabin.flightClassId,
            )}
            onSelect={(reference) => {
              if (reference) onReference?.(reference);

              onChange((items) =>
                items.map((item, i) =>
                  i === index
                    ? { ...item, flightClassId: reference?.id ?? '' }
                    : item,
                ),
              );
            }}
          />
          <FormField
            label="ظرفیت این کلاس"
            id={`ticket-extra-capacity-${index}`}
          >
            <Input
              id={`ticket-extra-capacity-${index}`}
              type="number"
              min={0}
              max={100000}
              step={1}
              value={
                Number.isNaN(cabin.totalCapacity) ? '' : cabin.totalCapacity
              }
              onChange={(event) => {
                onChange((items) =>
                  items.map((item, i) =>
                    i === index
                      ? {
                          ...item,
                          totalCapacity:
                            event.target.value === ''
                              ? NaN
                              : Number(event.target.value),
                        }
                      : item,
                  ),
                );
              }}
            />
          </FormField>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onChange((items) => items.filter((_, i) => i !== index));
            }}
          >
            حذف کلاس
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={disabled || cabins.length >= 2}
        onClick={() => {
          onChange((items) => [
            ...items,
            { flightClassId: '', totalCapacity: 0 },
          ]);
        }}
      >
        افزودن کلاس پروازی
      </Button>
      <p className="text-sm font-semibold">
        ظرفیت کل پرواز:{' '}
        {Number.isFinite(primaryCapacity) &&
        cabins.every((item) => Number.isFinite(item.totalCapacity))
          ? (
              primaryCapacity +
              cabins.reduce((sum, item) => sum + item.totalCapacity, 0)
            ).toLocaleString('fa-IR')
          : '—'}
      </p>
    </fieldset>
  );
}
