import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ContractTableScroll,
  syncContractTableScroll,
} from './contract-table-scroll';

describe('contract table horizontal navigation', () => {
  it('keeps the RTL top scrollbar and table synchronized in either direction, including return to the right edge', () => {
    const table = { scrollLeft: 0 };
    const top = { scrollLeft: -540 };
    syncContractTableScroll(top, table);
    expect(table.scrollLeft).toBe(-540);
    table.scrollLeft = -160;
    syncContractTableScroll(table, top);
    expect(top.scrollLeft).toBe(-160);
    table.scrollLeft = 0;
    syncContractTableScroll(table, top);
    expect(top.scrollLeft).toBe(0);
  });

  it('does not repeatedly write the synchronized position or require a mounted peer', () => {
    let writes = 0;
    const peer = {
      get scrollLeft() {
        return -100;
      },
      set scrollLeft(_value: number) {
        writes++;
      },
    };
    syncContractTableScroll({ scrollLeft: -100 }, peer);
    syncContractTableScroll({ scrollLeft: 0 }, null);
    expect(writes).toBe(0);
  });

  it('places labelled direction controls before a keyboard-focusable table region', () => {
    const html = renderToStaticMarkup(
      <ContractTableScroll>
        <table>
          <caption>قراردادها</caption>
        </table>
      </ContractTableScroll>,
    );
    expect(html).toContain('aria-label="اسکرول جدول به چپ"');
    expect(html).toContain('aria-label="اسکرول جدول به راست"');
    expect(html).toContain('tabindex="0" role="region"');
    expect(html.indexOf('اسکرول جدول به چپ')).toBeLessThan(
      html.indexOf('<table>'),
    );
  });
});
