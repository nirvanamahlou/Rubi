import type { ProcurementRequestV1 } from '@nora/contracts';

export type ProcurementListRow = Pick<
  ProcurementRequestV1,
  'id' | 'number' | 'status'
> & {
  draft: Pick<
    ProcurementRequestV1['draft'],
    'title' | 'estimatedAmount' | 'currencyCode'
  >;
  sample?: true;
  section?: number;
};

// Read-only examples for an empty local workspace. Never sent to the API.
export const sampleRequests: ProcurementListRow[] = [
  {
    id: 'sample-office-equipment',
    number: 'PR-1405-101',
    status: 'SUBMITTED',
    draft: {
      title: 'تجهیزات پشتیبانی شعبه مرکزی',
      estimatedAmount: '240000000',
      currencyCode: 'IRR',
    },
    sample: true,
  },
  {
    id: 'sample-network-renewal',
    number: 'PR-1405-102',
    status: 'IN_REVIEW',
    draft: {
      title: 'تمدید اشتراک زیرساخت شبکه',
      estimatedAmount: '185000000',
      currencyCode: 'IRR',
    },
    sample: true,
  },
  {
    id: 'sample-field-supplies',
    number: 'PR-1405-103',
    status: 'APPROVED',
    draft: {
      title: 'ملزومات پذیرش واحد عملیات',
      estimatedAmount: '98000000',
      currencyCode: 'IRR',
    },
    sample: true,
  },
  {
    id: 'sample-service-contract',
    number: 'PR-1405-104',
    status: 'SOURCING',
    draft: {
      title: 'خدمات نگهداری تجهیزات اداری',
      estimatedAmount: '360000000',
      currencyCode: 'IRR',
    },
    sample: true,
  },
  {
    id: 'sample-signage',
    number: 'PR-1405-105',
    status: 'CHANGES_REQUESTED',
    draft: {
      title: 'تابلوهای راهنمای شعبه شرق',
      estimatedAmount: '72000000',
      currencyCode: 'IRR',
    },
    sample: true,
  },
  ...(
    [
      [
        'sample-approval-training',
        'PR-1405-106',
        'IN_REVIEW',
        'دوره آموزشی کارکنان شعب',
        '145000000',
        2,
      ],
      [
        'sample-approval-hotel',
        'PR-1405-107',
        'SUBMITTED',
        'تجهیزات پذیرش هتل',
        '78000000',
        2,
      ],
      [
        'sample-quote-printers',
        'PR-1405-108',
        'SOURCING',
        'چاپگرهای واحد اداری',
        '315000000',
        4,
      ],
      [
        'sample-quote-support',
        'PR-1405-109',
        'SOURCING',
        'قرارداد پشتیبانی نرم‌افزار',
        '475000000',
        4,
      ],
      [
        'sample-order-furniture',
        'PR-1405-110',
        'SOURCING',
        'مبلمان اتاق جلسات',
        '290000000',
        5,
      ],
      [
        'sample-order-devices',
        'PR-1405-111',
        'SOURCING',
        'تجهیزات شبکه شعبه غرب',
        '520000000',
        5,
      ],
      [
        'sample-receipt-stationery',
        'PR-1405-112',
        'SOURCING',
        'لوازم اداری تحویل جزئی',
        '94000000',
        6,
      ],
      [
        'sample-receipt-maintenance',
        'PR-1405-113',
        'SOURCING',
        'پذیرش خدمات تعمیرات',
        '167000000',
        6,
      ],
      [
        'sample-invoice-hardware',
        'PR-1405-114',
        'SOURCING',
        'فاکتور تجهیزات رایانه‌ای',
        '390000000',
        7,
      ],
      [
        'sample-invoice-cleaning',
        'PR-1405-115',
        'SOURCING',
        'فاکتور خدمات نظافت شعب',
        '132000000',
        7,
      ],
    ] as const
  ).map(([id, number, status, title, estimatedAmount, section]) => ({
    id,
    number,
    status,
    draft: { title, estimatedAmount, currencyCode: 'IRR' },
    section,
    sample: true as const,
  })),
];

export const sampleSuppliers = [
  {
    id: 'sample-supplier-1',
    code: 'SUP-DEMO-101',
    name: 'تأمین تجهیزات آریا',
    isActive: true,
    collaborationStatus: 'آماده همکاری',
    sample: true,
  },
  {
    id: 'sample-supplier-2',
    code: 'SUP-DEMO-102',
    name: 'خدمات فنی پارس',
    isActive: true,
    collaborationStatus: 'در حال ارزیابی',
    sample: true,
  },
  {
    id: 'sample-supplier-3',
    code: 'SUP-DEMO-103',
    name: 'پخش ملزومات سپهر',
    isActive: true,
    collaborationStatus: 'آماده همکاری',
    sample: true,
  },
];
