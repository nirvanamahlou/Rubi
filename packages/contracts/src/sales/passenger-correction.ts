export interface SalesPassengerIdentityV1 {
  customerId: string;
  name: string;
  birthDate: string;
  passportNumber: string | null;
  passportExpiryDate: string | null;
}
export interface SalesPassengerCorrectionCommandV1 {
  operationId: string;
  expectedVersion: number;
  passengers: readonly Omit<SalesPassengerIdentityV1, 'name'>[];
  note: string;
}
export interface SalesPassengerCorrectionHistoryV1 {
  id: string;
  occurredAt: string;
  actorUserId: string;
  actorName: string;
  version: number;
  note: string;
  changes: readonly {
    customerId: string;
    name: string;
    field: 'birthDate' | 'passportNumber' | 'passportExpiryDate';
    before: string | null;
    after: string | null;
    masked: boolean;
  }[];
}
