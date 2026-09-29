import { ConflictException, ForbiddenException } from '@nestjs/common';
import type {
  AuthenticatedActor,
  WorkbenchCalendarEventInputV1,
  WorkbenchNoteInputV1,
} from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';

import { WorkbenchService } from './workbench.service';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: ['33333333-3333-4333-8333-333333333333'],
  permissions: [],
};

function service(
  client: Record<string, unknown>,
  documents = {},
  customerAffairs = { workbench: vi.fn().mockResolvedValue({ data: [] }) },
  iam = {
    recordSelfActivity: vi.fn(),
    personalProfile: vi.fn(),
    updateOwnProfile: vi.fn(),
  },
  settings?: unknown,
) {
  return new WorkbenchService(
    { client } as never,
    documents as never,
    iam as never,
    customerAffairs as never,
    settings as never,
  );
}

const event: WorkbenchCalendarEventInputV1 = {
  branchId: actor.branchIds[0]!,
  title: 'جلسه پیگیری',
  description: 'پیگیری درخواست داخلی',
  dueAt: '2026-09-13T08:00:00.000Z',
};

describe('WorkbenchService backend boundaries', () => {
  it('aggregates permitted customer-affairs referrals in the backend calendar', async () => {
    const referral = {
      id: '99999999-9999-4999-8999-999999999999',
      ticketId: '88888888-8888-4888-8888-888888888888',
      trackingNumber: 'CA-100',
      ticketSubject: 'پیگیری',
      title: 'پاسخ واحد',
      destinationModule: 'finance',
      destinationUnit: 'مالی',
      status: 'OPEN',
      dueAt: '2026-09-14T08:00:00.000Z',
    };
    const workbench = vi.fn().mockResolvedValue({ data: [referral] });
    const response = await service(
      { workbenchCalendarEvent: { findMany: vi.fn().mockResolvedValue([]) } },
      {},
      { workbench },
    ).calendar({
      ...actor,
      permissions: ['customer_affairs.ticket.read'],
    });
    expect(workbench).toHaveBeenCalledOnce();
    expect(response.sources.customerAffairs).toEqual([referral]);
  });

  it('rejects a calendar event outside the authenticated branches', async () => {
    const create = vi.fn();
    await expect(
      service({ workbenchCalendarEvent: { create } }).createEvent(
        { ...event, branchId: '44444444-4444-4444-8444-444444444444' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });

  it('validates calendar images through the public Documents service', async () => {
    const imageDocumentId = '55555555-5555-4555-8555-555555555555';
    const assertAttachments = vi
      .fn()
      .mockResolvedValue([{ id: imageDocumentId, title: 'تصویر' }]);
    const now = new Date('2026-09-12T18:00:00.000Z');
    const create = vi.fn().mockResolvedValue({
      id: '66666666-6666-4666-8666-666666666666',
      userId: actor.userId,
      ...event,
      dueAt: new Date(event.dueAt),
      status: 'PLANNED',
      priority: 'NORMAL',
      linkUrl: null,
      imageDocumentId,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    await service(
      { workbenchCalendarEvent: { create } },
      { assertWorkbenchOwnedAttachments: assertAttachments },
    ).createEvent({ ...event, imageDocumentId }, actor);
    expect(assertAttachments).toHaveBeenCalledWith(
      [imageDocumentId],
      'WorkbenchCalendarEvent',
      expect.any(String),
      event.branchId,
      actor,
    );
  });

  it('uses the published workspace priority when the creator leaves it empty', async () => {
    const create = vi.fn().mockResolvedValue({
      id: '66666666-6666-4666-8666-666666666666',
      userId: actor.userId,
      ...event,
      dueAt: new Date(event.dueAt),
      status: 'PLANNED',
      priority: 'URGENT',
      linkUrl: null,
      imageDocumentId: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const settings = {
      json: vi.fn().mockResolvedValue({ value: { priority: 'فوری' } }),
    };
    await service(
      { workbenchCalendarEvent: { create } },
      {},
      undefined,
      undefined,
      settings,
    ).createEvent(event, actor);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priority: 'URGENT' }),
      }),
    );
  });

  it('enforces optimistic concurrency for persisted notes', async () => {
    const note: WorkbenchNoteInputV1 = {
      title: 'یادداشت',
      body: 'متن',
      folder: 'شخصی',
      tags: '',
      items: [],
      pinned: false,
      expectedVersion: 2,
    };
    const transaction = vi.fn(async (operation: (tx: unknown) => unknown) =>
      operation({
        workbenchNoteFolder: { upsert: vi.fn() },
        workbenchNote: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      }),
    );
    await expect(
      service({ $transaction: transaction }).updateNote(
        '77777777-7777-4777-8777-777777777777',
        note,
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('routes profile photo uploads through the Documents owner boundary', async () => {
    const uploadOwnProfilePhoto = vi.fn().mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',
      scanStatus: 'PENDING_SCAN',
    });
    const file = {
      buffer: Buffer.from([137, 80, 78, 71]),
      mimetype: 'image/png',
      originalname: 'profile.png',
      size: 4,
    };
    const result = await service(
      {},
      { uploadOwnProfilePhoto },
    ).uploadProfilePhoto(
      { branchId: actor.branchIds[0]!, title: 'عکس پروفایل' },
      file,
      actor,
      { ipAddress: '127.0.0.1' },
    );
    expect(uploadOwnProfilePhoto).toHaveBeenCalledWith(
      { branchId: actor.branchIds[0]!, title: 'عکس پروفایل' },
      file,
      actor,
      { ipAddress: '127.0.0.1' },
    );
    expect(result.data.id).toBe('44444444-4444-4444-8444-444444444444');
  });

  it('loads the stored profile photo through the Documents owner boundary', async () => {
    const documentId = '44444444-4444-4444-8444-444444444444';
    const previewOwnProfilePhoto = vi
      .fn()
      .mockResolvedValue({ stream: 'file' });
    const personalProfile = vi.fn().mockResolvedValue({
      profile: { photoDocumentId: documentId },
    });
    await service({}, { previewOwnProfilePhoto }, undefined, {
      recordSelfActivity: vi.fn(),
      personalProfile,
      updateOwnProfile: vi.fn(),
    }).profilePhoto(actor, {});
    expect(personalProfile).toHaveBeenCalledWith(actor.userId);
    expect(previewOwnProfilePhoto).toHaveBeenCalledWith(documentId, actor, {});
  });
});
