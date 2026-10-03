'use client';

import type {
  B2bCrmConnectionsV1,
  B2bCrmPaymentDocumentV1,
  B2bCrmPaymentDocumentsV1,
} from '@nora/contracts';
import { FileText, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/surfaces';
import { documentsApi } from '@/modules/documents/api/client';
import { ContractOutputButton } from '@/modules/sales/components/contract-output';
import { SalesTravelDocuments } from '@/modules/sales/components/sales-travel-documents';
import { agencyClient } from '../api/agency-client';
import {
  assertPaymentDocumentContext,
  boundSnapshotRequest,
  canDownloadPaymentDocument,
  crmSnapshotValue,
  deliverBoundDownload,
  type BoundDeliveryContext,
} from '../model/crm-context';

const pageSize = 10;
const contractStatusLabels: Record<
  B2bCrmConnectionsV1['contracts'][number]['status'],
  string
> = {
  DRAFT: 'پیش‌نویس',
  PENDING_CONFIRMATION: 'منتظر تأیید',
  CONFIRMED: 'تأییدشده',
  SENT_TO_RESERVATIONS: 'ارسال به رزرواسیون',
  IN_PROGRESS: 'در حال انجام',
  COMPLETED: 'تکمیل‌شده',
  CANCELLED: 'لغوشده',
};

function scanLabel(
  status: B2bCrmPaymentDocumentV1['currentVersion']['scanStatus'],
) {
  return (
    {
      CLEAN: 'بررسی‌شده',
      PENDING_SCAN: 'در صف بررسی',
      QUARANTINED: 'قرنطینه',
      INFECTED: 'فایل آلوده',
      SCAN_FAILED: 'بررسی ناموفق',
      AWAITING_ANTIVIRUS_ADAPTER: 'در انتظار آنتی‌ویروس',
    } as const
  )[status];
}

export function OrganizationSalesDocuments({
  organizationId,
  branchId,
  sessionContextKey,
  connections,
}: {
  organizationId: string;
  branchId: string;
  sessionContextKey: string;
  connections: B2bCrmConnectionsV1 | undefined;
}) {
  const [page, setPage] = useState(1);
  const [openContractId, setOpenContractId] = useState('');
  const [receiptSnapshot, setReceiptSnapshot] = useState<{
    key: string;
    data: B2bCrmPaymentDocumentsV1;
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const abort = useRef<AbortController | undefined>(undefined);
  const deliveryContext = useRef<BoundDeliveryContext>({
    key: '',
    generation: 0,
  });
  const cohortKey = `${organizationId}|${branchId}|${sessionContextKey}|${connections?.observedAt ?? ''}|${connections?.contracts.map((contract) => contract.id).join(',') ?? ''}|${receiptSnapshot?.key ?? ''}`;
  /* The current render must invalidate an earlier download before effects run. */
  /* eslint-disable react-hooks/refs */
  deliveryContext.current = {
    key: cohortKey,
    generation: deliveryContext.current.generation,
  };
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    abort.current?.abort();
    ++request.current;
    const timer = window.setTimeout(() => {
      setPage(1);
      setOpenContractId('');
      setReceiptSnapshot(undefined);
      setBusy(false);
      setError('');
    }, 0);
    return () => {
      window.clearTimeout(timer);
      abort.current?.abort();
      deliveryContext.current = {
        ...deliveryContext.current,
        generation: deliveryContext.current.generation + 1,
      };
    };
  }, [organizationId, branchId, sessionContextKey, connections]);

  const contracts = connections?.contracts ?? [];
  const pages = Math.max(1, Math.ceil(contracts.length / pageSize));
  const visible = contracts.slice((page - 1) * pageSize, page * pageSize);

  async function loadReceipts(contractId: string) {
    const current = ++request.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const contextKey = `${organizationId}|${branchId}|${sessionContextKey}|${connections?.observedAt ?? ''}|${contractId}`;
    setOpenContractId(contractId);
    setReceiptSnapshot(undefined);
    setBusy(true);
    setError('');
    try {
      const result = await boundSnapshotRequest(
        contextKey,
        controller.signal,
        () =>
          agencyClient.crmPaymentDocuments(
            organizationId,
            contractId,
            branchId,
            controller.signal,
          ),
        (response) =>
          assertPaymentDocumentContext(
            response,
            organizationId,
            branchId,
            contractId,
          ),
      );
      if (current !== request.current || !result) return;
      setReceiptSnapshot(result);
    } catch (caught) {
      if (current !== request.current || controller.signal.aborted) return;
      setError(
        caught instanceof Error
          ? caught.message
          : 'دریافت رسیدهای پرداخت ناموفق بود.',
      );
    } finally {
      if (current === request.current) setBusy(false);
    }
  }

  async function download(
    item: B2bCrmPaymentDocumentV1,
    contractNumber: string,
  ) {
    const expectedDelivery = { ...deliveryContext.current };
    setError('');
    try {
      await deliverBoundDownload(
        expectedDelivery,
        () => deliveryContext.current,
        () =>
          documentsApi.download(
            item.id,
            `بررسی رسید پرداخت قرارداد ${contractNumber}`,
          ),
        (result) => {
          const url = URL.createObjectURL(result.blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = item.currentVersion.safeDownloadName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
        },
      );
    } catch (caught) {
      if (
        deliveryContext.current.key !== expectedDelivery.key ||
        deliveryContext.current.generation !== expectedDelivery.generation
      )
        return;
      setError(
        caught instanceof Error ? caught.message : 'دریافت رسید ناموفق بود.',
      );
    }
  }

  if (!connections) return null;
  return (
    <section className="panel mt-5" aria-label="اسناد قراردادهای فروش مرتبط">
      <header className="panel-head">
        <div>
          <h2 className="panel-title">اسناد قراردادهای فروش مرتبط</h2>
          <p className="panel-note">
            PDF قرارداد، مدارک سفر و رسیدهای پرداخت فقط با مجوزهای مالک هر بخش
            دریافت می‌شوند.
          </p>
        </div>
      </header>
      <div className="panel-body space-y-3">
        {connections.unavailableSources.SALES ? (
          <Alert
            tone="warning"
            title="قراردادهای فروش در دسترس نیست"
            description={connections.unavailableSources.SALES}
          />
        ) : !contracts.length ? (
          <p>برای این سازمان در شعبه انتخاب‌شده قرارداد فروشی ثبت نشده است.</p>
        ) : (
          visible.map((contract) => {
            const receiptContextKey = `${organizationId}|${branchId}|${sessionContextKey}|${connections.observedAt}|${contract.id}`;
            const receipts = crmSnapshotValue(
              receiptSnapshot,
              receiptContextKey,
            );
            const receiptRows =
              openContractId === contract.id
                ? (receipts?.payments.flatMap((row) => row.documents) ?? [])
                : [];
            return (
              <article className="rounded-xl border p-4" key={contract.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <strong>{contract.contractNumber}</strong>
                    <p className="text-xs text-muted-foreground">
                      {contractStatusLabels[contract.status]}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ContractOutputButton contractId={contract.id} />
                    <SalesTravelDocuments contractId={contract.id} />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy && openContractId === contract.id}
                      onClick={() => void loadReceipts(contract.id)}
                    >
                      <RefreshCw aria-hidden="true" className="size-4" />
                      رسیدهای پرداخت
                    </Button>
                  </div>
                </div>
                {openContractId === contract.id ? (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    {busy ? <p role="status">در حال دریافت رسیدها…</p> : null}
                    {error ? <p role="alert">{error}</p> : null}
                    {!busy && !error && receipts && !receiptRows.length ? (
                      <p>رسید پرداختی برای این قرارداد ثبت نشده است.</p>
                    ) : null}
                    {receiptRows.map((item) => (
                      <div
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-3"
                        key={item.id}
                      >
                        <span>
                          <FileText
                            aria-hidden="true"
                            className="me-2 inline size-4"
                          />
                          {item.title} ·{' '}
                          {scanLabel(item.currentVersion.scanStatus)}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!canDownloadPaymentDocument(item)}
                          onClick={() =>
                            void download(item, contract.contractNumber)
                          }
                        >
                          دریافت رسید
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
        {pages > 1 ? (
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              قبلی
            </Button>
            <span>
              {page.toLocaleString('fa-IR')} از {pages.toLocaleString('fa-IR')}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page === pages}
              onClick={() => setPage((value) => Math.min(pages, value + 1))}
            >
              بعدی
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
