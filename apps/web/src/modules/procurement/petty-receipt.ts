import { documentsApi } from '@/modules/documents/api/client';
export async function uploadPettyRechargeReceipt(
  file: File,
  branchId: string,
  reference: string,
) {
  const { data: options } = await documentsApi.options();
  const type = options.documentTypes.find(
    (item) => item.domain === 'PROCUREMENT',
  );
  const category = options.categories[0];
  if (!type || !category)
    throw new Error(
      'تنظیمات نوع سند خرید، دسته‌بندی یا مالک برای بارگذاری فاکتور کامل نیست.',
    );
  const form = new FormData();
  form.set('file', file);
  form.set('title', 'فیش شارژ تنخواه');
  form.set('documentTypeId', type.id);
  form.set('categoryId', category.id);
  form.set('branchId', branchId);
  form.set('ownerUserId', options.currentUserId);
  form.set('confidentiality', 'INTERNAL');
  form.set('sourceModule', 'PROCUREMENT');
  form.set('sourceEntityType', 'ProcurementPettyRecharge');
  form.set('sourceEntityId', reference);
  form.set('sourceDisplayLabel', 'شارژ تنخواه');
  const { data } = await documentsApi.upload(form);
  return { id: data.id, versionId: data.currentVersion.id };
}
