import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Input } from '@/components/ui/form-controls';
import { AffairsFormField } from './affairs-form-field';

describe('AffairsFormField', () => {
  it('associates generated labels and errors with their controls', () => {
    const html = renderToStaticMarkup(
      <AffairsFormField label="عنوان درخواست" error="عنوان الزامی است">
        <Input name="title" />
      </AffairsFormField>,
    );
    const id = html.match(/<input[^>]*\sid="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`for="${id}"`);
    expect(html).toContain(`aria-describedby="${id}-error"`);
    expect(html).toContain('aria-invalid="true"');
  });
});
