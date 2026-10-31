import type { CallCenterCrypto } from './call-center.crypto';

export function normalizeCallSearch(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('fa')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[۰-۹]/g, (n) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(n)))
    .replace(/[٠-٩]/g, (n) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(n)))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
export function callSearchToken(
  crypto: CallCenterCrypto,
  branch: string,
  kind: string,
  value: string,
) {
  return crypto.fingerprint(
    `search:v1:${branch}:${kind}:${normalizeCallSearch(value)}`,
  );
}
export function callSearchMetadata(
  crypto: CallCenterCrypto,
  branch: string,
  value: {
    name: string;
    subject: string;
    phone: string;
    source: string;
    operator: string;
  },
  outcome: string | null | undefined,
) {
  const words = [
    ...new Set(
      normalizeCallSearch(`${value.name} ${value.subject}`)
        .split(' ')
        .filter(Boolean),
    ),
  ];
  return {
    searchTokens: words.map((word) =>
      callSearchToken(crypto, branch, 'word', word),
    ),
    sourceToken: callSearchToken(crypto, branch, 'source', value.source),
    unitToken: callSearchToken(crypto, branch, 'unit', value.operator),
    needsCompletion:
      !value.name.trim() ||
      !value.phone ||
      !outcome ||
      !value.subject.trim() ||
      !value.source.trim() ||
      value.source === 'نامشخص' ||
      !value.operator.trim() ||
      value.operator === 'نامشخص',
    searchVersion: 1,
  };
}
