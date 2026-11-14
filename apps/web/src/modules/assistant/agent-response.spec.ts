import { describe, expect, it } from 'vitest';
import { agentResponseSchema } from './agent-response';
import { proxyAssistantConversation } from './proxy';
const value = {
  version: 3,
  status: 'ANSWER',
  text: '100.0000 USD',
  plan: ['Read contracts'],
  sources: [
    {
      resultId: '12345678-1234-4234-8234-123456789abc',
      sources: ['amounts'],
      observedAt: '2026-11-14T10:00:00.000Z',
      truncated: false,
    },
  ],
  limitations: [],
  requestId: '12345678-1234-4234-8234-123456789abc',
};
describe('v3 assistant consumer boundary', () => {
  it('requires bounded source-backed answers and rejects private source names', () => {
    expect(agentResponseSchema.safeParse(value).success).toBe(true);
    expect(
      agentResponseSchema.safeParse({ ...value, sources: [] }).success,
    ).toBe(false);
    expect(
      agentResponseSchema.safeParse({
        ...value,
        sources: [{ ...value.sources[0], sources: ['iam_users'] }],
      }).success,
    ).toBe(false);
  });
  it('uses the v3 path and isolates the extended deadline to this proxy', async () => {
    let target = '';
    const request = new Request(
      'http://localhost/api/assistant/v3/conversation',
      {
        method: 'POST',
        headers: {
          origin: 'http://localhost',
          cookie: 'nora_access=synthetic',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ version: 1, message: 'فروش؟', history: [] }),
      },
    );
    const response = await proxyAssistantConversation(
      request,
      'http://127.0.0.1:4300',
      async (url, options) => {
        target = String(url);
        expect(options?.redirect).toBe('error');
        return Response.json(value);
      },
      true,
    );
    expect(response.status).toBe(200);
    expect(target).toBe('http://127.0.0.1:4300/v3/assistant/conversation');
  });
});
