import type { MasterDataFieldDefinition } from './catalog';

export const hotelProfileFields: readonly MasterDataFieldDefinition[] = [
  { key: 'serviceLevel', label: 'درجه خدمات', type: 'text', placeholder: '' },
  { key: 'description', label: 'توضیحات', type: 'text', placeholder: '' },
  { key: 'hotelRules', label: 'قوانین هتل', type: 'text', placeholder: '' },
  { key: 'internalNote', label: 'یادداشت', type: 'text', placeholder: '' },
  {
    key: 'sourceDestination',
    label: 'مقصد فایل',
    type: 'text',
    placeholder: '',
  },
  {
    key: 'sourceRefundRules',
    label: 'متن استرداد مرجع',
    type: 'text',
    placeholder: '',
  },
  {
    key: 'sourceMainImage',
    label: 'آدرس تصویر اصلی',
    type: 'text',
    placeholder: '',
  },
  {
    key: 'sourceGalleryImages',
    label: 'آدرس تصاویر گالری',
    type: 'text',
    placeholder: '',
    hint: 'آدرس‌ها را با | جدا کنید.',
  },
  {
    key: 'sourceFeatured',
    label: 'نشان پرفروش فایل',
    type: 'select',
    placeholder: '',
    options: [
      { value: 'true', label: 'بله' },
      { value: 'false', label: 'خیر' },
    ],
  },
];

export const hotelProfileTextLimits: Readonly<Record<string, number>> = {
  name: 160,
  englishName: 160,
  address: 1000,
  serviceLevel: 160,
  sourceDestination: 160,
  description: 2000,
  hotelRules: 2000,
  internalNote: 2000,
  sourceRefundRules: 2000,
  sourceMainImage: 2000,
  sourceGalleryImages: 2000,
};

export const hotelMultilineFields = new Set([
  'description',
  'hotelRules',
  'internalNote',
  'sourceRefundRules',
  'sourceGalleryImages',
]);
