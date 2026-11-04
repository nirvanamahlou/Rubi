'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type {
  IntegrationRegistryV1,
  IntegrationSystemConfigV1,
} from '@nora/contracts';
import { Cable, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { Alert, Card, EmptyState, Skeleton } from '@/components/ui/surfaces';
import { catalogueSystems } from '../model';
import { isGhestirooSystem } from '../system-connector';
import {
  GhestirooConnection,
  type GhestirooConnectionState,
} from './ghestiroo-connection';
import { GhestirooWorkspace } from './ghestiroo-workspace';
import { NiyayeshData } from './niyayesh-data';
import { SitePresence } from './site-presence';
import { SiteApiConnection } from './site-api-connection';
import styles from './site-connections-workspace.module.css';

type SelectedProps = {
  registry: IntegrationRegistryV1;
  system: IntegrationSystemConfigV1;
  userId: string;
};

export function SiteConnectionsWorkspace({
  registry,
  userId,
}: {
  registry: IntegrationRegistryV1;
  userId: string;
}) {
  const systems = useMemo(
    () => catalogueSystems(registry, undefined, true),
    [registry],
  );
  const [selected, setSelected] = useState('');
  const site =
    systems.find((system) => system.id === selected) ??
    systems.find((system) => isGhestirooSystem(system, registry)) ??
    systems[0];
  if (!site)
    return (
      <EmptyState
        title="سامانه‌ای ثبت نشده است"
        description="فهرست سامانه‌ها را از بخش برندها و سامانه‌ها ایجاد کنید."
      />
    );
  return (
    <section className="grid gap-5" aria-label="مدیریت اتصال سایت‌ها">
      <Card className={styles.siteSelector}>
        <label>
          سایت انتخاب‌شده
          <NativeSearchSelect
            aria-label="انتخاب سایت در اتصال‌ها"
            value={site.id}
            onChange={(event) => setSelected(event.target.value)}
          >
            {systems.map((system) => (
              <option key={system.id} value={system.id}>
                {system.name}
              </option>
            ))}
          </NativeSearchSelect>
        </label>
      </Card>
      <SelectedSiteConnection
        key={`${registry.branchId}:${site.id}`}
        registry={registry}
        system={site}
        userId={userId}
      />
    </section>
  );
}

export function SelectedSiteConnection(props: SelectedProps) {
  return isGhestirooSystem(props.system, props.registry) ? (
    <GhestirooSelectedSite {...props} />
  ) : (
    <NiyayeshSelectedSite {...props} />
  );
}

function NiyayeshSelectedSite(props: SelectedProps) {
  const [revision, setRevision] = useState(0);
  return (
    <SiteConnectionLayout
      {...props}
      revision={revision}
      api={
        <SiteApiConnection
          branchId={props.registry.branchId}
          system={props.system}
          onSaved={() => setRevision((value) => value + 1)}
        />
      }
      services={
        <NiyayeshData
          key={`${props.system.id}:${revision}`}
          branchId={props.registry.branchId}
          expectedSystemId={props.system.id}
          servicesOnly
        />
      }
    />
  );
}

function SiteConnectionLayout({
  registry,
  system,
  api,
  services,
  revision = 0,
}: SelectedProps & { api: ReactNode; services: ReactNode; revision?: number }) {
  return (
    <div className="grid gap-5" aria-label={`اتصال و خدمات ${system.name}`}>
      <details
        className={styles.apiDisclosure}
        aria-label={`تنظیمات API ${system.name}`}
      >
        <summary>
          <span>
            <Cable aria-hidden="true" className="size-5" />
            تنظیمات API {system.name}
          </span>
          <ChevronDown aria-hidden="true" className={styles.chevron} />
        </summary>
        <div className={styles.apiBody}>{api}</div>
      </details>
      <section aria-label={`نمودار حضور زنده ${system.name}`}>
        <SitePresence
          key={`${registry.branchId}:${system.id}:${revision}`}
          branchId={registry.branchId}
          siteId={system.id}
          siteName={system.name}
          connector={
            isGhestirooSystem(system, registry) ? 'ghestiroo' : 'niyayesh'
          }
        />
      </section>
      <Card
        className="grid gap-4 p-5"
        aria-label={`مدیریت خدمات ${system.name}`}
      >
        <h2 className="text-lg font-bold">مدیریت خدمات {system.name}</h2>
        {services}
      </Card>
    </div>
  );
}

function GhestirooSelectedSite(props: SelectedProps) {
  const [connection, setConnection] = useState<GhestirooConnectionState>({
    status: null,
    loading: true,
    error: '',
  });
  const [retry, setRetry] = useState(0);
  const status = connection.status;
  const services = !status ? (
    connection.loading ? (
      <Skeleton className="h-24" />
    ) : (
      <>
        <Alert
          title="خواندن اتصال انجام نشد"
          description={connection.error}
          tone="error"
        />
        <Button
          variant="outline"
          onClick={() => setRetry((value) => value + 1)}
        >
          تلاش دوباره
        </Button>
      </>
    )
  ) : status.configured && status.scopes?.includes('catalog') ? (
    <GhestirooWorkspace
      key={`${props.registry.branchId}:${status.version}`}
      branchId={props.registry.branchId}
      embedded
    />
  ) : (
    <EmptyState
      title="خدمات این سایت در دسترس نیست"
      description={
        status.configured
          ? 'مجوز کاتالوگ این سایت برای حساب شما فعال نیست.'
          : 'اتصال API این سایت هنوز تنظیم نشده است.'
      }
    />
  );
  return (
    <SiteConnectionLayout
      {...props}
      revision={status?.version ?? 0}
      api={
        <GhestirooConnection
          key={retry}
          branchId={props.registry.branchId}
          userId={props.userId}
          onStateChange={setConnection}
        />
      }
      services={services}
    />
  );
}
