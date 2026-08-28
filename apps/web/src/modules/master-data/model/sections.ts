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
      'ارزها، تاریخچه و تأیید نرخ، بانک‌ها، شعب و روش‌های پرداخت مرجع',
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
    description: 'کشورها، نواحی، شهرها، فرودگاه‌ها و ترمینال‌ها',
    resources: ['countries', 'regions', 'cities', 'airports', 'terminals'],
    tone: 'sky',
  },
  {
    slug: 'organizations-suppliers',
    title: 'سازمان‌ها و تأمین‌کنندگان',
    description: 'سازمان‌ها، تأمین‌کنندگان، کارگزاران و همکاران',
    resources: ['organizations', 'brokers'],
    tone: 'violet',
  },
  {
    slug: 'accommodation',
    title: 'اقامت',
    description: 'هتل‌ها و اطلاعات مرجع خدمات اقامتی',
    resources: ['hotels'],
    tone: 'orange',
  },
  {
    slug: 'transportation',
    title: 'حمل‌ونقل',
    description: 'شرکت‌های هواپیمایی و مراجع حمل‌ونقل سفر',
    resources: ['airlines'],
    tone: 'blue',
  },
  {
    slug: 'insurance',
    title: 'بیمه',
    description: 'بیمه‌گران و اطلاعات مرجع خدمات بیمه سفر',
    resources: ['insurers'],
    tone: 'cyan',
  },
  {
    slug: 'tours-travel-services',
    title: 'تور و خدمات سفر',
    description: 'لیدرها و مراجع اجرایی تور و خدمات سفر',
    resources: ['leaders'],
    tone: 'rose',
  },
  {
    slug: 'sales-references',
    title: 'مراجع فروش',
    description: 'نحوه آشنایی و داده‌های مرجع چرخه فروش',
    resources: ['acquaintance-methods'],
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
