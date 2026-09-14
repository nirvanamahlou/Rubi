export const PACKAGE_PRICING_CONTRACT_VERSION = 1 as const;
export const PACKAGE_PRICING_API_PREFIX = '/api/v1/sales/pricing' as const;

export const PACKAGE_PRICING_PERMISSION_CODES = [
  'package_pricing.read',
  'package_pricing.create',
  'package_pricing.update',
  'package_pricing.archive',
  'package_pricing.period.manage',
  'package_pricing.rule.manage',
  'package_pricing.cost.read',
  'package_pricing.margin.read',
  'package_pricing.publish',
  'package_pricing.stop',
  'package_pricing.discount.override',
  'package_pricing.quote.create',
  'package_pricing.template.manage',
  'package_pricing.render',
  'package_pricing.audit.read',
] as const;
export type PackagePricingPermissionCode =
  (typeof PACKAGE_PRICING_PERMISSION_CODES)[number];

export const PACKAGE_PRICING_ERROR_CODES = [
  'PACKAGE_NOT_FOUND',
  'PACKAGE_FORBIDDEN',
  'PACKAGE_VALIDATION_FAILED',
  'CONCURRENT_MODIFICATION',
  'IDEMPOTENCY_CONFLICT',
  'SOURCE_RATE_UNAVAILABLE',
  'SOURCE_REFERENCE_REJECTED',
  'FX_SNAPSHOT_NOT_APPROVED',
  'CAPACITY_RECHECK_FAILED',
  'MINIMUM_MARGIN_VIOLATION',
  'PUBLISHED_PRICE_IMMUTABLE',
  'MAKER_CHECKER_VIOLATION',
  'LEGAL_ENTITY_REQUIRED',
  'RENDERER_UNAVAILABLE',
] as const;
export type PackagePricingErrorCode =
  (typeof PACKAGE_PRICING_ERROR_CODES)[number];

export type PackageStatus =
  | 'DRAFT'
  | 'READY_FOR_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'STOPPED'
  | 'EXPIRED'
  | 'ARCHIVED';
export type PackageComponentKind =
  | 'OUTBOUND_TICKET'
  | 'RETURN_TICKET'
  | 'HOTEL'
  | 'VISA'
  | 'INSURANCE'
  | 'TRANSFER'
  | 'TOUR'
  | 'LEADER'
  | 'OTHER';
export type PackageRuleOperation =
  | 'ADD_FIXED'
  | 'SUBTRACT_FIXED'
  | 'ADD_PERCENT'
  | 'SUBTRACT_PERCENT'
  | 'MULTIPLY'
  | 'DIVIDE'
  | 'FEE'
  | 'COMMISSION'
  | 'TAX'
  | 'PROFIT'
  | 'ROUND'
  | 'MINIMUM_PROFIT'
  | 'MINIMUM_SALE_PRICE';
export type PackagePassengerCategory =
  | 'ADULT'
  | 'CHILD_WITH_BED'
  | 'CHILD_WITHOUT_BED'
  | 'INFANT'
  | 'SINGLE_ROOM'
  | 'DOUBLE_ROOM'
  | 'TRIPLE_ROOM';
export type PackagePriceVersionStatus =
  'DRAFT' | 'READY_FOR_REVIEW' | 'PUBLISHED' | 'STOPPED';
export type PackageQuoteStatus =
  'DRAFT' | 'APPROVED' | 'CONVERTED_TO_CONTRACT' | 'EXPIRED' | 'CANCELLED';
export type PackageBannerFormat =
  'SQUARE_POST' | 'STORY' | 'HORIZONTAL' | 'WEBSITE' | 'A4';
export type PackageRenderStatus =
  'AWAITING_RENDERER' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface PackageMoneyV1 {
  amount: string;
  currencyCode: string;
}

export interface PackageSourceReferenceV1 {
  owner:
    | 'MASTER_DATA'
    | 'TICKET_CATALOG'
    | 'RESERVATIONS'
    | 'FINANCE'
    | 'PROCUREMENT';
  kind: string;
  id: string;
  version: number;
}

export interface PackageComponentInputV1 {
  clientKey: string;
  kind: PackageComponentKind;
  source: PackageSourceReferenceV1;
  titleSnapshot: string;
  quantity: number;
  capacity?: number | null;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface PackageHotelOptionInputV1 {
  hotel: PackageSourceReferenceV1;
  hotelNameSnapshot: string;
  roomType: PackageSourceReferenceV1;
  roomTypeNameSnapshot: string;
  mealService: PackageSourceReferenceV1;
  mealServiceNameSnapshot: string;
  checkInDate: string;
  checkOutDate: string;
}

export interface PackageCreateInputV1 {
  code: string;
  titleFa: string;
  titleEn: string;
  issuerLegalEntityId: string;
  issuerLegalEntityVersion: number;
  destinationId: string;
  destinationNameSnapshot: string;
  departureDate: string;
  returnDate: string;
  nights: number;
  days: number;
  capacity: number;
  priceValidUntil: string;
  description?: string | null;
  terms?: string | null;
  components: readonly PackageComponentInputV1[];
  hotelOptions: readonly PackageHotelOptionInputV1[];
}

export interface PackageListQueryV1 {
  search?: string;
  branchId?: string;
  destinationId?: string;
  status?: PackageStatus;
  departureFrom?: string;
  departureTo?: string;
  sortBy?: 'updatedAt' | 'departureDate' | 'code' | 'titleFa';
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface PackagePricingRuleInputV1 {
  sequence: number;
  title: string;
  operation: PackageRuleOperation;
  value: string;
  appliesToComponentKey?: string | null;
}

export interface PackagePriceVersionCreateInputV1 {
  expectedPackageVersion: number;
  pricingPeriodId: string;
  outputCurrencyCode: string;
  rules: readonly PackagePricingRuleInputV1[];
  passengerMultipliers: readonly {
    category: PackagePassengerCategory;
    multiplier: string;
  }[];
  reason: string;
}

export interface PackagePublishInputV1 {
  expectedPackageVersion: number;
  expectedPriceVersion: number;
  reason: string;
}

export interface PackageQuoteCreateInputV1 {
  packageId: string;
  departureId: string;
  priceVersionId: string;
  customerReference?: string | null;
  agencyReference?: string | null;
  counts: Readonly<Partial<Record<PackagePassengerCategory, number>>>;
  discount?: PackageMoneyV1 | null;
  validUntil: string;
  notes?: string | null;
}

export interface PackageRenderCreateInputV1 {
  packageId: string;
  departureId: string;
  priceVersionId: string;
  templateId: string;
  templateVersion: number;
  brandingSnapshotId: string;
  brandingSnapshotVersion: number;
  format: 'PNG' | 'JPEG' | 'PDF';
}

export interface PackageBannerTemplateCreateInputV1 {
  branchId: string;
  issuerLegalEntityId: string;
  code: string;
  title: string;
  format: PackageBannerFormat;
  width: number;
  height: number;
  templateDefinition: Readonly<Record<string, unknown>>;
}

export interface PackageSummaryV1 {
  id: string;
  code: string;
  titleFa: string;
  titleEn: string;
  destinationId: string;
  destinationNameSnapshot: string;
  departureDate: string;
  returnDate: string;
  nights: number;
  days: number;
  capacity: number;
  status: PackageStatus;
  version: number;
  latestPrice:
    | (PackageMoneyV1 & {
        version: number;
        marginAmount: string;
        marginPercent: string;
      })
    | null;
  updatedAt: string;
  updatedByUserId: string;
}

export interface PackagePageV1 {
  version: 1;
  data: readonly PackageSummaryV1[];
  meta: { page: number; pageSize: number; total: number };
}

export interface PackageRuleBreakdownLineV1 {
  sequence: number;
  title: string;
  operation: PackageRuleOperation;
  before: string;
  adjustment: string;
  after: string;
}

export interface PackagePriceBreakdownV1 {
  currencyCode: string;
  baseAmount: string;
  adjustments: string;
  fee: string;
  tax: string;
  profit: string;
  finalAmount: string;
  lines: readonly PackageRuleBreakdownLineV1[];
}

export const packagePricingEndpoints = {
  packages: PACKAGE_PRICING_API_PREFIX + '/packages',
  package: (id: string) =>
    PACKAGE_PRICING_API_PREFIX + '/packages/' + encodeURIComponent(id),
  priceVersions: (id: string, departureId: string) =>
    PACKAGE_PRICING_API_PREFIX +
    '/packages/' +
    encodeURIComponent(id) +
    '/departures/' +
    encodeURIComponent(departureId) +
    '/price-versions',
  quotes: PACKAGE_PRICING_API_PREFIX + '/quotes',
  templates: PACKAGE_PRICING_API_PREFIX + '/banner-templates',
  renders: PACKAGE_PRICING_API_PREFIX + '/render-requests',
} as const;
