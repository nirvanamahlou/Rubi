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
  createdAt?: string;
};

export function filterSampleRequests(
  rows: readonly ProcurementListRow[],
  filters: {
    section?: number;
    search?: string;
    status?: string;
    createdFrom?: string;
    createdTo?: string;
  },
): ProcurementListRow[] {
  const search = filters.search?.trim().toLocaleLowerCase('fa-IR') ?? '';
  return rows.filter((row) => {
    const sectionMatches =
      filters.section === undefined
        ? row.section === undefined
        : filters.section === 1
          ? row.section === undefined || row.section === 1
          : row.section === filters.section;
    if (!sectionMatches) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (
      search &&
      !`${row.number} ${row.draft.title}`
        .toLocaleLowerCase('fa-IR')
        .includes(search)
    )
      return false;
    const createdDay = row.createdAt?.slice(0, 10);
    if (filters.createdFrom && (!createdDay || createdDay < filters.createdFrom))
      return false;
    if (filters.createdTo && (!createdDay || createdDay > filters.createdTo))
      return false;
    return true;
  });
}

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
    createdAt: '2026-09-26T08:00:00.000Z',
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
    createdAt: '2026-09-27T08:00:00.000Z',
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
    createdAt: '2026-09-28T08:00:00.000Z',
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
    createdAt: '2026-09-29T08:00:00.000Z',
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
    createdAt: '2026-09-30T08:00:00.000Z',
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
      [
        'sample-approval-security',
        'PR-1405-116',
        'IN_REVIEW',
        'تمدید خدمات امنیت شبکه',
        '268000000',
        2,
      ],
      [
        'sample-approval-laptops',
        'PR-1405-117',
        'SUBMITTED',
        'تأمین لپ‌تاپ واحد فروش',
        '840000000',
        2,
      ],
      [
        'sample-approval-air-conditioning',
        'PR-1405-118',
        'IN_REVIEW',
        'سرویس سامانه سرمایش دفتر مرکزی',
        '196000000',
        2,
      ],
      [
        'sample-approval-ergonomic-chairs',
        'PR-1405-119',
        'SUBMITTED',
        'خرید صندلی ارگونومیک واحد مالی',
        '224000000',
        2,
      ],
      [
        'sample-quote-cloud',
        'PR-1405-120',
        'SOURCING',
        'تمدید زیرساخت ابری پشتیبان',
        '580000000',
        4,
      ],
      [
        'sample-quote-catering',
        'PR-1405-121',
        'APPROVED',
        'خدمات پذیرایی نشست‌های فصلی',
        '125000000',
        4,
      ],
      [
        'sample-quote-power-equipment',
        'PR-1405-122',
        'SOURCING',
        'تجهیزات برق اضطراری شعبه شمال',
        '430000000',
        4,
      ],
      [
        'sample-quote-uniforms',
        'PR-1405-123',
        'APPROVED',
        'پوشاک سازمانی کارکنان پذیرش',
        '176000000',
        4,
      ],
      [
        'sample-order-laptops',
        'PR-1405-124',
        'SOURCING',
        'سفارش لپ‌تاپ کارشناسان فروش',
        '840000000',
        5,
      ],
      [
        'sample-order-cooling',
        'PR-1405-125',
        'SOURCING',
        'سفارش قطعات سامانه سرمایش',
        '214000000',
        5,
      ],
      [
        'sample-order-security',
        'PR-1405-126',
        'CLOSED',
        'سفارش تجهیزات کنترل دسترسی',
        '335000000',
        5,
      ],
      [
        'sample-order-packaging',
        'PR-1405-127',
        'SOURCING',
        'سفارش ملزومات بسته‌بندی اسناد',
        '89000000',
        5,
      ],
      [
        'sample-receipt-laptops',
        'PR-1405-128',
        'SOURCING',
        'تحویل لپ‌تاپ واحد فروش',
        '840000000',
        6,
      ],
      [
        'sample-receipt-furniture',
        'PR-1405-129',
        'CLOSED',
        'پذیرش مبلمان اتاق جلسات',
        '290000000',
        6,
      ],
      [
        'sample-receipt-network',
        'PR-1405-130',
        'SOURCING',
        'مغایرت تجهیزات شبکه شعبه غرب',
        '520000000',
        6,
      ],
      [
        'sample-receipt-uniforms',
        'PR-1405-131',
        'SOURCING',
        'تحویل پوشاک سازمانی کارکنان',
        '176000000',
        6,
      ],
      [
        'sample-invoice-cloud',
        'PR-1405-132',
        'SOURCING',
        'فاکتور زیرساخت ابری پشتیبان',
        '580000000',
        7,
      ],
      [
        'sample-invoice-furniture',
        'PR-1405-133',
        'CLOSED',
        'فاکتور مبلمان اتاق جلسات',
        '290000000',
        7,
      ],
      [
        'sample-invoice-network',
        'PR-1405-134',
        'SOURCING',
        'فاکتور تجهیزات شبکه شعبه غرب',
        '520000000',
        7,
      ],
      [
        'sample-invoice-catering',
        'PR-1405-135',
        'SOURCING',
        'فاکتور خدمات پذیرایی سازمانی',
        '125000000',
        7,
      ],
    ] as const
  ).map(([id, number, status, title, estimatedAmount, section], index) => ({
    id,
    number,
    status,
    draft: { title, estimatedAmount, currencyCode: 'IRR' },
    section,
    sample: true as const,
    createdAt: new Date(Date.UTC(2026, 8, index + 1, 8)).toISOString(),
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
    createdAt: '2026-09-24T08:00:00.000Z',
  },
  {
    id: 'sample-supplier-2',
    code: 'SUP-DEMO-102',
    name: 'خدمات فنی پارس',
    isActive: true,
    collaborationStatus: 'در حال ارزیابی',
    sample: true,
    createdAt: '2026-09-25T08:00:00.000Z',
  },
  {
    id: 'sample-supplier-3',
    code: 'SUP-DEMO-103',
    name: 'پخش ملزومات سپهر',
    isActive: true,
    collaborationStatus: 'آماده همکاری',
    sample: true,
    createdAt: '2026-09-26T08:00:00.000Z',
  },
];

export function filterSampleSuppliers(
  rows: typeof sampleSuppliers,
  filters: { search?: string; createdFrom?: string; createdTo?: string },
) {
  const search = filters.search?.trim().toLocaleLowerCase('fa-IR') ?? '';
  return rows.filter((row) => {
    if (
      search &&
      !`${row.name} ${row.code}`.toLocaleLowerCase('fa-IR').includes(search)
    )
      return false;
    const createdDay = row.createdAt.slice(0, 10);
    return (
      (!filters.createdFrom || createdDay >= filters.createdFrom) &&
      (!filters.createdTo || createdDay <= filters.createdTo)
    );
  });
}
