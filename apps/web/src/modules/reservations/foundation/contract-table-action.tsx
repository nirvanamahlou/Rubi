'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-controls';
import { salesApi } from '@/modules/sales/api/client';
import { ReservationContractEditor } from '../components/reservation-contract-editor';
import type { RequestView, ViewAccess } from './model';
export function ContractTableAction({
  row,
  cancel,
  access,
}: {
  row: RequestView;
  cancel: boolean;
  access: ViewAccess;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const checked = Boolean(
    cancel ? row.tableSummary?.cancelledAt : row.tableSummary?.correctedAt,
  );
  const allowed = cancel
    ? access.permissions.includes('sales.contracts.cancel')
    : access.permissions.some((p) =>
        [
          'sales.contracts.update.branch',
          'sales.contracts.update.own',
        ].includes(p),
      );
  const label = cancel ? 'ابطال قرارداد' : 'اصلاح قرارداد';
  async function cancelContract() {
    if (!row.contractId || !reason.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await salesApi.detail(row.contractId);
      await salesApi.cancel(row.contractId, data.version, reason.trim());
      window.dispatchEvent(new Event('reservation-workflow-changed'));
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ابطال انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label + ' · ' + row.contractNumber}
        disabled={!allowed || !row.contractId || (cancel && checked)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex size-5 items-center justify-center rounded border border-current disabled:opacity-60"
      >
        {checked ? '✓' : ''}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          dir="rtl"
          className="max-h-[85vh] max-w-5xl overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogTitle>
            {label} · {row.contractNumber}
          </DialogTitle>
          <DialogDescription>
            {cancel
              ? 'ابطال، وضعیت واقعی قرارداد فروش را تغییر می‌دهد. دلیل را وارد و ثبت کنید.'
              : 'تیک پس از ثبت اصلاح واقعی قرارداد فعال می‌شود.'}
          </DialogDescription>
          {cancel ? (
            <div className="space-y-3">
              <label>
                دلیل ابطال
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <Button
                disabled={busy || !reason.trim()}
                onClick={() => void cancelContract()}
              >
                ثبت ابطال قرارداد
              </Button>
              {error && (
                <p role="alert" className="text-destructive">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <ReservationContractEditor
              requestId={row.id}
              {...(row.contractId ? { contractId: row.contractId } : {})}
              contractNumber={row.contractNumber}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
