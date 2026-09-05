'use client';

import { useEffect, useRef, useState } from 'react';
import type { CustomerSummary, MasterDataRecord } from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/surfaces';
import { customersApi } from '@/modules/customers/api/client';
import { masterDataApi } from '@/modules/master-data/api/client';
import { SearchableReference } from './searchable-reference';

export async function loadOrganizationCustomers(
  api: Pick<typeof customersApi, 'list'> = customersApi,
) {
  const data: CustomerSummary[] = [];
  for (let page = 1; ; page++) {
    const response = await api.list({
      search: '',
      kind: 'organization',
      status: 'all',
      role: 'all',
      branchId: 'all',
      createdFrom: null,
      createdTo: null,
      updatedFrom: null,
      updatedTo: null,
      sortBy: 'displayName',
      sortDirection: 'asc',
      page,
      pageSize: 100,
    });
    data.push(...response.data);
    if (!response.data.length || data.length >= response.meta.total)
      return data;
  }
}

export async function resolveOrganizationCustomer(
  organization: MasterDataRecord,
  api: Pick<typeof customersApi, 'list' | 'create'> = customersApi,
) {
  if (!organization.id || organization.status !== 'active')
    throw new Error('سازمان فعال را انتخاب کنید.');
  const matches = (await loadOrganizationCustomers(api)).filter(
    (person) => person.organizationId === organization.id,
  );
  const existing = matches.find(
    (person) => person.status === 'active' && person.roles.includes('customer'),
  );
  if (existing) return existing;
  if (matches.length)
    throw new Error(
      'پرونده این سازمان موجود است؛ فعال‌سازی یا نقش مشتری را در بخش مشتریان اصلاح کنید.',
    );
  const response = await api.create({
    kind: 'organization',
    organizationId: organization.id,
    displayName: organization.name,
    roles: ['customer'],
  });
  return response.data;
}

export function SalesOrganizationCustomer({
  onSelected,
  onBusyChange,
  disabled = false,
  selectedOrganizationId = '',
  onClear,
}: {
  selectedOrganizationId?: string;
  onClear?: () => void;
  disabled?: boolean;
  onSelected: (person: CustomerSummary) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [organizations, setOrganizations] = useState<MasterDataRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [organizationId, setOrganizationId] = useState(selectedOrganizationId);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      void (async () => {
        const records: MasterDataRecord[] = [];
        for (let page = 1; ; page++) {
          const response = await masterDataApi.list('organizations', {
            search: '',
            status: 'active',
            sortBy: 'name',
            sortDirection: 'asc',
            page,
            pageSize: 100,
          });
          records.push(...response.data);
          if (!response.data.length || records.length >= response.meta.total)
            break;
        }
        const people = await loadOrganizationCustomers();
        if (active) {
          setOrganizations(records);
          setCustomers(people);
        }
      })()
        .catch((reason: unknown) => {
          if (active)
            setError(
              reason instanceof Error
                ? reason.message
                : 'دریافت سازمان‌ها ناموفق بود.',
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [retry]);
  const select = async () => {
    if (inFlight.current || disabled) return;
    const organization = organizations.find(
      (item) => item.id === organizationId,
    );
    if (!organization) return;
    inFlight.current = true;
    setBusy(true);
    onBusyChange(true);
    setError('');
    try {
      const person = await resolveOrganizationCustomer(organization);
      onSelected(person);
      setCustomers((current) => [
        ...current.filter((item) => item.id !== person.id),
        person,
      ]);
    } catch (reason) {
      setError(
        (reason instanceof Error
          ? reason.message
          : 'انتخاب مشتری حقوقی انجام نشد.') +
          ' در خطای اتصال، ابتدا دوباره فهرست را دریافت کنید.',
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  };
  const existing = customers.find(
    (person) =>
      person.organizationId === organizationId &&
      person.status === 'active' &&
      person.roles.includes('customer'),
  );
  return (
    <section
      className="grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
      aria-label="انتخاب مشتری حقوقی یا آژانس"
    >
      <h3 className="font-bold">مشتری حقوقی / آژانس</h3>
      <p className="text-sm text-muted-foreground">
        سازمان یا آژانس ثبت‌شده را جست‌وجو کنید؛ مسافران را جداگانه در پایین
        وارد کنید.
      </p>
      {error ? (
        <Alert tone="error" title="اتصال انجام نشد" description={error} />
      ) : null}
      {loading ? (
        <p role="status">در حال دریافت سازمان‌ها و مشتریان حقوقی…</p>
      ) : (
        <SearchableReference
          label="سازمان / آژانس"
          value={organizationId}
          options={organizations}
          disabled={busy || disabled}
          onChange={(id) => {
            setOrganizationId(id);
            onClear?.();
          }}
        />
      )}
      {!loading && !error && !organizations.length ? (
        <p>سازمان فعالی موجود نیست؛ ابتدا آن را در اطلاعات پایه ثبت کنید.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={
            disabled || loading || busy || !organizationId || Boolean(error)
          }
          loading={busy}
          onClick={() => void select()}
        >
          {existing ? 'انتخاب مشتری حقوقی' : 'ثبت پرونده مشتری حقوقی و انتخاب'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy || loading}
          onClick={() => setRetry((value) => value + 1)}
        >
          دریافت دوباره
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        سازمان جدیدی ساخته نمی‌شود؛ در صورت نبود پرونده مشتری، فقط پرونده حقوقی
        متصل به همین سازمان ثبت می‌شود.
      </p>
    </section>
  );
}
