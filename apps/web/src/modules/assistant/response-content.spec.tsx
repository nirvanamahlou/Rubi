import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AssistantResponseContent } from './response-content';

describe('safe assistant calculation tables', () => {
  it('renders Persian emphasis, headings and nested lists instead of exposing Markdown markers', () => {
    const html = renderToStaticMarkup(
      <AssistantResponseContent
        text={
          '### جمع‌بندی\n**توضیح محاسبه**\n- قراردادهای لغونشده\n  - فروش تأییدشده\n- مجموع **۴۳**\n\n۱. بررسی قرارداد\n۲. بررسی پرداخت'
        }
      />,
    );
    expect(html).toContain('<h3');
    expect(html).toContain('<strong>توضیح محاسبه</strong>');
    expect(html.match(/<ul/g)).toHaveLength(2);
    expect(html).toContain('<ol');
    expect(html).not.toContain('**');
    expect(html).not.toContain('###');
    expect(html).not.toContain('- قرارداد');
    expect(html).toContain('<strong>۴۳</strong>');
  });
  it('formats table emphasis and internal business labels without changing operands', () => {
    const html = renderToStaticMarkup(
      <AssistantResponseContent
        text={
          '| مبنا | تعداد |\n| --- | --- |\n| `panel_non_cancelled` | ۴۰ |\n| **مجموع** | **۴۳** |\nمانده: -۱۲۳؛ ۴۰ + ۲ + ۱ = ۴۳'
        }
      />,
    );
    expect(html).toContain('قراردادهای لغونشده در پنل');
    expect(html).not.toContain('panel_non_cancelled');
    expect(html).toContain('<strong>مجموع</strong>');
    expect(html).toContain('مانده: -۱۲۳؛ ۴۰ + ۲ + ۱ = ۴۳');
  });
  it('never interprets HTML, images or executable links, including inside emphasis and lists', () => {
    const html = renderToStaticMarkup(
      <AssistantResponseContent
        text={
          '- **<img src=x onerror=alert(1)>**\n- [اجرا](javascript:alert(1))\n<script>alert(1)</script>'
        }
      />,
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<a ');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;script&gt;');
  });
  it('preserves ordinary minus signs, original proper names and unmatched text', () => {
    const html = renderToStaticMarkup(
      <AssistantResponseContent
        text={'-123 USD-120\nACME؛ **متن ناتمام'}
        english
      />,
    );
    expect(html).toContain('-123 USD-120');
    expect(html).toContain('ACME');
    expect(html).toContain('**متن ناتمام');
    expect(html).not.toContain('<ul');
  });
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
