import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const panel = readFileSync(
  new URL('./system-operations-panel.tsx', import.meta.url),
  'utf8',
);
const client = readFileSync(
  new URL('../api/client.ts', import.meta.url),
  'utf8',
);

describe('system operations panel', () => {
  it('connects the operational forms to versioned public endpoints', () => {
    for (const endpoint of [
      '/settings',
      '/numbering-schemes',
      '/sessions',
      '/feature-flags',
      '/backup-requests',
      '/jobs/reporting-exports/${id}/retry',
      '/health',
      '/audit',
    ])
      expect(client).toContain(endpoint);

    for (const action of [
      'writeSetting',
      'writeNumberingScheme',
      'writeFeatureFlag',
      'requestBackup',
      'revokeSession',
      'retryReportingExport',
    ])
      expect(panel).toContain(`systemManagementApi.${action}`);
  });

  it('uses authenticated requests and does not invent a health success', () => {
    expect(client).toContain("credentials: 'include'");
    expect(client).toContain('refreshAuthenticatedSession');
    expect(panel).toContain('{item.detail}');
    expect(panel).not.toContain('Math.random');
  });

  it('hides change-reason fields from settings forms and records audit reasons automatically', () => {
    expect(panel).not.toContain('label="دلیل تغییر"');
    expect(panel).toContain('ویرایش تنظیم عمومی');
    expect(panel).toContain('ویرایش طرح شماره‌گذاری');
    expect(panel).toContain('ویرایش Feature Flag');
    expect(panel).toContain('label="دلیل درخواست"');
    expect(panel).toContain('label="دلیل تلاش مجدد"');
  });
});
