export type MasterDataPreviewState =
  'empty' | 'loading' | 'error' | 'forbidden' | 'preview';

export const MASTER_DATA_BLOCKER_TITLE = 'Blocked by Migration Lock';
export const MASTER_DATA_PREVIEW_DISCLOSURE = 'نمونه طراحی و ذخیره‌نشده';

export const masterDataStateOptions: readonly [
  MasterDataPreviewState,
  string,
][] = [
  ['empty', 'بدون داده'],
  ['loading', 'در حال بارگذاری'],
  ['error', 'خطا'],
  ['forbidden', 'بدون دسترسی'],
  ['preview', 'نمونه طراحی'],
];

export const masterDataComponentContract = {
  direction: 'rtl',
  requiredStates: masterDataStateOptions.map(([state]) => state),
  permissionDeniedCode: 'master_data.read',
  persistenceDisclosure: MASTER_DATA_PREVIEW_DISCLOSURE,
  blockerTitle: MASTER_DATA_BLOCKER_TITLE,
} as const;
