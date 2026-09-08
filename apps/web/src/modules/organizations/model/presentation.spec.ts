import type { B2bAgencyAgreementV1 } from '@rubi/contracts';
import { describe, expect, it } from 'vitest';
import { agreementLabel, cooperationLabel, moneyLabel } from './presentation';

describe('organization presentation from real projections', () => {
  it('preserves Decimal precision above the safe integer limit', () => {
    expect(moneyLabel('123456789012345678.1234', 'IRR')).toBe(
      '۱۲۳٬۴۵۶٬۷۸۹٬۰۱۲٬۳۴۵٬۶۷۸٫۱۲۳۴ IRR',
    );
    expect(moneyLabel('invalid', 'IRR')).toBe('نامشخص');
    expect(moneyLabel('-0.0001', 'IRR')).toBe('−۰٫۰۰۰۱ IRR');
  });
  it('labels a dual-role organization without duplicating its identity', () => {
    expect(cooperationLabel('AGENCY,CORPORATE_CUSTOMER')).toBe(
      'آژانس و مشتری سازمانی',
    );
  });
  const agreement = {
    status: 'ACTIVE',
    isActive: true,
    startsAt: '2026-09-01',
    endsAt: '2026-09-08',
  } as B2bAgencyAgreementV1;
  it('uses inclusive UTC date validity and does not call expired agreements active', () => {
    expect(agreementLabel(agreement, '2026-09-08')).toBe('فعال');
    expect(agreementLabel(agreement, '2026-09-09')).toBe('منقضی');
    expect(agreementLabel(agreement, '2026-08-31')).toBe('هنوز آغاز نشده');
    expect(
      agreementLabel({ ...agreement, status: 'DRAFT' }, '2026-09-09'),
    ).toBe('پیش‌نویس');
  });
});
