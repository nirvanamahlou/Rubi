import {
  BadRequestException,
  ForbiddenException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
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

  it('uploads a profile photo with a server-owned profile reference', async () => {
    const branchId = actor.branchIds[0]!;
    const instance = service({
      options: vi.fn().mockResolvedValue({
        branches: [{ id: branchId }],
        owners: [{ id: actor.userId }],
        documentTypes: [
          {
            id: '55555555-5555-4555-8555-555555555555',
            code: 'BRAND_ASSET_TEMPLATE',
          },
        ],
        categories: [
          {
            id: '66666666-6666-4666-8666-666666666666',
            code: 'BRAND_ASSETS',
          },
        ],
      }),
    });
    const upload = vi.spyOn(instance, 'upload').mockResolvedValue({
      data: {
        id: '44444444-4444-4444-8444-444444444444',
        currentVersion: { scanStatus: 'PENDING_SCAN' },
      },
    } as never);
    const file = {
      buffer: Buffer.from([137, 80, 78, 71]),
      mimetype: 'image/png',
      originalname: 'profile.png',
      size: 4,
    };

    const result = await instance.uploadOwnProfilePhoto(
      { branchId, title: 'عکس پروفایل' },
      file,
      actor,
      {},
    );

    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUserId: actor.userId,
        sourceModule: 'WORKBENCH',
        sourceEntityType: 'IamProfile',
        sourceEntityId: actor.userId,
      }),
      file,
      expect.objectContaining({
        permissions: expect.arrayContaining(['documents.brand.read']),
      }),
      {},
    );
    expect(result).toEqual({
      id: '44444444-4444-4444-8444-444444444444',
      scanStatus: 'PENDING_SCAN',
    });
  });

  it('uploads a feedback attachment without granting generic document upload', async () => {
    const branchId = actor.branchIds[0]!;
    const feedbackId = '55555555-5555-4555-8555-555555555555';
    const options = vi.fn().mockResolvedValue({
      branches: [{ id: branchId }],
      owners: [{ id: actor.userId }],
      documentTypes: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          code: 'WORKBENCH_FEEDBACK_ATTACHMENT',
        },
      ],
      categories: [
        {
          id: '77777777-7777-4777-8777-777777777777',
          code: 'GENERAL_ARCHIVE',
        },
      ],
    });
    const instance = service({
      options,
    });
    const upload = vi.spyOn(instance, 'upload').mockResolvedValue({
      data: {
        id: '88888888-8888-4888-8888-888888888888',
        currentVersion: { scanStatus: 'PENDING_SCAN' },
      },
    } as never);
    const file = {
      buffer: Buffer.from('%PDF-test'),
      mimetype: 'application/pdf',
      originalname: 'feedback.pdf',
      size: 9,
    };

    const result = await instance.uploadOwnWorkbenchFeedbackAttachment(
      {
        feedbackId,
        branchId,
        subject: 'پیشنهاد کارکنان',
        anonymous: false,
      },
      file,
      actor,
      {},
    );

    expect(options).toHaveBeenCalledWith([branchId], ['GENERAL']);
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId,
        ownerUserId: actor.userId,
        sourceModule: 'WORKBENCH',
        sourceEntityType: 'WorkbenchFeedback',
        sourceEntityId: feedbackId,
      }),
      file,
      actor,
      {},
    );
    expect(actor.permissions).not.toContain('documents.upload');
    expect(result).toEqual({
      id: '88888888-8888-4888-8888-888888888888',
      scanStatus: 'PENDING_SCAN',
    });
  });

  it('uploads a message attachment with a server-owned message reference', async () => {
    const branchId = actor.branchIds[0]!;
    const clientRequestId = 'message:request-0001';
    const options = vi.fn().mockResolvedValue({
      branches: [{ id: branchId }],
      owners: [{ id: actor.userId }],
      documentTypes: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          code: 'WORKBENCH_FEEDBACK_ATTACHMENT',
        },
      ],
      categories: [
        {
          id: '77777777-7777-4777-8777-777777777777',
          code: 'GENERAL_ARCHIVE',
        },
      ],
    });
    const instance = service({ options });
    const upload = vi.spyOn(instance, 'upload').mockResolvedValue({
      data: {
        id: '88888888-8888-4888-8888-888888888888',
        currentVersion: { scanStatus: 'PENDING_SCAN' },
      },
    } as never);
    const file = {
      buffer: Buffer.from([137, 80, 78, 71]),
      mimetype: 'image/png',
      originalname: 'receipt.png',
      size: 4,
    };

    await instance.uploadOwnMessagingAttachment(
      { branchId, clientRequestId, conversationTitle: 'گفت‌وگو با مالی' },
      file,
      actor,
      {},
    );

    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId,
        ownerUserId: actor.userId,
        sourceModule: 'MESSAGING',
        sourceEntityType: 'MessagingMessage',
        sourceEntityId: clientRequestId,
      }),
      file,
      actor,
      {},
    );
    expect(actor.permissions).not.toContain('documents.upload');
  });

  it('rejects unsupported message attachment media on the server', async () => {
    await expect(
      service({}).uploadOwnMessagingAttachment(
        {
          branchId: actor.branchIds[0]!,
          clientRequestId: 'message:request-0001',
          conversationTitle: 'گفت‌وگو با مالی',
        },
        {
          buffer: Buffer.from('<svg/>'),
          mimetype: 'image/svg+xml',
          originalname: 'unsafe.svg',
          size: 6,
        },
        actor,
        {},
      ),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
  });

  it('does not preview a profile photo owned by another account', async () => {
    const instance = service({
      findDetail: vi.fn().mockResolvedValue({
        ownerUserId: '99999999-9999-4999-8999-999999999999',
        documentType: { domain: 'BRAND' },
        relations: [
          {
            relationType: 'PRIMARY_CASE',
            sourceModule: 'WORKBENCH',
            sourceEntityType: 'IamProfile',
            sourceEntityId: actor.userId,
          },
        ],
      }),
    });

    await expect(
      instance.previewOwnProfilePhoto(
        '44444444-4444-4444-8444-444444444444',
        actor,
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
