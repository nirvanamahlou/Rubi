/** Internal owner-to-owner V1 references. Never serialized into dashboard HTTP output. */
export interface CustomerBehaviorSignal {
  customerId: string;
  at: Date;
  service?: string;
  destinationId?: string;
}
export type CustomerBehaviorSignals =
  | { state: 'ready'; signals: readonly CustomerBehaviorSignal[] }
  | { state: 'forbidden' | 'unsupported' | 'unavailable'; reason?: string };
