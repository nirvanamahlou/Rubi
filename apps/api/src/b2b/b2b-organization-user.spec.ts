import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, it, expect, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import type { AuthenticatedActor } from '@rubi/contracts';
import { B2bOrganizationUserService } from './b2b-organization-user.service';
import type { B2bOrganizationUserRepository } from './b2b-organization-user.repository';
import { B2bPortalBoundaryInterceptor } from './b2b-portal-boundary.interceptor';
import { B2bPortalController } from './b2b-organization-user.controller';
import { AuthController } from '../iam/auth.controller';
import type { IamService } from '../iam/iam.service';
import type { MasterOrganizationDirectory } from '../master-data/master-organization-directory';
import type { B2bRepository } from './b2b.repository';
import {
  CreateB2bOrganizationUserDto,
  SaveB2bOrganizationUserDto,
} from './b2b-organization-user.dto';
const id = '11111111-1111-4111-8111-111111111111',
  other = '22222222-2222-4222-8222-222222222222';
const actor: AuthenticatedActor = {
  userId: id,
  sessionId: id,
  branchIds: [id],
  permissions: ['b2b.agency.read', 'b2b.agency.manage'],
};
const input = () =>
  plainToInstance(CreateB2bOrganizationUserDto, {
    branchId: id,
    roleName: 'کارشناس',
    sections: ['organization'],
    isActive: true,
    reason: 'ثبت آزمایشی',
    displayName: 'Synthetic user',
    username: 'synthetic.agency',
    password: 'Synthetic-Only-8264!',
  });
function setup() {
  const repository = {
    byUser: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue({ id, version: 1 }),
    history: vi.fn().mockResolvedValue([]),
  };
  const iam = {
    createUser: vi.fn().mockResolvedValue({ id: other }),
    updateUserStatus: vi.fn().mockResolvedValue({}),
    listUsers: vi.fn().mockResolvedValue([]),
  };
  const organizations = {
    agencyReference: vi
      .fn()
      .mockResolvedValue({ id, isActive: true, legalName: 'Only this agency' }),
    cooperationReference: vi.fn(),
    addresses: vi.fn().mockResolvedValue([]),
  };
  const b2b = { findProfile: vi.fn().mockResolvedValue(null) };
  const service = new B2bOrganizationUserService(
    repository as unknown as B2bOrganizationUserRepository,
    iam as unknown as IamService,
    organizations as unknown as MasterOrganizationDirectory,
    b2b as unknown as B2bRepository,
  );
  return { repository, iam, organizations, b2b, service };
}
describe('organization-user provisioning and section isolation', () => {
  it('provisions through IAM without any global roles or branches, and stores no password in B2B', async () => {
    const s = setup();
    await s.service.create(id, input(), actor, {});
    expect(s.iam.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ roleIds: [], branchIds: [] }),
      actor,
      {},
    );
    expect(s.repository.save.mock.calls[0]?.[1]).not.toHaveProperty('password');
    expect(s.repository.save.mock.calls[0]?.[1]).not.toHaveProperty('username');
    expect(s.repository.save).toHaveBeenCalledWith(
      id,
      expect.anything(),
      id,
      undefined,
      other,
    );
  });
  it.each([
    { ...actor, permissions: [] },
    { ...actor, branchIds: [other] },
  ])('denies unauthorized provisioning before IAM IO', async (a) => {
    const s = setup();
    await expect(s.service.create(id, input(), a, {})).rejects.toThrow();
    expect(s.iam.createUser).not.toHaveBeenCalled();
  });
  it('rejects global IAM fields injected into the public DTO', () => {
    const dto = plainToInstance(CreateB2bOrganizationUserDto, {
      ...input(),
      roleIds: [id],
      branchIds: [id],
      userId: other,
    });
    expect(
      validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).toHaveLength(3);
  });
  it.each(
    [
      ['dashboard'],
      ['organization', 'organization'],
      [
        'organization',
        'finance',
        'audit',
        'contracts',
        'credit',
        'access',
        'organization',
      ],
    ].map((sections) => ({ sections })),
  )('rejects invalid section lists', ({ sections }) => {
    const dto = plainToInstance(SaveB2bOrganizationUserDto, {
      branchId: id,
      roleName: 'Reader',
      isActive: true,
      reason: 'Test access',
      sections,
    });
    expect(
      validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length,
    ).toBeGreaterThan(0);
  });
  it('rejects active users without sections', async () => {
    const s = setup();
    await expect(
      s.service.create(id, { ...input(), sections: [] }, actor, {}),
    ).rejects.toThrow();
    expect(s.iam.createUser).not.toHaveBeenCalled();
  });
  it('rejects weak passwords before IAM or domain writes', async () => {
    const s = setup();
    await expect(
      s.service.create(id, { ...input(), password: 'weakpassword' }, actor, {}),
    ).rejects.toThrow();
    expect(s.iam.createUser).not.toHaveBeenCalled();
  });
  it('disables a newly provisioned IAM account if domain registration fails', async () => {
    const s = setup();
    s.repository.save.mockRejectedValue(new Error('audit failed'));
    await expect(s.service.create(id, input(), actor, {})).rejects.toThrow(
      'audit failed',
    );
    expect(s.iam.updateUserStatus).toHaveBeenCalledWith(
      other,
      'INACTIVE',
      actor,
      {},
    );
  });
  it('rejects an agency account attempting to provision users even if later given staff permissions', async () => {
    const s = setup();
    s.repository.byUser.mockResolvedValue({ isActive: true });
    await expect(s.service.create(id, input(), actor, {})).rejects.toThrow();
    expect(s.iam.createUser).not.toHaveBeenCalled();
  });
  it('uses the membership organization for portal reads and rechecks grants on every request', async () => {
    const s = setup();
    const member = {
      organizationId: other,
      branchId: id,
      isActive: true,
      sections: ['organization'],
    };
    s.repository.byUser.mockResolvedValue(member);
    await s.service.section('organization', actor);
    expect(s.organizations.addresses).toHaveBeenCalledWith(other);
    await expect(s.service.section('credit', actor)).rejects.toThrow();
    expect(s.b2b.findProfile).not.toHaveBeenCalled();
    s.repository.byUser.mockResolvedValue({ ...member, isActive: false });
    await expect(s.service.section('organization', actor)).rejects.toThrow();
  });
  it('denies portal data for inactive organizations', async () => {
    const s = setup();
    s.repository.byUser.mockResolvedValue({
      organizationId: id,
      isActive: true,
      sections: ['organization'],
    });
    s.organizations.agencyReference.mockResolvedValue({
      id,
      isActive: false,
      legalName: 'Inactive',
    });
    await expect(s.service.section('organization', actor)).rejects.toThrow();
    expect(s.organizations.addresses).not.toHaveBeenCalled();
  });
  it.each([true, false])(
    'globally blocks organization accounts outside the portal, including inactive memberships (%s)',
    async (isActive) => {
      const s = setup();
      s.repository.byUser.mockResolvedValue({ isActive });
      const interceptor = new B2bPortalBoundaryInterceptor(
        s.repository as unknown as B2bOrganizationUserRepository,
      );
      const next = { handle: vi.fn(() => of('secret')) };
      const context = {
        switchToHttp: () => ({ getRequest: () => ({ actor }) }),
        getClass: () => class OtherController {},
      } as unknown as ExecutionContext;
      await expect(interceptor.intercept(context, next)).rejects.toThrow();
      expect(next.handle).not.toHaveBeenCalled();
    },
  );
  it.each([B2bPortalController, AuthController])(
    'allows only portal or own authentication controller (%s)',
    async (controller) => {
      const s = setup();
      s.repository.byUser.mockResolvedValue({ isActive: true });
      const interceptor = new B2bPortalBoundaryInterceptor(
        s.repository as unknown as B2bOrganizationUserRepository,
      );
      const next = { handle: vi.fn(() => of('ok')) };
      await interceptor.intercept(
        {
          switchToHttp: () => ({ getRequest: () => ({ actor }) }),
          getClass: () => controller,
        } as unknown as ExecutionContext,
        next,
      );
      expect(next.handle).toHaveBeenCalledOnce();
    },
  );
  it('preserves existing staff access', async () => {
    const s = setup();
    const next = { handle: vi.fn(() => of('ok')) };
    await new B2bPortalBoundaryInterceptor(
      s.repository as unknown as B2bOrganizationUserRepository,
    ).intercept(
      {
        switchToHttp: () => ({ getRequest: () => ({ actor }) }),
        getClass: () => class StaffController {},
      } as unknown as ExecutionContext,
      next,
    );
    expect(next.handle).toHaveBeenCalledOnce();
  });
});
