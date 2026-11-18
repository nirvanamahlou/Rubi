import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  HotelImageStrip,
  HotelImageUpload,
  hotelImageUrls,
} from './hotel-images';

describe('Hotel images', () => {
  it('renders persisted main and gallery images with direct download links', () => {
    const main = '/api/v1/master-data/hotel-images/' + 'a'.repeat(64) + '.webp';
    const html = renderToStaticMarkup(
      createElement(HotelImageStrip, {
        main,
        gallery: 'https://example.com/hotel.jpg',
      }),
    );
    expect(html).toContain(main + '?download=1');
    expect(html).toContain('https://example.com/hotel.jpg');
    expect(html.match(/<img /g)).toHaveLength(2);
  });
  it('does not render unsafe imported image addresses', () => {
    expect(
      hotelImageUrls(
        'javascript:alert(1)|data:text/html,abc|//evil.test|https://hotel.test/a.jpg',
      ),
    ).toEqual(['https://hotel.test/a.jpg']);
  });
  it('disables gallery additions at six while retaining the main upload and removal controls', () => {
    const html = renderToStaticMarkup(
      createElement(HotelImageUpload, {
        main: '',
        gallery: Array.from(
          { length: 6 },
          (_, i) => 'https://hotel.test/' + i + '.webp',
        ).join('|'),
        disabled: false,
        onChange: vi.fn(),
        onBusy: vi.fn(),
      }),
    );
    expect(html).toMatch(/multiple=""[^>]*disabled=""/);
    expect(html.match(/<img /g)).toHaveLength(6);
  });
});
