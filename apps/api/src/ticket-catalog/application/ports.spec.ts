import { describe, expect, it } from 'vitest';
import {
  UnpublishedTicketAuthorization,
  type TicketActorContext,
} from './ports';
describe('Ticket authorization is fail closed', () => {
  const context: TicketActorContext = {
    actor: {
      userId: 'test',
      sessionId: 'test-session',
      permissions: ['iam.users.manage'],
      branchIds: ['branch-a'],
    },
    branchId: 'branch-a',
    traceId: 'test-trace',
  };
  const auth = new UnpublishedTicketAuthorization();
  it('denies even an IAM administrator until dedicated permissions are published', async () => {
    await expect(auth.require(context, 'create')).rejects.toThrow(
      'TICKET_PERMISSION_NOT_PUBLISHED',
    );
  });
  it('denies foreign branch and anonymous context', async () => {
    await expect(
      auth.require({ ...context, branchId: 'branch-b' }, 'read'),
    ).rejects.toThrow('FORBIDDEN');
    await expect(
      auth.require(
        { ...context, actor: { ...context.actor, userId: '' } },
        'read',
      ),
    ).rejects.toThrow('UNAUTHORIZED');
  });
});
