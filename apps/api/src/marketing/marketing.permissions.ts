import { MarketingDomainError } from './marketing.errors';

export const marketingPermissions = [
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

export type MarketingPermission = (typeof marketingPermissions)[number];

export type MarketingAction =
  | 'campaign.read'
  | 'campaign.create'
  | 'campaign.update'
  | 'campaign.approve'
  | 'campaign.schedule'
  | 'campaign.execute'
  | 'campaign.pause'
  | 'campaign.cancel'
  | 'audience.read'
  | 'audience.manage'
  | 'offer.manage'
  | 'budget.read'
  | 'budget.manage'
  | 'cost.record'
  | 'attribution.read'
  | 'analytics.read'
  | 'audit.read'
  | 'sensitive-summary.read';

export const marketingActionPermission: Readonly<
  Record<MarketingAction, MarketingPermission>
> = {
  'campaign.read': 'marketing.read',
  'campaign.create': 'marketing.campaign.create',
  'campaign.update': 'marketing.campaign.update',
  'campaign.approve': 'marketing.campaign.approve',
  'campaign.schedule': 'marketing.campaign.schedule',
  'campaign.execute': 'marketing.campaign.execute',
  'campaign.pause': 'marketing.campaign.pause',
  'campaign.cancel': 'marketing.campaign.cancel',
  'audience.read': 'marketing.audience.read',
  'audience.manage': 'marketing.audience.manage',
  'offer.manage': 'marketing.offer.manage',
  'budget.read': 'marketing.budget.read',
  'budget.manage': 'marketing.budget.manage',
  'cost.record': 'marketing.cost.record',
  'attribution.read': 'marketing.attribution.read',
  'analytics.read': 'marketing.analytics.read',
  'audit.read': 'marketing.audit.read',
  'sensitive-summary.read': 'marketing.sensitive_summary.read',
};

export function hasMarketingPermission(
  grantedPermissions: readonly string[],
  action: MarketingAction,
): boolean {
  return grantedPermissions.includes(marketingActionPermission[action]);
}

export function assertMarketingPermission(
  grantedPermissions: readonly string[],
  action: MarketingAction,
): void {
  if (!hasMarketingPermission(grantedPermissions, action)) {
    throw new MarketingDomainError(
      'MARKETING_PERMISSION_DENIED',
      'Marketing permissions are deny-by-default.',
      { requiredPermission: marketingActionPermission[action] },
    );
  }
}
