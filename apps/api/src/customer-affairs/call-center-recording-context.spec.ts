import 'reflect-metadata';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CallCenterTelephonyService } from './call-center-telephony.service';
import type { AuthenticatedActor } from '@nora/contracts';

describe('dossier recording authorization', () => {
  const actor = {
    userId: 'user',
    branchIds: ['branch'],
    permissions: [
      'customer_affairs.call_center.read',
      'customer_affairs.call_center.recordings.read',
      'customer_affairs.call_center.contacts.read.own',
    ],
  } as AuthenticatedActor;
  function setup() {
    const tx = {
      callCenterCall: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'call',
          contactId: 'contact',
          contact: { branchId: 'branch' },
        }),
      },
      callCenterTelephonySession: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const access = { contact: vi.fn().mockResolvedValue({}) };
    const service = new CallCenterTelephonyService(
      { client: tx } as never,
      {} as never,
      { access } as never,
      {} as never,
    );
    return { tx, access, service };
  }
  it('delegates own/team contact policy before reading technical data, without workflow permission', async () => {
    const { tx, access, service } = setup();
    expect(await service.callRecordingContext(actor, 'call')).toBeNull();
    expect(access.contact).toHaveBeenCalledWith(
      actor,
      'branch',
      'contact',
      'contacts',
      tx,
    );
  });
  it('cannot download audio outside current dossier access even in the same branch', async () => {
    const { tx, access, service } = setup();
    access.contact.mockRejectedValue(new NotFoundException());
    await expect(
      service.callRecordingContext(actor, 'call'),
    ).rejects.toMatchObject({ status: 404 });
    expect(tx.callCenterTelephonySession.findUnique).not.toHaveBeenCalled();
  });
  it('missing recording permission is rejected before a database lookup', async () => {
    const { tx, service } = setup();
    await expect(
      service.callRecordingContext(
        { ...actor, permissions: ['customer_affairs.call_center.read'] },
        'call',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.callCenterCall.findFirst).not.toHaveBeenCalled();
  });
});
