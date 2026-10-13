import { proxyAssistantConversation } from '@/modules/assistant/proxy';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return proxyAssistantConversation(request, process.env.ASSISTANT_SERVICE_URL);
}
