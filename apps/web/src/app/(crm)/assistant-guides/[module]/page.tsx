import { notFound } from 'next/navigation';

import { AssistantGuidePage } from '@/modules/assistant/assistant-guide-page';

export default async function Page({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (
    module !== 'sales' &&
    module !== 'workbench' &&
    module !== 'call-center' &&
    module !== 'b2c'
  )
    notFound();
  return <AssistantGuidePage module={module} />;
}
