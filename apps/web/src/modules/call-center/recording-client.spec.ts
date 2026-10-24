import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callRecordings, recordingBlob } from './recording-client';
const transport = vi.hoisted(() => vi.fn());
vi.mock('@/i18n/localized-fetch', () => ({ localizedFetch: transport }));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:4000/api/v1',
}));
const call = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const signal = new AbortController().signal;
beforeEach(() => vi.clearAllMocks());
describe('call recording downloads', () => {
  it('uses an authenticated call-scoped URL and returns actual audio bytes', async () => {
    const audio = new Uint8Array(44);
    audio.set([82, 73, 70, 70]);
    transport.mockResolvedValue(
      new Response(audio, { headers: { 'content-type': 'audio/wav' } }),
    );
    const blob = await recordingBlob(call, id, 'branch', signal);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(audio);
    expect(transport).toHaveBeenCalledWith(
      `http://localhost:4000/api/v1/integrations/telephony/recordings/calls/${call}/${id}/audio`,
      expect.objectContaining({
        credentials: 'include',
        cache: 'no-store',
        redirect: 'error',
        signal,
        headers: { 'x-branch-id': 'branch' },
      }),
    );
  });
  it('handles empty and multiple recordings without inventing provider URLs', async () => {
    transport.mockResolvedValueOnce(new Response('{"data":[]}'));
    expect(await callRecordings(call, 'branch', signal)).toEqual([]);
    const data = [
      { id, sizeBytes: 44 },
      { id: call, sizeBytes: 88 },
    ];
    transport.mockResolvedValueOnce(new Response(JSON.stringify({ data })));
    expect(await callRecordings(call, 'branch', signal)).toEqual(data);
  });
  it.each([401, 403, 404, 429, 500])(
    'propagates status %s without downloading an error document',
    async (status) => {
      transport.mockResolvedValue(new Response('private error', { status }));
      await expect(
        recordingBlob(call, id, 'branch', signal),
      ).rejects.toMatchObject({ status });
    },
  );
  it('rejects foreign URLs, invalid media and malformed manifests', async () => {
    await expect(
      recordingBlob(call, 'https://pbx/private.wav', 'branch', signal),
    ).rejects.toMatchObject({ status: 404 });
    expect(transport).not.toHaveBeenCalled();
    transport.mockResolvedValue(
      new Response('<html>login</html>', {
        headers: { 'content-type': 'text/html' },
      }),
    );
    await expect(
      recordingBlob(call, id, 'branch', signal),
    ).rejects.toMatchObject({ status: 502 });
    transport.mockResolvedValue(
      new Response('{"data":[{"id":"bad","sizeBytes":44}]}'),
    );
    await expect(callRecordings(call, 'branch', signal)).rejects.toMatchObject({
      status: 404,
    });
  });
});
