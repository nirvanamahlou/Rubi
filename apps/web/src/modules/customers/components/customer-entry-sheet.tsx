'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { formatCustomerDate } from '../model/customer-calendar';
import {
  CustomerDateField,
  type CustomerCalendarMode,
} from './customer-date-field';

export type EntryField =
  | 'firstName'
  | 'lastName'
  | 'nationalId'
  | 'birthDate'
  | 'passportNumber'
  | 'phone'
  | 'email';
export interface CustomerEntryRow {
  key: string;
  label: string;
  role: ReactNode;
  values: Record<EntryField, string>;
  readOnly?: boolean;
  actions?: ReactNode;
  onChange: (field: EntryField, value: string) => void;
}

const columns = [
  ['firstName', 'نام *', 'first-name'],
  ['lastName', 'نام خانوادگی *', 'last-name'],
  ['nationalId', 'کد ملی *', 'national-id'],
  ['birthDate', 'تاریخ تولد مسافر *', 'birth-date'],
  ['passportNumber', 'پاسپورت', 'passport-number'],
  ['phone', 'تلفن', 'phone'],
  ['email', 'ایمیل', 'email'],
] as const;

export function CustomerEntrySheet({
  rows,
  calendarMode,
  onCalendarModeChange,
  disabled = false,
}: {
  rows: readonly CustomerEntryRow[];
  calendarMode: CustomerCalendarMode;
  onCalendarModeChange: (mode: CustomerCalendarMode) => void;
  disabled?: boolean;
}) {
  const [dateRowKey, setDateRowKey] = useState<string | null>(null);
  const dateRow = rows.find((row) => row.key === dateRowKey);
  return (
    <>
      <div
        className="overflow-x-auto rounded-xl border"
        role="region"
        aria-label="جدول ورود اطلاعات مشتری و مسافران"
        tabIndex={0}
      >
        <table className="w-full min-w-[1150px] border-collapse text-sm">
          <caption className="sr-only">
            هر نفر یک ردیف؛ ستون‌های ستاره‌دار الزامی هستند. تلفن، ایمیل و
            پاسپورت اختیاری‌اند.
          </caption>
          <thead className="bg-primary/10 text-primary">
            <tr>
              <th scope="col" className="w-40 border-e p-3 text-start">
                پرونده / نقش
              </th>
              {columns.map(([field, label]) => (
                <th
                  scope="col"
                  className="border-e p-3 text-start whitespace-nowrap"
                  key={field}
                >
                  {label}
                </th>
              ))}
              <th scope="col" className="p-3 text-start">
                جزئیات
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className="border-t align-top even:bg-muted/25 focus-within:bg-primary/5"
              >
                <th
                  scope="row"
                  className="min-w-36 border-e p-2 text-start text-xs"
                >
                  <p className="mb-2 font-bold">{row.label}</p>
                  {row.role}
                </th>
                {columns.map(([field, label, suffix]) => (
                  <td className="border-e p-1.5" key={field}>
                    {field === 'birthDate' ? (
                      <Button
                        aria-label={`تاریخ تولد ${row.label}`}
                        className="h-10 w-full min-w-36 justify-start text-xs"
                        disabled={disabled || row.readOnly}
                        onClick={() => setDateRowKey(row.key)}
                        type="button"
                        variant="outline"
                      >
                        {row.values.birthDate
                          ? formatCustomerDate(
                              row.values.birthDate,
                              calendarMode,
                            )
                          : 'انتخاب تاریخ'}
                      </Button>
                    ) : (
                      <Input
                        aria-label={`${label.replace(' *', '')} ${row.label}`}
                        autoComplete="off"
                        className="h-10 min-w-28 rounded-md border-transparent bg-transparent px-2 shadow-none focus:border-primary"
                        disabled={disabled || row.readOnly}
                        dir={
                          [
                            'nationalId',
                            'passportNumber',
                            'phone',
                            'email',
                          ].includes(field)
                            ? 'ltr'
                            : 'rtl'
                        }
                        id={`${row.key}-${suffix}`}
                        inputMode={
                          field === 'nationalId'
                            ? 'numeric'
                            : field === 'phone'
                              ? 'tel'
                              : field === 'email'
                                ? 'email'
                                : 'text'
                        }
                        maxLength={
                          field === 'nationalId'
                            ? 10
                            : field === 'passportNumber'
                              ? 24
                              : undefined
                        }
                        minLength={field === 'nationalId' ? 10 : undefined}
                        onChange={(event) =>
                          row.onChange(
                            field,
                            field === 'passportNumber'
                              ? event.target.value.toUpperCase()
                              : event.target.value,
                          )
                        }
                        pattern={
                          field === 'nationalId'
                            ? '[0-9۰-۹٠-٩]{10}'
                            : field === 'passportNumber'
                              ? '[A-Za-z0-9-]{4,24}'
                              : field === 'phone'
                                ? '\\+?[0-9]{10,15}'
                                : undefined
                        }
                        required={[
                          'firstName',
                          'lastName',
                          'nationalId',
                        ].includes(field)}
                        type={
                          field === 'email'
                            ? 'email'
                            : field === 'phone'
                              ? 'tel'
                              : 'text'
                        }
                        value={row.values[field]}
                      />
                    )}
                  </td>
                ))}
                <td className="min-w-28 p-2">{row.actions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dateRow ? (
        <Dialog open onOpenChange={(open) => !open && setDateRowKey(null)}>
          <DialogContent className="min-h-[32rem] max-w-lg overflow-visible">
            <DialogTitle>تاریخ تولد {dateRow.label}</DialogTitle>
            <DialogDescription>
              تاریخ را از تقویم شمسی یا میلادی انتخاب کنید.
            </DialogDescription>
            <CustomerDateField
              initialOpen
              id={`${dateRow.key}-birth-date-picker`}
              label="تاریخ تولد"
              mode={calendarMode}
              onModeChange={onCalendarModeChange}
              onChange={(value) => {
                dateRow.onChange('birthDate', value);
                setDateRowKey(null);
              }}
              value={dateRow.values.birthDate}
              disabled={disabled}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
