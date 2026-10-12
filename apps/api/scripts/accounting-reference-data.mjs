import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [mode, ...extra] = process.argv.slice(2);
assert(
  ['--validate', '--preview', '--apply'].includes(mode) && !extra.length,
  'Use --validate, --preview or --apply.',
);
const seed = JSON.parse(
  await readFile(
    new URL(
      '../../../data/accounting/rahkaran-chart-737.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
assert.equal(seed.schemaVersion, 1);
assert.equal(seed.accounts.length, 222);
assert.equal(seed.configurations.length, 26);
const ids = new Set(
  [...seed.accounts, ...seed.configurations].map((item) => item.id),
);
assert.equal(ids.size, 248, 'Duplicate reference identity');
assert.equal(new Set(seed.accounts.map((item) => item.code)).size, 222);
const levels = { GROUP: 0, GENERAL: 1, SUBSIDIARY: 2 };
const accountById = new Map(seed.accounts.map((item) => [item.id, item]));
const typeIds = new Set(seed.configurations.map((item) => item.id));
for (const account of seed.accounts) {
  assert(Object.hasOwn(levels, account.level), 'Unsupported account level');
  if (account.level === 'GROUP') assert.equal(account.parentId, null);
  else {
    const parent = accountById.get(account.parentId);
    assert(
      parent && levels[parent.level] === levels[account.level] - 1,
      'Invalid reference parent',
    );
  }
  for (const level of [4, 5, 6]) {
    const assigned = account.attributes[`detail${level}TypeIds`] ?? [];
    assert(
      Array.isArray(assigned) && assigned.every((id) => typeIds.has(id)),
      'Unknown assigned detail type',
    );
  }
}
for (const configuration of seed.configurations) {
  assert.equal(configuration.kind, 'detail-types');
  const parent = configuration.attributes.parentTypeId;
  assert(!parent || typeIds.has(parent), 'Unknown detail-type parent');
}
if (mode === '--validate') {
  console.log('Reference data valid: 222 accounts and 26 detail types.');
} else {
  const base = new URL(
    process.env.ACCOUNTING_SEED_API ?? 'http://localhost:4192/api/v1/',
  );
  assert(
    ['localhost', '127.0.0.1', 'accounting-qa.localhost'].includes(
      base.hostname,
    ) && base.protocol === 'http:',
    'Use an explicit local Rubi API.',
  );
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  assert(
    process.env.ACCOUNTING_SEED_USERNAME &&
      process.env.ACCOUNTING_SEED_PASSWORD &&
      process.env.ACCOUNTING_SEED_BRANCH_ID,
    'Provide existing user credentials and an authorized branch through environment variables.',
  );
  const cookies = new Map();
  async function request(path, body) {
    const response = await fetch(new URL(path, base), {
      method: body ? 'POST' : 'GET',
      headers: {
        'content-type': 'application/json',
        cookie: [...cookies]
          .map(([key, value]) => `${key}=${value}`)
          .join('; '),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0];
      const index = pair.indexOf('=');
      if (index > 0) cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    const result = await response.json();
    assert(
      response.ok,
      `Reference request failed (${response.status}): ${result.error?.code ?? path}`,
    );
    return result;
  }
  await request('iam/auth/login', {
    username: process.env.ACCOUNTING_SEED_USERNAME,
    password: process.env.ACCOUNTING_SEED_PASSWORD,
  });
  const directory = await request('finance/accounting/books');
  const branchId = process.env.ACCOUNTING_SEED_BRANCH_ID;
  assert(
    directory.branches.some((branch) => branch.id === branchId),
    'Branch is outside existing access',
  );
  const book = directory.books.find((item) => item.id === seed.book.id);
  assert(
    !directory.books.some(
      (item) => item.code === seed.book.code && item.id !== seed.book.id,
    ),
    'Book code already belongs to another identity',
  );
  if (book) {
    assert.equal(
      book.branchId,
      branchId,
      'Existing book belongs to another branch',
    );
    for (const key of Object.keys(seed.book))
      assert.deepEqual(
        book[key] ?? null,
        seed.book[key] ?? null,
        `Existing book differs: ${key}`,
      );
  }
  const current = book
    ? await request(`finance/accounting/books/${seed.book.id}`)
    : { accounts: [], configurations: [] };
  function planned(existing, desired, label) {
    return desired.filter((item) => {
      const match = existing.find((value) => value.id === item.id);
      assert(
        !existing.some(
          (value) =>
            value.code === item.code &&
            value.id !== item.id &&
            (!item.kind || value.kind === item.kind),
        ),
        `${label} code collision`,
      );
      if (!match) return true;
      for (const key of Object.keys(item))
        assert.deepEqual(
          match[key] ?? null,
          item[key] ?? null,
          `${label} differs: ${item.code}.${key}`,
        );
      return false;
    });
  }
  const configurations = planned(
    current.configurations,
    seed.configurations,
    'Detail type',
  );
  const accounts = planned(current.accounts, seed.accounts, 'Account').sort(
    (a, b) => levels[a.level] - levels[b.level] || a.code.localeCompare(b.code),
  );
  console.log(
    JSON.stringify({
      mode,
      createBook: !book,
      configurations: configurations.length,
      accounts: accounts.length,
    }),
  );
  if (mode === '--apply') {
    if (!book)
      await request('finance/accounting/books', {
        ...seed.book,
        branchId,
        approvalPolicy: 'DUAL_CONTROL',
      });
    for (const [action, items] of [
      ['save-configuration', configurations],
      ['save-account', accounts],
    ]) {
      for (const payload of items)
        await request(
          `finance/accounting/books/${seed.book.id}/actions/${action}`,
          { key: `ref737-${action}-${payload.id}`, payload },
        );
    }
    const after = await request(`finance/accounting/books/${seed.book.id}`);
    assert.equal(
      planned(after.configurations, seed.configurations, 'Detail type').length,
      0,
    );
    assert.equal(planned(after.accounts, seed.accounts, 'Account').length, 0);
    console.log(
      'Reference data verified; existing records were not overwritten.',
    );
  }
}
