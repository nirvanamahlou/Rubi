import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  CreateAgencyAgreedRateDto,
  CreateAgencyAgreementDto,
  UpsertAgencyProfileDto,
} from './b2b.dto';

const branchId = '11111111-1111-4111-8111-111111111111';
describe('B2B DTO integrity', () => {
  it.each(['12345678901234567.1234', '1.12345', 9007199254740992])(
    'rejects a value that cannot safely reach Decimal(20,4): %s',
    (value) => {
      const dto = plainToInstance(CreateAgencyAgreedRateDto, {
        branchId,
        serviceReference: 'HOTEL',
        title: 'Test rate',
        kind: 'FIXED_AMOUNT',
        currencyCode: 'IRR',
        value,
        validFrom: '2026-09-08',
      });
      expect(
        validateSync(dto).some((error) => error.property === 'value'),
      ).toBe(true);
    },
  );
  it('rejects whitespace titles after normalization', () => {
    const dto = plainToInstance(CreateAgencyAgreementDto, {
      branchId,
      title: '   ',
      startsAt: '2026-09-08',
    });
    expect(validateSync(dto).some((error) => error.property === 'title')).toBe(
      true,
    );
  });
  it('does not interpret null lifecycle fields as valid defaults', () => {
    const dto = plainToInstance(UpsertAgencyProfileDto, {
      branchId,
      status: null,
      displayOrder: null,
    });
    expect(validateSync(dto).map((error) => error.property)).toEqual(
      expect.arrayContaining(['status', 'displayOrder']),
    );
  });
});
