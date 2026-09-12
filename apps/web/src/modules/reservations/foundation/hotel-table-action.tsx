'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import { TravelWorkflowForm } from '../components/travel-workflow-form';
import type { RequestView } from './model';

export function hotelTableAction(
  row: RequestView,
  confirmation: boolean,
  canManage: boolean,
) {
  const checked = confirmation
    ? Boolean(row.hotelConfirmed)
    : Boolean(row.hotelRequested);
  const blocked =
    !canManage ||
    row.status === 'CANCELLED' ||
    checked ||
    (confirmation && !row.hotelRequested);
  return {
    checked,
    disabled: blocked,
    action: confirmation
      ? row.status === 'SUPPLIER_CONFIRMED'
        ? 'واچر'
        : 'Confirmation'
      : 'رزرواسیون',
    hint: !canManage
      ? 'مجوز عملیات مدارک رزرواسیون لازم است.'
      : row.status === 'CANCELLED'
        ? 'این قرارداد ابطال شده است.'
        : checked
          ? 'این مرحله قبلاً ثبت شده است.'
          : confirmation && !row.hotelRequested
            ? 'ابتدا اقدام هتل و ارسال فرم به کارگزار را ثبت کنید.'
            : confirmation
              ? 'ثبت تأیید کارگزار و صدور واچر مسافر'
              : 'دریافت فرم رزرواسیون و ثبت ارسال آن به کارگزار',
  };
}
export function HotelTableAction({
  row,
  confirmation,
  canManage,
  onSelect,
}: {
  row: RequestView;
  confirmation: boolean;
  canManage: boolean;
  onSelect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const state = hotelTableAction(row, confirmation, canManage);
  const label = confirmation ? 'تأیید هتل' : 'اقدام هتل';
  return (
    <>
      <span title={state.hint}>
        <button
          type="button"
          role="checkbox"
          aria-checked={state.checked}
          aria-label={`${label} · ${row.contractNumber}`}
          disabled={state.disabled}
          className="inline-flex size-5 items-center justify-center rounded border border-current bg-transparent text-current disabled:cursor-default disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
            setOpen(true);
          }}
        >
          <span aria-hidden="true">{state.checked ? '✓' : ''}</span>
        </button>
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          dir="rtl"
          className="max-h-[85vh] max-w-3xl overflow-y-auto"
          onClick={(event) => event.stopPropagation()}
        >
          <DialogTitle>
            {label} · {row.contractNumber}
          </DialogTitle>
          <DialogDescription>
            {confirmation
              ? 'پس از ثبت صدور واچر، تیک تأیید هتل و رنگ طوسی تیره ثبت می‌شود. تحویل به فروش همچنان منتظر تأیید مالی است.'
              : 'فرم را دریافت و برای کارگزار ارسال کنید؛ سپس ارسال را ثبت کنید تا تیک اقدام هتل و رنگ طوسی روشن ثبت شود.'}
          </DialogDescription>
          <div className="mt-4">
            <TravelWorkflowForm id={row.id} action={state.action} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
