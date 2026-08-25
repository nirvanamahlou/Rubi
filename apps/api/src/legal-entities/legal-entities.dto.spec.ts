import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import {
  CreateDocumentIssueDto,
  ReissueDocumentDto,
  SwitchLegalEntityDto,
} from './legal-entities.dto';

describe('legal entity review DTO validation', () => {
  it('requires a non-negative expectedVersion including zero for initial context', async () => {
    await expect(
      validate(
        plainToInstance(SwitchLegalEntityDto, {
          selection: 'NIYAYESH_SEIR_SAHAR',
          expectedVersion: 0,
        }),
      ),
    ).resolves.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(SwitchLegalEntityDto, {
          selection: 'NIYAYESH_SEIR_SAHAR',
        }),
      ),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(SwitchLegalEntityDto, {
          selection: 'NIYAYESH_SEIR_SAHAR',
          expectedVersion: -1,
        }),
      ),
    ).not.toHaveLength(0);
  });

  it('requires trusted template identity and does not expose requiresLetterhead', async () => {
    const input = plainToInstance(CreateDocumentIssueDto, {
      issuerLegalEntityId: '00000000-0000-4000-8000-000000000001',
      templateVersion: '1',
      documentType: 'INVOICE',
      referenceEntityType: 'reservation',
      referenceEntityId: 'r1',
      requiresLetterhead: false,
    });
    expect(await validate(input)).not.toHaveLength(0);
    expect('requiresLetterhead' in input).toBe(true);
    expect(CreateDocumentIssueDto.prototype).not.toHaveProperty(
      'requiresLetterhead',
    );
  });

  it('trims valid reissue reasons and rejects whitespace, short and overlong reasons', async () => {
    const valid = plainToInstance(ReissueDocumentDto, {
      originalIssueId: '00000000-0000-4000-8000-000000000001',
      reason: '  اصلاح شماره پیگیری  ',
    });
    expect(await validate(valid)).toHaveLength(0);
    expect(valid.reason).toBe('اصلاح شماره پیگیری');
    for (const reason of ['   ', 'a', 'x'.repeat(501)]) {
      const invalid = plainToInstance(ReissueDocumentDto, {
        originalIssueId: '00000000-0000-4000-8000-000000000001',
        reason,
      });
      expect(await validate(invalid)).not.toHaveLength(0);
    }
  });
});
