import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AssistantResponseContent } from './response-content';

describe('safe assistant calculation tables', () => {
  it('renders headings and rows as an accessible table without executing markup', () => {
    const html = renderToStaticMarkup(
      <AssistantResponseContent
        text={
          'مبنای محاسبه\n| وضعیت | تعداد |\n| --- | --- |\n| لغونشده | ۷ |\n| مجموع | ۹ |\n<script>alert(1)</script>'
        }
      />,
    );
    expect(html).toContain('<table');
    expect(html.match(/<tr>/g)).toHaveLength(3);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
  });
});
