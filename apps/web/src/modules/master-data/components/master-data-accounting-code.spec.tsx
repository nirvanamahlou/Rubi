import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MasterDataRecord } from '@nora/contracts';
import { MasterDataProfileIdentity } from './master-data-profile-details';

describe('partner accounting identity', () => {
  it('shows the numeric organization code instead of the legacy code', () => {
    const record = {
      id: 'partner',
      code: 'ORG-EXISTING',
      name: 'Synthetic',
      status: 'active',
      attributes: { accountingCode: '3000001' },
    } as unknown as MasterDataRecord;
    const html = renderToStaticMarkup(
      <MasterDataProfileIdentity
        record={record}
        eyebrow="شرکت"
        title="Synthetic"
      />,
    );
    expect(html).not.toContain('کد تفصیلی حسابداری');
    expect(html).toContain('3000001');
    expect(html).not.toContain('ORG-EXISTING');
    expect(html).not.toContain('<input');
  });
});
