import type { MasterDataResourceKey } from './catalog';

export const masterDataSectionSlugs = [
  'finance',
  'geography',
  'organizations-suppliers',
  'accommodation',
  'transportation',
  'insurance',
  'tours-travel-services',
  'sales-references',
] as const;

export type MasterDataSectionSlug = (typeof masterDataSectionSlugs)[number];
export type MasterDataSectionTone =
  'emerald' | 'sky' | 'violet' | 'orange' | 'blue' | 'cyan' | 'rose' | 'purple';

export interface MasterDataSectionDefinition {
  slug: MasterDataSectionSlug;
  title: string;
  description: string;
  resources: readonly MasterDataResourceKey[];
  tone: MasterDataSectionTone;
}

export const masterDataSections: readonly MasterDataSectionDefinition[] = [
  {
    slug: 'finance',
    title: 'مالی و پولی',
    description:
      'ارزها با تاریخچه نرخ، گردش تأیید، بانک‌ها، شعب و روش‌های پرداخت مرجع',
    resources: [
      'currencies',
      'exchange-rates',
      'banks',
      'bank-branches',
      'payment-methods',
    ],
    tone: 'emerald',
  },
  {
    slug: 'geography',
    title: 'جغرافیا',
    description:
      'کشورها، نمای یکپارچه شهرها و استان‌ها، فرودگاه‌ها و ترمینال‌ها',
    resources: ['countries', 'regions', 'cities', 'airports', 'terminals'],
    tone: 'sky',
  },
  {
    slug: 'organizations-suppliers',
    title: 'سازمان‌ها و تأمین‌کنندگان',
    description: 'سازمان‌ها، تأمین‌کنندگان، کارگزاران و همکاران',
    resources: [
      'organizations',
      'suppliers',
      'brokers',
      'travel-services',
      'organization-contacts',
    ],
    tone: 'violet',
  },
  {
    slug: 'accommodation',
    title: 'اقامت',
    description: 'هتل‌ها و اطلاعات مرجع خدمات اقامتی',
    resources: [
      'hotels',
      'hotel-chains',
      'room-types',
      'meal-services',
      'facilities',
      'composite-hotels',
    ],
    tone: 'orange',
  },
  {
    slug: 'transportation',
    title: 'حمل‌ونقل',
    description:
      'ایرلاین‌ها، هواپیما، کلاس و بار، Manifest و مراجع ریلی و اتوبوسی',
    resources: [
      'airlines',
      'aircraft-types',
      'cabin-classes',
      'baggage-rules',
      'manifest-templates',
      'rail-companies',
      'train-types',
    ],
    tone: 'blue',
  },
  {
    slug: 'insurance',
    title: 'بیمه',
    description: 'شرکت‌های بیمه، طرح‌ها و پوشش‌های مرجع خدمات بیمه سفر',
    resources: ['insurers', 'insurance-plans', 'insurance-coverages'],
    tone: 'cyan',
  },
  {
    slug: 'tours-travel-services',
    title: 'تور و خدمات سفر',
    description:
      'لیدرها، انواع تور و ترانسفر، CIP، ویزا و مراجع اتوبوسی خدمات سفر',
    resources: [
      'leaders',
      'tour-types',
      'transfer-types',
      'cip-services',
      'visa-services',
      'bus-companies',
      'bus-types',
    ],
    tone: 'rose',
  },
  {
    slug: 'sales-references',
    title: 'مراجع فروش',
    description:
      'نحوه آشنایی، منبع سرنخ، کانال، دلیل باخت، نوع مشتری، Tag و نوع کمپین',
    resources: [
      'acquaintance-methods',
      'lead-sources',
      'sales-channels',
      'lost-reasons',
      'customer-types',
      'tags',
      'campaign-types',
    ],
    tone: 'purple',
  },
];

export function getMasterDataSection(slug: string) {
  return masterDataSections.find((section) => section.slug === slug);
}

export function getMasterDataSectionForResource(
  resource: MasterDataResourceKey,
) {
  return masterDataSections.find((section) =>
    section.resources.includes(resource),
  );
}
