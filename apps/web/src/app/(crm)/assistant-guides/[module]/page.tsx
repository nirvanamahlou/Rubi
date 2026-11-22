import { notFound } from 'next/navigation';

import { isAssistantGuideModule } from '@/modules/assistant/assistant-guide-registry';
import { AssistantGuidePage } from '@/modules/assistant/assistant-guide-page';

export default async function Page({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (!isAssistantGuideModule(module)) notFound();
  return <AssistantGuidePage module={module} />;
}
