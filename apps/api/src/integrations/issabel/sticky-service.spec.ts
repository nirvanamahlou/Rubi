import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedActor } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import { IssabelService } from './issabel.service';
import type { IssabelOptions } from './config';
import type { MemberSnapshot } from './sticky-sales';

function fixture(policy?: string) {
  const snapshot: MemberSnapshot = {
    queue: '1002',
    observedAt: new Date(),
    members: [],
  };
  const preferredAgent = vi.fn(
    async (
      _a: unknown,
      _c: unknown,
      _q: unknown,
      _p: unknown,
      s: MemberSnapshot | null,
    ) =>
      s
        ? {
            kind: 'PREFER',
            extension: '110',
            ringSeconds: 10,
            fallbackQueue: '1002',
          }
        : { kind: 'FALLBACK', queue: '1002', reason: 'AVAILABILITY_UNKNOWN' },
  );
  const client = {
    connected: true,
    queueSnapshot: vi.fn(async () => snapshot),
  };
  const service = new IssabelService(
    {} as never,
    new ConfigService({ ISSABEL_STICKY_QUEUE_WRAPUP_SECONDS_JSON: policy }),
    {} as never,
    {} as never,
    { preferredAgent } as never,
    {} as never,
  );
  Object.assign(service, {
    client,
    options: {
      connectionId: 'synthetic',
      nativeCapture: true,
    } as IssabelOptions,
  });
  return { service, preferredAgent, client, snapshot };
}
const actor = {} as AuthenticatedActor;
describe('server-only sales routing preflight integration', () => {
  it('does not query AMI with unverified queue policy', async () => {
    const f = fixture();
    expect(
      await f.service.previewPreviousAgent(actor, '1002', '+12025550188'),
    ).toMatchObject({ reason: 'QUEUE_POLICY_UNVERIFIED' });
    expect(f.client.queueSnapshot).not.toHaveBeenCalled();
  });
  it('checks permission before AMI and does not swallow denial', async () => {
    const f = fixture('{"1002":0}');
    f.preferredAgent.mockRejectedValue(new ForbiddenException());
    await expect(
      f.service.previewPreviousAgent(actor, '1002', '+12025550188'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.client.queueSnapshot).not.toHaveBeenCalled();
  });
  it('passes only the server-collected snapshot and rechecks access', async () => {
    const f = fixture('{"1002":0}');
    expect(
      await f.service.previewPreviousAgent(actor, '1002', '+12025550188'),
    ).toMatchObject({ kind: 'PREFER', ringSeconds: 10, fallbackQueue: '1002' });
    expect(f.client.queueSnapshot).toHaveBeenCalledWith('1002', 0);
    expect(f.preferredAgent).toHaveBeenCalledTimes(2);
    expect(f.preferredAgent.mock.calls[1]![4]).toBe(f.snapshot);
  });
  it('discards a snapshot from a disconnected transport generation', async () => {
    const f = fixture('{"1002":0}');
    f.client.queueSnapshot.mockImplementation(async () => {
      f.client.connected = false;
      return f.snapshot;
    });
    expect(
      await f.service.previewPreviousAgent(actor, '1002', '+12025550188'),
    ).toMatchObject({ reason: 'AVAILABILITY_UNKNOWN' });
    expect(f.preferredAgent).toHaveBeenCalledTimes(1);
  });
  it('discards a preference if transport disconnects during history lookup', async () => {
    const f = fixture('{"1002":0}');
    const original = f.preferredAgent.getMockImplementation()!;
    f.preferredAgent.mockImplementation(async (...args) => {
      const result = await original(...args);
      if (args[4]) f.client.connected = false;
      return result;
    });
    expect(
      await f.service.previewPreviousAgent(actor, '1002', '+12025550188'),
    ).toMatchObject({ reason: 'AVAILABILITY_UNKNOWN' });
  });
});
