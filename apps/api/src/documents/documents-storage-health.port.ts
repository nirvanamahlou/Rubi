export const DOCUMENTS_STORAGE_HEALTH_PORT = Symbol(
  'DOCUMENTS_STORAGE_HEALTH_PORT',
);

export interface DocumentsStorageHealthPort {
  probe(): Promise<{ latencyMs: number; healthy: boolean }>;
}
