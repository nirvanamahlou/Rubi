import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { config as loadEnvironment } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This utility only targets a developer's local database. It makes the
// Procurement lifecycle visible without fabricating a supplier integration,
// payment, or finance posting.
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
loadEnvironment({
  path: resolve(scriptDirectory, '../../../apps/api/.env'),
  quiet: true,
});

const marker = 'LOCAL_PROCUREMENT_LIFECYCLE';
const legacyPrefix = 'PR-1405-DEMO-';
const actorName = process.env.LOCAL_DEMO_PROCUREMENT_USER ?? 'nirvana';
const apply = process.argv.includes('--apply');
const clear = process.argv.includes('--clear');
const inspect = process.argv.includes('--inspect');

if (clear) {
  throw new Error(
    'سوابق چرخهٔ خرید افزایشی و غیرقابل‌حذف‌اند؛ دادهٔ محلی را پاک نکنید. برای بررسی فقط --inspect اجرا کنید.',
  );
}
if ([apply, inspect].filter(Boolean).length !== 1) {
  throw new Error('یکی از گزینه‌های --apply یا --inspect لازم است.');
}

if (!process.env.DATABASE_URL)
  throw new Error(
    'DATABASE_URL تنظیم نشده است. مسیر محیط API محلی را با --env-file معرفی کنید.',
  );
const target = new URL(process.env.DATABASE_URL);
if (!['127.0.0.1', 'localhost', '::1'].includes(target.hostname)) {
  throw new Error('این ابزار فقط روی پایگاه‌دادهٔ محلی اجرا می‌شود.');
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
const text = (value) => String(value ?? '');
const draftFor = ({
  branchId,
  title,
  category,
  amount,
  kind,
  quantity,
  unit,
  requiredAt,
}) => ({
  branchId,
  title,
  category,
  requiredAt,
  estimatedAmount: amount,
  currencyCode: 'IRR',
  urgent: false,
  urgencyReason: '',
  deliveryLocation: 'انبار شعبه مرکزی',
  needReason: 'تأمین موردنیاز واحد عملیاتی طبق برنامهٔ مصوب',
  notes: 'دادهٔ محلی برای بررسی کامل چرخهٔ خرید.',
  source: marker,
  documents: [],
  items: [
    {
      id: randomUUID(),
      kind,
      description: title,
      quantity,
      unit,
      acceptanceCriteria:
        kind === 'SERVICE' ? 'تأیید نتیجه توسط واحد درخواست‌کننده' : '',
    },
  ],
});

async function context() {
  const scoped = await client.query(
    `SELECT b.id AS "branchId", b.name AS "branchName", u.id AS "userId", u."displayName"
       FROM iam_users u
       JOIN iam_user_branches ub ON ub."userId" = u.id
       JOIN branches b ON b.id = ub."branchId" AND b."isActive" = TRUE
      WHERE u.status = 'ACTIVE' AND u.username = $1
      ORDER BY ub."isPrimary" DESC, b.code
      LIMIT 1`,
    [actorName],
  );
  if (scoped.rows[0]) return scoped.rows[0];
  const fallback = await client.query(
    `SELECT b.id AS "branchId", b.name AS "branchName", u.id AS "userId", u."displayName"
       FROM iam_users u
       JOIN iam_user_branches ub ON ub."userId" = u.id
       JOIN branches b ON b.id = ub."branchId" AND b."isActive" = TRUE
      WHERE u.status = 'ACTIVE'
      ORDER BY u.username, ub."isPrimary" DESC, b.code
      LIMIT 1`,
  );
  if (!fallback.rows[0])
    throw new Error('برای دادهٔ محلی، یک کاربر فعال با شعبهٔ مجاز لازم است.');
  return fallback.rows[0];
}

async function ensureMasterData({ userId }) {
  await client.query(
    `INSERT INTO master_currencies (id, code, name, "englishName", "decimalDigits", "createdByUserId", "updatedByUserId", "updatedAt")
     VALUES ($1, 'IRR', 'ریال ایران', 'Iranian Rial', 0, $2, $2, NOW())
     ON CONFLICT (code) DO UPDATE SET "isActive" = TRUE`,
    [randomUUID(), userId],
  );
  const supplier = await client.query(
    `INSERT INTO master_suppliers (id, code, name, address, "displayOrder", "collaborationStatus", "isActive", "createdByUserId", "updatedByUserId", "updatedAt")
     VALUES ($1, 'SUP-LOCAL-1405', 'تأمین تجهیزات پارس', 'تهران، خیابان مطهری، پلاک ۲۴', 1405, 'ACTIVE', TRUE, $2, $2, NOW())
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address, "isActive" = TRUE, "updatedByUserId" = EXCLUDED."updatedByUserId"
     RETURNING id`,
    [randomUUID(), userId],
  );
  const legal = await client.query(
    `INSERT INTO legal_entities (id, code, "persianName", "latinName", "isActive", "updatedAt")
     VALUES ($1, 'LEGAL-LOCAL-1405', 'شرکت نیایش سیر', 'Niayesh Seir', TRUE, NOW())
     ON CONFLICT (code) DO UPDATE SET "isActive" = TRUE
     RETURNING id`,
    [randomUUID()],
  );
  return { supplierId: supplier.rows[0].id, legalEntityId: legal.rows[0].id };
}

async function clearData() {
  const requests = await client.query(
    `SELECT id FROM procurement_request
      WHERE data->>'source' = $1 OR number LIKE $2`,
    [marker, `${legacyPrefix}%`],
  );
  const ids = requests.rows.map((row) => row.id);
  if (!ids.length) return 0;
  const orders = await client.query(
    'SELECT id FROM procurement_order WHERE "requestId" = ANY($1::uuid[])',
    [ids],
  );
  const orderIds = orders.rows.map((row) => row.id);
  const invoices = orderIds.length
    ? await client.query(
        'SELECT id FROM procurement_invoice WHERE "orderId" = ANY($1::uuid[])',
        [orderIds],
      )
    : { rows: [] };
  const invoiceIds = invoices.rows.map((row) => row.id);
  const receipts = orderIds.length
    ? await client.query(
        'SELECT id FROM procurement_receipt WHERE "orderId" = ANY($1::uuid[])',
        [orderIds],
      )
    : { rows: [] };
  const receiptIds = receipts.rows.map((row) => row.id);
  const receiptItems = receiptIds.length
    ? await client.query(
        'SELECT id FROM procurement_receipt_item WHERE "receiptId" = ANY($1::uuid[])',
        [receiptIds],
      )
    : { rows: [] };
  const receiptItemIds = receiptItems.rows.map((row) => row.id);
  const snapshots = await client.query(
    'SELECT id FROM procurement_approval_snapshot WHERE "requestId" = ANY($1::uuid[])',
    [ids],
  );
  const snapshotIds = snapshots.rows.map((row) => row.id);
  if (snapshotIds.length) {
    const steps = await client.query(
      'SELECT id FROM procurement_approval_step WHERE "snapshotId" = ANY($1::uuid[])',
      [snapshotIds],
    );
    const stepIds = steps.rows.map((row) => row.id);
    if (stepIds.length)
      await client.query(
        'DELETE FROM procurement_approval_decision WHERE "stepId" = ANY($1::uuid[])',
        [stepIds],
      );
    await client.query(
      'DELETE FROM procurement_approval_step WHERE "snapshotId" = ANY($1::uuid[])',
      [snapshotIds],
    );
  }
  await client.query(
    'DELETE FROM procurement_outbox WHERE "requestId" = ANY($1::uuid[])',
    [ids],
  );
  await client.query(
    'DELETE FROM procurement_finance_handoff WHERE "requestId" = ANY($1::uuid[])',
    [ids],
  );
  if (invoiceIds.length) {
    await client.query(
      'DELETE FROM procurement_invoice_match WHERE "invoiceId" = ANY($1::uuid[])',
      [invoiceIds],
    );
    await client.query(
      'DELETE FROM procurement_invoice_item WHERE "invoiceId" = ANY($1::uuid[])',
      [invoiceIds],
    );
    await client.query(
      'DELETE FROM procurement_invoice WHERE id = ANY($1::uuid[])',
      [invoiceIds],
    );
  }
  if (receiptItemIds.length)
    await client.query(
      'DELETE FROM procurement_return WHERE "receiptItemId" = ANY($1::uuid[])',
      [receiptItemIds],
    );
  await client.query(
    'DELETE FROM procurement_discrepancy WHERE "requestId" = ANY($1::uuid[])',
    [ids],
  );
  await client.query(
    'DELETE FROM procurement_service_acceptance WHERE "requestId" = ANY($1::uuid[])',
    [ids],
  );
  await client.query(
    'DELETE FROM procurement_receipt_adjustment WHERE "requestId" = ANY($1::uuid[])',
    [ids],
  );
  if (receiptIds.length)
    await client.query(
      'DELETE FROM procurement_receipt_item WHERE "receiptId" = ANY($1::uuid[])',
      [receiptIds],
    );
  if (orderIds.length) {
    await client.query(
      'DELETE FROM procurement_receipt WHERE "orderId" = ANY($1::uuid[])',
      [orderIds],
    );
    await client.query(
      'DELETE FROM procurement_order_item WHERE "orderId" = ANY($1::uuid[])',
      [orderIds],
    );
    await client.query(
      'DELETE FROM procurement_order_version WHERE "orderId" = ANY($1::uuid[])',
      [orderIds],
    );
    await client.query(
      'DELETE FROM procurement_order WHERE id = ANY($1::uuid[])',
      [orderIds],
    );
  }
  const quotations = await client.query(
    'SELECT id FROM procurement_quotation WHERE "requestId" = ANY($1::uuid[])',
    [ids],
  );
  const quotationIds = quotations.rows.map((row) => row.id);
  await client.query(
    'DELETE FROM procurement_selection WHERE "requestId" = ANY($1::uuid[])',
    [ids],
  );
  if (quotationIds.length)
    await client.query(
      'DELETE FROM procurement_quotation_item WHERE "quotationId" = ANY($1::uuid[])',
      [quotationIds],
    );
  await client.query(
    'DELETE FROM procurement_quotation WHERE "requestId" = ANY($1::uuid[])',
    [ids],
  );
  if (snapshotIds.length)
    await client.query(
      'DELETE FROM procurement_approval_snapshot WHERE id = ANY($1::uuid[])',
      [snapshotIds],
    );
  await client.query(
    'DELETE FROM procurement_audit WHERE "requestId" = ANY($1::uuid[])',
    [ids],
  );
  await client.query(
    'DELETE FROM procurement_request_version WHERE "requestId" = ANY($1::uuid[])',
    [ids],
  );
  await client.query(
    'DELETE FROM procurement_request_item WHERE "requestId" = ANY($1::uuid[])',
    [ids],
  );
  await client.query(
    'DELETE FROM procurement_request WHERE id = ANY($1::uuid[])',
    [ids],
  );
  return ids.length;
}

async function normalizeLegacyNumbers() {
  const legacy = await client.query(
    `SELECT id, number FROM procurement_request
      WHERE number LIKE $1 ORDER BY number`,
    [`${legacyPrefix}%`],
  );
  for (const [index, row] of legacy.rows.entries()) {
    await client.query(
      'UPDATE procurement_request SET number = $1, "updatedAt" = NOW() WHERE id = $2',
      [`PR-1405-${String(901 + index).padStart(3, '0')}`, row.id],
    );
  }
}

async function addScenario(index, scenario, seed) {
  const requestId = randomUUID();
  const requestItemId = randomUUID();
  const versionId = randomUUID();
  const quotedAt = new Date(Date.now() - (12 + index) * 86_400_000);
  const requiredAt = new Date(
    Date.now() + (7 + index) * 86_400_000,
  ).toISOString();
  const draft = draftFor({ ...scenario, branchId: seed.branchId, requiredAt });
  draft.items[0].id = requestItemId;
  const requestNumber = `PR-1405-${String(901 + index).padStart(3, '0')}`;
  const total = String(scenario.unitPrice * Number(scenario.quantity));
  await client.query(
    `INSERT INTO procurement_request (id, "branchId", "requesterUserId", "ownerUserId", number, status, version, title, category, priority, urgent, "requiredAt", "estimatedAmount", "currencyCode", data, "updatedAt")
     VALUES ($1,$2,$3,$3,$4,'SOURCING',1,$5,$6,'NORMAL',FALSE,$7,$8,'IRR',$9::jsonb,NOW())`,
    [
      requestId,
      seed.branchId,
      seed.userId,
      requestNumber,
      scenario.title,
      scenario.category,
      requiredAt,
      total,
      JSON.stringify(draft),
    ],
  );
  await client.query(
    `INSERT INTO procurement_request_item (id, "requestId", kind, description, quantity, unit, "acceptanceCriteria", data, "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,NOW())`,
    [
      requestItemId,
      requestId,
      scenario.kind,
      scenario.title,
      scenario.quantity,
      scenario.unit,
      draft.items[0].acceptanceCriteria || null,
      JSON.stringify(draft.items[0]),
    ],
  );
  await client.query(
    `INSERT INTO procurement_request_version (id, "requestId", version, payload, "createdByUserId")
     VALUES ($1,$2,1,$3::jsonb,$4)`,
    [versionId, requestId, JSON.stringify(draft), seed.userId],
  );
  const quotationId = randomUUID();
  await client.query(
    `INSERT INTO procurement_quotation (id, "requestId", "supplierId", reference, "currencyCode", "totalAmount", "validUntil", status, data, "updatedAt")
     VALUES ($1,$2,$3,$4,'IRR',$5,$6,'VALID',$7::jsonb,NOW())`,
    [
      quotationId,
      requestId,
      seed.supplierId,
      `QT-1405-${String(index + 1).padStart(3, '0')}`,
      total,
      new Date(Date.now() + 30 * 86_400_000),
      JSON.stringify({
        quotedAt: quotedAt.toISOString(),
        deliveryAt: requiredAt,
        paymentTerms: 'تسویه پس از تأیید تحویل',
        warranty: '۱۲ ماه',
        qualityNote: 'ارزیابی فنی انجام شد.',
      }),
    ],
  );
  await client.query(
    `INSERT INTO procurement_quotation_item (id, "requestId", "quotationId", "requestItemId", quantity, "unitPrice", "taxAmount", "discountAmount", "extraCostAmount", "totalAmount")
     VALUES ($1,$2,$3,$4,$5,$6,0,0,0,$7)`,
    [
      randomUUID(),
      requestId,
      quotationId,
      requestItemId,
      scenario.quantity,
      scenario.unitPrice,
      total,
    ],
  );
  const selectionId = randomUUID();
  await client.query(
    `INSERT INTO procurement_selection (id, "requestId", "quotationId", "requestVersionId", "selectedByUserId", reason, payload)
     VALUES ($1,$2,$3,$4,$5,'بهترین پیشنهاد واجد شرایط',$6::jsonb)`,
    [
      selectionId,
      requestId,
      quotationId,
      versionId,
      seed.userId,
      JSON.stringify({
        supplierId: seed.supplierId,
        quotationId,
        totalAmount: total,
        currencyCode: 'IRR',
      }),
    ],
  );
  const orderId = randomUUID();
  const orderVersionId = randomUUID();
  const orderItemId = randomUUID();
  const orderNumber = `PO-1405-${String(index + 1).padStart(3, '0')}`;
  await client.query(
    `INSERT INTO procurement_order (id, "requestId", number, "supplierId", "selectionId", status, version, "currencyCode", "totalAmount", "expectedAt", data, "updatedAt")
     VALUES ($1,$2,$3,$4,$5,'ISSUED',1,'IRR',$6,$7,$8::jsonb,NOW())`,
    [
      orderId,
      requestId,
      orderNumber,
      seed.supplierId,
      selectionId,
      total,
      requiredAt,
      JSON.stringify({
        deliveryLocation: 'انبار شعبه مرکزی',
        paymentTerms: 'تسویه پس از تأیید تحویل',
        supplier: { id: seed.supplierId, label: 'تأمین تجهیزات پارس' },
      }),
    ],
  );
  await client.query(
    `INSERT INTO procurement_order_version (id, "orderId", version, payload, "createdByUserId")
     VALUES ($1,$2,1,$3::jsonb,$4)`,
    [
      orderVersionId,
      orderId,
      JSON.stringify({
        number: orderNumber,
        lines: [
          {
            id: orderItemId,
            requestItemId,
            quantity: scenario.quantity,
            unitPrice: scenario.unitPrice,
          },
        ],
      }),
      seed.userId,
    ],
  );
  await client.query(
    `INSERT INTO procurement_order_item (id, "requestId", "orderId", "orderVersionId", "requestItemId", quantity, "unitPrice", "taxAmount", "discountAmount", "extraCostAmount", "totalAmount", data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,0,$8,$9::jsonb)`,
    [
      orderItemId,
      requestId,
      orderId,
      orderVersionId,
      requestItemId,
      scenario.quantity,
      scenario.unitPrice,
      total,
      JSON.stringify(draft.items[0]),
    ],
  );

  let receiptItemId = null;
  if (scenario.kind === 'GOODS') {
    const receiptId = randomUUID();
    receiptItemId = randomUUID();
    const accepted = scenario.returned
      ? Number(scenario.quantity) - 1
      : Number(scenario.quantity);
    await client.query(
      `INSERT INTO procurement_receipt (id, "requestId", "orderId", "orderVersionId", number, "receivedAt", "receivedByUserId", data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        receiptId,
        requestId,
        orderId,
        orderVersionId,
        `GR-1405-${String(index + 1).padStart(3, '0')}`,
        new Date(Date.now() - (4 + index) * 86_400_000),
        seed.userId,
        JSON.stringify({ location: 'انبار شعبه مرکزی', documents: [] }),
      ],
    );
    await client.query(
      `INSERT INTO procurement_receipt_item (id, "receiptId", "orderId", "orderVersionId", "orderItemId", quantity, "acceptedQuantity", "rejectedQuantity")
       VALUES ($1,$2,$3,$4,$5,$6,$7,0)`,
      [
        receiptItemId,
        receiptId,
        orderId,
        orderVersionId,
        orderItemId,
        scenario.quantity,
        accepted,
      ],
    );
    if (scenario.adjustment) {
      await client.query(
        `INSERT INTO procurement_receipt_adjustment (id, "requestId", "orderId", "orderVersionId", "receiptItemId", "receivedDelta", "acceptedDelta", "rejectedDelta", reason, "actorUserId", data)
         VALUES ($1,$2,$3,$4,$5,0,1,0,'اصلاح پذیرش پس از کنترل مجدد',$6,$7::jsonb)`,
        [
          randomUUID(),
          requestId,
          orderId,
          orderVersionId,
          receiptItemId,
          seed.userId,
          JSON.stringify({ source: 'LOCAL_PROCUREMENT_LIFECYCLE' }),
        ],
      );
    }
    if (scenario.discrepancy) {
      await client.query(
        `INSERT INTO procurement_discrepancy (id, "requestId", "orderId", "receiptId", kind, status, version, description, resolution, data, "updatedAt")
         VALUES ($1,$2,$3,$4,'DAMAGE','RESOLVED',2,'یک قلم در کنترل اولیه آسیب‌دیده بود.','REPLACE',$5::jsonb,NOW())`,
        [
          randomUUID(),
          requestId,
          orderId,
          receiptId,
          JSON.stringify({
            resolutionReason: 'تعویض توسط تأمین‌کننده ثبت شد.',
            resolvedBy: seed.userId,
          }),
        ],
      );
    }
    if (scenario.returned) {
      await client.query(
        `INSERT INTO procurement_return (id, "requestId", "orderId", "receiptItemId", quantity, reason, "returnedByUserId", "returnedAt", data)
         VALUES ($1,$2,$3,$4,1,'بازگشت قلم ناسازگار با مشخصات',$5,$6,$7::jsonb)`,
        [
          randomUUID(),
          requestId,
          orderId,
          receiptItemId,
          seed.userId,
          new Date(Date.now() - 2 * 86_400_000),
          JSON.stringify({
            disposition: 'ACCEPTED',
            financeCorrectionStatus: 'NOT_APPLICABLE',
          }),
        ],
      );
    }
  } else {
    await client.query(
      `INSERT INTO procurement_service_acceptance (id, "requestId", "orderId", "orderVersionId", "orderItemId", "acceptedByUserId", "acceptedAt", quantity, "criteriaSnapshot", data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)`,
      [
        randomUUID(),
        requestId,
        orderId,
        orderVersionId,
        orderItemId,
        seed.userId,
        new Date(Date.now() - (3 + index) * 86_400_000),
        scenario.quantity,
        JSON.stringify({
          criteria: draft.items[0].acceptanceCriteria,
          evidence: 'خروجی خدمت بررسی و تأیید شد.',
        }),
        JSON.stringify({ documents: [] }),
      ],
    );
  }

  if (scenario.invoice) {
    const invoiceId = randomUUID();
    await client.query(
      `INSERT INTO procurement_invoice (id, "requestId", "orderId", "orderVersionId", "supplierId", number, "normalizedNumber", status, version, "currencyCode", "totalAmount", "issuedAt", "dueAt", "issuerLegalEntityId", data, "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,'WAITING_FINANCE',1,'IRR',$8,$9,$10,$11,$12::jsonb,NOW())`,
      [
        invoiceId,
        requestId,
        orderId,
        orderVersionId,
        seed.supplierId,
        `INV-1405-${String(index + 1).padStart(3, '0')}`,
        `inv-1405-${String(index + 1).padStart(3, '0')}`,
        total,
        new Date(Date.now() - 86_400_000),
        new Date(Date.now() + 20 * 86_400_000),
        seed.legalEntityId,
        JSON.stringify({
          documents: [],
          source: 'LOCAL_PROCUREMENT_LIFECYCLE',
        }),
      ],
    );
    await client.query(
      `INSERT INTO procurement_invoice_item (id, "invoiceId", "orderId", "orderVersionId", "orderItemId", quantity, "unitPrice", "taxAmount", "discountAmount", "extraCostAmount", "totalAmount")
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,0,$8)`,
      [
        randomUUID(),
        invoiceId,
        orderId,
        orderVersionId,
        orderItemId,
        scenario.quantity,
        scenario.unitPrice,
        total,
      ],
    );
    await client.query(
      `INSERT INTO procurement_invoice_match (id, "invoiceId", "invoiceVersion", "orderId", "orderVersionId", status, "matchedByUserId", payload)
       VALUES ($1,$2,1,$3,$4,'MATCHED',$5,$6::jsonb)`,
      [
        randomUUID(),
        invoiceId,
        orderId,
        orderVersionId,
        seed.userId,
        JSON.stringify({ matched: true, amount: total, currencyCode: 'IRR' }),
      ],
    );
    await client.query(
      `INSERT INTO procurement_finance_handoff (id, "requestId", "invoiceId", "invoiceVersion", "sourceKey", status, version, payload, "updatedAt")
       VALUES ($1,$2,$3,1,$4,'PENDING',1,$5::jsonb,NOW())`,
      [
        randomUUID(),
        requestId,
        invoiceId,
        `procurement:local:invoice:${requestNumber}`,
        JSON.stringify({
          contract: 'procurement.finance-source.v1',
          requestNumber,
          invoiceNumber: `INV-1405-${String(index + 1).padStart(3, '0')}`,
          totalAmount: total,
          currencyCode: 'IRR',
        }),
      ],
    );
  }
}

const scenarios = [
  {
    title: 'تجهیزات شبکه شعبه غرب',
    category: 'تجهیزات فناوری',
    kind: 'GOODS',
    quantity: '12',
    unit: 'عدد',
    unitPrice: 18500000,
    invoice: true,
    discrepancy: true,
    returned: true,
  },
  {
    title: 'پشتیبانی سامانه منابع انسانی',
    category: 'خدمات فناوری',
    kind: 'SERVICE',
    quantity: '1',
    unit: 'ماه',
    unitPrice: 96000000,
    invoice: true,
  },
  {
    title: 'رایانه قابل‌حمل واحد فروش',
    category: 'تجهیزات اداری',
    kind: 'GOODS',
    quantity: '6',
    unit: 'دستگاه',
    unitPrice: 720000000,
    invoice: true,
    adjustment: true,
  },
  {
    title: 'تجهیزات کنترل دسترسی ساختمان مرکزی',
    category: 'ایمنی و امنیت',
    kind: 'GOODS',
    quantity: '18',
    unit: 'عدد',
    unitPrice: 28600000,
    invoice: false,
  },
  {
    title: 'ملزومات بسته‌بندی اسناد',
    category: 'ملزومات اداری',
    kind: 'GOODS',
    quantity: '40',
    unit: 'بسته',
    unitPrice: 4300000,
    invoice: true,
  },
  {
    title: 'بازرسی و سرویس دوره‌ای سرمایش',
    category: 'خدمات نگهداری',
    kind: 'SERVICE',
    quantity: '1',
    unit: 'خدمت',
    unitPrice: 148000000,
    invoice: true,
  },
];
const localRequestNumbers = scenarios.map(
  (_, index) => `PR-1405-${String(901 + index).padStart(3, '0')}`,
);

await client.connect();
try {
  if (inspect) {
    const result = await client.query(
      `SELECT r.number, r.title, COUNT(DISTINCT q.id)::int AS quotations, COUNT(DISTINCT o.id)::int AS orders,
              COUNT(DISTINCT rc.id)::int AS receipts, COUNT(DISTINCT sa.id)::int AS acceptances,
              COUNT(DISTINCT d.id)::int AS discrepancies, COUNT(DISTINCT rt.id)::int AS returns,
              COUNT(DISTINCT i.id)::int AS invoices, COUNT(DISTINCT fh.id)::int AS handoffs
         FROM procurement_request r
         LEFT JOIN procurement_quotation q ON q."requestId" = r.id
         LEFT JOIN procurement_order o ON o."requestId" = r.id
         LEFT JOIN procurement_receipt rc ON rc."requestId" = r.id
         LEFT JOIN procurement_service_acceptance sa ON sa."requestId" = r.id
         LEFT JOIN procurement_discrepancy d ON d."requestId" = r.id
         LEFT JOIN procurement_return rt ON rt."requestId" = r.id
         LEFT JOIN procurement_invoice i ON i."requestId" = r.id
         LEFT JOIN procurement_finance_handoff fh ON fh."requestId" = r.id
        WHERE r.data->>'source' = $1 OR r.number = ANY($2::text[])
        GROUP BY r.id
        ORDER BY r.number`,
      [marker, localRequestNumbers],
    );
    console.log(JSON.stringify(result.rows, null, 2));
  } else {
    await client.query('BEGIN');
    await normalizeLegacyNumbers();
    const existing = await client.query(
      `SELECT number FROM procurement_request
        WHERE data->>'source' = $1 OR number = ANY($2::text[])
        ORDER BY number`,
      [marker, localRequestNumbers],
    );
    if (existing.rows.length) {
      await client.query('COMMIT');
      console.log(
        `Local Procurement lifecycle data already exists (${existing.rows.length} requests); no history was changed.`,
      );
    } else {
      const actor = await context();
      const seed = { ...actor, ...(await ensureMasterData(actor)) };
      for (const [index, scenario] of scenarios.entries())
        await addScenario(index, scenario, seed);
      await client.query('COMMIT');
      console.log(
        `Created ${scenarios.length} local Procurement lifecycle requests with linked operational records.`,
      );
    }
  }
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
