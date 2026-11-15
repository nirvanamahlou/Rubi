import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SalesAgentController } from './controller';
import type { ContractCompanyScope } from '../contract-company-scope.public';
import type { IamService } from '../../iam/iam.service';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import type { SalesAgentQueryService } from './query.service';

const actor = {
  userId: 'synthetic-user',
  branchIds: ['synthetic-branch'],
  permissions: ['sales.contracts.read.all', 'sales.payments.read'],
};
function setup() {
  const current = structuredClone(actor);
  const companies = {
    selected: vi.fn().mockResolvedValue('synthetic-company'),
  };
  const iam = { authenticate: vi.fn().mockImplementation(async () => current) };
  const queries = {
    query: vi.fn().mockResolvedValue({ version: 1, rows: [] }),
  };
  const controller = new SalesAgentController(
    companies as unknown as ContractCompanyScope,
    queries as unknown as SalesAgentQueryService,
    iam as unknown as IamService,
  );
  const request = {
    actor,
    headers: { cookie: 'nora_access=synthetic' },
  } as unknown as AuthenticatedRequest;
  process.env.ASSISTANT_AGENT_ENABLED = 'true';
  return { current, companies, iam, queries, controller, request };
}
const original = process.env.ASSISTANT_AGENT_ENABLED;
afterEach(() => {
  if (original === undefined) delete process.env.ASSISTANT_AGENT_ENABLED;
  else process.env.ASSISTANT_AGENT_ENABLED = original;
});
describe('Sales public agent source authorization', () => {
  it('hides payment sources without payment permission and refuses absent Sales access', async () => {
    const h = setup();
    h.current.permissions = ['sales.contracts.read.own'];
    expect(
      (await h.controller.catalog(h.request)).sources.map((row) => row.id),
    ).not.toContain('payments');
    h.current.permissions = [];
    await expect(h.controller.catalog(h.request)).rejects.toThrow();
  });
  it('matches native all/branch/own scope and injects server-owned company and actor', async () => {
    for (const mode of ['all', 'branch', 'own']) {
      const h = setup();
      h.current.permissions = [`sales.contracts.read.${mode}`];
      const catalog = await h.controller.catalog(h.request);
      await h.controller.query(h.request, {
        sql: 'SELECT * FROM contracts',
        contextId: catalog.contextId,
      });
      expect(h.queries.query.mock.calls[0]![1]).toMatchObject({
        mode,
        userId: actor.userId,
        companyId: 'synthetic-company',
        branchIds: actor.branchIds,
      });
    }
  });
  it('blocks cross-account substitution and model-supplied scope', async () => {
    const h = setup();
    h.current.userId = 'other';
    await expect(h.controller.catalog(h.request)).rejects.toThrow();
    await expect(
      h.controller.query(h.request, {
        sql: 'SELECT * FROM contracts',
        contextId: 'x',
        companyId: 'other',
      }),
    ).rejects.toThrow('INVALID_QUERY');
  });
  it('rejects stale context before a query, and changed permissions/company before release', async () => {
    const h = setup();
    const catalog = await h.controller.catalog(h.request);
    h.current.permissions.pop();
    await expect(
      h.controller.query(h.request, {
        sql: 'SELECT * FROM contracts',
        contextId: catalog.contextId,
      }),
    ).rejects.toThrow('AGENT_CONTEXT_CHANGED');
    expect(h.queries.query).not.toHaveBeenCalled();
    const g = setup();
    const initial = await g.controller.catalog(g.request);
    g.queries.query.mockImplementation(async () => {
      g.companies.selected.mockResolvedValue('changed-company');
      return { version: 1, rows: [] };
    });
    await expect(
      g.controller.query(g.request, {
        sql: 'SELECT * FROM contracts',
        contextId: initial.contextId,
      }),
    ).rejects.toThrow('AGENT_CONTEXT_CHANGED');
  });
  it('does not expose database driver errors or secrets', async () => {
    const h = setup();
    const catalog = await h.controller.catalog(h.request);
    h.queries.query.mockRejectedValue(
      new Error('postgresql://private:secret@internal/private_table'),
    );
    await expect(
      h.controller.query(h.request, {
        sql: 'bad',
        contextId: catalog.contextId,
      }),
    ).rejects.toThrow('QUERY_REJECTED');
  });
});
