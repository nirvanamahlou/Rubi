import type {
  BranchReference,
  DocumentOptionsResponseV1,
} from '@nora/contracts';

export interface DocumentUploadValues {
  employeeId?: string;
  title: string;
  description: string;
  documentTypeId: string;
  categoryId: string;
  branchId: string;
  ownerUserId: string;
  sourceRelationId: string;
  confidentiality: string;
  confidentialAccessCode: string;
  validUntil: string;
  requiresStepUpVerification: boolean;
}

export const emptyDocumentUploadValues: DocumentUploadValues = {
  title: '',
  description: '',
  documentTypeId: '',
  categoryId: '',
  branchId: '',
  ownerUserId: '',
  sourceRelationId: '',
  confidentiality: '',
  confidentialAccessCode: '',
  validUntil: '',
  requiresStepUpVerification: false,
};

export function documentUploadBranchChoices(
  options: DocumentOptionsResponseV1['data'] | null,
  branches: readonly BranchReference[],
): { id: string; branchId: string; name: string }[] {
  const allowed = options?.branches ?? branches;
  const organization = (options?.organizationBranches ?? []).filter((record) =>
    allowed.some((branch) => branch.id === record.branchId),
  );
  return [
    ...organization,
    ...allowed
      .filter(
        (branch) =>
          !organization.some((record) => record.branchId === branch.id),
      )
      .map((branch) => ({
        id: branch.id,
        branchId: branch.id,
        name: branch.name,
      })),
  ];
}

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
  requiresConfidentialCode = false,
): string | null {
  if (!hasFile) return 'ابتدا فایل سند را انتخاب کنید.';
  if (!values.title.trim()) return 'عنوان سند را وارد کنید.';
  if (!values.documentTypeId) return 'نوع سند را انتخاب کنید.';
  if (!values.categoryId) return 'دسته‌بندی را انتخاب کنید.';
  if (!values.branchId) return 'شعبه را انتخاب کنید.';
  if (!values.ownerUserId) return 'مالک فایل را انتخاب کنید.';
  if (values.sourceRelationId && values.employeeId)
    return 'فقط یک پرونده مرجع انتخاب کنید.';
  if (requiresExpiry && !values.validUntil)
    return 'برای این نوع سند، تاریخ اعتبار الزامی است.';
  if (
    requiresConfidentialCode &&
    !/^\d{6}$/u.test(values.confidentialAccessCode)
  )
    return 'برای سند محرمانه، کد شش‌رقمی تعیین کنید.';
  return null;
}
