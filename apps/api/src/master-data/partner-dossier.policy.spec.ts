import { describe, expect, it, vi } from 'vitest';
import type { MasterDataContactCrypto } from './master-data-contact.crypto';
import { preparePartnerDossier } from './partner-dossier.policy';

describe('partner dossier opt-in policy', () => {
  const protectedValue = { encrypted: 'cipher', masked: '***12' };
  const crypto = {
    protect: vi.fn(() => protectedValue),
    protectTravelPhone: vi.fn(() => protectedValue),
  } as unknown as MasterDataContactCrypto;
  it('preserves legacy requests without dossier fields', () => {
    expect(preparePartnerDossier({ name: 'Legacy' }, crypto)).toBeUndefined();
  });
  it.each([
    { dossierMobile: '123' },
    { dossierImport: 'true' },
    { dossierVersion: '2' },
    { dossierVersion: '1', dossierImport: 'false' },
  ])('rejects ambiguous opt-in %j', (input) => {
    expect(() => preparePartnerDossier(input, crypto)).toThrow();
  });
  it('protects both contacts and retains no raw contact values', () => {
    const result = preparePartnerDossier(
      {
        dossierVersion: '1',
        dossierMobile: '+989121234567',
        dossierEmail: 'test@example.test',
        dossierAddress: ' Office ',
      },
      crypto,
    );
    expect(result).toEqual({
      mobile: protectedValue,
      email: protectedValue,
      address: 'Office',
    });
    expect(JSON.stringify(result)).not.toContain('test@example.test');
    expect(crypto.protectTravelPhone).toHaveBeenCalledWith('+989121234567');
  });
  it('distinguishes untouched contacts from explicit clear', () => {
    expect(preparePartnerDossier({ dossierVersion: '1' }, crypto)).toEqual({});
    expect(
      preparePartnerDossier(
        { dossierVersion: '1', dossierEmail: '', dossierMobile: '' },
        crypto,
      ),
    ).toEqual({ email: null, mobile: null });
  });
  it('rejects oversized addresses before any write', () => {
    expect(() =>
      preparePartnerDossier(
        { dossierVersion: '1', dossierAddress: 'x'.repeat(501) },
        crypto,
      ),
    ).toThrow();
  });
});
