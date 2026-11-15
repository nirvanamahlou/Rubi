'use client';
import { useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { useAccessPermissions } from '@/modules/iam/access-context';

export function AccountingFiscalDefault({
  book,
  yearId,
  busy,
  run,
  onChanged,
}: {
  book: AccountingSnapshotV1;
  yearId: string;
  busy: boolean;
  onChanged?: () => void;
  run: (
    action: string,
    payload: Record<string, unknown>,
    version?: number,
  ) => Promise<unknown>;
}) {
  const period = book.periods.find((row) => row.fiscalYearId === yearId);
  const year = book.configurations.find(
    (row) => row.id === yearId && row.kind === 'fiscal-years',
  );
  const permissions = useAccessPermissions();
  const client = useQueryClient();
  const pending = useRef(false);
  return (
    <label
      className="inline-flex items-center gap-2 text-xs"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <input
        type="checkbox"
        aria-label={`سال مالی پیش‌فرض ${year?.title ?? ''}`}
        checked={period?.isDefault === true}
        disabled={
          busy ||
          !period ||
          !year?.active ||
          !permissions?.includes('finance.account.manage')
        }
        onChange={async (event) => {
          if (!period || pending.current || busy) return;
          const isDefault = event.target.checked;
          pending.current = true;
          try {
            const saved = await run(
              'set-default-period',
              { id: period.id, isDefault },
              book.book.version,
            );
            if (saved) {
              onChanged?.();
              await client.invalidateQueries({
                queryKey: ['finance-fiscal-context'],
              });
            }
          } finally {
            pending.current = false;
          }
        }}
      />
      {period ? 'پیش‌فرض شرکت' : 'ابتدا سال مالی را به دفتر تخصیص دهید'}
    </label>
  );
}
