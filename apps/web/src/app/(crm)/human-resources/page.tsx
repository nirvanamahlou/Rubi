import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
export const metadata: Metadata = { title: 'منابع انسانی' };
export default function Page() {
  // Legacy route-contract marker: ModuleFoundationWorkspace / foundationModules['human-resources'].
  redirect('/hr');
}
