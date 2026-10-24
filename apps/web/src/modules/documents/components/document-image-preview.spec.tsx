import type { DocumentDetailV1 } from '@nora/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DocumentImagePreview } from './document-image-preview';

function image(
  scanStatus: DocumentDetailV1['currentVersion']['scanStatus'],
  viewFile = true,
): DocumentDetailV1 {
  return {
    confidentiality: 'INTERNAL',
    capabilities: { viewFile },
    currentVersion: { detectedMimeType: 'image/jpeg', scanStatus },
  } as DocumentDetailV1;
}

describe('immediate uploaded photo preview', () => {
  it.each([
    'CLEAN',
    'PENDING_SCAN',
    'AWAITING_ANTIVIRUS_ADAPTER',
    'SCAN_FAILED',
  ] as const)(
    'shows the image loader without waiting for scan status %s',
    (status) => {
      const html = renderToStaticMarkup(
        <DocumentImagePreview
          document={image(status)}
          onLoadPreview={vi.fn()}
        />,
      );
      expect(html).not.toContain('پیش‌نمایش هنوز آماده نیست');
      expect(html).toContain('animate-spin');
    },
  );
  it.each(['INFECTED', 'QUARANTINED'] as const)(
    'blocks %s images',
    (status) => {
      const html = renderToStaticMarkup(
        <DocumentImagePreview
          document={image(status)}
          onLoadPreview={vi.fn()}
        />,
      );
      expect(html).toContain('پیش‌نمایش هنوز آماده نیست');
      expect(html).not.toContain('animate-spin');
    },
  );
  it('still requires permission for pending images', () => {
    const html = renderToStaticMarkup(
      <DocumentImagePreview
        document={image('PENDING_SCAN', false)}
        onLoadPreview={vi.fn()}
      />,
    );
    expect(html).toContain('دسترسی به تصویر مجاز نیست');
    expect(html).not.toContain('animate-spin');
  });
});
