import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'منابع انسانی' });
}
export default function Page() {
  // Legacy route-contract marker: ModuleFoundationWorkspace / foundationModules['human-resources'].
  redirect('/hr');
}
