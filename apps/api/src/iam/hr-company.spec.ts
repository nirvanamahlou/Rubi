import type { AuthenticatedActor } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import { createHrCompany, hrCompanyInput } from './hr-company';
const actor: AuthenticatedActor = {
  userId: 'user',
  sessionId: 'session',
  branchIds: ['a'],
  permissions: ['hr.manage', 'iam.roles.manage'],
};
const input = { id: '12345678-1234-4234-8234-123456789012', name: 'شرکت' };
describe('HR company creation owned by IAM', () => {
  it('requires both HR and company administration permissions', () => {
    for (const permissions of [
      [],
      ['hr.manage'],
      ['iam.roles.manage'],
    ] as AuthenticatedActor['permissions'][])
      expect(() => hrCompanyInput(input, { ...actor, permissions })).toThrow();
    expect(hrCompanyInput(input, actor)).toEqual(input);
  });
  it('rejects unknown fields and invalid identity', () => {
    expect(() =>
      hrCompanyInput({ ...input, isActive: false }, actor),
    ).toThrow();
    expect(() => hrCompanyInput({ ...input, id: 'invalid' }, actor)).toThrow();
    expect(() => hrCompanyInput({ ...input, name: ' ' }, actor)).toThrow();
  });
  it('creates a real IAM company, grants its creator access and records audit', async () => {
    const tx = {
      branch: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(input),
      },
      userBranch: { create: vi.fn() },
      auditEvent: { create: vi.fn() },
    };
    await createHrCompany(tx as never, input, actor);
    expect(tx.branch.create).toHaveBeenCalledWith({
      data: { ...input, code: 'CMP-12345678123442348234123456789012' },
    });
    expect(tx.userBranch.create).toHaveBeenCalledWith({
      data: { userId: 'user', branchId: input.id },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledOnce();
  });
  it('does not use retries to grant access to another company', async () => {
    const tx = {
      branch: { findUnique: vi.fn().mockResolvedValue(input) },
      userBranch: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    await expect(createHrCompany(tx as never, input, actor)).rejects.toThrow();
    tx.userBranch.findUnique.mockResolvedValue({} as never);
    await expect(createHrCompany(tx as never, input, actor)).resolves.toEqual(
      input,
    );
  });
});
