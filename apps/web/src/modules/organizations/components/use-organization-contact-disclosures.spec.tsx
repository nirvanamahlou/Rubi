import type * as ReactModule from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  accessPermissions: ['master_data.sensitive_contact.unmask'] as
    readonly string[] | null | undefined,
  effects: [] as (() => void | (() => void))[],
  stateIndex: 0,
  stateValues: [] as unknown[],
  unmask: vi.fn(),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    useEffect: (effect: () => void | (() => void)) => {
      harness.effects.push(effect);
    },
    useState: <T,>(initial: T | (() => T)) => {
      const index = harness.stateIndex++;
      if (index >= harness.stateValues.length)
        harness.stateValues[index] =
          typeof initial === 'function' ? (initial as () => T)() : initial;
      const setState = (next: T | ((current: T) => T)) => {
        const current = harness.stateValues[index] as T;
        harness.stateValues[index] =
          typeof next === 'function'
            ? (next as (value: T) => T)(current)
            : next;
      };
      return [harness.stateValues[index] as T, setState] as const;
    },
  };
});

vi.mock('@/modules/iam/access-context', () => ({
  useAccessPermissions: () => harness.accessPermissions,
}));
vi.mock('@/modules/master-data/api/client', () => ({
  masterDataApi: { unmaskOrganizationContact: harness.unmask },
}));
vi.mock('./use-dossier-branch', () => ({
  useDossierBranch: () => ({
    branchId: 'branch-a',
    permissions: ['master_data.sensitive_contact.unmask'],
    sessionContextKey: 'stable-dossier-session',
    sessionError: '',
  }),
}));

import { useOrganizationContactDisclosures } from './use-organization-contact-disclosures';

const contact = {
  id: 'contact-a',
  resource: 'organization-contacts' as const,
  code: 'CONTACT-A',
  name: 'Synthetic contact',
  status: 'active' as const,
  isActive: true,
  version: 2,
  createdAt: '2026-10-04T00:00:00.000Z',
  updatedAt: '2026-10-04T00:00:00.000Z',
  attributes: { organizationId: 'organization-a' },
};

function Probe() {
  const disclosure = useOrganizationContactDisclosures({
    active: true,
    organizationId: 'organization-a',
    contacts: [contact],
  });
  return (
    <span>
      {disclosure.disclosure(contact.id)?.phone ?? 'MASKED'}|{disclosure.status}
    </span>
  );
}

function renderProbe() {
  harness.stateIndex = 0;
  harness.effects.length = 0;
  return renderToStaticMarkup(<Probe />);
}

async function flushPromises() {
  for (let index = 0; index < 6; index += 1) await Promise.resolve();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

beforeEach(() => {
  harness.accessPermissions = ['master_data.sensitive_contact.unmask'];
  harness.effects.length = 0;
  harness.stateIndex = 0;
  harness.stateValues.length = 0;
  harness.unmask.mockReset();
});

describe('organization contact disclosure hook lifecycle', () => {
  it('hides a visible snapshot synchronously when the provider revokes permission', async () => {
    harness.unmask.mockResolvedValue({
      data: { id: contact.id, phone: '09121234567', email: null },
    });
    expect(renderProbe()).toContain('MASKED');
    const cleanup = harness.effects[0]!();
    await flushPromises();
    expect(renderProbe()).toContain('09121234567');

    harness.accessPermissions = [];
    expect(renderProbe()).toContain('MASKED');
    cleanup?.();
    harness.effects[0]!();
    await flushPromises();
    expect(renderProbe()).toContain('MASKED');
  });

  it('aborts and discards a delayed response after provider permission loss', async () => {
    const pending = deferred<{
      data: { id: string; phone: string | null; email: string | null };
    }>();
    let signal: AbortSignal | undefined;
    harness.unmask.mockImplementation(
      (_id: string, options: { signal?: AbortSignal }) => {
        signal = options.signal;
        return pending.promise;
      },
    );
    renderProbe();
    const cleanup = harness.effects[0]!();
    await flushPromises();
    expect(harness.unmask).toHaveBeenCalledTimes(1);

    harness.accessPermissions = [];
    expect(renderProbe()).toContain('MASKED');
    cleanup?.();
    expect(signal?.aborted).toBe(true);
    harness.effects[0]!();
    pending.resolve({
      data: {
        id: contact.id,
        phone: '09121234567',
        email: 'person@example.test',
      },
    });
    await flushPromises();
    expect(renderProbe()).toContain('MASKED');
    expect(renderProbe()).not.toContain('09121234567');
  });
});
