import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AutomationGraphCanvas } from './marketing-durable-panels';

describe('AutomationGraphCanvas', () => {
  it('renders a persisted edge between the selected source and target ports', () => {
    const markup = renderToStaticMarkup(
      <AutomationGraphCanvas
        draft={{
          name: 'گراف ذخیره‌شده',
          nodes: [
            { id: 'source', title: 'مبدا' },
            { id: 'target', title: 'مقصد' },
          ],
          edges: [
            {
              source: 'source',
              target: 'target',
              sourcePort: 'top',
              targetPort: 'bottom',
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('<line');
    expect(markup).toContain('data-source-port="top"');
    expect(markup).toContain('data-target-port="bottom"');
    expect(markup).toContain('aria-label="درگاه top مبدا"');
    expect(markup).toContain('aria-label="درگاه bottom مقصد"');
  });
});
