export type CampaignStatus =
  | 'DRAFT'
  | 'READY_FOR_APPROVAL'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ARCHIVED';

export type CampaignChannel =
  | 'SMS'
  | 'EMAIL'
  | 'WHATSAPP'
  | 'WEBSITE'
  | 'INSTAGRAM'
  | 'TELEGRAM'
  | 'PUSH_NOTIFICATION'
  | 'PHONE_CALL'
  | 'PARTNER_AGENCY'
  | 'REFERRAL'
  | 'OFFLINE';

export type ExecutionCompany = 'NIAYESH_SEIR_SAHAR' | 'JAHAN_BASTAN';

export interface CampaignPreview {
  id: `preview-${string}`;
  internalCode: string;
  name: string;
  campaignType: string;
  objective: string;
  channels: readonly CampaignChannel[];
  audienceSummary: string;
  segmentReference: `preview-${string}`;
  startsAt: string;
  endsAt: string;
  budgetAmount: string;
  spendAmount: string;
  currencyCode: 'IRR' | 'USD' | 'EUR';
  attributedRevenue: null;
  ownerRole: string;
  executionCompany: ExecutionCompany;
  offerTitle: string;
  couponCode: string | null;
  utmCampaign: string;
  frequencyCap: string;
  status: CampaignStatus;
  version: number;
  updatedAt: string;
}

export const campaignStatusLabels: Readonly<Record<CampaignStatus, string>> = {
  DRAFT: 'پیش‌نویس',
  READY_FOR_APPROVAL: 'آماده تایید',
  APPROVED: 'تاییدشده',
  SCHEDULED: 'زمان‌بندی‌شده',
  RUNNING: 'در حال اجرا',
  PAUSED: 'متوقف موقت',
  COMPLETED: 'تکمیل‌شده',
  CANCELLED: 'لغوشده',
  ARCHIVED: 'بایگانی‌شده',
};

export const campaignChannelLabels: Readonly<Record<CampaignChannel, string>> =
  {
    SMS: 'پیامک',
    EMAIL: 'ایمیل',
    WHATSAPP: 'واتساپ',
    WEBSITE: 'وب‌سایت',
    INSTAGRAM: 'اینستاگرام',
    TELEGRAM: 'تلگرام',
    PUSH_NOTIFICATION: 'اعلان',
    PHONE_CALL: 'تماس تلفنی',
    PARTNER_AGENCY: 'آژانس همکار',
    REFERRAL: 'معرفی',
    OFFLINE: 'آفلاین',
  };

export const executionCompanyLabels: Readonly<
  Record<ExecutionCompany, string>
> = {
  NIAYESH_SEIR_SAHAR: 'نیایش سیر سحر',
  JAHAN_BASTAN: 'جهان باستان',
};

export const marketingPreviewCampaigns: readonly CampaignPreview[] = [
  {
    id: 'preview-campaign-spring',
    internalCode: 'MKT-SPRING-01',
    name: 'پیش‌فروش سفرهای بهاری',
    campaignType: 'فروش فصلی',
    objective: 'افزایش قراردادهای سفر داخلی',
    channels: ['SMS', 'WEBSITE', 'PARTNER_AGENCY'],
    audienceSummary: 'Segment ساختگی مشتریان فعال داخلی؛ فقط شمارش تجمیعی',
    segmentReference: 'preview-segment-domestic',
    startsAt: '2026-09-05T05:30:00.000Z',
    endsAt: '2026-09-20T17:30:00.000Z',
    budgetAmount: '480000000',
    spendAmount: '125000000',
    currencyCode: 'IRR',
    attributedRevenue: null,
    ownerRole: 'مدیر کمپین داخلی',
    executionCompany: 'NIAYESH_SEIR_SAHAR',
    offerTitle: 'پیشنهاد پرداخت مرحله‌ای',
    couponCode: 'SPRING-PREVIEW',
    utmCampaign: 'spring-domestic-preview',
    frequencyCap: 'حداکثر ۲ پیام در ۷ روز',
    status: 'RUNNING',
    version: 4,
    updatedAt: '2026-09-01T06:20:00.000Z',
  },
  {
    id: 'preview-campaign-heritage',
    internalCode: 'MKT-HERITAGE-02',
    name: 'تورهای میراث جهان باستان',
    campaignType: 'آگاهی از برند',
    objective: 'معرفی مسیرهای فرهنگی منتخب',
    channels: ['INSTAGRAM', 'TELEGRAM', 'WEBSITE'],
    audienceSummary: 'Segment ساختگی علاقه‌مندان سفر فرهنگی؛ بدون مشخصات فردی',
    segmentReference: 'preview-segment-heritage',
    startsAt: '2026-09-12T07:00:00.000Z',
    endsAt: '2026-10-02T18:00:00.000Z',
    budgetAmount: '320000000',
    spendAmount: '0',
    currencyCode: 'IRR',
    attributedRevenue: null,
    ownerRole: 'سرپرست بازاریابی محتوا',
    executionCompany: 'JAHAN_BASTAN',
    offerTitle: 'بسته محتوای معرفی مسیر',
    couponCode: null,
    utmCampaign: 'heritage-awareness-preview',
    frequencyCap: 'حداکثر ۳ نمایش در ۷ روز',
    status: 'SCHEDULED',
    version: 2,
    updatedAt: '2026-08-31T11:15:00.000Z',
  },
  {
    id: 'preview-campaign-agency',
    internalCode: 'MKT-AGENCY-03',
    name: 'فعال‌سازی شبکه آژانس‌ها',
    campaignType: 'همکاران تجاری',
    objective: 'افزایش ارجاع قرارداد از آژانس همکار',
    channels: ['PARTNER_AGENCY', 'EMAIL', 'PHONE_CALL'],
    audienceSummary: 'Segment سازمانی ساختگی آژانس‌های همکار فعال',
    segmentReference: 'preview-segment-agencies',
    startsAt: '2026-10-01T04:30:00.000Z',
    endsAt: '2026-10-31T17:30:00.000Z',
    budgetAmount: '8500.00',
    spendAmount: '0.00',
    currencyCode: 'USD',
    attributedRevenue: null,
    ownerRole: 'مالک کانال همکاران',
    executionCompany: 'NIAYESH_SEIR_SAHAR',
    offerTitle: 'مشوق ارجاع پیشنهادی',
    couponCode: 'AGENCY-PREVIEW',
    utmCampaign: 'agency-network-preview',
    frequencyCap: 'حداکثر ۱ تماس و ۲ ایمیل در ۱۴ روز',
    status: 'READY_FOR_APPROVAL',
    version: 1,
    updatedAt: '2026-08-30T09:00:00.000Z',
  },
  {
    id: 'preview-campaign-retention',
    internalCode: 'MKT-RETENTION-04',
    name: 'بازگشت مشتریان غیرفعال',
    campaignType: 'نگهداشت',
    objective: 'آزمون پیشنهاد بازگشت با رضایت معتبر',
    channels: ['SMS', 'WHATSAPP'],
    audienceSummary: 'Segment ساختگی غیرفعال؛ کنترل رضایت و Suppression الزامی',
    segmentReference: 'preview-segment-retention',
    startsAt: '2026-09-18T05:30:00.000Z',
    endsAt: '2026-10-10T17:30:00.000Z',
    budgetAmount: '210000000',
    spendAmount: '0',
    currencyCode: 'IRR',
    attributedRevenue: null,
    ownerRole: 'کارشناس نگهداشت',
    executionCompany: 'JAHAN_BASTAN',
    offerTitle: 'کد بازگشت پیشنهادی',
    couponCode: 'RETURN-PREVIEW',
    utmCampaign: 'retention-return-preview',
    frequencyCap: 'حداکثر ۱ پیام در ۱۴ روز',
    status: 'DRAFT',
    version: 1,
    updatedAt: '2026-08-29T13:45:00.000Z',
  },
  {
    id: 'preview-campaign-autumn',
    internalCode: 'MKT-AUTUMN-05',
    name: 'کمپین آزمایشی پاییز',
    campaignType: 'آزمایش کانال',
    objective: 'مقایسه عملکرد کانال‌های غیرارسالی',
    channels: ['WEBSITE', 'REFERRAL', 'OFFLINE'],
    audienceSummary: 'نمونه تجمیعی آزمایش کانال؛ بدون داده مشتری',
    segmentReference: 'preview-segment-experiment',
    startsAt: '2026-08-01T05:30:00.000Z',
    endsAt: '2026-08-25T17:30:00.000Z',
    budgetAmount: '90000000',
    spendAmount: '74500000',
    currencyCode: 'IRR',
    attributedRevenue: null,
    ownerRole: 'تحلیلگر بازاریابی',
    executionCompany: 'NIAYESH_SEIR_SAHAR',
    offerTitle: 'بدون پیشنهاد فروش',
    couponCode: null,
    utmCampaign: 'autumn-experiment-preview',
    frequencyCap: 'بدون ارسال مستقیم',
    status: 'COMPLETED',
    version: 6,
    updatedAt: '2026-08-26T08:10:00.000Z',
  },
] as const;

export interface MarketingCampaignQuery {
  search: string;
  status: CampaignStatus | 'ALL';
  channel: CampaignChannel | 'ALL';
  company: ExecutionCompany | 'ALL';
  sortBy: 'updatedAt' | 'startsAt' | 'budgetAmount' | 'name';
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export function normalizeMarketingCampaignQuery(
  input: Partial<MarketingCampaignQuery>,
): MarketingCampaignQuery {
  return {
    search: input.search?.trim().slice(0, 100) ?? '',
    status: input.status ?? 'ALL',
    channel: input.channel ?? 'ALL',
    company: input.company ?? 'ALL',
    sortBy: input.sortBy ?? 'updatedAt',
    sortDirection: input.sortDirection === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, Math.trunc(input.page ?? 1)),
    pageSize: Math.min(20, Math.max(2, Math.trunc(input.pageSize ?? 4))),
  };
}

export function filterAndSortCampaigns(
  campaigns: readonly CampaignPreview[],
  queryInput: Partial<MarketingCampaignQuery>,
): CampaignPreview[] {
  const query = normalizeMarketingCampaignQuery(queryInput);
  const needle = query.search.toLocaleLowerCase('fa-IR');
  return campaigns
    .filter((campaign) => {
      const searchable = [
        campaign.name,
        campaign.internalCode,
        campaign.campaignType,
        campaign.objective,
        campaign.ownerRole,
      ]
        .join(' ')
        .toLocaleLowerCase('fa-IR');
      return (
        (!needle || searchable.includes(needle)) &&
        (query.status === 'ALL' || campaign.status === query.status) &&
        (query.channel === 'ALL' ||
          campaign.channels.includes(query.channel)) &&
        (query.company === 'ALL' || campaign.executionCompany === query.company)
      );
    })
    .sort((left, right) => {
      const direction = query.sortDirection === 'asc' ? 1 : -1;
      if (query.sortBy === 'budgetAmount') {
        const difference =
          Number(left.budgetAmount) - Number(right.budgetAmount);
        return difference === 0
          ? left.id.localeCompare(right.id)
          : difference * direction;
      }
      const difference = left[query.sortBy].localeCompare(
        right[query.sortBy],
        'fa',
      );
      return difference === 0
        ? left.id.localeCompare(right.id)
        : difference * direction;
    });
}

export function paginateCampaigns(
  campaigns: readonly CampaignPreview[],
  page: number,
  pageSize: number,
): readonly CampaignPreview[] {
  const normalized = normalizeMarketingCampaignQuery({ page, pageSize });
  const start = (normalized.page - 1) * normalized.pageSize;
  return campaigns.slice(start, start + normalized.pageSize);
}

export function neutralizeSpreadsheetFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export const marketingSegments = [
  {
    id: 'preview-segment-domestic',
    title: 'مشتریان فعال سفر داخلی',
    rules: 'وضعیت فعال + رضایت کانال + بازه تعامل',
    estimatedCount: 'در انتظار قرارداد Customers',
    pii: false,
  },
  {
    id: 'preview-segment-heritage',
    title: 'علاقه‌مندان سفر فرهنگی',
    rules: 'برچسب علاقه تجمیعی + رضایت معتبر',
    estimatedCount: 'در انتظار قرارداد Customers',
    pii: false,
  },
  {
    id: 'preview-segment-agencies',
    title: 'آژانس‌های همکار فعال',
    rules: 'نوع همکاری + وضعیت قرارداد همکاری',
    estimatedCount: 'در انتظار قرارداد Partners',
    pii: false,
  },
] as const;

export const marketingOffers = [
  {
    id: 'preview-offer-installment',
    title: 'پرداخت مرحله‌ای',
    status: 'PROPOSED',
    owner: 'Sales',
    rule: 'قیمت نهایی فقط توسط Sales محاسبه می‌شود',
  },
  {
    id: 'preview-offer-return',
    title: 'مشوق بازگشت',
    status: 'PROPOSED',
    owner: 'Sales',
    rule: 'اعمال کد نیازمند اعتبارسنجی لحظه‌ای Sales است',
  },
] as const;

export const marketingCoupons = [
  {
    id: 'preview-coupon-spring',
    code: 'SPRING-PREVIEW',
    status: 'PROPOSED',
    limit: '۱ بار برای هر مرجع ناشناس',
    expiresAt: '2026-09-20T17:30:00.000Z',
  },
  {
    id: 'preview-coupon-agency',
    code: 'AGENCY-PREVIEW',
    status: 'PROPOSED',
    limit: 'سقف تجمیعی پیشنهادی',
    expiresAt: '2026-10-31T17:30:00.000Z',
  },
] as const;

export const marketingAttributionModels = [
  {
    id: 'preview-attribution-first',
    title: 'اولین تماس',
    status: 'PROPOSED',
    definition: 'تمام اعتبار تحلیلی به اولین Touchpoint تاییدشده می‌رسد.',
  },
  {
    id: 'preview-attribution-last',
    title: 'آخرین تماس غیرمستقیم',
    status: 'PROPOSED',
    definition: 'اعتبار به آخرین Touchpoint غیرمستقیم پیش از قرارداد می‌رسد.',
  },
  {
    id: 'preview-attribution-linear',
    title: 'خطی',
    status: 'PROPOSED',
    definition: 'اعتبار میان Touchpointهای معتبر به‌صورت مساوی تقسیم می‌شود.',
  },
] as const;

export const marketingTimeline = [
  {
    id: 'preview-event-01',
    campaignReference: 'preview-campaign-spring',
    action: 'تایید کمپین',
    actorRole: 'تاییدکننده مارکتینگ',
    occurredAt: '2026-08-29T08:15:00.000Z',
    version: 2,
  },
  {
    id: 'preview-event-02',
    campaignReference: 'preview-campaign-spring',
    action: 'زمان‌بندی اجرا',
    actorRole: 'برنامه‌ریز کمپین',
    occurredAt: '2026-08-30T09:30:00.000Z',
    version: 3,
  },
  {
    id: 'preview-event-03',
    campaignReference: 'preview-campaign-spring',
    action: 'شروع اجرای پیش‌نمایش',
    actorRole: 'مجری مجاز',
    occurredAt: '2026-09-01T06:20:00.000Z',
    version: 4,
  },
] as const;

export const marketingSuppressionSummary = [
  {
    id: 'preview-suppression-global',
    title: 'لغو عضویت سراسری',
    count: null,
    status: 'AWAITING_CUSTOMER_CONTRACT',
  },
  {
    id: 'preview-suppression-channel',
    title: 'عدم رضایت کانال',
    count: null,
    status: 'AWAITING_CUSTOMER_CONTRACT',
  },
  {
    id: 'preview-suppression-frequency',
    title: 'محدودیت تکرار ارسال',
    count: null,
    status: 'AWAITING_INTEGRATION_ADAPTER',
  },
] as const;
