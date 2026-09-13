import type {
  WorkbenchFeedbackCreateInputV1,
  WorkbenchFeedbackCreateResponseV1,
  WorkbenchFeedbackDetailResponseV1,
} from '@rubi/contracts';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { documentsApi } from '@/modules/documents/api/client';
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
  retriedAfterRefresh = false,
): Promise<WorkbenchFeedbackCreateResponseV1> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl)
    throw new WorkbenchFeedbackApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await fetch(`${baseUrl}/workbench/feedback`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (
    response.status === 401 &&
    !retriedAfterRefresh &&
    (await refreshAuthenticatedSession(baseUrl))
  ) {
    return sendRequest(input, true);
  }
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
  retriedAfterRefresh = false,
): Promise<WorkbenchFeedbackDetailResponseV1> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl)
    throw new WorkbenchFeedbackApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await fetch(
    `${baseUrl}/workbench/feedback/${encodeURIComponent(id)}`,
    { credentials: 'include', cache: 'no-store' },
  );
  if (
    response.status === 401 &&
    !retriedAfterRefresh &&
    (await refreshAuthenticatedSession(baseUrl))
  ) {
    return detailRequest(id, true);
  }
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

function mimeType(file: File): string {
  if (/\.pdf$/i.test(file.name)) return 'application/pdf';
  if (/\.png$/i.test(file.name)) return 'image/png';
  if (/\.jpe?g$/i.test(file.name)) return 'image/jpeg';
  return file.type;
}

export async function uploadWorkbenchFeedbackFiles(input: {
  feedbackId: string;
  subject: string;
  branchId: string;
  anonymous: boolean;
  files: readonly File[];
}): Promise<string[]> {
  if (!input.files.length) return [];
  const options = (await documentsApi.options()).data;
  if (!options.branches.some(({ id }) => id === input.branchId)) {
    throw new WorkbenchFeedbackApiError(
      'شعبه انتخاب‌شده برای بارگذاری فایل در دسترس نیست.',
      403,
    );
  }
  const category = options.categories[0];
  if (!category) {
    throw new WorkbenchFeedbackApiError(
      'دسته‌بندی فعال برای ذخیره فایل پیدا نشد.',
      409,
    );
  }
  const uploaded: string[] = [];
  for (const file of input.files) {
    const detected = mimeType(file);
    const documentType = options.documentTypes.find(
      (candidate) =>
        candidate.domain === 'GENERAL' &&
        !candidate.requiresExpiry &&
        candidate.allowedMimeTypes.includes(detected) &&
        file.size <= candidate.maxFileSizeBytes,
    );
    if (!documentType) {
      throw new WorkbenchFeedbackApiError(
        `نوع سند مناسب برای فایل «${file.name}» پیدا نشد.`,
        409,
      );
    }
    const form = new FormData();
    form.set('file', file);
    form.set('title', `پیوست نظرسنجی: ${input.subject}`.slice(0, 240));
    form.set('description', 'پیوست ثبت‌شده از بخش نظرسنجی میزکار');
    form.set('documentTypeId', documentType.id);
    form.set('categoryId', category.id);
    form.set('branchId', input.branchId);
    form.set('ownerUserId', options.currentUserId);
    form.set('sourceModule', 'WORKBENCH');
    form.set('sourceEntityType', 'WorkbenchFeedback');
    form.set('sourceEntityId', input.feedbackId);
    form.set('sourceDisplayLabel', input.subject.slice(0, 240));
    form.set('confidentiality', input.anonymous ? 'RESTRICTED' : 'INTERNAL');
    const result = await documentsApi.upload(form);
    uploaded.push(result.data.id);
  }
  return uploaded;
}

export const workbenchFeedbackApi = {
  send: sendRequest,
  detail: detailRequest,
};
