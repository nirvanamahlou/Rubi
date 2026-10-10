import { describe, expect, it } from 'vitest';
import type { TourDepartureV1 } from '@nora/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { searchOptions } from '@/components/ui/search-combobox';
import { salesTourOptions } from './sales-tour-picker';
import { ContractTableScroll } from './contract-table-scroll';
const tour = (id: string, status = 'ACTIVE', remainingCapacity = 5) =>
  ({
    id,
    package: { name: 'تور رویال آنتالیا ' + id },
    startsOn: '2099-10-01',
    endsOn: '2099-10-05',
    outbound: { status, carrierName: 'Air Tour' },
    remainingCapacity,
  }) as unknown as TourDepartureV1;
describe('contract tour suggestions', () => {
  it('offers five active suggestions and finds middle text beyond initial suggestions', () => {
    const options = salesTourOptions(
      Array.from({ length: 12 }, (_, i) => tour(String(i))),
      2,
    );
    expect(searchOptions(options, '')).toHaveLength(5);
    expect(searchOptions(options, 'نتالیا 11').map((o) => o.value)).toEqual([
      '11',
    ]);
    expect(searchOptions(options, 'ir To')).toHaveLength(5);
  });
  it('excludes paused outward or return flights and disables insufficient capacity', () => {
    const back = {
      ...tour('back'),
      returning: { status: 'PAUSED' },
    } as unknown as TourDepartureV1;
    const options = salesTourOptions(
      [
        tour('active'),
        tour('paused', 'PAUSED'),
        back,
        tour('full', 'ACTIVE', 1),
      ],
      2,
    );
    expect(options.map((o) => o.value)).toEqual(['active', 'full']);
    expect(options[1]?.disabled).toBe(true);
  });
  it('renders both accessible RTL scrolling surfaces around one table', () => {
    const html = renderToStaticMarkup(
      <ContractTableScroll>
        <table>
          <tbody>
            <tr>
              <td>Contract</td>
            </tr>
          </tbody>
        </table>
      </ContractTableScroll>,
    );
    expect(html).toContain('اسکرول افقی بالای جدول قراردادها');
    expect(html).toContain('جدول قراردادها و اسکرول افقی پایین');
    expect(html.match(/<table>/g)).toHaveLength(1);
    expect(html.match(/dir="rtl"/g)).toHaveLength(2);
  });
});
