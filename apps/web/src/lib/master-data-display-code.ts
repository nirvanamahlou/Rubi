import type { MasterDataRecord } from '@nora/contracts';

/** Display only: keep the legacy code in API write/import payloads. */
export function masterDataDisplayCode(record: MasterDataRecord): string {
  const code = record.attributes.accountingCode;
  return typeof code === 'string' && /^3\d{6}$/.test(code) ? code : record.code;
}
