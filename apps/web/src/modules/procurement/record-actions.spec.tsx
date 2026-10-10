import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AccessPermissionsProvider } from '@/modules/iam/access-context';
import { ProcurementRecordActions } from './record-actions';

function renderActions(deleteDisabled = false) {
  return renderToStaticMarkup(
    <AccessPermissionsProvider value={undefined}>
      <ProcurementRecordActions
        label="پرواز آزمایشی"
        onEdit={() => {}}
        onDelete={async () => {}}
        deleteDisabled={deleteDisabled}
      />
    </AccessPermissionsProvider>,
  );
}

describe('Procurement record actions', () => {
  it('renders readable themed edit/delete buttons with their actual glyphs', () => {
    const html = renderActions();

    expect(html).toContain('aria-label="ویرایش پرواز آزمایشی"');
    expect(html).toContain('aria-label="حذف دائمی پرواز آزمایشی"');
    expect(html).toContain('lucide-pencil');
    expect(html).toContain('lucide-trash-2');
    expect(html).toContain('bg-sky-50');
    expect(html).toContain('text-sky-700');
    expect(html).toContain('bg-rose-50');
    expect(html).toContain('text-rose-700');
    expect(html).toContain('dark:bg-sky-950/40');
    expect(html).toContain('dark:bg-rose-950/40');
    expect(html).not.toContain('text-destructive hover:text-destructive');

    const deleteButton = html.match(
      /<button[^>]*aria-label="حذف دائمی پرواز آزمایشی"[\s\S]*?<\/button>/,
    )?.[0];
    expect(deleteButton).toBeDefined();
    expect(deleteButton).not.toContain('bg-destructive');
    expect(deleteButton).not.toContain('text-destructive');
  });

  it('keeps the delete trigger disabled when the record cannot be deleted', () => {
    const html = renderActions(true);

    expect(html).toMatch(
      /disabled=""[^>]*aria-label="حذف دائمی پرواز آزمایشی"/,
    );
  });
});
