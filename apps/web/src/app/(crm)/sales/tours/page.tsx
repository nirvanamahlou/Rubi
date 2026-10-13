import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { TourWorkspace } from '@/modules/ticket-catalog/components/tour-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'تعریف تور و خدمات' });
}

export default function Page() {
  return <TourWorkspace mode="definition" />;
}
