import type { MasterDataRecord } from '@nora/contracts';
export type BrokerLeaderValue = {
  key: string;
  id?: string;
  version?: number;
  name: string;
  phone: string;
  phoneMasked: string;
  phoneTouched: boolean;
};
export function brokerFormValues(
  record?: MasterDataRecord,
): Record<string, string> {
  return {
    name: record?.name ?? '',
    englishName: String(record?.attributes.englishName ?? ''),
    primaryPhone: '',
    boardText: String(record?.attributes.boardText ?? ''),
    countryId: String(record?.attributes.countryId ?? ''),
    cityIds: String(
      record?.attributes.cityIds ?? record?.attributes.cityId ?? '',
    ),
  };
}
export function brokerLeaderValues(
  record?: MasterDataRecord,
): BrokerLeaderValue[] {
  if (!record) return [];
  const items: {
    id: string;
    version: number;
    name: string;
    primaryPhoneMasked?: string;
  }[] = JSON.parse(String(record.attributes.leadersJson ?? '[]'));
  return items.map((l) => ({
    key: l.id,
    id: l.id,
    version: l.version,
    name: l.name,
    phone: '',
    phoneMasked: l.primaryPhoneMasked ?? '',
    phoneTouched: false,
  }));
}
export function brokerName(values: Record<string, string>): string {
  return (values.name ?? '').trim() || (values.englishName ?? '').trim();
}

export function brokerMutationValues(
  values: Record<string, string>,
  leaders: BrokerLeaderValue[],
  record?: MasterDataRecord,
  phoneTouched = false,
): Record<string, string> {
  const result: Record<string, string> = {
    ...values,
    name: brokerName(values),
  };
  if (record && !phoneTouched) delete result.primaryPhone;
  result.leaderDrafts = JSON.stringify({
    items: leaders.map((l) => ({
      ...(l.id ? { id: l.id, version: l.version } : {}),
      name: l.name.trim(),
      ...(!l.id || l.phoneTouched ? { phone: l.phone.trim() } : {}),
    })),
    removed: brokerLeaderValues(record)
      .filter((l) => !leaders.some((v) => v.id === l.id))
      .map((l) => ({ id: l.id, version: l.version })),
  });
  return result;
}
