import { BadRequestException } from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';

import { DocumentsService } from './documents.service';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: ['33333333-3333-4333-8333-333333333333'],
  permissions: ['documents.list'],
};

function service(repository: Record<string, unknown>) {
  return new DocumentsService(
    repository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('DocumentsService Workbench contracts', () => {
  it('accepts only attachments owned by the Workbench record and user', async () => {
    const id = '44444444-4444-4444-8444-444444444444';
    const lookup = vi.fn().mockResolvedValue([{ id, title: 'پیوست' }]);
    const result = await service({
      workbenchOwnedAttachmentIds: lookup,
    }).assertWorkbenchOwnedAttachments(
      [id],
      'MessagingMessage',
      'message:request-1',
      actor.branchIds[0]!,
      actor,
    );
    expect(result).toEqual([{ id, title: 'پیوست' }]);
    expect(lookup).toHaveBeenCalledWith({
      documentIds: [id],
      sourceEntityType: 'MessagingMessage',
      sourceEntityId: 'message:request-1',
      branchId: actor.branchIds[0],
      ownerUserId: actor.userId,
    });
  });

  it('rejects an attachment when any server reference does not match', async () => {
    await expect(
      service({
        workbenchOwnedAttachmentIds: vi.fn().mockResolvedValue([]),
      }).assertWorkbenchOwnedAttachments(
        ['44444444-4444-4444-8444-444444444444'],
        'WorkbenchFeedback',
        '55555555-5555-4555-8555-555555555555',
        actor.branchIds[0]!,
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
