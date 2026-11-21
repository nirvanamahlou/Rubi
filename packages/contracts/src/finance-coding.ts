export const financeCodingProfiles = [
  {
    prefix: '2',
    typeCode: 'FIN-CODING-001-2',
    title: 'پرسنل',
    firstCode: '20000001',
  },
  {
    prefix: '3',
    typeCode: 'FIN-CODING-001-3',
    title: 'مشتریان حقوقی',
    firstCode: '30000001',
  },
  {
    prefix: '4',
    typeCode: 'FIN-CODING-001-4',
    title: 'مشتریان حقیقی',
    firstCode: '40000001',
  },
  {
    prefix: '5',
    typeCode: 'FIN-CODING-001-5',
    title: 'حساب‌های بانکی',
    firstCode: '50000001',
  },
] as const;

export const financeCodingWidth = 8;
export const financeCodingCapacity = 9_999_999n;
export type FinanceCodingProfile = (typeof financeCodingProfiles)[number];

export function financeCodingProfile(typeCode: unknown) {
  return financeCodingProfiles.find((profile) => profile.typeCode === typeCode);
}

export function financeCodingProfileForValue(value: string) {
  if (!/^[2345]\d{7}$/.test(value) || value.slice(1) === '0000000')
    return undefined;
  return financeCodingProfiles.find((profile) => profile.prefix === value[0]);
}
