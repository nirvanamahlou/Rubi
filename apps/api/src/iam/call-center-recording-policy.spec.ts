import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { IamCallCenterDirectory } from './iam-call-center-directory';
import { CallCenterTelephonyService } from '../customer-affairs/call-center-telephony.service';
import { IssabelRecordingsService } from '../integrations/issabel/recordings.service';
const ceo = '11111111-1111-4111-8111-111111111111';
const demo = '22222222-2222-4222-8222-222222222222';
const audio = 'customer_affairs.call_center.recordings.read' as const;
const actor = (id = ceo) =>
  ({
    userId: id,
    branchIds: ['branch'],
    permissions: ['customer_affairs.call_center.read', audio],
  }) as AuthenticatedActor;
afterEach(() => vi.unstubAllEnvs());
function fixture() {
  const findFirst = vi.fn(async () => ({ id: ceo }));
  const directory = new IamCallCenterDirectory({
    client: {
      user: { findFirst },
      branch: { findMany: vi.fn(async () => [{ id: 'branch' }]) },
    },
  } as never);
  return { directory, findFirst };
}
describe('executive-exclusive recording authorization', () => {
  it.each(['', 'not-an-id', `${ceo},${demo}`])(
    'fails closed for absent, invalid or multiple configured owners: %s',
    async (id) => {
      vi.stubEnv('CALL_CENTER_RECORDING_DOWNLOAD_USER_ID', id);
      const f = fixture();
      expect(await f.directory.canDownloadCallRecordings(actor())).toBe(false);
      expect(f.findFirst).not.toHaveBeenCalled();
    },
  );
  it('requires the pinned active internal Danial Altafi account, not a matching role/display name', async () => {
    vi.stubEnv('CALL_CENTER_RECORDING_DOWNLOAD_USER_ID', ceo);
    const f = fixture();
    expect(await f.directory.canDownloadCallRecordings(actor())).toBe(true);
    expect(f.findFirst).toHaveBeenCalledWith({
      where: {
        id: ceo,
        username: 'danial',
        status: 'ACTIVE',
        b2bOrganizationUser: null,
      },
      select: { id: true },
    });
    f.findFirst.mockResolvedValueOnce(null as never);
    expect(await f.directory.canDownloadCallRecordings(actor())).toBe(false);
  });
  it.each(['demo', 'unit-manager', 'expert', 'administrator'])(
    'rejects %s even with audio and global access',
    async () => {
      vi.stubEnv('CALL_CENTER_RECORDING_DOWNLOAD_USER_ID', ceo);
      vi.stubEnv('CALL_CENTER_ACCESS_POLICY', 'ANSWERED');
      vi.stubEnv('CALL_CENTER_GLOBAL_USER_IDS', demo);
      const f = fixture(),
        original = actor(demo);
      const scoped = await f.directory.callCenterActor(original);
      // Direct media policy never relies on generic/global grants.
      expect(await f.directory.canDownloadCallRecordings(original)).toBe(false);
      expect(original.permissions).toContain(audio);
      expect(scoped!.permissions).not.toContain(audio);
    },
  );
  it('rejects direct list, full audio and ranged audio before reading any media tables', async () => {
    vi.stubEnv('CALL_CENTER_RECORDING_DOWNLOAD_USER_ID', ceo);
    const f = fixture();
    const db = { client: { $transaction: vi.fn() } };
    const domain = new CallCenterTelephonyService(
      db as never,
      {} as never,
      {} as never,
      f.directory,
    );
    const media = new IssabelRecordingsService(
      db as never,
      {} as never,
      domain,
      {} as never,
    );
    for (const operation of [
      () => media.forCall(actor(demo), 'call'),
      () => media.read(actor(demo), 'recording', undefined, 'call'),
      () => media.read(actor(demo), 'recording', 'bytes=0-43'),
    ])
      await expect(operation()).rejects.toMatchObject({ status: 403 });
    expect(db.client.$transaction).not.toHaveBeenCalled();
  });
});
