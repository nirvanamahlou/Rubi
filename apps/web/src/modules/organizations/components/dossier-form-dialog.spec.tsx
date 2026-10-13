import type { ComponentProps, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/button', () => ({
  Button: (props: ComponentProps<'button'> & { loading?: boolean }) => {
    const buttonProps = { ...props };
    delete buttonProps.loading;
    return <button {...buttonProps} />;
  },
}));
vi.mock('@/components/ui/overlays', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

import { DossierFormDialog } from './dossier-form-dialog';

describe('dossier form external submit gate', () => {
  it('blocks submit without freezing concurrent field edits or reconciliation controls', () => {
    const markup = renderToStaticMarkup(
      <DossierFormDialog
        title="ثبت امضادار"
        submitDisabled
        onClose={vi.fn()}
        onSave={vi.fn()}
      >
        <textarea aria-label="توضیحات حدود اختیار" />
        <button type="button">بررسی دوباره وضعیت مدرک</button>
      </DossierFormDialog>,
    );
    expect(markup).toContain('<fieldset class="grid gap-4 sm:grid-cols-2">');
    expect(markup).toContain('aria-label="توضیحات حدود اختیار"');
    expect(markup).toContain('بررسی دوباره وضعیت مدرک');
    expect(markup).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/u);
  });
});
