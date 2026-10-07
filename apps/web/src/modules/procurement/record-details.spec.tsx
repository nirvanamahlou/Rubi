import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RecordCard, RecordPreviewButton } from './record-details';

describe('Persisted procurement record details', () => {
  it('keeps full text titles visible instead of applying icon-only action styling', () => {
    const title =
      'درخواست تجهیزات کامل شعبه مرکزی برای کارشناسان فروش و پشتیبانی';
    const html = renderToStaticMarkup(
      <RecordPreviewButton record={{ title }} title={title} variant="ghost">
        {title}
      </RecordPreviewButton>,
    );
    expect(html).toContain(`aria-label="جزئیات ${title}"`);
    expect(html).toContain(title);
    expect(html).not.toContain('text-[0px]');
    expect(html).not.toContain('size-10');
  });
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
  it('previews the saved request values, items, documents and an accessible view action', () => {
    const record = {
      id: 'request-1',
      number: 'PR-1405-901',
      status: 'APPROVED',
      data: {
        title: 'تجهیزات شعبه غرب',
        documents: [{ id: 'request-document', versionId: 'version-4' }],
      },
      draft: {
        items: [
          {
            id: 'request-item',
            description: 'رایانه قابل حمل',
            quantity: '3',
            unit: 'دستگاه',
          },
        ],
      },
    };
    const card = renderToStaticMarkup(
      <RecordCard record={record} showPreviewAction />,
    );
    const trigger = renderToStaticMarkup(
      <RecordPreviewButton record={record} />,
    );

    expect(card).toContain('تجهیزات شعبه غرب');
    expect(card).toContain('رایانه قابل حمل');
    expect(card).toContain('request-document');
    expect(card).toContain('version-4');
    expect(trigger).toContain('aria-label="مشاهده تجهیزات شعبه غرب"');
  });
});
