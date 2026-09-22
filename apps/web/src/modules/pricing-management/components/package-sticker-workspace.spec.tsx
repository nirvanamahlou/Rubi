import type { TourDepartureV1 } from '@nora/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PackageStickerWorkspace } from './package-sticker-workspace';

describe('package sticker workspace', () => {
  it('renders sticker content from the selected tour', () => {
    const tour = {
      startsOn: '2026-10-01',
      endsOn: '2026-10-08',
      package: { name: 'تور آنتالیا', details: { itinerary: [] } },
      outbound: {
        originId: 'تهران',
        carrierName: 'ماهان',
        serviceNumber: 'W5-112',
      },
    } as unknown as TourDepartureV1;

    const html = renderToStaticMarkup(<PackageStickerWorkspace tour={tour} />);

    expect(html).toContain('پیش‌نمایش واقعی استیکر پکیج');
    expect(html).toContain('تور آنتالیا');
    expect(html).toContain('ماهان');
    expect(html).toContain('در انتظار سرویس خروجی اسناد');
  });
});
