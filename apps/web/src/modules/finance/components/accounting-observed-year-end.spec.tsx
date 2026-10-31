import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { AccountingYearEndWorkspace } from './accounting-year-end-workspace';

describe('source-blocked year-end stages', () => {
  it.each(['closing', 'nature-adjustment'] as const)(
    '%s exposes observed navigation without inferred financial inputs or commands',
    (mode) => {
      const run = vi.fn();
      // The source-only shell must not need a populated book or expose the old
      // generic editor when the user requested the unobserved stages left blank.
      const html = renderToStaticMarkup(
        <AccountingYearEndWorkspace
          book={{} as AccountingSnapshotV1}
          run={run}
          busy={false}
          mode={mode}
        />,
      );
      expect(html).toContain('مراحل راهبر');
      expect(html).toContain('شرح راهبر');
      expect(html).toContain('پیش نمایش سند');
      expect(html).not.toContain('<input');
      expect(html).not.toContain('<select');
      expect(html).not.toContain('کنترل پیش‌نیازها');
      expect(html).not.toContain('حساب دائمی سود و زیان');
      expect(run).not.toHaveBeenCalled();
    },
  );
});
