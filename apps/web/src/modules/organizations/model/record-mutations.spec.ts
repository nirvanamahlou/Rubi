import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MasterDataRecord } from '@rubi/contracts';
import {
  masterDataApi,
  MasterDataApiError,
} from '@/modules/master-data/api/client';
import {
  deleteOrganizationRecord,
  saveOrganizationChanges,
} from './record-mutations';

const organization = {
  id: '11111111-1111-4111-8111-111111111111',
  resource: 'organizations',
  code: 'ORG_TEST',
  name: 'سازمان آزمون',
  version: 7,
  status: 'active',
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  attributes: { roleCodes: 'SUPPLIER,AGENCY,CORPORATE_CUSTOMER' },
} as MasterDataRecord;
afterEach(() => vi.restoreAllMocks());

describe('organization record actions', () => {
  it('denies edit and delete before contacting the owner without their separate permissions', async () => {
    const remove = vi.spyOn(masterDataApi, 'remove');
    const persist = vi.spyOn(masterDataApi, 'persistWithLogo');
    await expect(
      deleteOrganizationRecord(
        { resource: 'organizations', record: organization },
        ['master_data.update'],
      ),
    ).rejects.toThrow('مجوز');
    expect(() =>
      saveOrganizationChanges({
        record: organization,
        values: { legalName: 'نام تازه' },
        defaultRole: 'AGENCY',
        permissions: ['master_data.delete'],
      }),
    ).toThrow('مجوز');
    expect(remove).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
  it('deletes the exact organization with its optimistic version, never deactivates it', async () => {
    const remove = vi.spyOn(masterDataApi, 'remove').mockResolvedValue({
      data: { id: organization.id, resource: 'organizations', deleted: true },
    });
    const status = vi.spyOn(masterDataApi, 'setStatus');
    await deleteOrganizationRecord(
      { resource: 'organizations', record: organization },
      ['master_data.delete'],
    );
    expect(remove).toHaveBeenCalledExactlyOnceWith(
      'organizations',
      organization.id,
      7,
    );
    expect(status).not.toHaveBeenCalled();
  });
  it.each([409, 403, 0])(
    'preserves owner failures (%i) without retry or fallback mutation',
    async (status) => {
      const error = new MasterDataApiError('رکورد قابل حذف نیست', status);
      const remove = vi.spyOn(masterDataApi, 'remove').mockRejectedValue(error);
      await expect(
        deleteOrganizationRecord(
          { resource: 'organizations', record: organization },
          ['master_data.delete'],
        ),
      ).rejects.toBe(error);
      expect(remove).toHaveBeenCalledOnce();
    },
  );
  it('rejects mismatched delete responses instead of reporting success', async () => {
    vi.spyOn(masterDataApi, 'remove').mockResolvedValue({
      data: { id: 'another-record', resource: 'organizations', deleted: true },
    });
    await expect(
      deleteOrganizationRecord(
        { resource: 'organizations', record: organization },
        ['master_data.delete'],
      ),
    ).rejects.toThrow('نتیجه حذف تأیید نشد');
  });
  it('checks contact ownership before deletion and uses the contact resource', async () => {
    const contact = {
      ...organization,
      resource: 'organization-contacts',
      id: 'contact',
      attributes: { organizationId: organization.id },
    } as MasterDataRecord;
    const remove = vi.spyOn(masterDataApi, 'remove').mockResolvedValue({
      data: {
        id: contact.id,
        resource: 'organization-contacts',
        deleted: true,
      },
    });
    await expect(
      deleteOrganizationRecord(
        {
          resource: 'organization-contacts',
          record: contact,
          organizationId: 'another-parent',
        },
        ['master_data.delete'],
      ),
    ).rejects.toThrow('متعلق');
    expect(remove).not.toHaveBeenCalled();
    await deleteOrganizationRecord(
      {
        resource: 'organization-contacts',
        record: contact,
        organizationId: organization.id,
      },
      ['master_data.delete'],
    );
    expect(remove).toHaveBeenCalledExactlyOnceWith(
      'organization-contacts',
      contact.id,
      7,
    );
  });
  it('preserves identity, version, unrelated roles and logo options during edits', async () => {
    const persist = vi
      .spyOn(masterDataApi, 'persistWithLogo')
      .mockResolvedValue({ data: organization });
    await saveOrganizationChanges({
      record: organization,
      values: { legalName: 'نام ویرایش‌شده' },
      permissions: ['master_data.update'],
      defaultRole: 'AGENCY',
      logoChange: { kind: 'remove' },
    });
    expect(persist).toHaveBeenCalledExactlyOnceWith({
      resource: 'organizations',
      existing: organization,
      values: {
        legalName: 'نام ویرایش‌شده',
        roleCodes: 'SUPPLIER,AGENCY,CORPORATE_CUSTOMER',
      },
      logoChange: { kind: 'remove' },
      title: 'لوگوی سازمان نام ویرایش‌شده',
    });
  });
});
