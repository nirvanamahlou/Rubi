import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkbenchFeedbackService } from './workbench-feedback.service';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: ['33333333-3333-4333-8333-333333333333'],
  permissions: [],
};

const input = {
  id: '44444444-4444-4444-8444-444444444444',
  branchId: actor.branchIds[0]!,
  department: 'hr' as const,
  subject: '  پیشنهاد کارکنان  ',
  body: '  متن نظر  ',
  anonymous: true,
  attachmentDocumentIds: ['55555555-5555-4555-8555-555555555555'],
};

describe('WorkbenchFeedbackService', () => {
  const repository = { create: vi.fn(), findById: vi.fn() };
  const hrDirectory = { workbenchFeedbackRecipientUserIds: vi.fn() };
  const documents = { assertWorkbenchFeedbackAttachments: vi.fn() };
  const service = new WorkbenchFeedbackService(
    repository as never,
    hrDirectory as never,
    documents as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    hrDirectory.workbenchFeedbackRecipientUserIds.mockResolvedValue([
      '66666666-6666-4666-8666-666666666666',
    ]);
    documents.assertWorkbenchFeedbackAttachments.mockResolvedValue(undefined);
    repository.create.mockImplementation(async (value) => ({
      ...value,
      submittedAt: '2026-09-12T10:00:00.000Z',
      recipientCount: value.recipientUserIds.length,
    }));
    repository.findById.mockReset();
  });

  it('validates linked documents, trims content and routes to the selected unit', async () => {
    const response = await service.create(input, actor);

    expect(documents.assertWorkbenchFeedbackAttachments).toHaveBeenCalledWith(
      input.attachmentDocumentIds,
      input.id,
      input.branchId,
      actor,
    );
    expect(hrDirectory.workbenchFeedbackRecipientUserIds).toHaveBeenCalledWith(
      input.branchId,
      expect.arrayContaining(['منابع انسانی', 'سرمایه انسانی']),
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        department: 'HUMAN_RESOURCES',
        departmentCode: 'hr',
        subject: 'پیشنهاد کارکنان',
        body: 'متن نظر',
        anonymous: true,
        attachmentCount: 1,
        recipientUserIds: ['66666666-6666-4666-8666-666666666666'],
      }),
    );
    expect(response.data.recipientCount).toBe(1);
  });

  it('rejects a destination branch outside the authenticated scope', async () => {
    await expect(
      service.create(
        { ...input, branchId: '77777777-7777-4777-8777-777777777777' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('hides the sender from an authorized recipient of anonymous feedback', async () => {
    repository.findById.mockResolvedValue({
      id: input.id,
      trackingNumber: 'WB-444444444444',
      branchId: input.branchId,
      department: 'HUMAN_RESOURCES',
      subject: 'پیشنهاد کارکنان',
      body: 'متن کامل نظر',
      isAnonymous: true,
      attachmentCount: 1,
      submittedByUserId: '77777777-7777-4777-8777-777777777777',
      submittedAt: new Date('2026-09-12T10:00:00.000Z'),
      submittedBy: {
        id: '77777777-7777-4777-8777-777777777777',
        displayName: 'فرستنده',
      },
    });
    hrDirectory.workbenchFeedbackRecipientUserIds.mockResolvedValue([
      actor.userId,
    ]);

    const response = await service.detail(input.id, actor);

    expect(response.data.body).toBe('متن کامل نظر');
    expect(response.data.sender).toBeNull();
    expect(response.data.isOwn).toBe(false);
  });

  it('does not reveal feedback to a user outside its sender and recipients', async () => {
    repository.findById.mockResolvedValue({
      id: input.id,
      trackingNumber: 'WB-444444444444',
      branchId: input.branchId,
      department: 'HUMAN_RESOURCES',
      subject: 'پیشنهاد کارکنان',
      body: 'متن کامل نظر',
      isAnonymous: false,
      attachmentCount: 0,
      submittedByUserId: '77777777-7777-4777-8777-777777777777',
      submittedAt: new Date('2026-09-12T10:00:00.000Z'),
      submittedBy: {
        id: '77777777-7777-4777-8777-777777777777',
        displayName: 'فرستنده',
      },
    });
    hrDirectory.workbenchFeedbackRecipientUserIds.mockResolvedValue([]);

    await expect(service.detail(input.id, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
