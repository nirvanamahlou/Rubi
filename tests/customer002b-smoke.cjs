const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');

module.exports = async function smoke(env, state) {
  const base = 'http://127.0.0.1:4002/api/v1';
  assert.equal(new URL(env.DATABASE_URL).port, '55432');
  assert.equal(
    new URL(env.DATABASE_URL).pathname,
    '/rubi_customers_completion',
  );
  const checks = [];
  let cookie = '';
  async function call(
    route,
    method = 'GET',
    body,
    headers = {},
    expected = 200,
  ) {
    const response = await fetch(base + route, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status !== expected) {
      const failure = await response.clone().json();
      console.error(
        `Unexpected ${response.status}; code=${failure.error?.code ?? failure.code ?? 'unknown'}`,
      );
    }
    assert.equal(
      response.status,
      expected,
      `${method} ${route.split('?')[0]} status`,
    );
    return { response, body: await response.json() };
  }
  function passed(label) {
    checks.push(label);
    console.log(`PASS ${label}`);
  }
  const noAuth = await fetch(base + '/customers');
  assert.equal(noAuth.status, 401);
  passed('unauthenticated 401');
  const login = await call('/iam/auth/login', 'POST', {
    username: env.IAM_BOOTSTRAP_ADMIN_USERNAME,
    password: state.adminPassword,
  });
  cookie = login.response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  assert.ok(cookie.includes('rubi_access='));
  passed('real session authentication');
  const marker = crypto.randomBytes(4).toString('hex');
  const org = (
    await call(
      '/master-data/organizations',
      'POST',
      {
        values: {
          code: `SYN-${marker}`,
          legalName: 'سازمان مصنوعی تست مشتریان',
          displayName: `سازمان مصنوعی ${marker}`,
          roleCodes: ['CORPORATE_CUSTOMER'],
        },
      },
      {},
      201,
    )
  ).body.data;
  function id() {
    const digits = String(crypto.randomInt(100000000, 999999999));
    const mod =
      [...digits].reduce(
        (sum, digit, index) => sum + Number(digit) * (10 - index),
        0,
      ) % 11;
    return digits + (mod < 2 ? mod : 11 - mod);
  }
  const nationalA = id();
  const nationalB = id();
  const person = {
    kind: 'person',
    firstName: 'شخص',
    lastName: `مصنوعی ${marker}`,
    displayName: `شخص مصنوعی ${marker}`,
    roles: ['customer', 'passenger'],
    nationalId: nationalA,
    birthDate: '1990-01-02',
  };
  let a = (await call('/customers', 'POST', person, {}, 201)).body.data;
  let b = (
    await call(
      '/customers',
      'POST',
      {
        ...person,
        firstName: 'مسافر',
        displayName: `مسافر مصنوعی ${marker}`,
        roles: ['passenger'],
        nationalId: nationalB,
      },
      {},
      201,
    )
  ).body.data;
  assert.equal(a.nationalId, null);
  assert.notEqual(a.maskedNationalId, nationalA);
  passed('two synthetic people; shared role identity');
  await call('/customers', 'POST', person, {}, 409);
  passed('duplicate national identity rejected');
  const orgCustomer = (
    await call(
      '/customers',
      'POST',
      {
        kind: 'organization',
        organizationId: org.id,
        displayName: org.name,
        roles: ['customer'],
      },
      {},
      201,
    )
  ).body.data;
  assert.equal(orgCustomer.kind, 'organization');
  passed('organization persisted via public Master Data reference');
  a = (
    await call(
      `/customers/${a.id}/contacts`,
      'POST',
      {
        type: 'phone',
        value: '+12025550100',
        label: 'synthetic',
        isPrimary: true,
        version: a.version,
      },
      {},
      201,
    )
  ).body.data;
  assert.equal(a.contacts[0].value, null);
  passed('default contact masking');
  const reveal = await call(`/customers/${a.id}`, 'GET', undefined, {
    'x-sensitive-read-reason': 'customer-verification',
  });
  assert.equal(reveal.body.data.contacts[0].value, '+12025550100');
  assert.equal(reveal.body.data.birthDate, '1990-01-02');
  assert.match(reveal.response.headers.get('cache-control'), /no-store/);
  passed('reasoned reveal and no-store');
  const edit = {
    kind: 'person',
    firstName: a.firstName,
    lastName: a.lastName,
    displayName: a.displayName,
    roles: a.roles,
    version: a.version,
  };
  a = (await call(`/customers/${a.id}`, 'PATCH', edit)).body.data;
  const fresh = (
    await call(`/customers/${a.id}`, 'GET', undefined, {
      'x-sensitive-read-reason': 'data-correction',
    })
  ).body.data;
  assert.equal(fresh.birthDate, '1990-01-02');
  assert.equal(fresh.nationalId, nationalA);
  passed('unrelated edit preserves encrypted identity and masked birth date');
  const responses = await Promise.all(
    [0, 1].map(() =>
      fetch(base + `/customers/${a.id}`, {
        method: 'PATCH',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ ...edit, version: a.version }),
      }),
    ),
  );
  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [200, 409],
  );
  passed('atomic optimistic concurrency');
  a = (await call(`/customers/${a.id}`)).body.data;
  await call(
    `/customers/${a.id}/consents`,
    'POST',
    {
      purpose: 'marketing',
      channel: 'phone',
      status: 'granted',
      source: 'synthetic-smoke',
      reason: ' \t\n ',
      version: a.version,
    },
    {},
    400,
  );
  a = (
    await call(
      `/customers/${a.id}/consents`,
      'POST',
      {
        purpose: 'marketing',
        channel: 'phone',
        status: 'granted',
        source: 'synthetic-smoke',
        reason: 'درخواست آزمایشی معتبر',
        version: a.version,
      },
      {},
      201,
    )
  ).body.data;
  assert.equal(a.consents[0].reason, 'درخواست آزمایشی معتبر');
  passed('consent reason and history persisted');
  a = (
    await call(
      `/customers/${a.id}/companions`,
      'POST',
      {
        relatedCustomerId: b.id,
        relationshipType: 'companion',
        version: a.version,
      },
      {},
      201,
    )
  ).body.data;
  await call(
    `/customers/${a.id}/companions`,
    'POST',
    {
      relatedCustomerId: b.id,
      relationshipType: 'companion',
      version: a.version,
    },
    {},
    409,
  );
  await call(
    `/customers/${a.id}/companions`,
    'POST',
    {
      relatedCustomerId: a.id,
      relationshipType: 'companion',
      version: a.version,
    },
    {},
    400,
  );
  passed('companions reject duplicates and self-reference');
  const unknownBranch = crypto.randomUUID();
  await call(`/customers?branchId=${unknownBranch}`, 'GET', undefined, {}, 403);
  passed('branch filter tampering denied');
  const list = (
    await call('/customers?kind=organization&role=customer&pageSize=10')
  ).body;
  assert.ok(list.data.every((item) => item.kind === 'organization'));
  assert.equal(list.meta.metrics.totalCustomers, list.meta.total);
  passed('organization filter and KPI agree');
  const audit = (await call(`/customers/${a.id}/audit`)).body;
  const auditText = JSON.stringify(audit);
  assert.ok(
    !auditText.includes(nationalA) && !auditText.includes('+12025550100'),
  );
  assert.ok(
    audit.data.some((event) => event.action === 'customers.sensitive.read'),
  );
  passed('sensitive view audit without raw PII');
  const history = (await call(`/customers/${a.id}/status-history`)).body;
  assert.ok(history.data.length > 0);
  passed('real status timeline');
  const page = await fetch('http://127.0.0.1:3102/customers', {
    headers: { cookie },
    redirect: 'manual',
  });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /مشتریان/);
  passed('authenticated Web route HTTP smoke');
  const { Pool } = require(
    path.join(__dirname, '../packages/database/node_modules/pg'),
  );
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    const stored = await pool.query(
      'SELECT "nationalIdEncrypted", "nationalIdMasked", "nationalIdKeyVersion" FROM customers WHERE id=$1',
      [a.id],
    );
    assert.ok(stored.rows[0].nationalIdEncrypted);
    assert.ok(!JSON.stringify(stored.rows[0]).includes(nationalA));
    const storedContact = await pool.query(
      'SELECT "encryptedValue", "maskedValue" FROM customer_contacts WHERE "customerId"=$1',
      [a.id],
    );
    assert.ok(storedContact.rows[0].encryptedValue);
    assert.ok(!JSON.stringify(storedContact.rows[0]).includes('+12025550100'));
    passed('real PostgreSQL ciphertext at rest');
  } finally {
    await pool.end();
  }
  console.log(
    `Synthetic smoke: ${checks.length} checks passed; no real database accessed.`,
  );
};
