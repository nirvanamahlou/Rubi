import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

// Opt-in integration suite. An explicit, task-owned database is mandatory;
// ordinary unit-test runs never connect to operational data.
describe.skipIf(process.env.PROCUREMENT_DATABASE_TEST !== '1')(
  'Procurement PostgreSQL 18 invariants',
  () => {
    let client: Client;
    let actor: string;
    let branch: string;
    let issuer: string;
    let supplier: string;
    let request: string;
    let otherRequest: string;
    let requestItem: string;
    let otherRequestItem: string;
    let order: string;
    let orderVersion: string;
    let nextOrderVersion: string;
    let orderItem: string;
    let nextOrderItem: string;

    async function insert(
      table: string,
      values: Record<string, unknown>,
    ): Promise<string> {
      const id = randomUUID();
      const row = { id, ...values };
      const columns = Object.keys(row);
      await client.query(
        `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')})`,
        Object.values(row),
      );
      return id;
    }

    async function rejectsCode(
      operation: () => Promise<unknown>,
      code: string,
    ) {
      await client.query('SAVEPOINT expected_failure');
      let actual: unknown;
      try {
        await operation();
      } catch (error) {
        actual = error;
      }
      await client.query('ROLLBACK TO SAVEPOINT expected_failure');
      expect(actual).toMatchObject({ code });
    }

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? '');
      if (
        url.hostname !== '127.0.0.1' ||
        url.port !== '55473' ||
        url.pathname !== '/procurement_001_test'
      ) {
        throw new Error(
          'Refusing database other than the dedicated PROCUREMENT-001 test database',
        );
      }
      client = new Client({ connectionString: url.toString() });
      await client.connect();
      const version = Number(
        (await client.query('SHOW server_version_num')).rows[0]
          .server_version_num,
      );
      expect(version).toBeGreaterThanOrEqual(180000);
      expect(version).toBeLessThan(190000);
      actor = (
        await client.query(
          "SELECT id FROM iam_users WHERE username='customer-fixture-admin'",
        )
      ).rows[0].id;
      branch = (await client.query("SELECT id FROM branches WHERE code='HQ'"))
        .rows[0].id;
      issuer = (
        await client.query(
          'SELECT id FROM legal_entities ORDER BY code LIMIT 1',
        )
      ).rows[0].id;
    });
    afterAll(async () => {
      await client?.end();
    });
    beforeEach(async () => {
      await client.query('BEGIN');
      supplier = await insert('master_suppliers', {
        code: `PT-${randomUUID().slice(0, 12)}`,
        name: 'Synthetic test supplier',
        createdByUserId: actor,
        updatedByUserId: actor,
        updatedAt: new Date(),
      });
      const requestValues = {
        branchId: branch,
        requesterUserId: actor,
        updatedAt: new Date(),
      };
      request = await insert('procurement_request', {
        ...requestValues,
        number: randomUUID(),
      });
      otherRequest = await insert('procurement_request', {
        ...requestValues,
        number: randomUUID(),
      });
      requestItem = await insert('procurement_request_item', {
        requestId: request,
        quantity: '10.0000',
        updatedAt: new Date(),
      });
      otherRequestItem = await insert('procurement_request_item', {
        requestId: otherRequest,
        quantity: '10.0000',
        updatedAt: new Date(),
      });
      order = await insert('procurement_order', {
        requestId: request,
        number: randomUUID(),
        supplierId: supplier,
        currencyCode: 'IRR',
        totalAmount: '100.0000',
        updatedAt: new Date(),
      });
      orderVersion = await insert('procurement_order_version', {
        orderId: order,
        version: 1,
        payload: {},
        createdByUserId: actor,
      });
      nextOrderVersion = await insert('procurement_order_version', {
        orderId: order,
        version: 2,
        payload: {},
        createdByUserId: actor,
      });
      const itemValues = {
        requestId: request,
        orderId: order,
        requestItemId: requestItem,
        quantity: '10.0000',
        unitPrice: '10.0000',
        totalAmount: '100.0000',
      };
      orderItem = await insert('procurement_order_item', {
        ...itemValues,
        orderVersionId: orderVersion,
      });
      nextOrderItem = await insert('procurement_order_item', {
        ...itemValues,
        orderVersionId: nextOrderVersion,
      });
    });
    afterEach(async () => {
      await client?.query('ROLLBACK');
    });

    async function receipt() {
      return insert('procurement_receipt', {
        requestId: request,
        orderId: order,
        orderVersionId: orderVersion,
        number: randomUUID(),
        receivedAt: new Date(),
        receivedByUserId: actor,
      });
    }
    async function invoice(number = 'synthetic-001', issuerId = issuer) {
      return insert('procurement_invoice', {
        requestId: request,
        orderId: order,
        orderVersionId: orderVersion,
        supplierId: supplier,
        issuerLegalEntityId: issuerId,
        number,
        normalizedNumber: number,
        currencyCode: 'IRR',
        totalAmount: '100.0000',
        issuedAt: new Date(),
        updatedAt: new Date(),
      });
    }

    it('applies the complete migration history and exposes scoped query indexes', async () => {
      const migrations = await client.query(
        'SELECT count(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
      );
      expect(migrations.rows[0].count).toBeGreaterThanOrEqual(61);
      const indexes = await client.query(
        "SELECT indexdef FROM pg_indexes WHERE tablename='procurement_request'",
      );
      expect(
        indexes.rows.some((row: { indexdef: string }) =>
          row.indexdef.includes('"branchId", status, "createdAt", id'),
        ),
      ).toBe(true);
      const foreignKeys = await client.query(
        "SELECT count(*)::int AS count FROM pg_constraint WHERE contype='f' AND conrelid::regclass::text LIKE 'procurement_%' AND confdeltype='r'",
      );
      expect(foreignKeys.rows[0].count).toBeGreaterThan(60);
    });

    it('stores incomplete drafts, full HR unit identifiers, exact Decimal values and UTC instants', async () => {
      const unit = 'u'.repeat(160);
      await client.query(
        'UPDATE procurement_request SET "unitId"=$1, "estimatedAmount"=$2, "currencyCode"=$3, "requiredAt"=$4 WHERE id=$5',
        [
          unit,
          '99999999999999999999.9999',
          'IRR',
          '2026-09-13T10:30:00+03:30',
          request,
        ],
      );
      const row = (
        await client.query(
          'SELECT "unitId", "estimatedAmount"::text, "requiredAt", status, title FROM procurement_request WHERE id=$1',
          [request],
        )
      ).rows[0];
      expect(row.unitId).toHaveLength(160);
      expect(row.estimatedAmount).toBe('99999999999999999999.9999');
      expect(row.requiredAt.toISOString()).toBe('2026-09-13T07:00:00.000Z');
      expect(row.status).toBe('DRAFT');
      expect(row.title).toBe('');
    });

    it('rejects missing owner references, invalid version and money without currency', async () => {
      await rejectsCode(
        () =>
          client.query(
            'UPDATE procurement_request SET "requesterUserId"=$1 WHERE id=$2',
            [randomUUID(), request],
          ),
        '23503',
      );
      await rejectsCode(
        () =>
          client.query('UPDATE procurement_request SET version=0 WHERE id=$1', [
            request,
          ]),
        '23514',
      );
      await rejectsCode(
        () =>
          client.query(
            'UPDATE procurement_request SET "estimatedAmount"=1 WHERE id=$1',
            [request],
          ),
        '23514',
      );
    });

    it('rejects cross-request allocations even when both rows independently exist', async () => {
      await rejectsCode(
        () =>
          insert('procurement_order_item', {
            requestId: request,
            orderId: order,
            orderVersionId: orderVersion,
            requestItemId: otherRequestItem,
            quantity: 1,
            unitPrice: 1,
            totalAmount: 1,
          }),
        '23503',
      );
      await rejectsCode(
        () =>
          insert('procurement_order_item', {
            requestId: request,
            orderId: order,
            orderVersionId: orderVersion,
            requestItemId: requestItem,
            quantity: 1,
            unitPrice: 1,
            totalAmount: 1,
          }),
        '23505',
      );
    });

    it('allows pending disposition but rejects over-disposition and wrong amendment lines', async () => {
      const receiptId = await receipt();
      const line = {
        receiptId,
        orderId: order,
        orderVersionId: orderVersion,
        orderItemId: orderItem,
        quantity: 5,
        acceptedQuantity: 2,
        rejectedQuantity: 1,
      };
      await insert('procurement_receipt_item', line);
      await rejectsCode(
        () =>
          insert('procurement_receipt_item', {
            ...line,
            orderItemId: nextOrderItem,
          }),
        '23503',
      );
      const secondReceipt = await receipt();
      await rejectsCode(
        () =>
          insert('procurement_receipt_item', {
            ...line,
            receiptId: secondReceipt,
            acceptedQuantity: 5,
            rejectedQuantity: 1,
          }),
        '23514',
      );
    });

    it('pins invoice lines to the invoice order version', async () => {
      const invoiceId = await invoice();
      const line = {
        invoiceId,
        orderId: order,
        orderVersionId: orderVersion,
        orderItemId: orderItem,
        quantity: 1,
        unitPrice: 10,
        totalAmount: 10,
      };
      await insert('procurement_invoice_item', line);
      await rejectsCode(
        () =>
          insert('procurement_invoice_item', {
            ...line,
            orderItemId: nextOrderItem,
          }),
        '23503',
      );
      await rejectsCode(
        () => insert('procurement_invoice_item', line),
        '23505',
      );
    });

    it('scopes duplicate normalized invoice numbers to supplier and issuer', async () => {
      await invoice();
      await rejectsCode(() => invoice(), '23505');
      const otherIssuer = (
        await client.query(
          'SELECT id FROM legal_entities WHERE id<>$1 LIMIT 1',
          [issuer],
        )
      ).rows[0].id;
      await invoice('synthetic-001', otherIssuer);
    });

    it('rejects updates/deletes of versions, receipts, policy snapshots, decisions and audit', async () => {
      const receiptId = await receipt();
      const requestVersionId = await insert('procurement_request_version', {
        requestId: request,
        version: 1,
        payload: {},
        createdByUserId: actor,
      });
      const snapshotId = await insert('procurement_approval_snapshot', {
        requestId: request,
        requestVersionId,
        policyReference: 'synthetic-owner-policy',
        policyVersion: 'test-1',
        payload: {},
      });
      const stepId = await insert('procurement_approval_step', {
        snapshotId,
        position: 1,
        approverUserId: actor,
        updatedAt: new Date(),
      });
      const decisionId = await insert('procurement_approval_decision', {
        stepId,
        actorUserId: actor,
        decision: 'APPROVED',
      });
      const auditId = await insert('procurement_audit', {
        requestId: request,
        actorUserId: actor,
        action: 'TEST',
        entityType: 'REQUEST',
        entityId: request,
      });
      for (const [table, id] of [
        ['procurement_order_version', orderVersion],
        ['procurement_request_version', requestVersionId],
        ['procurement_receipt', receiptId],
        ['procurement_approval_snapshot', snapshotId],
        ['procurement_approval_decision', decisionId],
        ['procurement_audit', auditId],
      ]) {
        await rejectsCode(
          () => client.query(`UPDATE "${table}" SET id=id WHERE id=$1`, [id]),
          '23514',
        );
        await rejectsCode(
          () => client.query(`DELETE FROM "${table}" WHERE id=$1`, [id]),
          '23514',
        );
      }
    });

    it('rejects a stale optimistic write without replacing the successful version', async () => {
      const first = await client.query(
        'UPDATE procurement_request SET version=version+1,title=$1 WHERE id=$2 AND version=1',
        ['first writer', request],
      );
      const stale = await client.query(
        'UPDATE procurement_request SET version=version+1,title=$1 WHERE id=$2 AND version=1',
        ['stale writer', request],
      );
      expect(first.rowCount).toBe(1);
      expect(stale.rowCount).toBe(0);
      expect(
        (
          await client.query(
            'SELECT title,version FROM procurement_request WHERE id=$1',
            [request],
          )
        ).rows[0],
      ).toEqual({ title: 'first writer', version: 2 });
    });

    it('enforces idempotency and persists domain events without a Finance handoff', async () => {
      const values = {
        actorUserId: actor,
        branchId: branch,
        key: 'synthetic-key',
        operation: 'create-request',
        requestHash: 'a'.repeat(64),
        response: { id: request },
      };
      const id = await insert('procurement_idempotency', values);
      await rejectsCode(
        () => insert('procurement_idempotency', values),
        '23505',
      );
      await rejectsCode(
        () =>
          client.query(
            'UPDATE procurement_idempotency SET response=$1 WHERE id=$2',
            [{ id: otherRequest }, id],
          ),
        '23514',
      );
      const event = await insert('procurement_outbox', {
        requestId: request,
        eventId: randomUUID(),
        eventType: 'procurement.request.created',
        payload: { id: request },
        updatedAt: new Date(),
      });
      expect(
        (
          await client.query(
            'SELECT "handoffId",status FROM procurement_outbox WHERE id=$1',
            [event],
          )
        ).rows[0],
      ).toEqual({ handoffId: null, status: 'PENDING' });
    });

    it('enforces exact totals and immutable commercial lines for every commercial document', async () => {
      const quotationId = await insert('procurement_quotation', {
        requestId: request,
        supplierId: supplier,
        currencyCode: 'IRR',
        totalAmount: '3.8500',
        updatedAt: new Date(),
      });
      const invoiceId = await invoice();
      const freshItem = await insert('procurement_request_item', {
        requestId: request,
        quantity: '2.5000',
        updatedAt: new Date(),
      });
      const cases: Array<[string, Record<string, unknown>]> = [
        [
          'procurement_quotation_item',
          { quotationId, requestId: request, requestItemId: requestItem },
        ],
        [
          'procurement_order_item',
          {
            orderId: order,
            orderVersionId: orderVersion,
            requestId: request,
            requestItemId: freshItem,
          },
        ],
        [
          'procurement_invoice_item',
          {
            invoiceId,
            orderId: order,
            orderVersionId: orderVersion,
            orderItemId: orderItem,
          },
        ],
      ];
      for (const [table, references] of cases) {
        const line = {
          ...references,
          quantity: '2.5000',
          unitPrice: '1.2000',
          discountAmount: '0.1000',
          taxAmount: '0.2000',
          extraCostAmount: '0.7500',
          totalAmount: '3.8500',
        };
        await rejectsCode(
          () => insert(table, { ...line, totalAmount: '3.8501' }),
          '23514',
        );
        await rejectsCode(
          () =>
            insert(table, {
              ...line,
              discountAmount: '3.1000',
              totalAmount: '0.8500',
            }),
          '23514',
        );
        await rejectsCode(
          () =>
            insert(table, {
              ...line,
              quantity: '0.0001',
              unitPrice: '0.0001',
              discountAmount: '0',
              taxAmount: '0',
              extraCostAmount: '0',
              totalAmount: '0',
            }),
          '23514',
        );
        await rejectsCode(
          () => insert(table, { ...line, quantity: 'NaN', totalAmount: 'NaN' }),
          '23514',
        );
        await rejectsCode(
          () =>
            insert(table, {
              ...line,
              taxAmount: '-0.1000',
              totalAmount: '3.5500',
            }),
          '23514',
        );
        const id = await insert(table, line);
        await rejectsCode(
          () =>
            client.query(`UPDATE "${table}" SET "quantity"=3 WHERE id=$1`, [
              id,
            ]),
          '23514',
        );
        await rejectsCode(
          () => client.query(`DELETE FROM "${table}" WHERE id=$1`, [id]),
          '23514',
        );
      }
    });

    it('records signed receipt compensation without rewriting the original evidence', async () => {
      const receiptId = await receipt();
      const receiptItemId = await insert('procurement_receipt_item', {
        receiptId,
        orderId: order,
        orderVersionId: orderVersion,
        orderItemId: orderItem,
        quantity: '5',
        acceptedQuantity: '4',
        rejectedQuantity: '0',
      });
      const values = {
        requestId: request,
        orderId: order,
        orderVersionId: orderVersion,
        receiptItemId,
        receivedDelta: '-1',
        acceptedDelta: '-1',
        rejectedDelta: '0',
        reason: 'Synthetic approved correction',
        actorUserId: actor,
        data: { approvalReference: 'synthetic-test-policy' },
      };
      const id = await insert('procurement_receipt_adjustment', values);
      const original = (
        await client.query(
          'SELECT quantity::text, "acceptedQuantity"::text FROM procurement_receipt_item WHERE id=$1',
          [receiptItemId],
        )
      ).rows[0];
      expect(original).toEqual({
        quantity: '5.0000',
        acceptedQuantity: '4.0000',
      });
      expect(
        (
          await client.query(
            'SELECT "receivedDelta"::text,"acceptedDelta"::text FROM procurement_receipt_adjustment WHERE id=$1',
            [id],
          )
        ).rows[0],
      ).toEqual({ receivedDelta: '-1.0000', acceptedDelta: '-1.0000' });
      await rejectsCode(
        () =>
          insert('procurement_receipt_adjustment', {
            ...values,
            receivedDelta: 0,
            acceptedDelta: 0,
          }),
        '23514',
      );
      await rejectsCode(
        () =>
          insert('procurement_receipt_adjustment', {
            ...values,
            receivedDelta: 'NaN',
          }),
        '23514',
      );
      await rejectsCode(
        () =>
          insert('procurement_receipt_adjustment', { ...values, reason: ' ' }),
        '23514',
      );
      await rejectsCode(
        () =>
          insert('procurement_receipt_adjustment', {
            ...values,
            orderVersionId: nextOrderVersion,
          }),
        '23503',
      );
      await rejectsCode(
        () =>
          insert('procurement_receipt_adjustment', {
            ...values,
            requestId: otherRequest,
          }),
        '23503',
      );
      await rejectsCode(
        () =>
          client.query(
            'UPDATE procurement_receipt_adjustment SET reason=$1 WHERE id=$2',
            ['rewritten', id],
          ),
        '23514',
      );
      await rejectsCode(
        () =>
          client.query(
            'DELETE FROM procurement_receipt_adjustment WHERE id=$1',
            [id],
          ),
        '23514',
      );
    });

    it('persists scoped idempotent export jobs and rejects stale worker claims', async () => {
      const values = {
        actorUserId: actor,
        branchId: branch,
        requestId: request,
        idempotencyKey: 'synthetic-export-key',
        requestHash: 'b'.repeat(64),
        kind: 'REQUEST_REPORT',
        format: 'PDF',
        payloadJson: { requestId: request },
        availableAt: new Date(),
        updatedAt: new Date(),
      };
      const id = await insert('procurement_export_job', values);
      await rejectsCode(
        () => insert('procurement_export_job', values),
        '23505',
      );
      await rejectsCode(
        () =>
          insert('procurement_export_job', {
            ...values,
            idempotencyKey: 'other',
            version: 0,
          }),
        '23514',
      );
      await rejectsCode(
        () =>
          insert('procurement_export_job', {
            ...values,
            idempotencyKey: 'other',
            attempts: -1,
          }),
        '23514',
      );
      await rejectsCode(
        () =>
          insert('procurement_export_job', {
            ...values,
            idempotencyKey: 'other',
            requestHash: 'invalid',
          }),
        '23514',
      );
      const otherBranch = await insert('branches', {
        code: `PT-${randomUUID().slice(0, 12)}`,
        name: 'Synthetic export branch',
        updatedAt: new Date(),
      });
      await rejectsCode(
        () =>
          insert('procurement_export_job', {
            ...values,
            idempotencyKey: 'other',
            branchId: otherBranch,
          }),
        '23503',
      );
      await insert('procurement_export_job', {
        ...values,
        idempotencyKey: 'branch-report',
        requestId: null,
        payloadJson: {},
      });
      const first = await client.query(
        'UPDATE procurement_export_job SET version=2,status=$1,attempts=1,"leaseUntil"=now()+interval \'1 minute\' WHERE id=$2 AND version=1',
        ['RUNNING', id],
      );
      const stale = await client.query(
        'UPDATE procurement_export_job SET version=2,status=$1 WHERE id=$2 AND version=1',
        ['RUNNING', id],
      );
      expect(first.rowCount).toBe(1);
      expect(stale.rowCount).toBe(0);
      const indexes = await client.query(
        "SELECT indexdef FROM pg_indexes WHERE tablename='procurement_export_job'",
      );
      expect(
        indexes.rows.some((row: { indexdef: string }) =>
          row.indexdef.includes('(status, "availableAt")'),
        ),
      ).toBe(true);
    });

    it('does not auto-grant Procurement business authority through the administrator seed', async () => {
      const result = await client.query(
        'SELECT p.code FROM iam_role_permissions rp JOIN iam_roles r ON r.id=rp."roleId" JOIN iam_permissions p ON p.id=rp."permissionId" WHERE r.code=\'administrator\' AND p.code LIKE \'procurement.%\'',
      );
      expect(result.rows).toEqual([]);
      const permissions = await client.query(
        "SELECT count(*)::int AS count FROM iam_permissions WHERE code LIKE 'procurement.%'",
      );
      expect(permissions.rows[0].count).toBeGreaterThan(10);
    });
  },
);
