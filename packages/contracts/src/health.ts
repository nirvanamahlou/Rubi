export const HEALTH_STATUS_OK = 'ok' as const;

export interface HealthData {
  service: 'api' | 'worker';
  status: typeof HEALTH_STATUS_OK;
  timestamp: string;
}

export interface ResponseMeta {
  requestId: string;
}

export interface HealthResponse {
  data: HealthData;
  meta: ResponseMeta;
}

export function createHealthData(
  service: HealthData['service'],
  now: Date = new Date(),
): HealthData {
  return {
    service,
    status: HEALTH_STATUS_OK,
    timestamp: now.toISOString(),
  };
}
