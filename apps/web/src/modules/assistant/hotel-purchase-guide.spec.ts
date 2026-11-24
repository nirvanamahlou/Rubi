import { describe, expect, it } from 'vitest';
import catalog from './hotel-purchase-rates.generated.json';
import { resolveReservationGuide } from './reservation-guide';

const panel = '/reservations/hotel-rates';

describe('hotel purchase guide', () => {
  it.each(catalog)('routes the example for $id', ({ id, examples }) => {
    expect(resolveReservationGuide(examples[0]!, panel)).toMatchObject({
      topic: { id, href: panel },
    });
  });

  it('answers from another page and continues after navigation', () => {
    const result = resolveReservationGuide(
      'چطور برای قیمت خرید هتل اکسل نرخ وارد کنم؟',
      '/workbench',
    );
    expect(result).toMatchObject({ topic: { id: 'hotel-purchase-excel' } });
    expect(
      resolveReservationGuide('بعدش چی؟', '/workbench', 'hotel-purchase-excel'),
    ).toMatchObject({ followUp: true, topic: { id: 'hotel-purchase-excel' } });
  });

  it('clarifies an ambiguous price and preserves explicit foreign topics', () => {
    expect(resolveReservationGuide('قیمت هتل', '/workbench')).toHaveProperty(
      'clarification',
    );
    expect(
      resolveReservationGuide('مبلغ قرارداد هتل چقدر است؟', panel),
    ).toBeUndefined();
    expect(
      resolveReservationGuide(
        'قیمت‌گذاری هتل در بازه در اطلاعات پایه کجاست؟',
        panel,
      ),
    ).toBeUndefined();
  });

  it('allows an exact pack identifier on the purchase guide path', () => {
    const id = '12345678-1234-4234-8234-123456789abc';
    expect(
      resolveReservationGuide(`وضعیت بستهٔ قیمت خرید هتل ${id}`, '/workbench'),
    ).toMatchObject({ packId: id, inspection: true });
    expect(
      resolveReservationGuide('چرا این بسته در قیمت‌گذاری تور نیست؟', panel),
    ).toMatchObject({ inspection: true, topic: { id: 'hotel-purchase-tour' } });
  });
});
