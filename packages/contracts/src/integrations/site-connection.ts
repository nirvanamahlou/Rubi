/** ERP v1 signing configuration. Secret is write-only and never part of status. */
export interface SiteConnectionInputV1 {
  expectedVersion: number;
  origin: string;
  client: string;
  system: string;
  organization: string;
  environment: string;
  keyId: string;
  /** Empty retains a saved secret only when the signing identity is unchanged. */
  secret: string;
}

export interface SiteConnectionStatusV1 {
  contract: 'integrations.site-connection.v1';
  systemId: string;
  configured: boolean;
  storageReady: boolean;
  canManage: boolean;
  version: number;
  source: 'PANEL' | 'SERVER' | 'NONE';
  connection: Omit<SiteConnectionInputV1, 'secret' | 'expectedVersion'> | null;
  secretConfigured: boolean;
  updatedAt?: string;
}
