import { authenticatedFetch } from '@/lib/authenticated-fetch';
import type {
  WorkbenchFeedbackCreateInputV1,
  WorkbenchFeedbackCreateResponseV1,
  WorkbenchFeedbackDetailResponseV1,
} from '@nora/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { notifyNotificationFeedChanged } from '@/modules/notifications/api/client';

export class WorkbenchFeedbackApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function sendRequest(
  input: WorkbenchFeedbackCreateInputV1,
): Promise<WorkbenchFeedbackCreateResponseV1> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl)
    throw new WorkbenchFeedbackApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await authenticatedFetch(
    `${baseUrl}/workbench/feedback`,
    baseUrl,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      message?: string;
      error?: { message?: string };
    } | null;
    throw new WorkbenchFeedbackApiError(
      envelope?.error?.message ??
        envelope?.message ??
        'ارسال نظرسنجی انجام نشد.',
      response.status,
    );
  }
  const result = (await response.json()) as WorkbenchFeedbackCreateResponseV1;
  notifyNotificationFeedChanged();
  return result;
}

async function detailRequest(
  id: string,
): Promise<WorkbenchFeedbackDetailResponseV1> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl)
    throw new WorkbenchFeedbackApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await authenticatedFetch(
    `${baseUrl}/workbench/feedback/${encodeURIComponent(id)}`,
    baseUrl,
  );
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      message?: string;
      error?: { message?: string };
    } | null;
    throw new WorkbenchFeedbackApiError(
      envelope?.error?.message ??
        envelope?.message ??
        'دریافت نظرسنجی انجام نشد.',
      response.status,
    );
  }
  return response.json() as Promise<WorkbenchFeedbackDetailResponseV1>;
}

async function uploadAttachmentRequest(input: {
  feedbackId: string;
  subject: string;
  branchId: string;
  anonymous: boolean;
  file: File;
}): Promise<{ data: { id: string } }> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl)
    throw new WorkbenchFeedbackApiError('نشانی API پیکربندی نشده است.', 0);
  const form = new FormData();
  form.set('file', input.file);
  form.set('branchId', input.branchId);
  form.set('subject', input.subject);
  form.set('anonymous', String(input.anonymous));
  const response = await authenticatedFetch(
    `${baseUrl}/workbench/feedback/${encodeURIComponent(input.feedbackId)}/attachments`,
    baseUrl,
    {
      timeoutMs: 120_000,
      method: 'POST',
      headers: { accept: 'application/json' },
      body: form,
    },
  );
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      message?: string;
      error?: { message?: string };
    } | null;
    throw new WorkbenchFeedbackApiError(
      envelope?.error?.message ??
        envelope?.message ??
        'بارگذاری پیوست نظرسنجی انجام نشد.',
      response.status,
    );
  }
  return response.json() as Promise<{ data: { id: string } }>;
}

export async function uploadWorkbenchFeedbackFiles(input: {
  feedbackId: string;
  subject: string;
  branchId: string;
  anonymous: boolean;
  files: readonly File[];
}): Promise<string[]> {
  if (!input.files.length) return [];
  const uploaded: string[] = [];
  for (const file of input.files) {
    const result = await uploadAttachmentRequest({
      feedbackId: input.feedbackId,
      subject: input.subject,
      branchId: input.branchId,
      anonymous: input.anonymous,
      file,
    });
    uploaded.push(result.data.id);
  }
  return uploaded;
}

export const workbenchFeedbackApi = {
  send: sendRequest,
  detail: detailRequest,
};
