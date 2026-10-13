'use client';

import {
  Building2,
  FileText,
  ShoppingCart,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { moneyLabel } from '../model/presentation';
import { connectedOutstanding } from '../model/organization-crm-connections';
import { useOrganizationCrmConnections } from './use-organization-crm-connections';

function Metric({
  label,
  value,
  icon: Icon,
  tone = '',
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: string;
}) {
  return (
    <article className="kpi">
      <div className={`kpi-icon ${tone}`}>
        <Icon size={23} />
      </div>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
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
  branchId,
  sessionContextKey,
}: {
  organizationId: string;
  branchId: string;
  sessionContextKey: string;
}) {
  const { data, loading } = useOrganizationCrmConnections(
    organizationId,
    branchId,
    sessionContextKey,
  );
  const outstanding = data ? connectedOutstanding(data.contracts) : [];
  const openReservations =
    data?.reservations.filter(
      (reservation) =>
        !['VOUCHER_ISSUED', 'CANCELLED'].includes(reservation.status),
    ).length ?? 0;
  const pending = loading ? '…' : '—';
  const customersAvailable = data && !data.unavailableSources.CUSTOMERS;
  const salesAvailable = data && !data.unavailableSources.SALES;
  const reservationsAvailable = data && !data.unavailableSources.RESERVATIONS;

  return (
    <section className="kpis" aria-label="شاخص‌های متصل پرونده سازمان">
      <Metric
        label="مشتری سازمانی مرتبط"
        value={
          customersAvailable
            ? data.customers.length.toLocaleString('fa-IR')
            : pending
        }
        icon={Building2}
        tone="green"
      />
      <Metric
        label="قرارداد فروش مرتبط"
        value={
          salesAvailable
            ? data.contracts.length.toLocaleString('fa-IR')
            : pending
        }
        icon={FileText}
        tone="purple"
      />
      <Metric
        label="سفارش باز"
        value={
          reservationsAvailable
            ? openReservations.toLocaleString('fa-IR')
            : pending
        }
        icon={ShoppingCart}
      />
      <Metric
        label="مانده قراردادهای فروش"
        value={salesAvailable ? outstandingLabel(outstanding) : pending}
        icon={Wallet}
        tone="amber"
      />
    </section>
  );
}
