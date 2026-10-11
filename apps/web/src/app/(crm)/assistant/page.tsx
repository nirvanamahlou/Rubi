import type { Metadata } from 'next';
import { localizedMetadata } from '@/i18n/metadata';
import { ExecutiveWorkspace } from '@/modules/assistant/executive-workspace';
import { assistantView } from '@/modules/assistant/model';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: 'دستیار هوشمند مدیرعامل' });
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <ExecutiveWorkspace view={assistantView(params.view)} />;
}
