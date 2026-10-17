import { BadRequestException } from '@nestjs/common';
import type { MasterDataContactCrypto } from './master-data-contact.crypto';

export function preparePartnerDossier(
  values: Record<string, unknown>,
  crypto: MasterDataContactCrypto,
) {
  if (values.dossierVersion === undefined) {
    if (
      ['dossierEmail', 'dossierMobile', 'dossierAddress', 'dossierImport'].some(
        (key) => Object.hasOwn(values, key),
      )
    )
      throw new BadRequestException('Partner dossier version is required.');
    return undefined;
  }
  if (values.dossierVersion !== '1')
    throw new BadRequestException('Unsupported partner dossier version.');
  const result: Record<string, unknown> = {};
  if (values.dossierImport !== undefined) {
    if (values.dossierImport !== 'true')
      throw new BadRequestException('Invalid partner import mode.');
    result.import = true;
  }
  for (const [field, kind] of [
    ['dossierEmail', 'email'],
    ['dossierMobile', 'phone'],
  ] as const) {
    if (!Object.hasOwn(values, field)) continue;
    if (typeof values[field] !== 'string')
      throw new BadRequestException('Partner contact must be text.');
    const value = String(values[field]).normalize('NFKC').trim();
    result[field === 'dossierEmail' ? 'email' : 'mobile'] = value
      ? kind === 'phone'
        ? crypto.protectTravelPhone(value)
        : crypto.protect(kind, value)
      : null;
  }
  if (Object.hasOwn(values, 'dossierAddress')) {
    if (
      values.dossierAddress !== null &&
      typeof values.dossierAddress !== 'string'
    )
      throw new BadRequestException('Partner address must be text.');
    const address = String(values.dossierAddress ?? '').trim();
    if (address.length > 500)
      throw new BadRequestException('Partner address exceeds 500 characters.');
    result.address = address || null;
  }
  return result;
}
