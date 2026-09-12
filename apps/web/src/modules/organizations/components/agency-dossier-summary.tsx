'use client';
import { useEffect, useState } from 'react';
import type { B2bCooperationRole } from '@rubi/contracts';
import { masterDataApi } from '@/modules/master-data/api/client';
import { agencyClient } from '../api/agency-client';
import { useDossierBranch } from './use-dossier-branch';

export function AgencyDossierSummary({
  organizationId,
  role,
}: {
  organizationId: string;
  role: B2bCooperationRole;
}) {
  const { branchId, setBranchId, branches, permissions, sessionError } =
    useDossierBranch();
  const [summary, setSummary] = useState<
    readonly { label: string; value: string }[]
  >([]);
  useEffect(() => {
    if (!branchId) return;
    let active = true;
    const allowed = (...codes: (typeof permissions)[number][]) =>
      codes.every((code) => permissions.includes(code));
    void Promise.allSettled([
      masterDataApi.organizationAddresses(organizationId),
      role === 'AGENCY' && allowed('b2b.agency.read')
        ? agencyClient.profileDetails(organizationId, branchId)
        : Promise.resolve(null),
      role === 'AGENCY' && allowed('b2b.rate.read')
        ? agencyClient.rates(organizationId, branchId)
        : Promise.resolve(null),
      allowed('b2b.agreement.read', 'b2b.credit.read')
        ? agencyClient.agreements(organizationId, branchId, role)
        : Promise.resolve(null),
    ]).then(([addresses, profile, rates, agreements]) => {
      if (!active) return;
      const restricted = 'نیاز به دسترسی';
      const unavailable = 'دریافت ناموفق';
      const details =
        profile.status === 'fulfilled' ? profile.value?.data : undefined;
      setSummary([
        {
          label: 'شعب و آدرس‌ها',
          value:
            addresses.status === 'fulfilled'
              ? addresses.value.data.length.toLocaleString('fa-IR')
              : unavailable,
        },
        {
          label: 'مدیر حساب',
          value:
            profile.status === 'rejected'
              ? unavailable
              : !details
                ? role === 'AGENCY'
                  ? restricted
                  : 'برای این نقش تعریف نشده'
                : (details.accountManagers.find(
                    (user) => user.id === details.profile?.accountManagerUserId,
                  )?.displayName ?? 'تعیین نشده'),
        },
        {
          label: 'نرخ، تخفیف و پورسانت',
          value:
            rates.status === 'rejected'
              ? unavailable
              : rates.value
                ? rates.value.data.length.toLocaleString('fa-IR')
                : role === 'AGENCY'
                  ? restricted
                  : 'برای این نقش تعریف نشده',
        },
        {
          label: 'قراردادهای ثبت‌شده',
          value:
            agreements.status === 'rejected'
              ? unavailable
              : agreements.value
                ? agreements.value.meta.total.toLocaleString('fa-IR')
                : restricted,
        },
      ]);
    });
    return () => {
      active = false;
    };
  }, [organizationId, branchId, permissions, role]);
  return (
    <section className="panel" aria-label="خلاصه اطلاعات ثبت‌شده">
      <header className="panel-head">
        <div>
          <h2 className="panel-title">اطلاعات ثبت‌شده در پرونده</h2>
          <p className="panel-note">
            {branches.find((branch) => branch.id === branchId)?.name ??
              'در حال دریافت…'}
          </p>
        </div>
        <label className="field">
          <span>شعبه خلاصه پرونده</span>
          <select
            className="input"
            value={branchId}
            onChange={(event) => {
              setSummary([]);
              setBranchId(event.target.value);
            }}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="panel-body grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {sessionError ? (
          <p role="alert">{sessionError}</p>
        ) : (
          summary.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border p-4"
            >
              <p className="panel-note">{item.label}</p>
              <strong>{item.value}</strong>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
