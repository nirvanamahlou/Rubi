import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { TooltipProvider } from '@/components/ui/overlays';
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
      expect(html).toContain('مراحل بعدی در راهکاران قابل مشاهده نیست');
      expect(run).not.toHaveBeenCalled();
    },
  );
});

describe('observed opening and final forms', () => {
  it.each(['opening', 'final'] as const)(
    '%s retains only visible inputs and never invokes an unobserved issue action',
    (mode) => {
      const run = vi.fn();
      const html = renderToStaticMarkup(
        <TooltipProvider>
          <AccountingYearEndWorkspace
            mode={mode}
            book={{} as AccountingSnapshotV1}
            busy={false}
            run={run}
          />
        </TooltipProvider>,
      );
      expect(html).toContain('carry-date');
      expect(html).toContain('carry-auxiliary-number');
      expect(html).not.toContain('دوره مبدأ');
      expect(html).not.toContain('حساب مقابل');
      expect(html).not.toContain('نوع سند');
      expect(html.includes('صدور سند معکوس تعدیل ماهیت')).toBe(
        mode === 'opening',
      );
      expect(html).toContain('مراحل بعدی در راهکاران قابل مشاهده نیست');
      expect(run).not.toHaveBeenCalled();
    },
  );
});
