'use client';

import {
  Building2,
  FileText,
  ShoppingCart,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { NativeSearchSelect } from '@/components/ui/native-search-select';

import { moneyLabel } from '../model/presentation';
import {
  connectedOutstanding,
  overduePaymentCount,
} from '../model/organization-crm-connections';
import { useOrganizationCrmConnections } from './use-organization-crm-connections';
import { useDossierBranch } from './use-dossier-branch';
import { OrganizationSalesDocuments } from './organization-sales-documents';

function Metric({
  label,
  value,
  icon: Icon,
  tone = '',
  note,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: string;
  note?: string | undefined;
}) {
  return (
    <article className="kpi">
      <div className={`kpi-icon ${tone}`}>
        <Icon size={23} />
      </div>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        {note ? <small>{note}</small> : null}
      </div>
    </article>
  );
}

function outstandingLabel(
  rows: readonly { currencyCode: string; amount: string }[],
) {
  if (!rows.length) return '۰';
  if (rows.length === 1)
    return moneyLabel(rows[0]!.amount, rows[0]!.currencyCode);
  return `${rows.length.toLocaleString('fa-IR')} ارز`;
}

export function OrganizationCrmKpis({
  organizationId,
}: {
  organizationId: string;
}) {
  const { branchId, setBranchId, branches, sessionError, sessionContextKey } =
    useDossierBranch();
  const { data, loading, error } = useOrganizationCrmConnections(
    organizationId,
    branchId,
    sessionContextKey,
  );
  const outstanding = data ? connectedOutstanding(data.contracts) : [];
  const today = new Date().toISOString().slice(0, 10);
  const overdue = data ? overduePaymentCount(data.payments, today) : 0;
  const openReservations =
    data?.reservations.filter(
      (reservation) =>
        !['VOUCHER_ISSUED', 'CANCELLED'].includes(reservation.status),
    ).length ?? 0;
  const pending = loading ? '…' : '—';

  return (
    <>
      <section className="panel mb-5" aria-label="شعبه قراردادهای فروش مرتبط">
        <header className="panel-head">
          <div>
            <h2 className="panel-title">ارتباط قراردادهای فروش</h2>
            <p className="panel-note">
              قراردادها با شناسه مشتری سازمانی و در شعبه انتخاب‌شده تطبیق داده
              می‌شوند.
            </p>
          </div>
          <label className="field">
            <span>شعبه قراردادهای فروش</span>
            <NativeSearchSelect
              className="input"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </NativeSearchSelect>
          </label>
        </header>
        {sessionError ? (
          <div className="panel-body" role="alert">
            {sessionError}
          </div>
        ) : null}
      </section>
      <section className="kpis" aria-label="شاخص‌های متصل پرونده سازمان">
        <Metric
          label="مشتری سازمانی مرتبط"
          value={data ? data.customers.length.toLocaleString('fa-IR') : pending}
          icon={Building2}
          tone="green"
          note={
            error ||
            data?.unavailableSources.CUSTOMERS ||
            'تطبیق در Backend با شناسه سازمان'
          }
        />
        <Metric
          label="قرارداد فروش مرتبط"
          value={data ? data.contracts.length.toLocaleString('fa-IR') : pending}
          icon={FileText}
          tone="purple"
          note={data?.unavailableSources.SALES || 'داده زنده Backend فروش'}
        />
        <Metric
          label="سفارش باز"
          value={data ? openReservations.toLocaleString('fa-IR') : pending}
          icon={ShoppingCart}
          note={
            data?.unavailableSources.RESERVATIONS ||
            'داده زنده Backend رزرواسیون'
          }
        />
        <Metric
          label="مانده قراردادهای فروش"
          value={data ? outstandingLabel(outstanding) : pending}
          icon={Wallet}
          tone="amber"
          note={
            data?.unavailableSources.SALES_PAYMENTS ||
            data?.unavailableSources.SALES ||
            `${overdue.toLocaleString('fa-IR')} پرداخت سررسیدگذشته`
          }
        />
      </section>
      <OrganizationSalesDocuments
        organizationId={organizationId}
        branchId={branchId}
        sessionContextKey={sessionContextKey}
        connections={data}
      />
    </>
  );
}
