import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UserDetailsEditor } from './user-details-editor';

describe('legacy user name editor', () => {
  it('prefills the existing full name without saving or changing access on opening', () => {
    const request = vi.fn();
    const html = renderToStaticMarkup(
      <UserDetailsEditor
        user={{
          id: 'legacy',
          displayName: 'Existing Full Name',
          detailsRevision: 'a'.repeat(64),
        }}
        canManage
        request={request}
        onSaved={vi.fn()}
      />,
    );
    expect(html).toContain('Existing Full Name');
    expect(html).toContain('type="button"');
    expect(html).not.toContain('<form');
    expect(request).not.toHaveBeenCalled();
  });
  it('disables editing for a read-only operator', () => {
    const html = renderToStaticMarkup(
      <UserDetailsEditor
        user={{
          id: 'legacy',
          displayName: 'Existing Full Name',
          detailsRevision: 'a'.repeat(64),
        }}
        canManage={false}
        request={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(html).toMatch(/<input[^>]*disabled/);
    expect(html).toMatch(/<button[^>]*disabled/);
  });
});
