import { localizedFetch } from '@/i18n/localized-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';
export type CallRecording = { id: string; sizeBytes: number };
export class RecordingError extends Error {
  constructor(readonly status: number) {
    super('Recording unavailable');
  }
}
const uuid = (value: string) => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new RecordingError(404);
  return value;
};
async function request(path: string, branch: string, signal: AbortSignal) {
  const base = getPublicApiBaseUrl();
  if (!base) throw new RecordingError(503);
  const response = await localizedFetch(
    `${base}/integrations/telephony/recordings/calls/${path}`,
    {
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
      signal,
      headers: { 'x-branch-id': branch },
    },
  );
  if (!response.ok) throw new RecordingError(response.status);
  return response;
}
export async function callRecordings(
  callId: string,
  branch: string,
  signal: AbortSignal,
): Promise<CallRecording[]> {
  const response = await request(uuid(callId), branch, signal);
  const payload = (await response.json()) as { data: CallRecording[] };
  if (
    !Array.isArray(payload.data) ||
    payload.data.some(
      (r) =>
        !r ||
        typeof r.id !== 'string' ||
        !Number.isInteger(r.sizeBytes) ||
        r.sizeBytes < 44 ||
        r.sizeBytes > 20971520,
    )
  )
    throw new RecordingError(502);
  payload.data.forEach((r) => uuid(r.id));
  return payload.data;
}
export async function recordingBlob(
  callId: string,
  id: string,
  branch: string,
  signal: AbortSignal,
) {
  const response = await request(
    `${uuid(callId)}/${uuid(id)}/audio`,
    branch,
    signal,
  );
  if (response.headers.get('content-type')?.split(';')[0] !== 'audio/wav')
    throw new RecordingError(502);
  const blob = await response.blob();
  if (blob.size < 44 || blob.size > 20971520) throw new RecordingError(502);
  return blob;
}
