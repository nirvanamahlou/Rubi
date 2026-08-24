'use client';

import type { CustomerSummary } from '@rubi/contracts';
import {
  Ban,
  ExternalLink,
  LogIn,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui/surfaces';
import {
  customerAffairsCustomersApi,
  CustomerLookupApiError,
  CUSTOMER_AFFAIRS_CUSTOMERS_CONTRACT_VERSION,
} from '../api/customers-client';

type LookupState =
  'loading' | 'ready' | 'empty' | 'error' | 'unauthorized' | 'forbidden';

export function CustomerPicker({
  disabled = false,
  onSelect,
  selected,
}: {
  disabled?: boolean;
  onSelect: (customer: CustomerSummary | null) => void;
  selected: CustomerSummary | null;
}) {
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState<readonly CustomerSummary[]>([]);
  const [state, setState] = useState<LookupState>('loading');

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setState('loading');
      try {
        const response = await customerAffairsCustomersApi.search(
          {
            search,
            status: 'active',
            role: 'customer',
            sortBy: 'displayName',
            sortDirection: 'asc',
            page: 1,
            pageSize: 10,
          },
          signal,
        );
        setRecords(response.data);
        setState(response.data.length ? 'ready' : 'empty');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        setRecords([]);
        setState(
          error instanceof CustomerLookupApiError && error.status === 401
            ? 'unauthorized'
            : error instanceof CustomerLookupApiError && error.status === 403
              ? 'forbidden'
              : 'error',
        );
      }
    },
    [search],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  return (
    <section
      aria-labelledby="customer-picker-title"
      className="space-y-3 rounded-2xl border border-border bg-primary/5 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold" id="customer-picker-title">
            انتخاب مشتری موجود از Customer 360
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            اتصال فقط خواندنی از قرارداد عمومی Customers؛ بدون دسترسی مستقیم به
            داده.
          </p>
        </div>
        <Badge>customers.v{CUSTOMER_AFFAIRS_CUSTOMERS_CONTRACT_VERSION}</Badge>
      </div>
      <FormField id="customer-affairs-customer-search" label="جست‌وجوی مشتری">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute end-3 top-3.5 size-4 text-muted-foreground"
          />
          <Input
            className="pe-10"
            disabled={disabled}
            id="customer-affairs-customer-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="نام یا راه تماس ماسک‌شده"
            value={search}
          />
        </div>
      </FormField>
      <div aria-busy={state === 'loading'} aria-live="polite">
        {state === 'loading' ? (
          <div aria-label="در حال جست‌وجوی مشتریان" className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : state === 'unauthorized' ? (
          <EmptyState
            description="نشست معتبر نیست؛ برای جست‌وجوی Customers دوباره وارد شوید."
            icon={LogIn}
            title="نیاز به ورود"
          />
        ) : state === 'forbidden' ? (
          <EmptyState
            description="مجوز customers.read برای این عملیات لازم است."
            icon={Ban}
            title="دسترسی Customers مجاز نیست"
          />
        ) : state === 'error' ? (
          <ErrorState
            action={
              <Button
                onClick={() => void load()}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden="true" className="size-4" />
                تلاش دوباره
              </Button>
            }
            description="اتصال Backend و NEXT_PUBLIC_API_BASE_URL را بررسی کنید."
            title="جست‌وجوی مشتری ناموفق بود"
          />
        ) : state === 'empty' ? (
          <EmptyState
            description="با عبارت فعلی مشتری فعالی پیدا نشد."
            title="نتیجه‌ای وجود ندارد"
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {records.map((customer) => (
              <Card
                className={
                  selected?.id === customer.id
                    ? 'border-primary bg-primary/10 p-3'
                    : 'p-3'
                }
                key={customer.id}
              >
                <div className="flex items-start gap-3">
                  <UserRound
                    aria-hidden="true"
                    className="mt-1 size-5 text-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{customer.displayName}</p>
                    <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                      {customer.maskedPrimaryContact ?? 'بدون تماس'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    aria-pressed={selected?.id === customer.id}
                    disabled={disabled}
                    onClick={() => onSelect(customer)}
                    size="sm"
                    type="button"
                    variant={
                      selected?.id === customer.id ? 'primary' : 'outline'
                    }
                  >
                    انتخاب
                  </Button>
                  <Button asChild size="sm" type="button" variant="ghost">
                    <Link
                      href={`/customer-affairs/customer/${encodeURIComponent(customer.id)}`}
                    >
                      <ExternalLink aria-hidden="true" className="size-4" />
                      Customer 360 / موارد مشابه
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      {selected ? (
        <Alert
          description={`${selected.displayName} · ${selected.maskedPrimaryContact ?? 'بدون تماس'}`}
          title="CustomerReference انتخاب‌شده"
        />
      ) : null}
    </section>
  );
}
