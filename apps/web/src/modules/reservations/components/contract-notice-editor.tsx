'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-controls';
import { travelRequest } from './travel-workflow-form';
type Notice = { version: number; notice: string; canEdit: boolean };
export function ContractNoticeEditor({
  contractId,
  onSaved,
}: {
  contractId: string;
  onSaved: () => void;
}) {
  const [record, setRecord] = useState<Notice | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    void travelRequest<Notice>(
      `sales/contracts/${encodeURIComponent(contractId)}/notice`,
    )
      .then((value) => {
        if (active) {
          setError('');
          setRecord(value);
          setNotice(value.notice);
        }
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : 'عملیات انجام نشد؛ مجوز و اتصال را بررسی کنید.',
          );
      });
    return () => {
      active = false;
    };
  }, [contractId, retry]);
  async function save() {
    if (!record?.canEdit || lock.current || notice === record.notice) return;
    lock.current = true;
    setBusy(true);
    setSaved(false);
    setError('');
    try {
      const value = await travelRequest<Notice>(
        `sales/contracts/${encodeURIComponent(contractId)}/notice`,
        { expectedVersion: record.version, notice },
      );
      setRecord(value);
      setNotice(value.notice);
      setSaved(true);
      onSaved();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'عملیات انجام نشد؛ مجوز و اتصال را بررسی کنید.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="grid w-full gap-3 rounded-xl border border-border bg-surface p-4"
      dir="rtl"
    >
      <label htmlFor={`contract-notice-${contractId}`} className="font-bold">
        نوتیس قرارداد
      </label>
      <Textarea
        id={`contract-notice-${contractId}`}
        value={notice}
        onChange={(e) => {
          setNotice(e.target.value);
          setSaved(false);
        }}
        disabled={!record?.canEdit || busy}
        maxLength={5000}
        rows={5}
      />
      <div className="flex flex-wrap gap-2">
        {record?.canEdit && (
          <Button
            onClick={() => void save()}
            disabled={busy || notice === record.notice}
          >
            {busy ? 'در حال ثبت…' : 'ذخیره نوتیس'}
          </Button>
        )}
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            setRecord(null);
            setError('');
            setSaved(false);
            setRetry((r) => r + 1);
          }}
        >
          دریافت آخرین نسخه
        </Button>
      </div>
      {saved && <p role="status">نوتیس قرارداد ذخیره شد.</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
