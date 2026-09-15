import { describe, expect, it, vi } from 'vitest';

import type { LocalDocumentStorage } from '../documents/documents.storage';
import { validateStorageObjectKey } from '../documents/documents.validation';
import { ReportingExportService } from './reporting-export.service';

describe('ReportingExportService storage boundary', () => {
  it('stores exports with the versioned key accepted by Documents storage', async () => {
    const putQuarantined = vi.fn().mockResolvedValue(undefined);
    const service = new ReportingExportService({
      putQuarantined,
    } as unknown as LocalDocumentStorage);
    const exportId = '4b646cf7-c56c-4d4a-9a69-18450ad2b14d';
    const buffer = Buffer.from('report');

    const key = await service.store(exportId, 'xlsx', buffer);

    expect(key).toMatch(
      /^documents\/4b646cf7-c56c-4d4a-9a69-18450ad2b14d\/v1\/[0-9a-f-]{36}\.bin$/,
    );
    expect(validateStorageObjectKey(key)).toBe(true);
    expect(putQuarantined).toHaveBeenCalledWith(key, buffer);
  });
});
