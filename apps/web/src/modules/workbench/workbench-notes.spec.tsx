import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.mock('./workbench-daily-assistant', () => ({
  WorkbenchDailyAssistant: () => null,
}));
vi.mock('./note-editor', () => ({ NoteEditor: () => null }));
vi.mock('./workbench-select', () => ({ WorkbenchSelect: () => null }));
vi.mock('@/components/ui/date-picker', () => ({ DatePicker: () => null }));
import { WorkbenchNotes } from './workbench-notes';

it('does not recreate deleted example notes when the personal notebook mounts', () => {
  const html = renderToStaticMarkup(
    <WorkbenchNotes open={false} onOpenChange={() => {}} />,
  );
  expect(html).not.toContain('ایده بهبود تحویل پرونده');
  expect(html).not.toContain('نکات جلسه فروش سازمانی');
  expect(html).not.toContain('چک‌لیست روزانه من');
  expect(html).toContain('دفتر یادداشت من');
});
