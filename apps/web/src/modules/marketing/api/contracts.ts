export const MARKETING_UI_VERSION = 'marketing.ui.v1-preview' as const;

export const MARKETING_PREVIEW_NOTICE =
  'این محیط فقط پیش‌نمایش ساختگی است؛ داده‌ای ذخیره، پیامی ارسال و اثر مالی ثبت نمی‌شود.' as const;

export const MARKETING_ANALYTICS_STATUS =
  'AWAITING_ANALYTICS_CONTRACT' as const;
export const MARKETING_ATTRIBUTION_STATUS = 'PROPOSED' as const;
export const MARKETING_DISPATCH_STATUS =
  'AWAITING_INTEGRATION_ADAPTER' as const;

export type MarketingPreviewState =
  | 'preview'
  | 'loading'
  | 'empty'
  | 'error'
  | 'unauthorized'
  | 'forbidden'
  | 'conflict'
  | 'awaiting-integration';

export const marketingEndpointProposals = {
  dashboard: '/api/v1/marketing/dashboard',
  campaigns: '/api/v1/marketing/campaigns',
  campaign: '/api/v1/marketing/campaigns/:campaignReference',
  transition: '/api/v1/marketing/campaigns/:campaignReference/transitions',
  timeline: '/api/v1/marketing/campaigns/:campaignReference/timeline',
  segments: '/api/v1/marketing/segments',
  offers: '/api/v1/marketing/offers',
  coupons: '/api/v1/marketing/coupons',
  attribution: '/api/v1/marketing/attribution',
  dispatchIntents: '/api/v1/marketing/dispatch-intents',
} as const;

export const marketingPermissionProposals = [
  'marketing.read',
  'marketing.campaign.create',
  'marketing.campaign.update',
  'marketing.campaign.approve',
  'marketing.campaign.schedule',
  'marketing.campaign.execute',
  'marketing.campaign.pause',
  'marketing.campaign.cancel',
  'marketing.audience.read',
  'marketing.audience.manage',
  'marketing.offer.manage',
  'marketing.budget.read',
  'marketing.budget.manage',
  'marketing.cost.record',
  'marketing.attribution.read',
  'marketing.analytics.read',
  'marketing.audit.read',
  'marketing.sensitive_summary.read',
] as const;

export interface MarketingKpiDefinition {
  key: string;
  title: string;
  definition: string;
  numerator: string;
  denominator: string | null;
  status: typeof MARKETING_ANALYTICS_STATUS;
  value: null;
}

function awaitingKpi(
  key: string,
  title: string,
  definition: string,
  numerator: string,
  denominator: string | null = null,
): MarketingKpiDefinition {
  return {
    key,
    title,
    definition,
    numerator,
    denominator,
    status: MARKETING_ANALYTICS_STATUS,
    value: null,
  };
}

export const marketingKpiDefinitions = [
  awaitingKpi(
    'activeCampaigns',
    'کمپین‌های فعال',
    'کمپین‌های دارای وضعیت RUNNING در بازه گزارش',
    'تعداد کمپین RUNNING',
  ),
  awaitingKpi(
    'scheduledCampaigns',
    'کمپین‌های زمان‌بندی‌شده',
    'کمپین‌های تاییدشده با اجرای آینده',
    'تعداد کمپین SCHEDULED',
  ),
  awaitingKpi(
    'totalBudget',
    'بودجه کل',
    'جمع آخرین نسخه بودجه تاییدشده کمپین‌ها به تفکیک ارز',
    'جمع بودجه تاییدشده',
  ),
  awaitingKpi(
    'recordedSpend',
    'هزینه ثبت‌شده',
    'جمع هزینه دارای مرجع معتبر مالی',
    'جمع هزینه ثبت‌شده Finance',
  ),
  awaitingKpi(
    'remainingBudget',
    'بودجه باقی‌مانده',
    'بودجه تاییدشده منهای هزینه ثبت‌شده در همان ارز',
    'بودجه تاییدشده - هزینه ثبت‌شده',
  ),
  awaitingKpi(
    'targetAudience',
    'مخاطبان هدف',
    'تعداد تجمیعی اعضای Segment پیش از کنترل ارسال',
    'تعداد اعضای Segment',
  ),
  awaitingKpi(
    'sendableMessages',
    'پیام‌های قابل ارسال',
    'مخاطبان رضایت‌داده و غیرمسدود پس از Frequency Cap',
    'مخاطب مجاز پس از کنترل‌ها',
  ),
  awaitingKpi(
    'deliveryRate',
    'نرخ تحویل',
    'نسبت پیام تحویل‌شده به پیام پذیرفته‌شده توسط ارائه‌دهنده',
    'پیام تحویل‌شده',
    'پیام پذیرفته‌شده',
  ),
  awaitingKpi(
    'openRate',
    'نرخ بازشدن',
    'نسبت بازشدن یکتا به پیام تحویل‌شده در کانال قابل‌اندازه‌گیری',
    'بازشدن یکتا',
    'پیام تحویل‌شده',
  ),
  awaitingKpi(
    'clickRate',
    'نرخ کلیک',
    'نسبت کلیک یکتا به پیام تحویل‌شده',
    'کلیک یکتا',
    'پیام تحویل‌شده',
  ),
  awaitingKpi(
    'attributedLeads',
    'سرنخ‌های منتسب',
    'سرنخ‌هایی که طبق مدل مصوب Touchpoint به کمپین منتسب شده‌اند',
    'سرنخ منتسب',
  ),
  awaitingKpi(
    'attributedContracts',
    'قراردادهای منتسب',
    'قراردادهای قطعی منتسب‌شده پس از تایید Sales',
    'قرارداد منتسب',
  ),
  awaitingKpi(
    'conversionRate',
    'نرخ تبدیل',
    'نسبت قرارداد منتسب به سرنخ منتسب',
    'قرارداد منتسب',
    'سرنخ منتسب',
  ),
  awaitingKpi(
    'attributedRevenue',
    'درآمد منتسب',
    'جمع درآمد قطعی قراردادهای منتسب با منبع Sales/Finance',
    'درآمد قطعی منتسب',
  ),
  awaitingKpi(
    'cac',
    'هزینه جذب مشتری (CAC)',
    'هزینه ثبت‌شده تقسیم بر مشتری جدید منتسب',
    'هزینه ثبت‌شده',
    'مشتری جدید منتسب',
  ),
  awaitingKpi(
    'roas',
    'بازده هزینه تبلیغات (ROAS)',
    'درآمد منتسب تقسیم بر هزینه ثبت‌شده',
    'درآمد منتسب',
    'هزینه ثبت‌شده',
  ),
  awaitingKpi(
    'unsubscribes',
    'لغو عضویت',
    'تعداد رخدادهای لغو رضایت در بازه گزارش',
    'رخداد لغو رضایت',
  ),
  awaitingKpi(
    'suppressedContacts',
    'مخاطبان مسدودشده',
    'تعداد مراجع ناشناس یکتا در Suppression List',
    'مرجع ناشناس مسدودشده',
  ),
] as const satisfies readonly MarketingKpiDefinition[];
