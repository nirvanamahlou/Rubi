/** Nonsecret configuration only; operational connections remain adapter-owned. */
export type IntegrationLifecycle = 'ENABLED' | 'DISABLED' | 'ARCHIVED';
export type IntegrationBusinessDomain = 'TRAVEL' | 'EDUCATION' | 'OTHER';

export interface IntegrationBrandConfigV1 {
  id: string;
  code: string;
  name: string;
  lifecycle: IntegrationLifecycle;
}

export interface IntegrationCapabilityConfigV1 {
  code: string;
  name: string;
  lifecycle: IntegrationLifecycle;
}

export interface IntegrationSystemConfigV1 extends IntegrationBrandConfigV1 {
  brandId: string;
  kind: string;
  businessDomain: IntegrationBusinessDomain;
  capabilityCodes: string[];
  /** Nonsecret setup intent, never evidence of an operational connection. */
  setup?: IntegrationSiteSetupV1;
}

export interface IntegrationSiteSetupV1 {
  websiteUrl?: string;
  apiBaseUrl?: string;
  documentationUrl?: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  protocol: 'UNDECIDED' | 'REST' | 'WEBHOOK' | 'MANUAL';
  authentication: 'UNDECIDED' | 'API_KEY' | 'OAUTH2' | 'HMAC' | 'NONE';
}

export interface IntegrationCatalogueConfigV1 {
  schemaVersion: 1;
  brands: IntegrationBrandConfigV1[];
  systems: IntegrationSystemConfigV1[];
  capabilities: IntegrationCapabilityConfigV1[];
}

export interface IntegrationRegistryWriteV1 extends IntegrationCatalogueConfigV1 {
  expectedVersion: number;
  reason: string;
}

export interface IntegrationRegistryV1 extends IntegrationCatalogueConfigV1 {
  contract: 'integrations.registry.v1';
  branchId: string;
  initialized: boolean;
  version: number;
  canManage: boolean;
  connectionState: 'NOT_CONFIGURED';
  lastChange: {
    occurredAt: string;
    actorUserId: string;
    reason: string;
  } | null;
  /** Only measured catalogue counts. No sales, payments or delivery estimates. */
  counts: {
    brands: number;
    systems: number;
    awaitingConnection: number;
  } | null;
}

export interface IntegrationExistingAdapterV1 {
  code: string;
  title: string;
  owner: 'Integrations' | 'Customer Affairs';
  operations: readonly string[];
  verification: 'NOT_VERIFIED';
}
