'use client';

import { useRef, useState } from 'react';
import type {
  IntegrationRegistryV1,
  IntegrationSystemConfigV1,
} from '@nora/contracts';
import { Activity, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { SitePresence } from './site-presence';
import { isGhestirooSystem } from '../system-connector';
import styles from './brands-dashboard.module.css';

export function SiteTrackingDialog({
  registry,
  systems,
}: {
  registry: IntegrationRegistryV1;
  systems: readonly IntegrationSystemConfigV1[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [revision, setRevision] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const site =
    systems.find((system) => system.id === selected) ??
    systems.find((system) => isGhestirooSystem(system, registry)) ??
    systems[0];
  function selector(label: string) {
    return (
      <NativeSearchSelect
        aria-label={label}
        value={site?.id ?? ''}
        disabled={!systems.length}
        onChange={(event) => setSelected(event.target.value)}
      >
        {systems.map((system) => (
          <option key={system.id} value={system.id}>
            {system.name}
          </option>
        ))}
      </NativeSearchSelect>
    );
  }
  return (
    <>
      <div className={styles.trackingLauncher}>
        <label className={styles.sitePicker}>
          حضور زنده سایت‌ها{selector('سایت حضور زنده')}
        </label>
        <Button
          ref={trigger}
          size="sm"
          variant="outline"
          disabled={!site}
          onClick={() => setOpen(true)}
        >
          <Activity className="size-4" />
          نمایش حضور زنده
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          dir="rtl"
          className={styles.trackingModal}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogTitle className="px-6 text-lg font-semibold">
            حضور زنده سایت‌ها
          </DialogTitle>
          <DialogDescription className="sr-only">
            حضور مرورگرها در بخش‌های سایت · مستقل از بازهٔ گزارش
          </DialogDescription>
          <div className={styles.trackingToolbar}>
            <label className={styles.sitePicker}>
              سایت{selector('سایت در نقشه حضور زنده')}
            </label>
            <Button
              size="sm"
              variant="outline"
              aria-label="به‌روزرسانی حضور زنده"
              onClick={() => setRevision((value) => value + 1)}
            >
              <RefreshCw className="size-4" />
              به‌روزرسانی
            </Button>
          </div>
          <div className={styles.trackingBody}>
            {open && site ? (
              <SitePresence
                key={`${registry.branchId}:${site.id}:${revision}`}
                branchId={registry.branchId}
                siteId={site.id}
                siteName={site.name}
                embedded
                connector={
                  isGhestirooSystem(site, registry) ? 'ghestiroo' : 'niyayesh'
                }
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
