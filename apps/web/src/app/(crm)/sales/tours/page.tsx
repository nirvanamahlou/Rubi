import type { Metadata } from 'next';
import { TourWorkspace } from '@/modules/ticket-catalog/components/tour-workspace';

export const metadata: Metadata = { title: 'تعریف تور و خدمات' };

export default function Page() {
  return <TourWorkspace mode="definition" />;
}
