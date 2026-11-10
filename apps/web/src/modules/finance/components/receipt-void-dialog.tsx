import { completionJournalHref } from '../accounting-completion-routes';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { useEffect, useRef, useState } from 'react';
import type { FinanceInboxItemV1 } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-controls';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { apiRequest } from '../api/finance-inbox-api';

interface ReceiptVoidPreview {
  version: number;
  amount: string;
  currency: string;
  reference: string | null;
  journalNumber: number | null;
  journal: { id: string; bookId: string } | null;
  blocker: string | null;
  balances: { currencyCode: string; outstanding: string }[];
}

export function ReceiptVoidDialog({
  item,
  onClose,
  onVoided,
}: {
  item: FinanceInboxItemV1;
  onClose: () => void;
  onVoided: () => void;
}) {
  const permissions = useAccessPermissions();
  const path = `/finance/inbox/sales/${encodeURIComponent(item.sourceContextReference)}/${encodeURIComponent(item.sourceReference)}/void`;
  const [preview, setPreview] = useState<ReceiptVoidPreview | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    let active = true;
    void apiRequest<{ data: ReceiptVoidPreview }>(path)
      .then((result) => {
        if (active) setPreview(result.data);
      })
      .catch((cause) => {
        if (active) setError((cause as Error).message);
      });
    return () => {
      active = false;
    };
  }, [path]);

  async function submit() {
    if (
      !preview ||
      preview.blocker ||
      reason.trim().length < 3 ||
      submitting.current
    )
      return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await apiRequest(path, {
        method: 'POST',
        body: JSON.stringify({
          reason: reason.trim(),
          version: preview.version,
        }),
      });
      onVoided();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting.current) onClose();
      }}
    >
      <DialogContent dir="rtl">
        <DialogTitle>ابطال دریافت</DialogTitle>
        <DialogDescription>{item.title}</DialogDescription>
        {error && <p role="alert">{error}</p>}
        {!preview && !error && <p role="status">در حال دریافت پیش‌نمایش…</p>}
        {preview && (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <p>
              {preview.amount} {preview.currency}
            </p>
            <p>شماره پیگیری {preview.reference ?? 'ثبت نشده'}</p>
            <p>شماره سند {preview.journalNumber ?? 'ثبت نشده'}</p>
            {preview.journal &&
              permissions?.includes('finance.journal.read') && (
                <a
                  className="text-primary underline"
                  href={completionJournalHref(
                    preview.journal.bookId,
                    preview.journal.id,
                  )}
                >
                  مشاهده سند
                </a>
              )}
            <p>مانده پس از ابطال</p>
            {preview.balances.map((balance) => (
              <p key={balance.currencyCode}>
                {balance.outstanding} {balance.currencyCode}
              </p>
            ))}
            {preview.blocker && <p role="alert">{preview.blocker}</p>}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReason('ثبت تکراری')}
            >
              ثبت تکراری
            </Button>
            <label className="grid gap-2">
              دلیل ابطال
              <Textarea
                required
                minLength={3}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <Button
              type="submit"
              variant="destructive"
              disabled={busy || !!preview.blocker || reason.trim().length < 3}
            >
              تأیید ابطال
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
