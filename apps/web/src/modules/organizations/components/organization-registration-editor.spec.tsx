import type { MasterDataRecord } from '@nora/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./organization-addresses-panel', () => ({
  OrganizationAddressesPanel: ({
    organizationId,
  }: {
    organizationId: string;
  }) => <div>addresses:{organizationId}</div>,
}));
vi.mock('./agreement-workflow-panel', () => ({
  AgreementWorkflowPanel: ({
    organizationId,
    role,
  }: {
    organizationId: string;
    role: string;
  }) => (
    <div>
      agreement:{organizationId}:{role}
    </div>
  ),
}));

import { OrganizationRegistrationEditor } from './organization-registration-editor';

const organization = {
  id: 'org-1',
  resource: 'organizations',
  code: 'ORG-1',
  name: 'آژانس نمونه',
  status: 'active',
  version: 1,
  createdAt: '2026-10-07T00:00:00.000Z',
  updatedAt: '2026-10-07T00:00:00.000Z',
  attributes: {
    roleCodes: 'AGENCY',
    personType: 'LEGAL',
    nationalId: '12345678901',
  },
} satisfies MasterDataRecord;

describe('agency registration edit entry', () => {
  it('shows registered identity, address, representatives and agreement in one edit entry', () => {
    const markup = renderToStaticMarkup(
      <OrganizationRegistrationEditor
        organization={organization}
        contacts={[
          {
            id: 'contact-1',
            resource: 'organization-contacts',
            code: 'CONTACT-1',
            name: 'نماینده نمونه',
            status: 'active',
            version: 1,
            createdAt: '2026-10-07T00:00:00.000Z',
            updatedAt: '2026-10-07T00:00:00.000Z',
            attributes: {
              jobTitle: 'مدیر فروش',
              phoneMasked: '*******1234',
              phone: '09123451234',
            },
          } satisfies MasterDataRecord,
        ]}
        contactsLoading={false}
        contactPage={1}
        contactTotal={1}
        permissions={['master_data.update', 'master_data.create']}
        onClose={() => {}}
        onEditIdentity={() => {}}
        onAddContact={() => {}}
        onEditContact={() => {}}
        onContactPageChange={() => {}}
      />,
    );
    expect(markup).toContain('آژانس نمونه');
    expect(markup).toContain('12345678901');
    expect(markup).toContain('شماره مجوز');
    expect(markup).not.toContain('مجوز گردشگری');
    expect(markup).toContain('addresses:org-1');
    expect(markup).toContain('نماینده نمونه');
    expect(markup).toContain('agreement:org-1:AGENCY');
    expect(markup).toContain('*******1234');
    expect(markup).not.toContain('09123451234');
  });

  it('disables edits without owner permissions', () => {
    const markup = renderToStaticMarkup(
      <OrganizationRegistrationEditor
        organization={organization}
        contacts={[]}
        contactsLoading={false}
        contactPage={1}
        contactTotal={0}
        permissions={[]}
        onClose={() => {}}
        onEditIdentity={() => {}}
        onAddContact={() => {}}
        onEditContact={() => {}}
        onContactPageChange={() => {}}
      />,
    );
    expect(markup).toMatch(/disabled=""[^>]*>.*?ویرایش مشخصات و لوگو/s);
    expect(markup).toMatch(/disabled=""[^>]*>.*?افزودن نماینده/s);
  });
});
