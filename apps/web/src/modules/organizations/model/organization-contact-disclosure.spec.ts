import type { IamPermissionCode } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  CONTACT_UNMASK_PERMISSION,
  hasCurrentContactDisclosurePermission,
  loadOrganizationContactDisclosures,
  organizationContactDisclosureContext,
  visibleOrganizationContactDisclosure,
} from './organization-contact-disclosure';

const authorized = [CONTACT_UNMASK_PERMISSION] as readonly IamPermissionCode[];
const contact = {
  id: 'contact-a',
  version: 2,
  organizationId: 'organization-a',
};

function context(
  overrides: Partial<
    Parameters<typeof organizationContactDisclosureContext>[0]
  > = {},
) {
  return organizationContactDisclosureContext({
    active: true,
    organizationId: 'organization-a',
    branchId: 'branch-a',
    sessionContextKey: 'session-a',
    permissions: authorized,
    contacts: [contact],
    ...overrides,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

describe('organization contact disclosure boundary', () => {
  it('does not create a disclosure context without the fresh permission or session', () => {
    expect(context({ permissions: [] })).toBeUndefined();
    expect(context({ sessionContextKey: '' })).toBeUndefined();
    expect(context({ active: false })).toBeUndefined();
  });

  it('hides cleartext immediately when the current access provider revokes permission', () => {
    expect(hasCurrentContactDisclosurePermission(authorized, authorized)).toBe(
      true,
    );
    const currentContext = context()!;
    const snapshot = {
      contextKey: currentContext.key,
      values: {
        [contact.id]: {
          id: contact.id,
          phone: '09121234567',
          email: 'person@example.test',
        },
      },
      failures: {},
    };
    expect(
      visibleOrganizationContactDisclosure(
        snapshot,
        currentContext.key,
        contact.id,
      ),
    ).toBeDefined();

    const providerAllows = hasCurrentContactDisclosurePermission(
      authorized,
      [],
    );
    const revokedContext = context({
      permissions: providerAllows ? authorized : [],
    });
    expect(revokedContext).toBeUndefined();
    expect(
      visibleOrganizationContactDisclosure(
        snapshot,
        revokedContext?.key ?? '',
        contact.id,
      ),
    ).toBeUndefined();
    expect(hasCurrentContactDisclosurePermission(authorized, undefined)).toBe(
      false,
    );
  });

  it('never requests disclosure for contacts outside the current organization', async () => {
    const result = context({
      contacts: [
        contact,
        { id: 'contact-b', version: 1, organizationId: 'organization-b' },
      ],
    })!;
    expect(result?.contacts).toEqual([contact]);
    const request = vi.fn(async (id: string) => ({
      id,
      phone: '09121234567',
      email: null,
    }));
    await loadOrganizationContactDisclosures({
      context: result,
      request,
      isCurrent: (key) => key === result.key,
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(contact.id, 'branch-a');
  });

  it('changes identity for session, organization and contact version changes', () => {
    const original = context()!;
    expect(context({ sessionContextKey: 'session-b' })!.key).not.toBe(
      original.key,
    );
    expect(
      context({
        organizationId: 'organization-b',
        contacts: [{ ...contact, organizationId: 'organization-b' }],
      })!.key,
    ).not.toBe(original.key);
    expect(context({ contacts: [{ ...contact, version: 3 }] })!.key).not.toBe(
      original.key,
    );
  });

  it('discards a delayed cleartext response after its context changes', async () => {
    const currentContext = context()!;
    const response = deferred<{
      id: string;
      phone: string | null;
      email: string | null;
    }>();
    let activeKey = currentContext.key;
    const loading = loadOrganizationContactDisclosures({
      context: currentContext,
      request: vi.fn(() => response.promise),
      isCurrent: (key) => key === activeKey,
    });
    activeKey = context({ sessionContextKey: 'session-b' })!.key;
    response.resolve({
      id: contact.id,
      phone: '09121234567',
      email: 'person@example.test',
    });
    await expect(loading).resolves.toBeUndefined();
  });

  it('rejects mismatched responses and retains failures without cleartext', async () => {
    const currentContext = context({
      contacts: [
        contact,
        { id: 'contact-b', version: 1, organizationId: 'organization-a' },
      ],
    })!;
    const snapshot = await loadOrganizationContactDisclosures({
      context: currentContext,
      request: vi.fn(async (id) => {
        if (id === contact.id)
          return { id: 'other-contact', phone: '09121234567', email: null };
        throw new Error('network');
      }),
      isCurrent: (key) => key === currentContext.key,
    });
    expect(snapshot?.values).toEqual({});
    expect(Object.keys(snapshot?.failures ?? {})).toEqual([
      'contact-a',
      'contact-b',
    ]);
  });

  it('preserves explicit null fields and hides snapshots from stale render contexts', async () => {
    const currentContext = context()!;
    const snapshot = await loadOrganizationContactDisclosures({
      context: currentContext,
      request: vi.fn(async (id) => ({ id, phone: null, email: null })),
      isCurrent: (key) => key === currentContext.key,
    });
    expect(snapshot?.values[contact.id]).toEqual({
      id: contact.id,
      phone: null,
      email: null,
    });
    expect(
      visibleOrganizationContactDisclosure(
        snapshot,
        context({ sessionContextKey: 'session-b' })!.key,
        contact.id,
      ),
    ).toBeUndefined();
    expect(
      visibleOrganizationContactDisclosure(snapshot, '', contact.id),
    ).toBeUndefined();
    expect(
      visibleOrganizationContactDisclosure(
        snapshot,
        currentContext.key,
        contact.id,
      ),
    ).toEqual({ id: contact.id, phone: null, email: null });
  });
});
