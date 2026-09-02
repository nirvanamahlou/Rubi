import type {
  BranchReference,
  DocumentOptionsResponseV1,
} from '@rubi/contracts';

export interface DocumentUploadValues {
  title: string;
  description: string;
  documentTypeId: string;
  categoryId: string;
  branchId: string;
  ownerUserId: string;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: string;
  sourceDisplayLabel: string;
  confidentiality: string;
  validUntil: string;
  versionNote: string;
}

export const emptyDocumentUploadValues: DocumentUploadValues = {
  title: '',
  description: '',
  documentTypeId: '',
  categoryId: '',
  branchId: '',
  ownerUserId: '',
  sourceModule: '',
  sourceEntityType: '',
  sourceEntityId: '',
  sourceDisplayLabel: '',
  confidentiality: '',
  validUntil: '',
  versionNote: '',
};

export function hydrateDocumentUploadDefaults(
  values: DocumentUploadValues,
  options: DocumentOptionsResponseV1['data'],
  branches: readonly BranchReference[],
): DocumentUploadValues {
  return {
    ...values,
    documentTypeId: values.documentTypeId || options.documentTypes[0]?.id || '',
    categoryId: values.categoryId || options.categories[0]?.id || '',
    ownerUserId: values.ownerUserId || options.owners[0]?.id || '',
    branchId: values.branchId || branches[0]?.id || '',
  };
}

export function validateDocumentUpload(
  values: DocumentUploadValues,
  hasFile: boolean,
  requiresExpiry: boolean,
): string | null {
  if (!hasFile) return 'ابتدا فایل سند را انتخاب کنید.';
  if (!values.title.trim()) return 'عنوان سند را وارد کنید.';
  if (!values.documentTypeId) return 'نوع سند را انتخاب کنید.';
  if (!values.categoryId) return 'دسته‌بندی را انتخاب کنید.';
  if (!values.branchId) return 'شعبه را انتخاب کنید.';
  if (!values.ownerUserId) return 'مالک فایل را انتخاب کنید.';
  if (!values.sourceModule.trim()) return 'ماژول مبدأ را وارد کنید.';
  if (!values.sourceEntityType.trim()) return 'نوع رکورد مبدأ را وارد کنید.';
  if (!values.sourceEntityId.trim()) return 'شناسه رکورد مبدأ را وارد کنید.';
  if (!values.sourceDisplayLabel.trim()) return 'عنوان پرونده را وارد کنید.';
  if (requiresExpiry && !values.validUntil)
    return 'برای این نوع سند، تاریخ اعتبار الزامی است.';
  return null;
}
