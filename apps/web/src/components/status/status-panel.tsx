'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, RefreshCw, Server, WifiOff } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Alert,
  Badge,
  Card,
  ErrorState,
  PageHeader,
  Skeleton,
} from '@/components/ui/surfaces';
import { getHealthEndpoint } from '@/lib/environment';
import { faMessages } from '@/messages/fa';

async function checkApi(signal: AbortSignal) {
  const endpoint = getHealthEndpoint();
  if (!endpoint) throw new Error(faMessages.status.notConfigured);
  const response = await fetch(endpoint, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`API health returned ${response.status}`);
  return { checkedAt: new Date().toISOString() };
}

export function StatusPanel() {
  const endpoint = getHealthEndpoint();
  const query = useQuery({
    queryKey: ['api-health', endpoint],
    queryFn: ({ signal }) => checkApi(signal),
    enabled: Boolean(endpoint),
    retry: false,
  });
  const apiReady = query.isSuccess;
  const isChecking = query.isFetching;
  const lastChecked = query.data?.checkedAt
    ? new Intl.DateTimeFormat('fa-IR', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format(new Date(query.data.checkedAt))
    : faMessages.status.neverChecked;

  return (
    <main
      className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 sm:py-14"
      id="main-content"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link className="flex items-center gap-3" href="/dashboard">
            <span className="grid size-11 place-items-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">
              ر
            </span>
            <span className="font-black">{faMessages.brand.name}</span>
          </Link>
          <Button
            onClick={() => void query.refetch()}
            disabled={!endpoint || isChecking}
            variant="outline"
          >
            <RefreshCw
              aria-hidden="true"
              className={isChecking ? 'size-4 animate-spin' : 'size-4'}
            />
            {faMessages.common.retry}
          </Button>
        </div>
        <PageHeader
          description={faMessages.status.description}
          title={faMessages.status.title}
        />
        {!endpoint ? (
          <Alert
            description={faMessages.status.notConfigured}
            title="پیکربندی API"
            tone="warning"
          />
        ) : null}
        <section className="grid gap-4 md:grid-cols-2" aria-live="polite">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <span className="grid size-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 aria-hidden="true" className="size-5" />
              </span>
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                {faMessages.status.operational}
              </Badge>
            </div>
            <h2 className="mt-5 font-bold">{faMessages.status.web}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Next.js Web App
            </p>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <span
                className={`grid size-11 place-items-center rounded-2xl ${apiReady ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}
              >
                {apiReady ? (
                  <Server aria-hidden="true" className="size-5" />
                ) : (
                  <WifiOff aria-hidden="true" className="size-5" />
                )}
              </span>
              <Badge>
                {isChecking
                  ? faMessages.status.checking
                  : apiReady
                    ? faMessages.status.operational
                    : faMessages.status.offline}
              </Badge>
            </div>
            <h2 className="mt-5 font-bold">{faMessages.status.api}</h2>
            {isChecking ? (
              <Skeleton className="mt-3 h-4 w-40" />
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {apiReady
                  ? 'Health endpoint پاسخ موفق داد.'
                  : (query.error?.message ?? faMessages.status.notConfigured)}
              </p>
            )}
          </Card>
        </section>
        {query.isError ? (
          <ErrorState
            action={
              <Button onClick={() => void query.refetch()} variant="outline">
                {faMessages.common.retry}
              </Button>
            }
            description="اتصال شبکه، اجرای API و مقدار Environment Variable را بررسی کنید."
            title={faMessages.status.offline}
          />
        ) : null}
        <Card className="p-5">
          <dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="font-semibold">{faMessages.status.lastChecked}</dt>
            <dd className="text-muted-foreground">{lastChecked}</dd>
            <dt className="font-semibold">Health endpoint</dt>
            <dd
              className="break-all font-mono text-xs text-muted-foreground"
              dir="ltr"
            >
              {endpoint ?? faMessages.common.unavailable}
            </dd>
          </dl>
        </Card>
      </div>
    </main>
  );
}
