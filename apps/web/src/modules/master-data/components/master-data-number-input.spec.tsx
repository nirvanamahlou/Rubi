import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  formatMasterDataNumber,
  MasterDataNumberInput,
  normalizeMasterDataNumber,
} from './master-data-number-input';

describe('master data grouped number input', () => {
  it('preserves precision while adding English comma groups', () => {
    expect(formatMasterDataNumber('123456789012345.50')).toBe(
      '123,456,789,012,345.50',
    );
    expect(normalizeMasterDataNumber('۱۲۳٬۴۵۶,789')).toBe('123456789');
  });

  it('renders a grouped value without changing the submitted raw value', () => {
    const html = renderToStaticMarkup(
      <MasterDataNumberInput onChange={() => undefined} value="1250000" />,
    );
    expect(html).toContain('value="1,250,000"');
    expect(html).toContain('inputMode="decimal"');
  });
});
