import type { Metadata } from 'next';

import { Customer360View } from '@/modules/customer-affairs/components/customer-360-view';

export const metadata: Metadata = {
  title: 'Customer 360 | امور مشتریان',
};

export default async function CustomerAffairsCustomerPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  return <Customer360View customerId={customerId} />;
}
