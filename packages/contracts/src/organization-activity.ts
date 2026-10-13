/** Safe metadata projection shared by the owning audit services. No raw snapshots. */
export type OrganizationActivitySource = 'B2B' | 'MASTER_DATA' | 'DOCUMENTS';
export type OrganizationActivityCategory =
  'PROFILE' | 'ACCESS' | 'CONTRACT' | 'CREDIT' | 'RATE' | 'DOCUMENT';
export interface OrganizationActivityEvent {
  id: string;
  source: OrganizationActivitySource;
  category: OrganizationActivityCategory;
  action: string;
  outcome: string;
  entityId: string | null;
  entityType: string;
  actorUserId: string;
  actorName: string;
  occurredAt: string;
  changedFields: string[];
}
export interface OrganizationActivityQuery {
  from?: string;
  to?: string;
  source?: OrganizationActivitySource | undefined;
  category?: OrganizationActivityCategory | undefined;
  outcome?: string;
  cursor?: string;
  asOf?: string;
}
export interface OrganizationActivityPage {
  data: OrganizationActivityEvent[];
  nextCursor: string | null;
  asOf: string;
  unavailableSources: string[];
}
