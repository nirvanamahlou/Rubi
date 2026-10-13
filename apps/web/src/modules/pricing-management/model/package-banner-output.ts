export interface PackageBannerOutputAvailability {
  available: boolean;
  label: string;
  reason: string;
}

export interface PackageBannerDocumentsAdapter {
  availability(): PackageBannerOutputAvailability;
}

export const packageBannerDocumentsAdapter: PackageBannerDocumentsAdapter = {
  availability: () => ({
    available: false,
    label: 'در انتظار سرویس خروجی اسناد',
    reason:
      'قرارداد عمومی تولید تصویر یا PDF برای بنر پکیج هنوز منتشر نشده است.',
  }),
};
