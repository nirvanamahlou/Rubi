import type {
  DocumentOptionsResponseV1,
  SalesContractDetail,
} from '@rubi/contracts';

export function paymentDocumentQuery(
  contract: SalesContractDetail,
  paymentId: string,
  page = 1,
) {
  if (!contract.payments.some((payment) => payment.id === paymentId))
    throw new Error('پرداخت متعلق به این قرارداد نیست.');
  return {
    branchId: contract.branchId,
    sourceModule: 'sales',
    sourceEntityType: 'SalesContractPaymentEntry',
    sourceEntityId: paymentId,
    sortBy: 'createdAt' as const,
    sortDirection: 'desc' as const,
    page,
    pageSize: 100,
  };
}

export function paymentEvidenceForm(
  contract: SalesContractDetail,
  paymentId: string,
  options: DocumentOptionsResponseV1['data'],
  file: File,
) {
  const source = paymentDocumentQuery(contract, paymentId);
  const type = options.documentTypes.find(
    (item) =>
      item.code === 'RECEIPT' &&
      item.domain === 'FINANCE' &&
      !item.requiresExpiry,
  );
  const category = options.categories.find(
    (item) => item.code === 'PROCUREMENT_FINANCE',
  );
  if (
    !type ||
    !category ||
    !options.branches.some((branch) => branch.id === contract.branchId)
  )
    throw new Error(
      'دسترسی یا اطلاعات پایهٔ بارگذاری رسید مالی در این شعبه موجود نیست.',
    );
  if (
    !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) ||
    !type.allowedMimeTypes.includes(file.type) ||
    !options.uploadPolicy.allowedMimeTypes.includes(file.type) ||
    file.size <= 0 ||
    file.size >
      Math.min(type.maxFileSizeBytes, options.uploadPolicy.maxFileSizeBytes)
  )
    throw new Error('مدرک باید PDF، JPG یا PNG و در محدودهٔ حجم مجاز باشد.');
  const form = new FormData();
  form.set('file', file);
  form.set('title', 'مدرک پرداخت قرارداد ' + contract.contractNumber);
  form.set('documentTypeId', type.id);
  form.set('categoryId', category.id);
  form.set('branchId', source.branchId);
  form.set('ownerUserId', options.currentUserId);
  form.set('confidentiality', 'RESTRICTED');
  form.set('sourceModule', source.sourceModule);
  form.set('sourceEntityType', source.sourceEntityType);
  form.set('sourceEntityId', source.sourceEntityId);
  form.set(
    'sourceDisplayLabel',
    'پرداخت ' + paymentId + ' / ' + contract.contractNumber,
  );
  return form;
}

export const paymentDocumentScanLabel = (status: string) =>
  ({
    CLEAN: 'بررسی امنیتی فایل موفق',
    PENDING_SCAN: 'در انتظار بررسی امنیتی',
    INFECTED: 'فایل آلوده؛ دریافت ممنوع',
    SCAN_FAILED: 'بررسی امنیتی ناموفق',
    QUARANTINED: 'فایل قرنطینه‌شده',
    AWAITING_ANTIVIRUS_ADAPTER: 'در انتظار سرویس بررسی امنیتی',
  })[status] ?? 'وضعیت امنیتی نامشخص';
