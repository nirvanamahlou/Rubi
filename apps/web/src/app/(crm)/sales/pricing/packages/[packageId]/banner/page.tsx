import type { Metadata } from 'next';
import { PackageBannerWorkspace } from '@/modules/pricing-management/components/package-banner-workspace';

export const metadata: Metadata = { title: 'ساخت بنر پکیج' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ packageId: string }>;
  searchParams: Promise<{
    batchId?: string | string[];
    publicationId?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  const [{ packageId }, query] = await Promise.all([params, searchParams]);
  return (
    <PackageBannerWorkspace
      batchId={typeof query.batchId === 'string' ? query.batchId : undefined}
      packageId={packageId}
      publicationId={
        typeof query.publicationId === 'string'
          ? query.publicationId
          : undefined
      }
      returnTo={typeof query.returnTo === 'string' ? query.returnTo : undefined}
    />
  );
}
