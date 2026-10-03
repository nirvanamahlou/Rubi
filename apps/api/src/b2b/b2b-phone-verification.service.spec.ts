import type {
  AuthenticatedActor,
  CreateB2bPhoneChallengeRequestV1,
  MasterDataRecord,
} from '@nora/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MasterDataService } from '../master-data/master-data.service';
import type { B2bOrganizationUserRepository } from './b2b-organization-user.repository';
import type { B2bPhoneDeliveryPort } from './b2b-phone-verification.delivery';
import { B2bPhoneVerificationService } from './b2b-phone-verification.service';
import { B2bPhoneVerificationStore } from './b2b-phone-verification.store';

const branchId = '11111111-1111-4111-8111-111111111111';
const registrationId = '22222222-2222-4222-8222-222222222222';
const organizationId = '44444444-4444-4444-8444-444444444444';
const actor: AuthenticatedActor = {
  userId: '33333333-3333-4333-8333-333333333333',
  sessionId: '55555555-5555-4555-8555-555555555555',
  branchIds: [branchId],
  permissions: ['master_data.read', 'master_data.create'],
};
const context = {
  registrationId,
  branchId,
  role: 'AGENCY' as const,
  organizationId,
  phone: '۰۹۱۲ ۱۲۳ ۴۵۶۷',
};
const organization = (
  roles = 'AGENCY',
  createdAt = '2026-01-01T00:00:00.000Z',
) =>
  ({
    id: organizationId,
    resource: 'organizations',
    code: 'ORG',
    name: 'Synthetic',
    status: 'active',
    attributes: { roleCodes: roles },
    version: 1,
    createdAt,
    updatedAt: createdAt,
  }) as MasterDataRecord;

function setup() {
  const masterData = {
    detail: vi.fn().mockResolvedValue({ data: organization() }),
    create: vi.fn().mockResolvedValue({ data: { id: 'contact' } }),
  };
  const organizationUsers = { byUser: vi.fn().mockResolvedValue(null) };
  const delivery = { send: vi.fn().mockResolvedValue(undefined) };
  const service = new B2bPhoneVerificationService(
    new B2bPhoneVerificationStore(),
    organizationUsers as unknown as B2bOrganizationUserRepository,
    masterData as unknown as MasterDataService,
    delivery as B2bPhoneDeliveryPort,
  );
  return { service, masterData, organizationUsers, delivery };
}

async function grant(
  service: B2bPhoneVerificationService,
  input: CreateB2bPhoneChallengeRequestV1 = context,
) {
  const challenge = await service.challenge(input, actor);
  return service.verify(
    challenge.challengeId,
    { ...input, code: challenge.developmentCode },
    actor,
  );
}

describe('B2B cooperation phone verification service', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T10:00:00.000Z'));
  });
  afterEach(() => {
    delete process.env.NODE_ENV;
    vi.useRealTimers();
  });

  it('allows role activation for an active existing organization and returns only a development code', async () => {
    const fixture = setup();
    fixture.masterData.detail.mockResolvedValue({ data: organization('') });
    const result = await fixture.service.challenge(context, actor);
    expect(result).toMatchObject({
      canonicalPhone: '+989121234567',
      developmentCode: expect.stringMatching(/^\d{6}$/),
    });
    expect(fixture.delivery.send).toHaveBeenCalledWith({
      canonicalPhone: '+989121234567',
      code: result.developmentCode,
    });
  });

  it.each([
    [{ ...actor, permissions: ['master_data.read'] }, context, 'مجوز'],
    [{ ...actor, branchIds: [] }, context, 'شعبه'],
  ] as const)(
    'rejects invalid actor scope',
    async (scopedActor, input, message) => {
      const fixture = setup();
      await expect(
        fixture.service.challenge(
          input,
          scopedActor as unknown as AuthenticatedActor,
        ),
      ).rejects.toThrow(message);
      expect(fixture.delivery.send).not.toHaveBeenCalled();
    },
  );

  it('rejects portal actors and malformed phones before issuing', async () => {
    const fixture = setup();
    fixture.organizationUsers.byUser.mockResolvedValue({ id: 'membership' });
    await expect(fixture.service.challenge(context, actor)).rejects.toThrow(
      'پرتال',
    );
    fixture.organizationUsers.byUser.mockResolvedValue(null);
    await expect(
      fixture.service.challenge({ ...context, phone: '02112345678' }, actor),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rechecks permissions, branch and portal scope on verify and contact consume', async () => {
    const fixture = setup();
    const challenge = await fixture.service.challenge(context, actor);
    await expect(
      fixture.service.verify(
        challenge.challengeId,
        { ...context, code: challenge.developmentCode },
        { ...actor, permissions: ['master_data.read'] },
      ),
    ).rejects.toThrow('مجوز');
    fixture.organizationUsers.byUser.mockResolvedValue({ id: 'portal' });
    await expect(
      fixture.service.verify(
        challenge.challengeId,
        { ...context, code: challenge.developmentCode },
        actor,
      ),
    ).rejects.toThrow('پرتال');
    fixture.organizationUsers.byUser.mockResolvedValue(null);
    const verified = await fixture.service.verify(
      challenge.challengeId,
      { ...context, code: challenge.developmentCode },
      actor,
    );
    await expect(
      fixture.service.createVerifiedContact(
        { ...context, grant: verified.grant, fullName: 'نماینده' },
        { ...actor, branchIds: [] },
      ),
    ).rejects.toThrow('شعبه');
    expect(fixture.masterData.create).not.toHaveBeenCalled();
  });

  it('pins existing organizations and limits a new-registration grant to a newly created dossier', async () => {
    const fixture = setup();
    const verified = await grant(fixture.service);
    await expect(
      fixture.service.createVerifiedContact(
        {
          ...context,
          organizationId: '66666666-6666-4666-8666-666666666666',
          grant: verified.grant,
          fullName: 'نماینده',
        },
        actor,
      ),
    ).rejects.toThrow('این سازمان');

    vi.advanceTimersByTime(60_000);
    const newContext = {
      registrationId: crypto.randomUUID(),
      branchId,
      role: context.role,
      phone: context.phone,
    };
    const newGrant = await grant(fixture.service, newContext);
    const contact = {
      ...newContext,
      organizationId,
      grant: newGrant.grant,
      fullName: 'نماینده',
    };
    fixture.masterData.detail.mockResolvedValueOnce({
      data: organization('AGENCY', '2026-01-01T00:00:00.000Z'),
    });
    await expect(
      fixture.service.createVerifiedContact(contact, actor),
    ).rejects.toThrow('قدیمی');
    fixture.masterData.detail.mockResolvedValueOnce({
      data: organization('AGENCY', '2026-10-03T10:01:01.000Z'),
    });
    await expect(
      fixture.service.createVerifiedContact(contact, actor),
    ).resolves.toMatchObject({ data: { id: 'contact' } });
  });

  it('claims once before persistence, rejects concurrent/replayed writes and never restores a failed grant', async () => {
    const fixture = setup();
    const verified = await grant(fixture.service);
    const contact = {
      ...context,
      grant: verified.grant,
      fullName: 'نماینده آزمایشی',
      jobTitle: 'مدیر',
      email: 'test@example.com',
    };
    fixture.masterData.create.mockRejectedValueOnce(
      new Error('ambiguous write'),
    );
    await expect(
      fixture.service.createVerifiedContact(contact, actor),
    ).rejects.toThrow('کد جدید');
    await expect(
      fixture.service.createVerifiedContact(contact, actor),
    ).rejects.toThrow('معتبر نیست');
    expect(fixture.masterData.create).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    const secondInput = {
      ...context,
      registrationId: crypto.randomUUID(),
    };
    const second = await grant(fixture.service, secondInput);
    fixture.masterData.create.mockResolvedValue({ data: { id: 'contact' } });
    const concurrent = {
      ...contact,
      ...secondInput,
      grant: second.grant,
    };
    const writes = await Promise.allSettled([
      fixture.service.createVerifiedContact(concurrent, actor),
      fixture.service.createVerifiedContact(concurrent, actor),
    ]);
    expect(writes.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(writes.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );
    expect(fixture.masterData.create).toHaveBeenCalledTimes(2);
  });

  it('fails closed in production before directory or persistence access', async () => {
    const fixture = setup();
    process.env.NODE_ENV = 'production';
    await expect(fixture.service.challenge(context, actor)).rejects.toThrow(
      'غیرفعال',
    );
    await expect(
      fixture.service.verify(
        crypto.randomUUID(),
        { ...context, code: '123456' },
        actor,
      ),
    ).rejects.toThrow('غیرفعال');
    await expect(
      fixture.service.createVerifiedContact(
        { ...context, grant: 'x'.repeat(32), fullName: 'نماینده' },
        actor,
      ),
    ).rejects.toThrow('غیرفعال');
    expect(fixture.masterData.detail).not.toHaveBeenCalled();
    expect(fixture.masterData.create).not.toHaveBeenCalled();
  });
});
