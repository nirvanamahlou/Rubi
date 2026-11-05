'use client';
import { useEffect, useRef, useState } from 'react';
import { SearchCombobox } from '@/components/ui/search-combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { rateRequest } from './controls';
import { loadPackDirectory, packsForCity } from './existing-packs-model';
import {
  copyableHotelPacks,
  loadCopiedHotelIds,
} from './pack-hotel-copy-model';
import type { PackSummary } from './packs-workspace';

export function PackHotelCopy({
  branchId,
  cityId,
  currentPackId,
  availableHotelIds,
  disabled,
  onCopy,
}: {
  branchId: string;
  cityId: string;
  currentPackId?: string | undefined;
  availableHotelIds: readonly string[];
  disabled: boolean;
  onCopy: (hotelIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [branchId, cityId, currentPackId, disabled],
  );
  function close() {
    generation.current += 1;
    setOpen(false);
    setLoading(false);
  }
  async function show() {
    if (disabled || !branchId || !cityId) return;
    const version = ++generation.current;
    setOpen(true);
    setLoading(true);
    setError('');
    setMessage('');
    setPacks([]);
    try {
      const result = await loadPackDirectory(branchId, rateRequest);
      if (version === generation.current)
        setPacks(copyableHotelPacks(result, branchId, cityId, currentPackId));
    } catch (error) {
      if (version === generation.current)
        setError(
          error instanceof Error
            ? error.message
            : 'دریافت بسته‌ها انجام نشد؛ دوباره تلاش کنید.',
        );
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }
  async function choose(id: string) {
    if (disabled || loading || !packs.some((pack) => pack.id === id)) return;
    const version = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const result = await loadCopiedHotelIds(
        id,
        branchId,
        cityId,
        availableHotelIds,
        rateRequest,
      );
      if (version !== generation.current) return;
      onCopy(result.hotelIds);
      setMessage(
        `${result.hotelIds.length.toLocaleString('fa-IR')} هتل از بسته انتخاب شد.${result.skipped ? ` ${result.skipped.toLocaleString('fa-IR')} هتل دیگر قابل انتخاب نیست.` : ''}`,
      );
      close();
    } catch (error) {
      if (version === generation.current)
        setError(
          error instanceof Error
            ? error.message
            : 'کپی هتل‌ها انجام نشد؛ دوباره تلاش کنید.',
        );
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }
  return (
    <div className="mb-3 space-y-2">
      <button
        type="button"
        disabled={disabled || !branchId || !cityId}
        onClick={() => void show()}
      >
        کپی از بستهٔ دیگر
      </button>
      {message && <p role="status">{message}</p>}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent>
          <DialogTitle>کپی انتخاب هتل‌ها از بستهٔ دیگر</DialogTitle>
          <DialogDescription>
            بسته‌های همین شهر و شعبه نمایش داده می‌شوند. هتل‌ها به انتخاب‌های
            فعلی اضافه می‌شوند؛ نرخ و تاریخ بسته تغییر نمی‌کند.
          </DialogDescription>
          {loading ? (
            <p role="status">در حال دریافت اطلاعات بسته…</p>
          ) : packs.length ? (
            <SearchCombobox
              label="بستهٔ مبدأ برای کپی هتل‌ها"
              value=""
              options={packsForCity(packs, cityId)}
              disabled={disabled}
              onValueChange={(id) => void choose(id)}
            />
          ) : (
            !error && <p>بستهٔ دیگری برای این شهر ثبت نشده است.</p>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="flex gap-2">
            {error && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void show()}
              >
                تلاش مجدد
              </button>
            )}
            <button type="button" onClick={close}>
              بستن
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
