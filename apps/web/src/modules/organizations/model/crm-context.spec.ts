import type {
  B2bCrmConnectionsV1,
  B2bCrmPaymentDocumentV1,
  B2bCrmPaymentDocumentsV1,
} from '@nora/contracts';
import { describe, expect, it } from 'vitest';

import {
  assertCrmContext,
  assertPaymentDocumentContext,
  boundSnapshotRequest,
  canDownloadPaymentDocument,
  crmContextKey,
  crmSnapshotValue,
  deliverBoundDownload,
} from './crm-context';

const connections = {
  version: 1,
  organizationId: 'organization-a',
  branchId: 'branch-a',
} as B2bCrmConnectionsV1;

describe('CRM response context binding', () => {
  it('never reveals a late previous organization, branch, session or revision snapshot', async () => {
    let release!: (value: B2bCrmConnectionsV1) => void;
    const delayed = new Promise<B2bCrmConnectionsV1>((resolve) => {
      release = resolve;
    });
    const controller = new AbortController();
    const oldKey = crmContextKey('organization-a', 'branch-a', 'session-a', 0);
    const pending = boundSnapshotRequest(
      oldKey,
      controller.signal,
      () => delayed,
      (value) => assertCrmContext(value, 'organization-a', 'branch-a'),
    );
    controller.abort();
    release(connections);
    await expect(pending).resolves.toBeUndefined();

    const oldSnapshot = { key: oldKey, data: connections };
    expect(
      crmSnapshotValue(
        oldSnapshot,
        crmContextKey('organization-b', 'branch-a', 'session-a', 0),
      ),
    ).toBeUndefined();
    expect(
      crmSnapshotValue(
        oldSnapshot,
        crmContextKey('organization-a', 'branch-b', 'session-a', 0),
      ),
    ).toBeUndefined();
    expect(
      crmSnapshotValue(
        oldSnapshot,
        crmContextKey('organization-a', 'branch-a', 'session-b', 0),
      ),
    ).toBeUndefined();
    expect(
      crmSnapshotValue(
        oldSnapshot,
        crmContextKey('organization-a', 'branch-a', 'session-a', 1),
      ),
    ).toBeUndefined();
  });

  it('rejects malformed owner responses before storing them', () => {
    expect(() =>
      assertCrmContext(
        { ...connections, branchId: 'foreign-branch' },
        'organization-a',
        'branch-a',
      ),
    ).toThrow('همخوان نیست');
    expect(() =>
      assertPaymentDocumentContext(
        {
          version: 1,
          organizationId: 'organization-a',
          branchId: 'branch-a',
          contractId: 'foreign-contract',
          payments: [],
          observedAt: '2026-10-03T00:00:00.000Z',
        } satisfies B2bCrmPaymentDocumentsV1,
        'organization-a',
        'branch-a',
        'contract-a',
      ),
    ).toThrow('همخوان نیست');
  });

  it('keeps unclean or owner-denied receipts unavailable for download', () => {
    const document = {
      capabilities: { viewFile: true, download: true },
      currentVersion: { scanStatus: 'CLEAN' },
    } as B2bCrmPaymentDocumentV1;
    expect(canDownloadPaymentDocument(document)).toBe(true);
    expect(
      canDownloadPaymentDocument({
        ...document,
        currentVersion: {
          ...document.currentVersion,
          scanStatus: 'PENDING_SCAN',
        },
      }),
    ).toBe(false);
    expect(
      canDownloadPaymentDocument({
        ...document,
        capabilities: { viewFile: true, download: false },
      }),
    ).toBe(false);
  });

  it.each([
    ['context change', { key: 'organization-b|branch-a', generation: 0 }],
    ['unmount cleanup', { key: 'organization-a|branch-a', generation: 1 }],
  ])(
    'does not deliver bytes from a deferred request after %s',
    async (_reason, invalidated) => {
      let release!: (value: Blob) => void;
      const delayed = new Promise<Blob>((resolve) => {
        release = resolve;
      });
      let current = { key: 'organization-a|branch-a', generation: 0 };
      const delivered: Blob[] = [];
      const pending = deliverBoundDownload(
        current,
        () => current,
        () => delayed,
        (value) => delivered.push(value),
      );

      current = invalidated;
      release(new Blob(['old agency receipt']));

      await expect(pending).resolves.toBe(false);
      expect(delivered).toEqual([]);
    },
  );
});
