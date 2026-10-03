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

export type WorkerInfrastructureComponent = 'QUEUE' | 'REDIS' | 'WORKER';
export type WorkerInfrastructureStatus = 'HEALTHY' | 'UNAVAILABLE';

/**
 * Public, credential-free readiness detail exposed by the standalone Worker.
 * It contains no endpoint, credential, queue-name, or job payload data.
 */
export interface WorkerInfrastructureHealthV1 {
  component: WorkerInfrastructureComponent;
  status: WorkerInfrastructureStatus;
  checkedAt: string;
  latencyMs: number | null;
  detail: string;
}

export interface WorkerHealthResponseV1 {
  data: HealthData;
  components: WorkerInfrastructureHealthV1[];
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
