import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import { DocumentsRepository } from './documents.repository';

describe('DocumentsRepository source scoping', () => {
  it('combines exact primary-case source filtering with branch and domain scope', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    const database = {
      client: {
        document: { count, findMany },
        $transaction: vi.fn(async (operations: Promise<unknown>[]) =>
          Promise.all(operations),
        ),
      },
    } as unknown as DatabaseService;
    const repository = new DocumentsRepository(database);

    await repository.list(
      {
        branchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        domain: 'CUSTOMER_IDENTITY',
        sourceModule: 'customers',
        sourceEntityType: 'Customer',
        sourceEntityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        page: 1,
        pageSize: 25,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
      },
      ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      ['CUSTOMER_IDENTITY'],
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    );

    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        branchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        documentType: expect.objectContaining({
          domain: { in: ['CUSTOMER_IDENTITY'] },
        }),
        relations: {
          some: {
            relationType: 'PRIMARY_CASE',
            sourceModule: 'customers',
            sourceEntityType: 'Customer',
            sourceEntityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          },
        },
      }),
    });
    expect(findMany).toHaveBeenCalledOnce();
  });
});
