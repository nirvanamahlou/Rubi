import { describe, expect, it } from 'vitest';
import {
  matchWebsiteAgency,
  websiteAgencyInput,
} from './website-agency-directory';

const input = {
  legalName: 'شرکت گردشگری کیان',
  nationalId: '12345678901',
  economicCode: '19957350',
  registrationNumber: '918',
  tourismLicenseNumber: null,
};

describe('website agency onboarding', () => {
  it('links a single legal identity despite Persian spelling variants', () => {
    expect(
      matchWebsiteAgency(input, [
        {
          ...input,
          legalName: 'شرکت گردشگري كيان',
          id: 'agency',
          eligible: true,
        },
      ]),
    ).toEqual({ status: 'MATCHED', organizationId: 'agency' });
  });
  it('keeps same-name, mismatched and conflicting records under review', () => {
    const candidates = [{ ...input, id: 'first', eligible: true }];
    expect(
      matchWebsiteAgency(
        { ...input, nationalId: null, economicCode: 'another' },
        candidates,
      ),
    ).toEqual({ status: 'REVIEW' });
    expect(
      matchWebsiteAgency({ ...input, legalName: 'شرکت دیگری' }, candidates),
    ).toEqual({ status: 'REVIEW' });
    expect(
      matchWebsiteAgency(input, [
        ...candidates,
        { ...input, id: 'second', eligible: true },
      ]),
    ).toEqual({ status: 'REVIEW' });
    expect(matchWebsiteAgency(input, [])).toEqual({ status: 'NEW' });
  });
  it('accepts website account metadata and rejects credential fields', () => {
    const body = {
      legalName: input.legalName,
      nationalId: '۱۲۳۴۵۶۷۸۹۰۱',
      username: 'Agency@example.invalid',
      email: 'Agency@example.invalid',
      approved: true,
    };
    expect(websiteAgencyInput(body)).toMatchObject({
      nationalId: '12345678901',
      username: 'Agency@example.invalid',
      email: 'agency@example.invalid',
    });
    expect(() =>
      websiteAgencyInput({ ...body, password: 'test-only-fixture' }),
    ).toThrow();
    expect(() =>
      websiteAgencyInput({ ...body, passwordHash: 'test-only-fixture' }),
    ).toThrow();
  });
});
