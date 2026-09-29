import { documentsApi } from '@/modules/documents/api/client';

function mimeType(file: File): string {
  if (/\.pdf$/i.test(file.name)) return 'application/pdf';
  if (/\.png$/i.test(file.name)) return 'image/png';
  if (/\.webp$/i.test(file.name)) return 'image/webp';
  if (/\.jpe?g$/i.test(file.name)) return 'image/jpeg';
  return file.type;
}

export async function uploadWorkbenchAttachments(input: {
  entityType: 'MessagingMessage' | 'WorkbenchCalendarEvent' | 'IamProfile';
  entityId: string;
  title: string;
  description: string;
  branchId: string;
  files: readonly File[];
  confidentiality?: 'INTERNAL' | 'RESTRICTED';
}): Promise<string[]> {
  if (!input.files.length) return [];
  const options = (await documentsApi.options()).data;
  if (!options.branches.some(({ id }) => id === input.branchId))
    throw new Error('شعبه پیوست در محدوده دسترسی شما نیست.');
  const category = options.categories[0];
  if (!category) throw new Error('دسته‌بندی فعال برای ذخیره فایل پیدا نشد.');
  const ids: string[] = [];
  for (const file of input.files) {
    const detected = mimeType(file);
    const documentType = options.documentTypes.find(
      (candidate) =>
        candidate.domain === 'GENERAL' &&
        !candidate.requiresExpiry &&
        candidate.allowedMimeTypes.includes(detected) &&
        file.size <= candidate.maxFileSizeBytes,
    );
    if (!documentType)
      throw new Error(`نوع سند مناسب برای فایل «${file.name}» پیدا نشد.`);
    const form = new FormData();
    form.set('file', file);
    form.set('title', input.title.slice(0, 240));
    form.set('description', input.description.slice(0, 1000));
    form.set('documentTypeId', documentType.id);
    form.set('categoryId', category.id);
    form.set('branchId', input.branchId);
    form.set('ownerUserId', options.currentUserId);
    form.set('sourceModule', 'WORKBENCH');
    form.set('sourceEntityType', input.entityType);
    form.set('sourceEntityId', input.entityId);
    form.set('sourceDisplayLabel', input.title.slice(0, 240));
    form.set('confidentiality', input.confidentiality ?? 'INTERNAL');
    ids.push((await documentsApi.upload(form)).data.id);
  }
  return ids;
}
