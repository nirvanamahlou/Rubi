import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedActor,
  OrganizationActivityEvent,
} from '@rubi/contracts';
import { activityEvent, activityWindow } from '../common/organization-activity';
import { B2bActivityService } from './b2b-activity.service';
import type { B2bActivityRepository } from './b2b-activity.repository';
import type { MasterOrganizationDirectory } from '../master-data/master-organization-directory';
import type { DocumentsService } from '../documents/documents.service';
import type { IamService } from '../iam/iam.service';
import type { B2bOrganizationUserRepository } from './b2b-organization-user.repository';

const actor = {
  userId: 'actor',
  branchIds: ['branch'],
  permissions: [
    'b2b.agency.read',
    'b2b.agreement.read',
    'b2b.credit.read',
    'b2b.rate.read',
    'master_data.audit.read',
    'documents.audit.read',
  ],
} as AuthenticatedActor;
function fixture() {
  const repository = { activity: vi.fn().mockResolvedValue([]) };
  const organizations = {
    agencyReference: vi.fn().mockResolvedValue({ id: 'org' }),
    cooperationReference: vi.fn(),
    organizationActivity: vi.fn().mockResolvedValue([]),
  };
  const documents = { organizationActivity: vi.fn().mockResolvedValue([]) };
  const iam = {
    listUsers: vi
      .fn()
      .mockResolvedValue([{ id: 'actor', displayName: 'Operator' }]),
  };
  const memberships = { byUser: vi.fn().mockResolvedValue(null) };
  return {
    repository,
    organizations,
    documents,
    iam,
    memberships,
    service: new B2bActivityService(
      repository as unknown as B2bActivityRepository,
      organizations as unknown as MasterOrganizationDirectory,
      documents as unknown as DocumentsService,
      iam as unknown as IamService,
      memberships as unknown as B2bOrganizationUserRepository,
    ),
  };
}
describe('Dossier activity authorization and projection', () => {
  it('denies other branches, missing grants and agency portal accounts before reading any source', async () => {
    const f = fixture();
    await expect(f.service.list('org', 'other', actor, {})).rejects.toThrow();
    await expect(
      f.service.list('org', 'branch', { ...actor, permissions: [] }, {}),
    ).rejects.toThrow();
    f.memberships.byUser.mockResolvedValue({ id: 'portal' });
    await expect(f.service.list('org', 'branch', actor, {})).rejects.toThrow();
    expect(f.repository.activity).not.toHaveBeenCalled();
    expect(f.organizations.organizationActivity).not.toHaveBeenCalled();
  });
  it('omits unauthorized owners and reports the missing coverage', async () => {
    const f = fixture();
    const result = await f.service.list(
      'org',
      'branch',
      { ...actor, permissions: ['b2b.agency.read'] },
      {},
    );
    expect(f.organizations.organizationActivity).not.toHaveBeenCalled();
    expect(f.documents.organizationActivity).not.toHaveBeenCalled();
    expect(result.unavailableSources).toHaveLength(5);
  });
  it('merges tied source pages in stable key order and resolves actors without leaking the IAM directory', async () => {
    const f = fixture();
    const events = Array.from(
      { length: 51 },
      (_, i) =>
        ({
          id: `B2B:${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`,
          occurredAt: '2026-01-01T00:00:00.000Z',
          actorUserId: 'actor',
        }) as OrganizationActivityEvent,
    );
    f.repository.activity.mockResolvedValue(events);
    f.documents.organizationActivity.mockResolvedValue([
      { ...events[0], id: 'DOCUMENTS:00000000-0000-4000-8000-000000000000' },
    ]);
    const result = await f.service.list('org', 'branch', actor, {});
    expect(result.data).toHaveLength(50);
    expect(result.data[0]?.id).toMatch(/^DOCUMENTS/);
    expect(result.data[0]?.actorName).toBe('Operator');
    expect(
      activityWindow({ asOf: result.asOf, cursor: result.nextCursor! }).before
        ?.id,
    ).toBe(result.data.at(-1)?.id);
    expect(result).not.toHaveProperty('users');
  });
  it('rejects missing organizations and propagates source errors instead of presenting incomplete success', async () => {
    const f = fixture();
    f.organizations.agencyReference.mockResolvedValue(null);
    await expect(f.service.list('org', 'branch', actor, {})).rejects.toThrow();
    const g = fixture();
    g.documents.organizationActivity.mockRejectedValue(
      new Error('source failed'),
    );
    await expect(g.service.list('org', 'branch', actor, {})).rejects.toThrow(
      'source failed',
    );
  });
  it('maps nested grants and financial revisions to changed labels only', () => {
    const result = activityEvent(
      {
        id: 'id',
        action: 'update',
        entityId: 'entity',
        entityType: 'user',
        actorUserId: 'actor',
        occurredAt: new Date(),
        category: 'ACCESS',
        outcome: 'SUCCESS',
        beforeSnapshot: { sections: ['organization'] },
        afterSnapshot: {
          record: {
            sections: ['credit'],
            password: 'secret',
            notes: 'private',
            phone: 'private',
            guarantees: [{ amount: '9000000', secret: 'private' }],
          },
        },
      },
      'B2B',
    );
    expect(result.changedFields).toContain('بخش‌های مجاز');
    expect(result.changedFields).toContain('تضمین‌ها');
    expect(JSON.stringify(result)).not.toMatch(/secret|private|9000000/);
  });
});
describe('Report dates and cursors', () => {
  it('includes an entire Tehran calendar day', () => {
    const window = activityWindow({ from: '2026-01-02', to: '2026-01-02' });
    expect(window.from?.toISOString()).toBe('2026-01-01T20:30:00.000Z');
    expect(window.to?.toISOString()).toBe('2026-01-02T20:29:59.999Z');
  });
  it.each([
    { from: '2026-02-30' },
    { from: '2026-02-02', to: '2026-02-01' },
    { cursor: 'bad' },
    { source: 'SECRET' },
    { from: ['2026-01-01'] },
    { asOf: '3000-01-01' },
  ])('rejects malformed filters %j', (query) => {
    expect(() => activityWindow(query as never)).toThrow();
  });
});
