import { TooltipProvider } from '@/components/ui/overlays';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type {
  AccountingSnapshotV1,
  AccountingConfigurationV1,
} from '@nora/contracts';
import { AccountingCodingStandard } from './accounting-coding-standard';

vi.mock('@/modules/iam/access-context', () => ({
  useAccessPermissions: () => ['finance.account.manage'],
  useRouteAccess: () => () => true,
  useTabAccess: () => () => true,
  useScreenAccess: () => () => true,
}));

describe('observed coding standard form', () => {
  it('opens the selected saved standard directly, preserving its protocol and read-only flag', () => {
    const row = {
      id: 'selected',
      kind: 'coding-standards',
      title: 'استاندارد انتخاب‌شده',
      titleEn: 'Saved standard',
      attributes: {
        protocolVersion: '3.1',
        isSystem: true,
        entities: '[]',
        extraFields: '[]',
      },
    } as unknown as AccountingConfigurationV1;
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <AccountingCodingStandard
          initialRecord={row}
          book={
            {
              book: { id: 'book' },
              configurations: [row],
            } as unknown as AccountingSnapshotV1
          }
          busy={false}
          run={vi.fn()}
          refresh={async () => {}}
        />
      </TooltipProvider>,
    );
    expect(html).toContain('value="استاندارد انتخاب‌شده"');
    expect(html).toContain('value="3.1"');
    expect(html).toContain('disabled=""');
  });
  it('opens the header and both source panels without generating reference data', () => {
    const run = vi.fn();
    const book = {
      configurations: [],
      book: { id: 'book' },
    } as unknown as AccountingSnapshotV1;
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <AccountingCodingStandard
          book={book}
          busy={false}
          run={run}
          refresh={async () => {}}
        />
      </TooltipProvider>,
    );
    expect(html).toContain('عنوان کدینگ استاندارد');
    expect(html).toContain('نسخه پروتکل');
    expect(html).toContain('عنوان لاتین کدینگ استاندارد');
    expect(html).toContain('موجودیت استاندارد');
    expect(html).toContain('کدهای استاندارد');
    expect(html).toContain('فیلدهای تکمیلی کدینگ استاندارد');
    expect(html).not.toContain('SANAMA');
    expect(html).not.toContain('نمایش فرم');
    expect(run).not.toHaveBeenCalled();
  });
});
