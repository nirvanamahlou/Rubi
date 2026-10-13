import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';

import { StatusPanel } from '@/components/status/status-panel';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'وضعیت سرویس‌ها' });
}

export default function StatusPage() {
  return <StatusPanel />;
}
