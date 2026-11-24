import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SalesAgentController } from './controller';
import type { ContractCompanyScope } from '../contract-company-scope.public';
import type { IamService } from '../../iam/iam.service';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import type { SalesAgentQueryService } from './query.service';
import type { DatabaseService } from '../../database/database.service';

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
  const database = {
    client: {
      $transaction: vi.fn().mockResolvedValue({ version: 1, rows: [] }),
      user: { findFirst: vi.fn() },
    },
  };
  const controller = new SalesAgentController(
    companies as unknown as ContractCompanyScope,
    queries as unknown as SalesAgentQueryService,
    iam as unknown as IamService,
    database as unknown as DatabaseService,
  );
  const request = {
    actor,
    headers: { cookie: 'nora_access=synthetic' },
  } as unknown as AuthenticatedRequest;
  process.env.ASSISTANT_AGENT_ENABLED = 'true';
  return { current, companies, iam, queries, database, controller, request };
}
const original = process.env.ASSISTANT_AGENT_ENABLED;
afterEach(() => {
  vi.unstubAllEnvs();
  if (original === undefined) delete process.env.ASSISTANT_AGENT_ENABLED;
  else process.env.ASSISTANT_AGENT_ENABLED = original;
});
describe('Sales public agent source authorization', () => {
  it('uses global scope only for the configured active account and rechecks it on release', async () => {
    const h = setup();
    const id = '00000000-0000-4000-8000-000000000001';
    h.current.userId = id;
    h.current.permissions = [];
    h.request.actor = { ...h.request.actor, userId: id };
    vi.stubEnv('NORA_DANIAL_BUSINESS_READ_USER_ID', id);
    h.companies.selected.mockResolvedValue(null);
    h.database.client.user.findFirst.mockResolvedValue({ id });
    const { contextId, sources } = await h.controller.catalog(h.request);
    expect(sources.map((source) => source.id)).toContain('payments');
    expect(h.companies.selected).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: ['legal-entity.aggregate.read'] }),
    );
    h.database.client.$transaction.mockImplementation(async () => {
      h.database.client.user.findFirst.mockResolvedValue(null);
      return { version: 1, rows: [] };
    });
    await expect(
      h.controller.countBreakdown(h.request, { contextId }),
    ).rejects.toThrow();
  });

  it('rejects count scope injection, stale scope and revocation before result release', async () => {
    const h = setup();
    const { contextId } = await h.controller.catalog(h.request);
    await expect(
      h.controller.countBreakdown(h.request, { contextId, companyId: 'other' }),
    ).rejects.toThrow('INVALID_QUERY');
    await expect(
      h.controller.countBreakdown(h.request, { contextId: 'stale' }),
    ).rejects.toThrow('AGENT_CONTEXT_CHANGED');
    expect(h.database.client.$transaction).not.toHaveBeenCalled();
    h.database.client.$transaction.mockImplementation(async () => {
      h.companies.selected.mockResolvedValue('other');
      return { version: 1, rows: [] };
    });
    await expect(
      h.controller.countBreakdown(h.request, { contextId }),
    ).rejects.toThrow('AGENT_CONTEXT_CHANGED');
  });
  it('returns a controlled unavailable response, never zero, on count reader failure', async () => {
    const h = setup();
    const { contextId } = await h.controller.catalog(h.request);
    h.database.client.$transaction.mockRejectedValue(
      new Error('private driver detail'),
    );
    await expect(
      h.controller.countBreakdown(h.request, { contextId }),
    ).rejects.toThrow('AGENT_SOURCE_UNAVAILABLE');
  });
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
