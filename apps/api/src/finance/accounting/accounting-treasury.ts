import {
  treasuryDocumentTypes,
  type AccountingAttributes,
} from '@nora/contracts';
import * as v from './accounting.validation';

export const treasuryConfigKinds = [
  'bank-account-types',
  'treasury-causes',
  'payment-providers',
];
export function treasuryConfigAttributes(
  kind: string,
  code: unknown,
  attrs: AccountingAttributes,
): AccountingAttributes {
  if (kind === 'bank-account-types') {
    if (typeof attrs.hasCheckbook !== 'boolean')
      v.invalid('وضعیت دسته چک معتبر نیست.');
    return { hasCheckbook: attrs.hasCheckbook };
  }
  v.text(code, 40, true);
  if (kind === 'treasury-causes') {
    const documentType = v.text(attrs.documentType, 40, true);
    if (!treasuryDocumentTypes.some((value) => value === documentType))
      v.invalid('نوع سند معتبر نیست.');
    return { documentType, descriptionEn: v.text(attrs.descriptionEn, 2000) };
  }
  const email = v.text(attrs.email, 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    v.invalid('پست الکترونیکی معتبر نیست.');
  return {
    shortName: v.text(attrs.shortName, 160),
    email,
    phone: v.text(attrs.phone, 50),
  };
}
