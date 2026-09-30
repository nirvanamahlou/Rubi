import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import {
  B2bAgreementWorkflowRepository,
  type AgreementCaseRow,
} from './b2b-agreement-workflow.repository';

const id = '11111111-1111-4111-8111-111111111111';

describe('B2B agreement command replay', () => {
  it('does not report a newer agreement version as the result of an older request', async () => {
    let receipt:
      | {
          fingerprint: string;
          agreementId: string;
          resultVersion: number;
        }
      | undefined;
    let currentVersion = 1;
    let writes = 0;
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue(''),
      b2bAgreementCommand: {
        findUnique: vi.fn(async () => receipt ?? null),
        create: vi.fn(async ({ data }: { data: typeof receipt }) => {
          receipt = data;
        }),
      },
    };
    const database = {
      client: {
        $transaction: (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      },
    } as unknown as DatabaseService;
    const repository = new B2bAgreementWorkflowRepository(database);
    vi.spyOn(repository, 'find').mockImplementation(
      async () => ({ id, version: currentVersion }) as AgreementCaseRow,
    );
    const run = (
      repository as unknown as {
        run: (
          command: {
            organizationId: string;
            branchId: string;
            role: 'AGENCY';
            actorUserId: string;
            requestId: string;
          },
          payload: unknown,
          operation: () => Promise<AgreementCaseRow>,
        ) => Promise<AgreementCaseRow>;
      }
    ).run.bind(repository);
    const command = {
      organizationId: id,
      branchId: id,
      role: 'AGENCY' as const,
      actorUserId: id,
      requestId: id,
    };
    const operation = async () => {
      writes += 1;
      return { id, version: 1 } as AgreementCaseRow;
    };

    await expect(
      run(command, { action: 'save' }, operation),
    ).resolves.toMatchObject({
      version: 1,
    });
    await expect(
      run(command, { action: 'save' }, operation),
    ).resolves.toMatchObject({
      version: 1,
    });
    currentVersion = 2;
    await expect(
      run(command, { action: 'save' }, operation),
    ).rejects.toMatchObject({
      response: { code: 'B2B_COMMAND_RESULT_SUPERSEDED' },
    });
    expect(writes).toBe(1);
  });
});
