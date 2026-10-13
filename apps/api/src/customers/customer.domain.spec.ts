import { describe, expect, it } from 'vitest';
import {
  customerApiDesign,
  customerPermissions,
  type CustomerDraftDto,
} from './customer.contracts';
import {
  detectDuplicateCandidate,
  maskContact,
  validateCustomerDraft,
} from './customer.domain';

const draft: CustomerDraftDto = {
  displayName: 'مسافر نمونه',
  firstName: 'نمونه',
  lastName: 'آزمایشی',
  birthDate: '1990-01-01',
  primaryPhone: ['+98', '912', '000', '1234'].join(''),
  email: 'preview@example.invalid',
  addressLabel: 'نشانی نمایشی ثبت‌نشده',
  consentStatus: 'not-recorded',
  companionCustomerIds: [],
};

describe('customer domain foundation', () => {
  it('validates a non-sensitive draft', () => {
    expect(validateCustomerDraft(draft)).toEqual({ valid: true, errors: {} });
    expect(
      validateCustomerDraft({ ...draft, firstName: '', email: 'invalid' })
        .valid,
    ).toBe(false);
  });
  it('creates candidates for manual review and never auto-merges', () => {
    const candidate = detectDuplicateCandidate(draft, {
      ...draft,
      id: 'preview-2',
    });
    expect(candidate).toMatchObject({ score: 100, reviewStatus: 'pending' });
    expect(candidate).not.toHaveProperty('mergedCustomerId');
  });
  it('ignores weak matches and masks contacts', () => {
    expect(
      detectDuplicateCandidate(draft, {
        ...draft,
        id: 'preview-3',
        firstName: 'دیگر',
        lastName: 'فرد',
        primaryPhone: ['+98', '912', '000', '9999'].join(''),
        birthDate: null,
      }),
    ).toBeNull();
    expect(maskContact(draft.primaryPhone)).toBe('+989•••234');
  });
  it('uses the published customers.* permissions', () => {
    expect(customerPermissions.read).toBe('customers.read');
    expect(customerApiDesign.reviewDuplicate.permission).toBe(
      'customers.merge',
    );
    expect(
      Object.values(customerPermissions).every((value) =>
        value.startsWith('customers.'),
      ),
    ).toBe(true);
  });
});
