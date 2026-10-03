import type {
  B2bCrmConnectionsV1,
  B2bCrmPaymentDocumentV1,
  B2bCrmPaymentDocumentsV1,
} from '@nora/contracts';

export function crmContextKey(
  organizationId: string,
  branchId: string,
  sessionContextKey: string,
  revision: number,
) {
  return `${organizationId}|${branchId}|${sessionContextKey}|${revision}`;
}

export function crmSnapshotValue<T>(
  snapshot: { key: string; data: T } | undefined,
  currentKey: string,
) {
  return snapshot?.key === currentKey ? snapshot.data : undefined;
}

export async function boundSnapshotRequest<T>(
  key: string,
  signal: AbortSignal,
  request: () => Promise<T>,
  validate: (value: T) => T,
) {
  const data = validate(await request());
  return signal.aborted ? undefined : { key, data };
}

export type BoundDeliveryContext = {
  key: string;
  generation: number;
};

export async function deliverBoundDownload<T>(
  expected: BoundDeliveryContext,
  current: () => BoundDeliveryContext,
  request: () => Promise<T>,
  deliver: (value: T) => void,
) {
  const value = await request();
  const active = current();
  if (active.key !== expected.key || active.generation !== expected.generation)
    return false;
  deliver(value);
  return true;
}

export function assertCrmContext(
  response: B2bCrmConnectionsV1,
  organizationId: string,
  branchId: string,
) {
  if (
    response.organizationId !== organizationId ||
    response.branchId !== branchId
  )
    throw new Error('پاسخ ارتباطات با پرونده و شعبه انتخاب‌شده همخوان نیست.');
  return response;
}

export function assertPaymentDocumentContext(
  response: B2bCrmPaymentDocumentsV1,
  organizationId: string,
  branchId: string,
  contractId: string,
) {
  if (
    response.organizationId !== organizationId ||
    response.branchId !== branchId ||
    response.contractId !== contractId
  )
    throw new Error('پاسخ رسیدها با قرارداد و پرونده انتخاب‌شده همخوان نیست.');
  return response;
}

export function canDownloadPaymentDocument(document: B2bCrmPaymentDocumentV1) {
  return (
    document.capabilities.download &&
    document.currentVersion.scanStatus === 'CLEAN'
  );
}
