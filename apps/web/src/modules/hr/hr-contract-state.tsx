'use client';
import { useEffect, useRef, useState } from 'react';
import type { DocumentListItemV1, HrRecordDto } from '@rubi/contracts';
import { documentsApi } from '../documents/api/client';
import { DatePicker } from '@/components/ui/date-picker';
import { hrRequest } from './hr-api';
import type { HrStore } from './hr-store';
import { HrButton } from './hr-controls';
import { RequiredFieldLabel } from './required-field-label';
import ui from './hr-unified.module.css';

export function HrContractState({
  record,
  store,
}: {
  record: HrRecordDto;
  store: HrStore;
}) {
  const [documents, setDocuments] = useState<readonly DocumentListItemV1[]>([]);
  const [documentId, setDocumentId] = useState(
    record.data.signedDocumentId ?? '',
  );
  const [expiry, setExpiry] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  useEffect(() => {
    let active = true;
    void documentsApi
      .list({
        branchId: record.branchId,
        domain: 'HUMAN_RESOURCES',
        archiveStatus: 'ACTIVE',
        pageSize: 100,
      })
      .then((result) => {
        if (active) setDocuments(result.data);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'دریافت اسناد انجام نشد.');
      });
    return () => {
      active = false;
    };
  }, [record.branchId]);
  const state = record.data.contractState;
  const command = async (next: 'SIGNED' | 'ACTIVE' | 'ENDED') => {
    setBusy(true);
    setError('');
    try {
      await hrRequest(`/records/${record.id}/contract-state`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Idempotency-Key': key.current,
        },
        body: JSON.stringify({
          version: record.version,
          state: next,
          ...(next === 'SIGNED' ? { signedDocumentId: documentId } : {}),
          ...(next === 'ENDED' ? { reason } : {}),
        }),
      });
      key.current = crypto.randomUUID();
      await store.mutated();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'تغییر مرحله قرارداد انجام نشد.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <details>
      <summary className={ui.detailsSummary}>
        مرحله قرارداد:{' '}
        {state === 'ACTIVE'
          ? 'فعال'
          : state === 'SIGNED'
            ? 'نسخه امضاشده ثبت شده'
            : state === 'ENDED'
              ? 'پایان‌یافته'
              : 'در انتظار نسخه امضاشده'}
      </summary>
      <div className={ui.spaced}>
        {store.data!.capabilities.write &&
        store.data!.capabilities.approve &&
        store.data!.capabilities.sensitive &&
        record.status === 'تأییدشده' ? (
          <>
            {!state ? (
              <>
                <label className={ui.field}>
                  <RequiredFieldLabel required>
                    نسخه امضاشده در اسناد
                  </RequiredFieldLabel>
                  <select
                    value={documentId}
                    onChange={(event) => setDocumentId(event.target.value)}
                  >
                    <option value="">انتخاب سند</option>
                    {documents.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.archiveCode} · {item.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={ui.field}>
                  اعتبار فایل جدید در بایگانی
                  <DatePicker
                    value={expiry}
                    onChange={setExpiry}
                    aria-label="اعتبار قرارداد امضاشده"
                  />
                </label>
                <label className={ui.field}>
                  بارگذاری نسخه امضاشده
                  <input
                    type="file"
                    accept=".pdf,image/jpeg,image/png"
                    disabled={busy}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (!file) return;
                      setBusy(true);
                      try {
                        const { archiveHrFile } =
                          await import('./hr-file-archive');
                        const archived = await archiveHrFile({
                          file,
                          branchId: record.branchId,
                          entityId: record.id,
                          title: `نسخه امضاشده ${record.code}`,
                          validUntil: expiry || undefined,
                        });
                        const result = await documentsApi.list({
                          branchId: record.branchId,
                          domain: 'HUMAN_RESOURCES',
                          pageSize: 100,
                        });
                        setDocuments(result.data);
                        setDocumentId(archived.id);
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : 'بارگذاری انجام نشد.',
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                </label>
                <HrButton
                  disabled={busy || !documentId}
                  onClick={() => void command('SIGNED')}
                >
                  ثبت نسخه امضاشده
                </HrButton>
              </>
            ) : null}
            {state === 'SIGNED' ? (
              <HrButton
                primary
                disabled={busy}
                onClick={() => void command('ACTIVE')}
              >
                فعال‌سازی قرارداد
              </HrButton>
            ) : null}
            {state === 'SIGNED' || state === 'ACTIVE' ? (
              <>
                <label className={ui.field}>
                  <RequiredFieldLabel required>
                    دلیل پایان قرارداد
                  </RequiredFieldLabel>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <HrButton
                  disabled={busy || !reason.trim()}
                  onClick={() => void command('ENDED')}
                >
                  ثبت پایان قرارداد
                </HrButton>
              </>
            ) : null}
          </>
        ) : null}
        {error ? (
          <p role="alert" className={ui.error}>
            {error}
          </p>
        ) : null}
      </div>
    </details>
  );
}
