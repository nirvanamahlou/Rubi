'use client';

import { documentsApi } from '../documents/api/client';
import { readHrAttachmentFile } from './contextual-hr-form';

export interface EmployeeDocumentArchiveInput {
  employeeId: string;
  employeeName: string;
  branchName: string;
  title: string;
  documentType: string;
  issuer: string;
  confidentiality: string;
  validUntil: string;
  fileReference: string;
}

const confidentialityCodes: Readonly<Record<string, string>> = {
  عمومی: 'PUBLIC',
  داخلی: 'INTERNAL',
  محرمانه: 'CONFIDENTIAL',
  'خیلی محرمانه': 'RESTRICTED',
};

export async function uploadEmployeeDocumentToArchive(
  input: EmployeeDocumentArchiveInput,
): Promise<{ id: string; archiveCode: string }> {
  const [optionsResponse, file] = await Promise.all([
    documentsApi.options(),
    readHrAttachmentFile(input.fileReference),
  ]);
  const options = optionsResponse.data;
  const documentType =
    options.documentTypes.find((item) => item.code === 'HR_DOCUMENT') ??
    options.documentTypes.find((item) => item.domain === 'HUMAN_RESOURCES');
  const category =
    options.categories.find((item) => /پرسنل|منابع انسانی/.test(item.name)) ??
    options.categories[0];
  const branch =
    options.branches.find((item) => item.name === input.branchName) ??
    options.branches[0];
  const owner =
    options.owners.find((item) => item.id === options.currentUserId) ??
    options.owners[0];
  if (!documentType)
    throw new Error('نوع سند منابع انسانی در اسناد و فایل‌ها تعریف نشده است.');
  if (!category) throw new Error('دسته‌بندی سند در اسناد و فایل‌ها تعریف نشده است.');
  if (!branch) throw new Error('شعبه مجاز برای بارگذاری سند پیدا نشد.');
  if (!owner) throw new Error('مالک مجاز برای بارگذاری سند پیدا نشد.');
  if (!input.validUntil)
    throw new Error('تاریخ انقضا برای ثبت مدرک پرسنلی در اسناد الزامی است.');
  const form = new FormData();
  form.set('file', file);
  form.set('title', input.title || input.documentType);
  form.set(
    'description',
    `${input.documentType}${input.issuer ? ` - صادرکننده: ${input.issuer}` : ''}`,
  );
  form.set('documentTypeId', documentType.id);
  form.set('categoryId', category.id);
  form.set('branchId', branch.id);
  form.set('ownerUserId', owner.id);
  form.set('sourceModule', 'HUMAN_RESOURCES');
  form.set('sourceEntityType', 'Employee');
  form.set('sourceEntityId', input.employeeId);
  form.set('sourceDisplayLabel', input.employeeName);
  form.set(
    'confidentiality',
    confidentialityCodes[input.confidentiality] ?? 'RESTRICTED',
  );
  form.set('validUntil', input.validUntil);
  form.set('versionNote', 'ثبت خودکار از پرونده کارکنان');
  const response = await documentsApi.upload(form);
  return { id: response.data.id, archiveCode: response.data.archiveCode };
}
