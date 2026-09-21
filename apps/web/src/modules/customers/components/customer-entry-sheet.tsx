'use client';

import type { ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { Input } from '@/components/ui/form-controls';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/overlays';
import { cn } from '@/lib/utils';
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
  | 'passportExpiryDate'
  | 'passportFirstName'
  | 'passportLastName'
  | 'gender'
  | 'nationalityCode'
  | 'passportIssuingCountryCode'
  | 'birthCountryCode'
  | 'phone'
  | 'email';
export interface CustomerEntryRow {
  key: string;
  label: string;
  role: ReactNode;
  values: Record<
    Exclude<
      EntryField,
      | 'passportExpiryDate'
      | 'passportFirstName'
      | 'passportLastName'
      | 'gender'
      | 'nationalityCode'
      | 'passportIssuingCountryCode'
      | 'birthCountryCode'
    >,
    string
  > & {
    passportExpiryDate?: string;
  } & Partial<
      Record<
        | 'passportFirstName'
        | 'passportLastName'
        | 'gender'
        | 'nationalityCode'
        | 'passportIssuingCountryCode'
        | 'birthCountryCode',
        string
      >
    >;
  readOnly?: boolean;
  editableFields?: readonly EntryField[];
  actions?: ReactNode;
  onChange: (field: EntryField, value: string) => void;
}

const columns = [
  ['firstName', 'نام *', 'first-name'],
  ['lastName', 'نام خانوادگی *', 'last-name'],
  ['nationalId', 'کد ملی *', 'national-id'],
  ['birthDate', 'تاریخ تولد مسافر *', 'birth-date'],
  ['passportNumber', 'شماره پاسپورت', 'passport-number'],
  ['passportExpiryDate', 'انقضای پاسپورت', 'passport-expiry'],
  ['passportFirstName', 'نام لاتین پاسپورت *', 'passport-first-name'],
  ['passportLastName', 'نام خانوادگی لاتین *', 'passport-last-name'],
  ['gender', 'جنسیت *', 'gender'],
  ['nationalityCode', 'ملیت ISO3 *', 'nationality'],
  ['passportIssuingCountryCode', 'کشور صادرکننده ISO3 *', 'passport-country'],
  ['birthCountryCode', 'کشور محل تولد ISO3 *', 'birth-country'],
  ['phone', 'تلفن', 'phone'],
  ['email', 'ایمیل', 'email'],
] as const;

const iso3Countries = [
  ['IRN', 'ایران'],
  ['TUR', 'ترکیه'],
  ['ARE', 'امارات متحده عربی'],
  ['ARM', 'ارمنستان'],
  ['AZE', 'جمهوری آذربایجان'],
  ['GEO', 'گرجستان'],
  ['IRQ', 'عراق'],
  ['AFG', 'افغانستان'],
  ['QAT', 'قطر'],
  ['OMN', 'عمان'],
  ['SAU', 'عربستان سعودی'],
  ['KWT', 'کویت'],
  ['BHR', 'بحرین'],
  ['JOR', 'اردن'],
  ['LBN', 'لبنان'],
  ['SYR', 'سوریه'],
  ['PAK', 'پاکستان'],
  ['RUS', 'روسیه'],
  ['KAZ', 'قزاقستان'],
  ['UZB', 'ازبکستان'],
  ['TKM', 'ترکمنستان'],
  ['TJK', 'تاجیکستان'],
  ['KGZ', 'قرقیزستان'],
  ['IND', 'هند'],
  ['CHN', 'چین'],
  ['JPN', 'ژاپن'],
  ['KOR', 'کره جنوبی'],
  ['THA', 'تایلند'],
  ['MYS', 'مالزی'],
  ['SGP', 'سنگاپور'],
  ['IDN', 'اندونزی'],
  ['MDV', 'مالدیو'],
  ['LKA', 'سری‌لانکا'],
  ['DEU', 'آلمان'],
  ['FRA', 'فرانسه'],
  ['ITA', 'ایتالیا'],
  ['ESP', 'اسپانیا'],
  ['GRC', 'یونان'],
  ['NLD', 'هلند'],
  ['BEL', 'بلژیک'],
  ['AUT', 'اتریش'],
  ['CHE', 'سوئیس'],
  ['SWE', 'سوئد'],
  ['NOR', 'نروژ'],
  ['DNK', 'دانمارک'],
  ['FIN', 'فنلاند'],
  ['POL', 'لهستان'],
  ['CZE', 'جمهوری چک'],
  ['HUN', 'مجارستان'],
  ['ROU', 'رومانی'],
  ['BGR', 'بلغارستان'],
  ['CYP', 'قبرس'],
  ['PRT', 'پرتغال'],
  ['GBR', 'بریتانیا'],
  ['IRL', 'ایرلند'],
  ['USA', 'ایالات متحده آمریکا'],
  ['CAN', 'کانادا'],
  ['MEX', 'مکزیک'],
  ['BRA', 'برزیل'],
  ['ARG', 'آرژانتین'],
  ['AUS', 'استرالیا'],
  ['NZL', 'نیوزیلند'],
  ['ZAF', 'آفریقای جنوبی'],
  ['EGY', 'مصر'],
  ['MAR', 'مراکش'],
  ['TUN', 'تونس'],
  ['KEN', 'کنیا'],
  ['TZA', 'تانزانیا'],
] as const;

const iso3Fields: readonly EntryField[] = [
  'nationalityCode',
  'passportIssuingCountryCode',
  'birthCountryCode',
];

function Iso3CountryGuide({ label }: { label: string }) {
  const plainLabel = label.replace(' *', '');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center rounded-md text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`راهنمای کد ISO3 برای ${plainLabel}`}
          title="راهنمای کد کشورهای پرکاربرد"
        >
          <CircleHelp aria-hidden="true" className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-0" sideOffset={6}>
        <div className="border-b px-3 py-2" dir="rtl">
          <p className="font-bold">راهنمای کد ISO3</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            کشورهای پرکاربرد در قراردادهای سفر
          </p>
        </div>
        <div
          className="max-h-64 overflow-y-auto p-1"
          role="list"
          aria-label="فهرست نام کشورها و کد ISO3"
        >
          {iso3Countries.map(([code, country]) => (
            <div
              key={code}
              role="listitem"
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 odd:bg-muted/45"
              dir="rtl"
            >
              <span>{country}</span>
              <bdi className="font-mono font-bold text-primary">{code}</bdi>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CustomerEntrySheet({
  rows,
  calendarMode,
  onCalendarModeChange,
  disabled = false,
  showPassportExpiry = false,
}: {
  rows: readonly CustomerEntryRow[];
  calendarMode: CustomerCalendarMode;
  onCalendarModeChange: (mode: CustomerCalendarMode) => void;
  disabled?: boolean;
  showPassportExpiry?: boolean;
}) {
  const visibleColumns = columns.filter(
    ([field]) => field !== 'passportExpiryDate' || showPassportExpiry,
  );
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
              {visibleColumns.map(([field, label]) => (
                <th
                  scope="col"
                  className="border-e p-3 text-start whitespace-nowrap"
                  key={field}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {iso3Fields.includes(field) ? (
                      <Iso3CountryGuide label={label} />
                    ) : null}
                  </span>
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
                {visibleColumns.map(([field, label, suffix]) => (
                  <td className="border-e p-1.5" key={field}>
                    {field === 'gender' ? (
                      <div
                        className="grid min-w-32 grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1"
                        role="radiogroup"
                        aria-label={`جنسیت ${row.label}`}
                      >
                        {(
                          [
                            ['M', 'مرد'],
                            ['F', 'زن'],
                          ] as const
                        ).map(([value, optionLabel]) => {
                          const selected = row.values.gender === value;
                          const genderDisabled = Boolean(
                            disabled ||
                            (row.readOnly &&
                              !row.editableFields?.includes('gender')),
                          );
                          return (
                            <button
                              key={value}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              disabled={genderDisabled}
                              className={cn(
                                'h-8 rounded-md px-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                                selected
                                  ? 'bg-primary text-primary-foreground shadow-sm'
                                  : 'bg-surface text-muted-foreground hover:text-foreground',
                              )}
                              onClick={() => row.onChange('gender', value)}
                            >
                              {optionLabel}
                            </button>
                          );
                        })}
                      </div>
                    ) : field === 'birthDate' ||
                      field === 'passportExpiryDate' ? (
                      <CustomerDateField
                        compact
                        id={`${row.key}-${suffix}`}
                        label={`${field === 'birthDate' ? 'تاریخ تولد' : 'انقضای پاسپورت'} ${row.label}`}
                        mode={calendarMode}
                        onModeChange={onCalendarModeChange}
                        value={row.values[field] ?? ''}
                        onChange={(value) => row.onChange(field, value)}
                        disabled={Boolean(
                          disabled ||
                          (row.readOnly &&
                            !row.editableFields?.includes(field)),
                        )}
                      />
                    ) : (
                      <Input
                        aria-label={`${label.replace(' *', '')} ${row.label}`}
                        autoComplete="off"
                        className="h-10 min-w-28 rounded-md border-transparent bg-transparent px-2 shadow-none focus:border-primary"
                        disabled={
                          disabled ||
                          (row.readOnly && !row.editableFields?.includes(field))
                        }
                        dir={
                          [
                            'nationalId',
                            'passportNumber',
                            'phone',
                            'email',
                            'nationalityCode',
                            'passportIssuingCountryCode',
                            'birthCountryCode',
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
                              : [
                                    'nationalityCode',
                                    'passportIssuingCountryCode',
                                    'birthCountryCode',
                                  ].includes(field)
                                ? 3
                                : undefined
                        }
                        minLength={field === 'nationalId' ? 10 : undefined}
                        onChange={(event) =>
                          row.onChange(
                            field,
                            field === 'passportNumber'
                              ? event.target.value.toUpperCase()
                              : [
                                    'passportFirstName',
                                    'passportLastName',
                                    'nationalityCode',
                                    'passportIssuingCountryCode',
                                    'birthCountryCode',
                                  ].includes(field)
                                ? event.target.value.toUpperCase()
                                : event.target.value,
                          )
                        }
                        pattern={
                          field === 'nationalId'
                            ? '[0-9۰-۹٠-٩]{10}'
                            : field === 'passportNumber'
                              ? '[A-Za-z0-9-]{4,24}'
                              : [
                                    'nationalityCode',
                                    'passportIssuingCountryCode',
                                    'birthCountryCode',
                                  ].includes(field)
                                ? '[A-Z]{3}'
                                : field === 'passportFirstName' ||
                                    field === 'passportLastName'
                                  ? "[A-Za-z][A-Za-z '\\-]*"
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
                        value={row.values[field] ?? ''}
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
    </>
  );
}
