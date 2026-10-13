import { describe, expect, it } from 'vitest';
import {
  normalizeWorkbenchTab,
  safeWorkbenchHref,
  workbenchDate,
} from './model';
describe('workbench navigation and presentation', () => {
  it('restores known tabs and falls back for unknown links', () => {
    expect(normalizeWorkbenchTab('files')).toBe('files');
    expect(normalizeWorkbenchTab('unknown')).toBe('today');
    expect(normalizeWorkbenchTab(null)).toBe('today');
  });
  it.each([
    null,
    'https://example.com',
    '//example.com',
    '/\\example.com',
    'javascript:alert(1)',
    '/\n/example.com',
    ' /documents',
  ])('rejects unsafe notification destination %s', (href) => {
    expect(safeWorkbenchHref(href)).toBeNull();
  });
  it('preserves internal owner deep links', () => {
    expect(safeWorkbenchHref('/documents?document=doc-1')).toBe(
      '/documents?document=doc-1',
    );
  });
  it('handles malformed event dates without crashing the list', () => {
    expect(workbenchDate('invalid')).toBe('—');
    expect(workbenchDate('2026-09-11T12:00:00Z')).not.toBe('—');
  });
});
