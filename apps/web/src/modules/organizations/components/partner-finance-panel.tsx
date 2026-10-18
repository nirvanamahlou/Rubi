'use client';
import { useEffect, useState } from 'react';
import type {
  B2bAgreementCaseV1,
  PartnerFinanceV1,
  PartnerRoleV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { partnerClient } from '../api/partner-client';
import { agencyClient } from '../api/agency-client';
import { useDossierBranch } from './use-dossier-branch';
import { OrganizationDocumentsPanel } from './organization-documents-panel';
import type { MasterDataRecord } from '@nora/contracts';
import { downloadOrganizationXlsx } from '../model/organization-xlsx';
import { projectPartnerCredit } from '../model/partner-credit';
import { DossierFormDialog } from './dossier-form-dialog';
import { Input, Textarea } from '@/components/ui/form-controls';
import { MoneyInput } from '@/components/ui/money-input';
import { DatePicker } from '@/components/ui/date-picker';
import { MasterDataReferenceSelector } from '@/modules/master-data/components/master-data-reference-selector';
import { browserRandomUuid } from '@/lib/browser-random-uuid';

const titles: Record<string, string> = {
  statement: 'صورتحساب خرید و مانده عملیاتی',
  invoice: 'فاکتورهای خرید',
  payments: 'پرداخت‌های ثبت‌شده به طرف همکاری',
  checks: 'چک‌های مالی و تضمینی طرف همکاری',
  commission: 'درخواست‌های مالی پورسانت',
  settlement: 'تسویه خریدها',
  disputes: 'مغایرت‌های مالی',
  exposure: 'اعتبار دریافتی و مانده قابل استفاده',
};
export function PartnerFinancePanel({
  organization,
  role,
  tab,
}: {
  organization: MasterDataRecord;
  role: PartnerRoleV1;
  tab: string;
}) {
  const {
    branchId,
    setBranchId,
    branches,
    permissions,
    sessionContextKey,
    sessionError,
  } = useDossierBranch();
  const [result, setResult] = useState<{
    key: string;
    data?: PartnerFinanceV1;
    agreements?: B2bAgreementCaseV1[];
    error?: string;
  }>({ key: '' });
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState({ from: '', to: '', currency: '' });
  const [editor, setEditor] = useState<{
    context: string;
    operationId: string;
    kind: 'CHECK' | 'COMMISSION' | 'ADJUSTMENT';
    title: string;
    description: string;
    reference: string;
    amount: string;
    currencyCode: string;
    dueAt: string;
  }>();
  const key = `${organization.id}:${role}:${branchId}:${sessionContextKey}:${refresh}`;
  useEffect(() => {
    if (!branchId || !sessionContextKey) return;
    const abort = new AbortController();
    void (async () => {
      const data = await partnerClient.finance(
        organization.id,
        role,
        branchId,
        abort.signal,
      );
      const agreements: B2bAgreementCaseV1[] = [];
      if (
        permissions.includes('b2b.agreement.read') &&
        permissions.includes('b2b.credit.read')
      ) {
        let page = 1;
        let pages = 1;
        do {
          const response = await agencyClient.agreements(
            organization.id,
            branchId,
            role,
            page++,
          );
          agreements.push(...response.data);
          pages = response.meta.totalPages;
          if (abort.signal.aborted) return;
          if (pages > 1000)
            throw new Error('تعداد قراردادها از سقف خواندن امن بیشتر است.');
        } while (page <= pages);
      }
      if (!abort.signal.aborted) setResult({ key, data, agreements });
    })().catch((error: unknown) => {
      if (!abort.signal.aborted)
        setResult({
          key,
          error:
            error instanceof Error ? error.message : 'دریافت مالی ناموفق بود.',
        });
    });
    return () => abort.abort();
  }, [organization.id, role, branchId, sessionContextKey, permissions, key]);
  const current = result.key === key ? result : undefined;
  const data = current?.data;
  const canReadCredit =
    permissions.includes('b2b.agreement.read') &&
    permissions.includes('b2b.credit.read');
  const columns = [
    'شناسه',
    'تاریخ',
    'شرح',
    tab === 'settlement' ? 'مانده' : 'مبلغ',
    'ارز',
    tab === 'settlement' ? 'وضعیت' : 'مرجع',
  ];
  const today = new Date().toISOString().slice(0, 10);
  const active = (current?.agreements ?? []).flatMap((agreement) => {
    const revision = agreement.revisions.find(
      (r) => r.id === agreement.activeRevisionId,
    );
    return agreement.status === 'ACTIVE' &&
      revision?.status === 'APPROVED' &&
      revision.startsAt <= today &&
      (!revision.endsAt || revision.endsAt >= today)
      ? [{ agreement, revision }]
      : [];
  });
  const requestKind =
    tab === 'checks'
      ? 'CHECK'
      : tab === 'commission'
        ? 'COMMISSION'
        : tab === 'disputes'
          ? 'ADJUSTMENT'
          : null;
  const requestRows = (data?.requests ?? [])
    .filter((row) => row.kind === requestKind)
    .map((row) => [
      row.id,
      row.dueAt.slice(0, 10),
      `${row.title} — ${row.status}`,
      row.amount,
      row.currencyCode,
      row.reference,
    ]);
  const rows = !data
    ? []
    : tab === 'payments'
      ? data.payments.map((p) => [
          p.id,
          p.occurredAt.slice(0, 10),
          p.method ?? 'روش ثبت‌شده',
          p.amount,
          p.currencyCode,
          p.reference ?? '—',
        ])
      : tab === 'checks'
        ? [
            ...requestRows,
            ...active.flatMap(({ revision }) =>
              revision.guarantees
                .filter((g) => g.kind === 'CHEQUE')
                .map((g) => [
                  g.reference,
                  g.receivedAt,
                  'چک تضمین؛ پرداخت محسوب نمی‌شود',
                  g.amount,
                  g.currencyCode,
                  g.status === 'RECEIVED' ? 'تحویل‌شده' : 'در انتظار تحویل',
                ]),
            ),
          ]
        : tab === 'commission'
          ? requestRows
          : [
              ...(tab === 'disputes' ? requestRows : []),
              ...data.purchases
                .filter((p) =>
                  tab === 'disputes'
                    ? data.reconciliationRequired.includes(p.id)
                    : p.current &&
                      (tab !== 'invoice' || p.source === 'PROCUREMENT'),
                )
                .map((p) => [
                  p.id,
                  p.createdAt.slice(0, 10),
                  p.title,
                  tab === 'settlement'
                    ? (data.settlements?.find((row) => row.purchaseId === p.id)
                        ?.remaining ?? 'نامشخص')
                    : p.amount,
                  p.currencyCode,
                  tab === 'settlement'
                    ? (data.settlements?.find((row) => row.purchaseId === p.id)
                        ?.status ?? 'نامشخص')
                    : p.reference,
                ]),
            ];
  const invalidRange = Boolean(
    filter.from && filter.to && filter.from > filter.to,
  );
  const shown = invalidRange
    ? []
    : rows.filter(
        (row) =>
          (!filter.from || row[1]! >= filter.from) &&
          (!filter.to || row[1]! <= filter.to) &&
          (!filter.currency || row[4] === filter.currency),
      );
  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">{titles[tab] ?? titles.statement}</h2>
        {requestKind && (
          <Button
            disabled={
              !data ||
              !permissions.includes('finance.request.manage') ||
              !permissions.includes('finance.read')
            }
            onClick={() =>
              setEditor({
                context: key,
                operationId: browserRandomUuid(),
                kind: requestKind,
                title: '',
                description: '',
                reference: '',
                amount: '',
                currencyCode: '',
                dueAt: '',
              })
            }
          >
            ثبت درخواست{' '}
            {requestKind === 'CHECK'
              ? 'چک'
              : requestKind === 'COMMISSION'
                ? 'پورسانت'
                : 'اصلاح / مغایرت'}
          </Button>
        )}
        <label className="field">
          شعبه
          <NativeSearchSelect
            className="input"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </NativeSearchSelect>
        </label>
        <Button
          variant="outline"
          onClick={() => setRefresh((value) => value + 1)}
        >
          تازه‌سازی
        </Button>
      </header>
      <div className="panel-body space-y-4">
        {sessionError || current?.error ? (
          <p role="alert" className="form-error">
            {sessionError || current?.error}
          </p>
        ) : !data ? (
          <p role="status">در حال دریافت پرونده مالی…</p>
        ) : (
          <>
            {!!data.reconciliationRequired.length && (
              <p role="alert" className="form-error">
                پرداخت یا خرید نیازمند تطبیق است؛ اعتبار قابل استفاده تا رفع
                مغایرت اعلام نمی‌شود.
              </p>
            )}
            {!canReadCredit && (tab === 'checks' || tab === 'exposure') && (
              <p role="status">
                دسترسی به قرارداد و اعتبار ندارید؛ اطلاعات تضمین و سقف اعتبار
                قابل بررسی نیست.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['ارز', 'خرید جاری', 'پرداخت‌شده', 'مانده عملیاتی ما'].map(
                      (title) => (
                        <th key={title}>{title}</th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.totals.map((total) => (
                    <tr key={total.currencyCode}>
                      <td>{total.currencyCode}</td>
                      <td dir="ltr">{total.purchases}</td>
                      <td dir="ltr">{total.paid}</td>
                      <td dir="ltr">{total.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {tab === 'exposure' ? (
              <div className="space-y-3">
                {!canReadCredit ? (
                  <p>اعتبار دریافتی نامشخص است؛ مجوز مشاهده لازم است.</p>
                ) : active.length ? (
                  active.flatMap(({ agreement, revision }) =>
                    revision.creditPolicies.map((policy) => {
                      const projection = projectPartnerCredit(
                        {
                          ...policy,
                          id: agreement.id,
                          profileId: '',
                          isActive: true,
                          version: agreement.version,
                          createdAt: revision.createdAt,
                          updatedAt: revision.createdAt,
                        },
                        data,
                        active
                          .flatMap(
                            ({ revision: candidate }) =>
                              candidate.creditPolicies,
                          )
                          .filter(
                            (candidate) =>
                              candidate.currencyCode === policy.currencyCode &&
                              candidate.effectiveFrom <= today &&
                              (!candidate.expiresAt ||
                                candidate.expiresAt >= today),
                          ).length,
                        new Date(),
                      );
                      return (
                        <div
                          className="summary-list"
                          key={`${agreement.id}:${policy.currencyCode}`}
                        >
                          <strong>
                            {agreement.title} — {policy.currencyCode}
                          </strong>
                          {projection.status === 'AVAILABLE' ? (
                            <p>
                              سقف دریافتی: {projection.limit} · مصرف:{' '}
                              {projection.exposure} · باقی‌مانده:{' '}
                              {projection.available}
                            </p>
                          ) : (
                            <p role="status">{projection.reason}</p>
                          )}
                        </div>
                      );
                    }),
                  )
                ) : (
                  <p>قرارداد فعالِ دارای اعتبار دریافتی ثبت نشده است.</p>
                )}
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="field">
                    از تاریخ
                    <DatePicker
                      value={filter.from}
                      onChange={(from) => setFilter({ ...filter, from })}
                    />
                  </label>
                  <label className="field">
                    تا تاریخ
                    <DatePicker
                      value={filter.to}
                      onChange={(to) => setFilter({ ...filter, to })}
                    />
                  </label>
                  <label className="field">
                    ارز
                    <NativeSearchSelect
                      value={filter.currency}
                      onChange={(e) =>
                        setFilter({ ...filter, currency: e.target.value })
                      }
                    >
                      <option value="">همه ارزها</option>
                      {[...new Set(rows.map((row) => row[4]!))].map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </NativeSearchSelect>
                  </label>
                </div>
                {invalidRange && (
                  <p role="alert">پایان بازه باید بعد از شروع آن باشد.</p>
                )}
                <Button
                  variant="outline"
                  disabled={
                    !shown.length || !permissions.includes('finance.export')
                  }
                  onClick={() =>
                    downloadOrganizationXlsx(`partner-${tab}.xlsx`, [
                      columns,
                      ...shown,
                    ])
                  }
                >
                  خروجی اکسل
                </Button>
                {shown.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          {columns.map((title) => (
                            <th key={title}>{title}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((row, rowIndex) => (
                          <tr key={`${row[0]}:${rowIndex}`}>
                            {row.map((cell, index) => (
                              <td className="p-2 text-center" key={index}>
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p role="status">رکوردی برای این بخش و شعبه ثبت نشده است.</p>
                )}
              </>
            )}
          </>
        )}
        <OrganizationDocumentsPanel
          organization={organization}
          folderLabel={`اسناد ${titles[tab] ?? 'مالی'}`}
          compact
        />
      </div>
      {editor && (
        <DossierFormDialog
          title="ثبت درخواست مالی طرف همکاری"
          description="درخواست در همین پرونده ثبت می‌شود؛ تأیید و پرداخت از گردش موجود کارتابل مالی انجام می‌شود."
          submitDisabled={editor.context !== key}
          onClose={() => {
            setEditor(undefined);
            setRefresh((value) => value + 1);
          }}
          onSave={async () => {
            if (editor.context !== key)
              throw Object.assign(
                new Error(
                  'نشست یا شعبه تغییر کرده است؛ فرم را دوباره باز کنید.',
                ),
                { status: 409 },
              );
            const { context: _context, ...input } = editor;
            void _context;
            if (
              !input.title.trim() ||
              !input.amount ||
              !input.currencyCode ||
              !input.dueAt ||
              (input.kind === 'CHECK' && !input.reference.trim())
            )
              throw Object.assign(
                new Error('عنوان، مبلغ، ارز، سررسید و شماره چک را کامل کنید.'),
                { status: 400 },
              );
            const saved = await partnerClient.createFinanceRequest(
              organization.id,
              role,
              branchId,
              { ...input, party: organization.name },
            );
            if (saved.requestId !== input.operationId)
              throw new Error(
                'نتیجه ثبت درخواست تأیید نشد؛ فهرست را تازه‌سازی کنید.',
              );
          }}
        >
          <label className="field">
            عنوان *
            <Input
              required
              maxLength={200}
              value={editor.title}
              onChange={(e) => setEditor({ ...editor, title: e.target.value })}
            />
          </label>
          <label className="field">
            مبلغ *
            <MoneyInput
              required
              value={editor.amount}
              onValueChange={(amount) => setEditor({ ...editor, amount })}
            />
          </label>
          <div className="field">
            <label htmlFor="partner-request-currency">ارز *</label>
            <MasterDataReferenceSelector
              id="partner-request-currency"
              config={{ target: 'currencies', payload: 'code' }}
              label="ارز"
              required
              disabled={false}
              closeOnSelect
              value={editor.currencyCode}
              onChange={(currencyCode) =>
                setEditor({ ...editor, currencyCode })
              }
            />
          </div>
          <label className="field">
            سررسید *
            <DatePicker
              withinDialog
              required
              value={editor.dueAt}
              onChange={(dueAt) => setEditor({ ...editor, dueAt })}
            />
          </label>
          <label className="field">
            {editor.kind === 'CHECK' ? 'شماره چک *' : 'مرجع'}
            <Input
              required={editor.kind === 'CHECK'}
              maxLength={160}
              value={editor.reference}
              onChange={(e) =>
                setEditor({ ...editor, reference: e.target.value })
              }
            />
          </label>
          <label className="field">
            توضیحات
            <Textarea
              maxLength={2000}
              value={editor.description}
              onChange={(e) =>
                setEditor({ ...editor, description: e.target.value })
              }
            />
          </label>
        </DossierFormDialog>
      )}
    </section>
  );
}
