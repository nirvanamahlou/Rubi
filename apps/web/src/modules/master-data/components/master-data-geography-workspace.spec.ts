import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(
    process.cwd(),
    'src/modules/master-data/components/master-data-geography-workspace.tsx',
  ),
  'utf8',
);

describe('Master Data geography workspace terminal filters', () => {
  it('uses independent rail terminals for the visible tab and keeps aviation nested', () => {
    expect(source).toContain("resource: 'rail-terminals'");
    expect(source).toContain('openCreate(resource)');
    expect(source).toContain('loadAirportTerminals(formParent.id)');
    expect(source).toContain("openRelatedCreate('terminals', airport)");
    expect(source).toContain("formDefinition.key === 'terminals'");
  });

  it('removes airport list filtering without leaving hidden query state', () => {
    expect(source).not.toContain('const [airportId, setAirportId] = useState');
    expect(source).not.toContain("airportId !== 'all'");
    expect(source).not.toContain('setAirportId(');
    expect(source).not.toContain('aria-label="فیلتر فرودگاه"');
    expect(source).not.toContain('همه فرودگاه‌ها');
  });

  it('preserves terminal type filtering and airport-backed creation paths', () => {
    expect(source).toContain('aria-label="فیلتر نوع ترمینال"');
    expect(source).toContain("terminalType !== 'all'");
    expect(source).toContain('setTerminalType(value as typeof terminalType)');
    expect(source).toContain('airportId: id');
    expect(source).toContain('setFormInitialValues({ airportId: parent.id })');
    expect(source).toContain("setLockedFormFields(['airportId'])");
    expect(source).toContain('id="terminal-parent-airport"');
    expect(source).toMatch(
      /masterDataApi\.detail\(\s*'airports',\s*selectedAirportId,?\s*\)/,
    );
  });
});
