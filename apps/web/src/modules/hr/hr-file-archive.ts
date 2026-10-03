'use client';
import { documentsApi } from '../documents/api/client';
import { readHrAttachmentFile } from './contextual-hr-form';

export async function archiveHrFile(input: {
  reference?: string;
  file?: File;
  branchId: string;
  employeeId?: string | undefined;
  entityId: string;
  title: string;
  validUntil?: string | undefined;
}): Promise<{ id: string; archiveCode: string }> {
  const file =
    input.file ?? (await readHrAttachmentFile(input.reference ?? ''));
  const { data: options } = await documentsApi.options();
  const type =
    options.documentTypes.find((item) => item.code === 'HR_DOCUMENT') ??
    options.documentTypes.find((item) => item.domain === 'HUMAN_RESOURCES');
  const category = options.categories.find((item) =>
    /پرسنل|منابع انسانی/.test(item.name),
  );
  const branch = options.branches.find((item) => item.id === input.branchId);
  const owner = options.owners.find(
    (item) => item.id === options.currentUserId,
  );
  if (!type || !category || !branch || !owner)
    throw new Error(
      'نوع سند منابع انسانی، دسته‌بندی، شعبه یا مالک مجاز در اسناد و فایل‌ها تعریف نشده است.',
    );
  if (type.requiresExpiry && !input.validUntil)
    throw new Error('برای این نوع فایل، تاریخ اعتبار بایگانی را مشخص کنید.');
  const form = new FormData();
  form.set('file', file);
  form.set('title', input.title);
  form.set('documentTypeId', type.id);
  form.set('categoryId', category.id);
  form.set('branchId', branch.id);
  form.set('ownerUserId', owner.id);
  form.set('sourceModule', 'HUMAN_RESOURCES');
  form.set('sourceEntityType', input.employeeId ? 'Employee' : 'HrRecord');
  form.set('sourceEntityId', input.employeeId ?? input.entityId);
  form.set('sourceDisplayLabel', input.title);
  form.set('confidentiality', 'RESTRICTED');
  form.set('versionNote', 'ثبت از منابع انسانی');
  if (input.validUntil) form.set('validUntil', input.validUntil);
  const { data } = await documentsApi.upload(form);
  return { id: data.id, archiveCode: data.archiveCode };
}
export async function previewHrDocument(reference: string): Promise<string> {
  const id = reference.replace(/^document:\/\//, '');
  const { blob } = await documentsApi.preview(id);
  return URL.createObjectURL(blob);
}
