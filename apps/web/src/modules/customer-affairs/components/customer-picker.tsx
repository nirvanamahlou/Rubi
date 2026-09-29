'use client';

import type { CustomerSummary } from '@nora/contracts';
import {
  Ban,
  ExternalLink,
  LogIn,
  Plus,
  RefreshCw,
  Search,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

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
} from '../api/customers-client';
import {
  customerPickerPagination,
  customerPickerVisibleRecords,
} from './customer-picker-pagination';

const CustomerCreateDialog = dynamic(
  () =>
    import('@/modules/customers/public/entry').then(
      (module) => module.CustomerCreateDialog,
    ),
  {
    ssr: false,
    loading: () => <p role="status">در حال آماده‌سازی فرم مشتری…</p>,
  },
);

type LookupState =
  'loading' | 'ready' | 'empty' | 'error' | 'unauthorized' | 'forbidden';

export function CustomerPicker({
  disabled = false,
  onSelect,
  selected,
  initialCustomerId,
}: {
  disabled?: boolean;
  onSelect: (customer: CustomerSummary | null) => void;
  selected: CustomerSummary | null;
  initialCustomerId?: string | null;
}) {
  const id = useId();
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [retry, setRetry] = useState(0);
  const [current, setCurrent] = useState<CustomerSummary | null>(null);
  const [currentError, setCurrentError] = useState(false);
  const [records, setRecords] = useState<readonly CustomerSummary[]>([]);
  const [state, setState] = useState<LookupState>('loading');
  const [creating, setCreating] = useState(false);
  const pagination = useMemo(
    () => customerPickerPagination(search, page),
    [search, page],
  );
  const chosen =
    selected ?? (current?.id === initialCustomerId ? current : null);

  useEffect(() => {
    if (!initialCustomerId) return;
    const controller = new AbortController();
    void customerAffairsCustomersApi
      .detail(initialCustomerId, controller.signal)
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setCurrent(data);
        setCurrentError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCurrentError(true);
      });
    return () => controller.abort();
  }, [initialCustomerId, retry]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setState('loading');
      try {
        const response = await customerAffairsCustomersApi.search(
          {
            search,
            status: 'active',
            role: 'all',
            sortBy: 'displayName',
            sortDirection: 'asc',
            page: pagination.requestPage,
            pageSize: pagination.requestPageSize,
          },
          signal,
        );
        if (signal?.aborted) return;
        const visibleRecords = customerPickerVisibleRecords(
          response.data,
          pagination,
        );
        setRecords(visibleRecords);
        setTotal(response.meta.total);
        setState(visibleRecords.length ? 'ready' : 'empty');
      } catch (error) {
        if (signal?.aborted) return;
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
    [search, pagination],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => void load(controller.signal),
      search.trim() ? 300 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, retry, search]);

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="space-y-3 rounded-2xl border border-border bg-primary/5 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-bold" id={`${id}-title`}>
            انتخاب از مشتریان و مسافران
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            مشتری یا مسافر ثبت‌شده را انتخاب کنید یا پروندهٔ تازه بسازید.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={disabled}
            onClick={() => setCreating(true)}
            permission="customers.create"
            ref={createButtonRef}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus aria-hidden="true" className="size-4" />
            ثبت مشتری یا مسافر جدید
          </Button>
          <a
            href="/customers"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline"
          >
            بازکردن مشتریان و مسافران
          </a>
        </div>
      </div>
      <FormField id={`${id}-search`} label="جست‌وجوی مشتری یا مسافر">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="absolute end-3 top-3.5 size-4 text-muted-foreground"
          />
          <Input
            className="pe-10"
            disabled={disabled}
            id={`${id}-search`}
            maxLength={100}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
              setState('loading');
            }}
            placeholder="نام مشتری یا مسافر"
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
            description="نشست معتبر نیست؛ برای جست‌وجوی مشتریان دوباره وارد شوید."
            icon={LogIn}
            title="نیاز به ورود"
          />
        ) : state === 'forbidden' ? (
          <EmptyState
            description="مجوز customers.read برای این عملیات لازم است."
            icon={Ban}
            title="دسترسی به مشتریان و مسافران مجاز نیست"
          />
        ) : state === 'error' ? (
          <ErrorState
            action={
              <Button
                onClick={() => setRetry((value) => value + 1)}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCw aria-hidden="true" className="size-4" />
                تلاش دوباره
              </Button>
            }
            description="فهرست مشتریان دریافت نشد؛ دوباره تلاش کنید. انتخاب قبلی حفظ می‌شود."
            title="جست‌وجوی مشتری ناموفق بود"
          />
        ) : state === 'empty' ? (
          <EmptyState
            description={
              search.trim()
                ? 'با عبارت فعلی مشتری یا مسافر فعالی پیدا نشد.'
                : 'مشتری یا مسافر فعالی برای نمایش وجود ندارد.'
            }
            title="نتیجه‌ای وجود ندارد"
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {records.map((customer) => (
              <Card
                className={
                  chosen?.id === customer.id
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
                    <Badge>
                      {customer.roles
                        .map((role) =>
                          role === 'passenger' ? 'مسافر' : 'مشتری',
                        )
                        .join(' / ')}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                      {customer.maskedPrimaryContact ?? 'بدون تماس'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    aria-pressed={chosen?.id === customer.id}
                    aria-label={`انتخاب ${customer.displayName}`}
                    disabled={disabled}
                    onClick={() => onSelect(customer)}
                    size="sm"
                    type="button"
                    variant={chosen?.id === customer.id ? 'primary' : 'outline'}
                  >
                    انتخاب
                  </Button>
                  <Button asChild size="sm" type="button" variant="ghost">
                    <Link
                      href={`/customers?customerId=${encodeURIComponent(customer.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink aria-hidden="true" className="size-4" />
                      پرونده مشتری / مسافر
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || state === 'loading' || page === 1}
          onClick={() => {
            setPage((value) => value - 1);
            setState('loading');
          }}
        >
          قبلی
        </Button>
        <span className="text-xs text-muted-foreground">
          صفحه {page.toLocaleString('fa-IR')} · {total.toLocaleString('fa-IR')}{' '}
          نتیجه
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={
            disabled ||
            state !== 'ready' ||
            page * pagination.displayPageSize >= total
          }
          onClick={() => {
            setPage((value) => value + 1);
            setState('loading');
          }}
        >
          بعدی
        </Button>
      </div>
      {chosen ? (
        <Alert
          description={`${chosen.displayName} · ${chosen.maskedPrimaryContact ?? 'بدون تماس'}`}
          title="مشتری / مسافر انتخاب‌شده"
        />
      ) : null}
      {initialCustomerId && !chosen && (
        <p role="status" className="text-sm">
          {currentError
            ? 'نام مشتری فعلی دریافت نشد؛ اتصال فعلی بدون تغییر حفظ می‌شود.'
            : 'در حال دریافت نام مشتری فعلی…'}{' '}
          <a
            className="text-primary underline"
            href={`/customers?customerId=${encodeURIComponent(initialCustomerId)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            مشاهده پرونده فعلی
          </a>
          {currentError && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRetry((value) => value + 1)}
            >
              تلاش دوباره
            </Button>
          )}
        </p>
      )}
      {creating ? (
        <CustomerCreateDialog
          onClose={() => setCreating(false)}
          returnFocusRef={createButtonRef}
          onCreated={(customer) => {
            onSelect(customer);
            setCreating(false);
            setSearch(customer.displayName.slice(0, 100));
            setPage(1);
            setState('loading');
            setRetry((value) => value + 1);
          }}
        />
      ) : null}
    </section>
  );
}
