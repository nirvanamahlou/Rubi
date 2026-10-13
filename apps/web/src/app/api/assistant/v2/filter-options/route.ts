import { proxyAssistantFilterOptions } from '@/modules/assistant/proxy';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  return proxyAssistantFilterOptions(
    request,
    process.env.ASSISTANT_SERVICE_URL,
  );
}
