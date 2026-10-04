import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ConfidentialAccessCodeInput } from './inline-document-upload';

describe('inline confidential document code', () => {
  it('validates only when Upload is requested and does not block the parent signatory form', () => {
    const markup = renderToStaticMarkup(
      <form>
        <ConfidentialAccessCodeInput value="" onChange={vi.fn()} />
        <button type="submit">ذخیره غیرفعال</button>
      </form>,
    );
    expect(markup).toContain('کد دسترسی سند محرمانه');
    expect(markup).not.toContain('required=""');
    expect(markup).not.toContain('pattern=');
    expect(markup).toContain('maxLength="6"');
  });
});
