import { proxyAssistantConversation } from '@/modules/assistant/proxy';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 65;
export async function POST(request: Request) {
  if (process.env.ASSISTANT_AGENT_ENABLED !== 'true')
    return Response.json(
      { error: { code: 'AGENT_DISABLED' } },
      { status: 503, headers: { 'cache-control': 'private, no-store' } },
    );
  return proxyAssistantConversation(
    request,
    process.env.ASSISTANT_SERVICE_URL,
    fetch,
    true,
  );
}
