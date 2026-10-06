'use client';

import { useQuery } from '@tanstack/react-query';
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
  return record.data ? (
    <MasterDataLogoImage
      record={record.data.data}
      className="size-10 shrink-0"
    />
  ) : null;
}
