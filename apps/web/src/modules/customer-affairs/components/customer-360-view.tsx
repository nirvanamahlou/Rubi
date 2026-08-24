'use client';

import type { CustomerDetail } from '@rubi/contracts';
import {
  ArrowRight,
  Ban,
  LogIn,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
} from '@/components/ui/surfaces';
import {
  customerAffairsCustomersApi,
  CustomerLookupApiError,
} from '../api/customers-client';

type DetailState =
  'loading' | 'ready' | 'empty' | 'error' | 'unauthorized' | 'forbidden';

export function Customer360View({ customerId }: { customerId: string }) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [state, setState] = useState<DetailState>('loading');

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await customerAffairsCustomersApi.detail(
          customerId,
          signal,
        );
        setCustomer(response.data);
        setState(response.data ? 'ready' : 'empty');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        setCustomer(null);
        setState(
          error instanceof CustomerLookupApiError && error.status === 401
            ? 'unauthorized'
            : error instanceof CustomerLookupApiError && error.status === 403
              ? 'forbidden'
              : error instanceof CustomerLookupApiError && error.status === 404
                ? 'empty'
                : 'error',
        );
      }
    },
    [customerId],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  return (
    <main className="space-y-5" dir="rtl">
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link href="/customer-affairs">
              <ArrowRight aria-hidden="true" className="size-4" />
              بازگشت به امور مشتریان
            </Link>
          </Button>
        }
        description="نمای فقط خواندنی از قرارداد عمومی Customers؛ بدون import از ماژول داخلی Customers یا Prisma."
        eyebrow="Customer 360 · قرارداد عمومی"
        title="نمای مشتری انتخاب‌شده"
      />
      {state === 'loading' ? (
        <Card aria-busy="true" className="space-y-3 p-5">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </Card>
      ) : state === 'unauthorized' ? (
        <EmptyState
          description="نشست معتبر برای مشاهده Customer 360 وجود ندارد."
          icon={LogIn}
          title="نیاز به ورود"
        />
      ) : state === 'forbidden' ? (
        <EmptyState
          description="مجوز customers.read برای مشاهده این مشتری لازم است."
          icon={Ban}
          title="دسترسی مجاز نیست"
        />
      ) : state === 'empty' ? (
        <EmptyState
          description="مشتری پیدا نشد یا خارج از Branch Scope است."
          title="مشتری در دسترس نیست"
        />
      ) : state === 'error' ? (
        <ErrorState
          action={
            <Button
              onClick={() => {
                setState('loading');
                void load();
              }}
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              تلاش دوباره
            </Button>
          }
          description="اتصال Backend یا Session را بررسی کنید."
          title="دریافت Customer 360 ناموفق بود"
        />
      ) : customer ? (
        <>
          <Alert
            description="فقط داده عمومی و راه تماس ماسک‌شده نمایش داده می‌شود و هیچ Mutation اجرا نمی‌شود."
            title="دسترسی read-only و Permission-aware"
          />
          <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
            <Card className="p-5">
              <div className="flex items-start gap-4">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <UserRound aria-hidden="true" className="size-6" />
                </span>
                <div>
                  <h2 className="text-xl font-black">{customer.displayName}</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {customer.roles.map((role) => (
                      <Badge key={role}>
                        {role === 'customer' ? 'مشتری' : 'همراه'}
                      </Badge>
                    ))}
                    <Badge>
                      {customer.status === 'active' ? 'فعال' : 'غیرفعال'}
                    </Badge>
                  </div>
                </div>
              </div>
              <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-muted/40 p-3">
                  <dt className="text-xs text-muted-foreground">
                    راه تماس اصلی
                  </dt>
                  <dd className="mt-1 font-medium" dir="ltr">
                    {customer.maskedPrimaryContact ?? 'ثبت نشده'}
                  </dd>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <dt className="text-xs text-muted-foreground">
                    وضعیت رضایت‌نامه
                  </dt>
                  <dd className="mt-1 font-medium">
                    {customer.currentConsentStatus}
                  </dd>
                </div>
              </dl>
            </Card>
            <Card className="p-5">
              <h2 className="flex items-center gap-2 font-bold">
                <ShieldCheck
                  aria-hidden="true"
                  className="size-5 text-primary"
                />
                خلاصه مجاز Customer 360
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                {customer.contacts.length.toLocaleString('fa-IR')} تماس،{' '}
                {customer.addresses.length.toLocaleString('fa-IR')} نشانی و{' '}
                {customer.companions.length.toLocaleString('fa-IR')} همراه ثبت
                شده است.
              </p>
              <p
                className="mt-3 break-all font-mono text-xs text-muted-foreground"
                dir="ltr"
              >
                {customer.id}
              </p>
            </Card>
          </section>
        </>
      ) : null}
    </main>
  );
}
