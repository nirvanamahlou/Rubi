import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('slots an icon and label into one link without a runtime error', () => {
    const markup = renderToStaticMarkup(
      <Button asChild variant="outline">
        <a href="/documents">
          <span aria-hidden="true">icon</span>
          آرشیو اسناد
        </a>
      </Button>,
    );

    expect(markup).toContain('href="/documents"');
    expect(markup).toContain('آرشیو اسناد');
    expect(markup.match(/<a /g)).toHaveLength(1);
  });
});
