/* Owner-authorized definition import. Native commands only; no direct business writes. */
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');

async function main() {
  const mode = process.argv[2];
  assert(['--preview', '--apply'].includes(mode), 'Use --preview or --apply');
  const required = (name) => {
    assert(process.env[name], `Missing ${name}`);
    return process.env[name];
  };
  assert.equal(
    new URL(required('DATABASE_URL')).pathname.slice(1),
    required('ACCOUNTING_ROOT_CHART_DATABASE'),
    'Unexpected database',
  );
  const root = required('ACCOUNTING_ROOT_CHART_API_ROOT');
  const native = createRequire(resolve(root, 'main.js'));
  native('reflect-metadata');
  const { DatabaseService } = native(
    resolve(root, 'database/database.service.js'),
  );
  const { IamFinanceDirectory } = native(
    resolve(root, 'iam/iam-finance-directory.js'),
  );
  const { LegalEntitiesService } = native(
    resolve(root, 'legal-entities/legal-entities.service.js'),
  );
  const { FailClosedDocumentTemplatePolicyAdapter } = native(
    resolve(root, 'legal-entities/document-template-policy.port.js'),
  );
  const { AccountingCompanyScope } = native(
    resolve(root, 'finance/accounting/accounting-company-scope.js'),
  );
  const { AccountingService } = native(
    resolve(root, 'finance/accounting/accounting.service.js'),
  );
  const { planRootChart } = require(required('ACCOUNTING_ROOT_CHART_PLANNER'));
  const reference = JSON.parse(
    readFileSync(required('ACCOUNTING_ROOT_CHART_REFERENCE'), 'utf8'),
  );
  assert.equal(reference.schemaVersion, 1);
  assert.equal(reference.accounts.length, 49);
  assert.equal(
    reference.accounts.filter((a) => a.level === 'GROUP').length,
    13,
  );
  assert.equal(
    reference.accounts.filter((a) => a.level === 'GENERAL').length,
    36,
  );
  const branchId = required('ACCOUNTING_ROOT_CHART_BRANCH_ID');
  const userId = required('ACCOUNTING_ROOT_CHART_ACTOR_ID');
  const db = new DatabaseService();
  const identity = new IamFinanceDirectory(db);
  const entities = new LegalEntitiesService(
    db,
    new FailClosedDocumentTemplatePolicyAdapter(),
  );
  const scope = new AccountingCompanyScope(entities);
  const service = new AccountingService(
    db,
    identity,
    undefined,
    undefined,
    undefined,
    scope,
  );
  let original, owned;
  try {
    const principal = await identity.reminderPrincipal(userId, branchId);
    assert(
      principal &&
        [
          'finance.read',
          'finance.account.manage',
          'finance.journal.read',
        ].every((p) => principal.permissions.includes(p)),
      'Existing actor lacks required permissions',
    );
    const actor = {
      ...principal,
      sessionId: 'system:owner-root-chart-import-1115',
    };
    const companies = (await entities.selectable(actor)).data;
    const codes = ['NIYAYESH_SEIR_SAHAR', 'JAHAN_BASTAN', 'GHESATI_RO'];
    const roots = codes.map((code) => {
      const row = companies.find((e) => e.code === code);
      assert(row, `Missing active company: ${code}`);
      return row;
    });
    const books = await db.client.accountingBook.findMany({
      where: { legalEntityId: { in: roots.map((e) => e.id) } },
    });
    assert(
      books.every((b) => b.branchId === branchId),
      'A company book belongs to another branch',
    );
    const allBranchBooks = await db.client.accountingBook.findMany({
      where: { branchId },
      select: { id: true, code: true },
    });
    const plans = [];
    for (let index = 0; index < roots.length; index++) {
      const company = roots[index];
      const matches = books.filter((b) => b.legalEntityId === company.id);
      assert(
        matches.length <= 1,
        'Multiple company ledgers require explicit selection',
      );
      const book = matches[0] ?? {
        id: randomUUID(),
        code: String(index + 1),
        branchId,
        legalEntityId: company.id,
        title: company.persianName,
        baseCurrency: 'IRR',
      };
      if (!matches.length)
        assert(
          !allBranchBooks.some((b) => b.code === book.code),
          'New ledger code collision',
        );
      const existing = matches.length
        ? await db.client.accountingAccount.findMany({
            where: { bookId: book.id },
            orderBy: { id: 'asc' },
          })
        : [];
      const plan = planRootChart(book.id, existing, reference.accounts);
      plans.push({
        company,
        book,
        existing,
        plan,
        createBook: !matches.length,
      });
    }
    console.log(
      JSON.stringify({
        mode,
        companies: plans.map((p) => ({
          company: p.company.code,
          createBook: p.createBook,
          createGroups: p.plan.create.filter((a) => a.level === 'GROUP').length,
          createGenerals: p.plan.create.filter((a) => a.level === 'GENERAL')
            .length,
          existing: p.existing.length,
          matched: p.plan.matched,
          newSubsidiaries: 0,
        })),
      }),
    );
    if (mode === '--preview') return;
    original = (await entities.current(actor)).data;
    owned = original;
    try {
      for (const entry of plans) {
        const latestPrincipal = await identity.reminderPrincipal(
          userId,
          branchId,
        );
        assert(
          latestPrincipal?.permissions.includes('finance.account.manage'),
          'Actor permissions changed',
        );
        const current = (await entities.current(actor)).data;
        assert.equal(
          current.version,
          owned.version,
          'Company selection changed concurrently',
        );
        if (current.selection !== entry.company.code)
          owned = (
            await entities.switch(entry.company.code, current.version, actor)
          ).data;
        if (entry.createBook)
          await service.createBook(
            {
              ...entry.book,
              approvalPolicy: 'DUAL_CONTROL',
              active: true,
              isMain: false,
              allowsPosting: true,
            },
            actor,
          );
        const before = await service.snapshot(entry.book.id, actor);
        const latest = planRootChart(
          entry.book.id,
          before.accounts,
          reference.accounts,
        );
        for (const payload of latest.create) {
          assert(
            ['GROUP', 'GENERAL'].includes(payload.level),
            'Subsidiary creation is forbidden',
          );
          await service.command(
            entry.book.id,
            'save-account',
            {
              key: `root-chart-1115-${entry.book.id}-${payload.code}`,
              payload,
            },
            actor,
          );
        }
        const after = await db.client.accountingAccount.findMany({
          where: { bookId: entry.book.id },
          orderBy: { id: 'asc' },
        });
        assert.equal(
          planRootChart(entry.book.id, after, reference.accounts).create.length,
          0,
        );
        for (const saved of entry.existing)
          assert.deepEqual(
            after.find((a) => a.id === saved.id),
            saved,
            'An existing account changed',
          );
        assert.equal(
          after.filter((a) => a.level === 'SUBSIDIARY').length,
          entry.existing.filter((a) => a.level === 'SUBSIDIARY').length,
        );
        console.log(
          JSON.stringify({
            verified: entry.company.code,
            groups: after.filter((a) => a.level === 'GROUP').length,
            generals: after.filter((a) => a.level === 'GENERAL').length,
            subsidiaries: after.filter((a) => a.level === 'SUBSIDIARY').length,
            existingPreserved: entry.existing.length,
          }),
        );
      }
    } finally {
      const current = (await entities.current(actor)).data;
      if (current.selection !== original.selection) {
        assert.equal(
          current.version,
          owned.version,
          'Do not overwrite a concurrent company selection',
        );
        await entities.switch(original.selection, current.version, actor);
      }
      console.log(JSON.stringify({ companySelectionRestored: true }));
    }
  } finally {
    await db.onModuleDestroy();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Import failed');
  process.exitCode = 1;
});
