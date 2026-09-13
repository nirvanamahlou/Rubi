import type { AuthenticatedActor } from '@rubi/contracts';
import { UserStatus } from '@rubi/database';
import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import { IamService } from './iam.service';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  permissions: [],
  branchIds: ['33333333-3333-4333-8333-333333333333'],
};

describe('IAM messaging contact projection', () => {
  it('queries only active internal accounts in the actor branch and returns minimum fields', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        displayName: 'کاربر داخلی',
        username: 'internal',
        branches: [
          {
            branch: {
              id: actor.branchIds[0],
              code: 'THR',
              name: 'دفتر مرکزی',
            },
          },
        ],
      },
    ]);
    const service = new IamService(
      { client: { user: { findMany } } } as unknown as DatabaseService,
      {} as never,
      {} as never,
    );

    const result = await service.listMessagingContacts(actor, 'داخلی', 20);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: actor.userId },
          status: UserStatus.ACTIVE,
          b2bOrganizationUser: null,
          branches: {
            some: {
              branchId: { in: actor.branchIds },
              branch: { isActive: true },
            },
          },
        }),
        take: 21,
      }),
    );
    expect(result).toEqual({
      contacts: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          displayName: 'کاربر داخلی',
          username: 'internal',
          branches: [
            {
              id: actor.branchIds[0],
              code: 'THR',
              name: 'دفتر مرکزی',
            },
          ],
        },
      ],
      hasMore: false,
    });
  });

  it('requires one common authorized branch for every group member', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        displayName: 'یک',
        username: 'one',
        branches: [
          { branch: { id: actor.branchIds[0], code: 'THR', name: 'تهران' } },
        ],
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        displayName: 'دو',
        username: 'two',
        branches: [
          { branch: { id: actor.branchIds[0], code: 'THR', name: 'تهران' } },
        ],
      },
    ]);
    const service = new IamService(
      { client: { user: { findMany } } } as unknown as DatabaseService,
      {} as never,
      {} as never,
    );

    const result = await service.validateMessagingRecipients(actor, [
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555',
    ]);

    expect(result.branchId).toBe(actor.branchIds[0]);
    expect(result.contacts).toHaveLength(2);
  });
});
