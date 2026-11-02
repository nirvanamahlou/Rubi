import type { AuthenticatedActor } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import type { DocumentTemplatePolicyPort } from './document-template-policy.port';
import { LegalEntitiesService } from './legal-entities.service';

const actor: AuthenticatedActor = {
  userId: '00000000-0000-4000-8000-000000000001',
  sessionId: 'session-1',
  permissions: ['legal-entity.read', 'legal-entity.switch'],
  branchIds: ['branch-1'],
};

describe('legal entity selectable companies', () => {
  it('queries only active companies from the four-code public contract', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const policies: DocumentTemplatePolicyPort = {
      resolve: vi.fn().mockResolvedValue(null),
    };
    const service = new LegalEntitiesService(
      {
        client: { legalEntity: { findMany } },
      } as unknown as DatabaseService,
      policies,
    );

    await expect(service.selectable(actor)).resolves.toEqual({
      data: [],
      meta: { canAggregate: false },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        code: {
          in: [
            'NIYAYESH_SEIR_SAHAR',
            'JAHAN_BASTAN',
            'JAHAN_ACADEMIA',
            'GHESATI_RO',
          ],
        },
      },
      orderBy: { code: 'desc' },
    });
  });
});
