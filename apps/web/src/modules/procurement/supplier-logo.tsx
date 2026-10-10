'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { masterDataApi } from '@/modules/master-data/api/client';
import { MasterDataLogoImage } from '@/modules/master-data/components/master-data-logo-image';

/** Reuses the owner's authenticated logo preview and document scan checks. */
export function ProcurementSupplierLogo({ id }: { id: string }) {
  const record = useQuery({
    queryKey: ['procurement', 'supplier-profile', id],
    queryFn: () => masterDataApi.detail('suppliers', id),
    staleTime: 60_000,
    retry: false,
  });
  return (
    <span
      className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted/60 text-muted-foreground"
      aria-label="لوگوی تأمین‌کننده"
      role="img"
    >
      <Building2 aria-hidden="true" className="size-5" />
      {record.data ? (
        <span className="absolute inset-0">
          <MasterDataLogoImage
            record={record.data.data}
            className="size-10 rounded-lg bg-surface object-contain"
          />
        </span>
      ) : null}
    </span>
  );
}
