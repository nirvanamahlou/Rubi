import { expect, it, vi } from 'vitest';
import { downloadContractResponse } from './contract-download';
it('recovers an expired session once and retries the same private PDF request', async () => {
  const send = vi
    .fn()
    .mockResolvedValueOnce(new Response('', { status: 401 }))
    .mockResolvedValueOnce(
      new Response('%PDF', { headers: { 'content-type': 'application/pdf' } }),
    );
  const refresh = vi.fn().mockResolvedValue({ user: { id: 'synthetic' } });
  const response = await downloadContractResponse(
    'id',
    send,
    refresh,
    'https://api.test/api/v1',
  );
  expect(response.status).toBe(200);
  expect(send).toHaveBeenCalledTimes(2);
  expect(refresh).toHaveBeenCalledOnce();
  expect(send.mock.calls[1]).toEqual([
    '/sales/contracts/id/pdf',
    { credentials: 'include', cache: 'no-store' },
  ]);
});
it.each([403, 409, 503])(
  'preserves authoritative %s failures without refreshing or bypassing access',
  async (status) => {
    const send = vi.fn().mockResolvedValue(new Response('', { status }));
    const refresh = vi.fn();
    expect(
      (await downloadContractResponse('id', send, refresh, 'https://api.test'))
        .status,
    ).toBe(status);
    expect(send).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
  },
);
