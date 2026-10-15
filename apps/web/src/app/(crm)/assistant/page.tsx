import { redirect } from 'next/navigation';
import { assistantView } from '@/modules/assistant/model';
import { assistantDashboardHref } from '@/modules/assistant/dashboard-location';

/** Preserve existing bookmarks while the complete workspace lives in Dashboard. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirect(assistantDashboardHref(assistantView(params.view)));
}
