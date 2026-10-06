import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RecordCard } from './record-details';

describe('Persisted procurement record details', () => {
  it('shows the saved order tracking and exact archived document version', () => {
    const html = renderToStaticMarkup(
      <RecordCard
        record={{
          number: 'PO-001',
          status: 'PENDING_APPROVAL',
          data: {
            trackingCode: 'TRACK-001',
            deliveryLocation: 'شعبه مرکزی',
            documents: [{ id: 'document-1', versionId: 'version-2' }],
          },
        }}
      />,
    );
    expect(html).toContain('PO-001');
    expect(html).toContain('TRACK-001');
    expect(html).toContain('version-2');
    expect(html).toContain('document-1');
  });
  it('renders persisted line quantities while excluding unknown metadata', () => {
    const html = renderToStaticMarkup(
      <RecordCard
        record={{
          data: { internalOnly: 'UNLISTED-METADATA' },
          lines: [
            {
              id: 'line-1',
              description: 'رایانه',
              quantity: '2',
              unitPrice: '120.50',
            },
          ],
        }}
      />,
    );
    expect(html).toContain('رایانه');
    expect(html).toContain('120.50');
    expect(html).not.toContain('UNLISTED-METADATA');
  });
});
