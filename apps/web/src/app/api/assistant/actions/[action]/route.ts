import { proxyAssistantAction } from '@/modules/assistant/proxy';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  const { action } = await context.params;
  return proxyAssistantAction(
    request,
    process.env.ASSISTANT_SERVICE_URL,
    action,
  );
}
