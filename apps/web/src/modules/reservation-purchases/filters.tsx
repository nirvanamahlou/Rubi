'use client';
import { DatePicker } from '@/components/ui/date-picker';
import { purchaseDateFields, type PurchaseFilters } from './model';

export function PurchaseFilterControls({
  value,
  onChange,
}: {
  value: PurchaseFilters;
  onChange: (value: PurchaseFilters) => void;
}) {
  return (
    <div className="grid gap-3 border-b p-4 sm:grid-cols-2 xl:grid-cols-5">
      <label className="space-y-2 text-sm">
        <span>وضعیت ثبت خرید</span>
        <select
          aria-label="وضعیت ثبت خرید"
          className="h-11 w-full rounded-xl border bg-background px-3"
          value={value.status}
          onChange={(e) =>
            onChange({
              ...value,
              status: e.target.value as PurchaseFilters['status'],
            })
          }
        >
          <option value="ALL">همه وضعیت‌های ثبت</option>
          <option value="REGISTERED">ثبت‌شده</option>
          <option value="UNREGISTERED">ثبت‌نشده</option>
        </select>
      </label>
      <label className="space-y-2 text-sm">
        <span>مبنای تاریخ و مرتب‌سازی</span>
        <select
          aria-label="مبنای تاریخ و مرتب‌سازی"
          className="h-11 w-full rounded-xl border bg-background px-3"
          value={value.dateBy}
          onChange={(e) =>
            onChange({
              ...value,
              dateBy: e.target.value as PurchaseFilters['dateBy'],
            })
          }
        >
          {purchaseDateFields.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="space-y-2 text-sm">
        <label htmlFor="purchase-from">از تاریخ</label>
        <DatePicker
          id="purchase-from"
          aria-label="از تاریخ خرید و تأمین"
          value={value.from}
          onChange={(from) => onChange({ ...value, from })}
        />
      </div>
      <div className="space-y-2 text-sm">
        <label htmlFor="purchase-to">تا تاریخ</label>
        <DatePicker
          id="purchase-to"
          aria-label="تا تاریخ خرید و تأمین"
          value={value.to}
          onChange={(to) => onChange({ ...value, to })}
        />
      </div>
      <label className="space-y-2 text-sm">
        <span>ترتیب تاریخ</span>
        <select
          aria-label="ترتیب تاریخ"
          className="h-11 w-full rounded-xl border bg-background px-3"
          value={value.direction}
          onChange={(e) =>
            onChange({
              ...value,
              direction: e.target.value as PurchaseFilters['direction'],
            })
          }
        >
          <option value="DESC">جدیدتر به قدیمی‌تر</option>
          <option value="ASC">قدیمی‌تر به جدیدتر</option>
        </select>
      </label>
    </div>
  );
}
