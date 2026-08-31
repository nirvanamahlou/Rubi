'use client';

import type { MasterDataRecord } from '@rubi/contracts';
import { Power } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { masterDataApi } from '../api/client';

/** Authorization is enforced by the status endpoint; never silently disable a reference in use. */
export function MasterDataPowerButton({
  record,
  onChanged,
}: {
  record: MasterDataRecord;
  onChanged: () => void | Promise<void>;
}) {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = `${record.status === 'active' ? 'غیرفعال‌سازی' : 'فعال‌سازی'} ${record.name}`;
  async function toggle() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await masterDataApi.setStatus(
        record.resource,
        record.id,
        record.status === 'active' ? 'inactive' : 'active',
        record.version,
      );
      await onChanged();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'تغییر وضعیت ناموفق بود؛ دوباره تلاش کنید.',
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        size="icon"
        variant="outline"
        aria-label={label}
        title={label}
        aria-busy={pending}
        disabled={pending}
        onClick={() => void toggle()}
        className={
          record.status === 'active'
            ? 'text-rose-700 dark:text-rose-300'
            : 'text-emerald-700 dark:text-emerald-300'
        }
      >
        <Power aria-hidden="true" className="size-4" />
      </Button>
      {error ? (
        <span role="alert" className="max-w-64 text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
