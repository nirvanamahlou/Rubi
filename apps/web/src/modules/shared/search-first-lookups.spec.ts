import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const guardedLookupSources = [
  'customer-affairs/components/assignee-picker.tsx',
  'customer-affairs/components/sales-handoff-response.tsx',
  'documents/components/document-case-picker.tsx',
  'hr/hr-archive-document-picker.tsx',
  'hr/hr-directory-picker.tsx',
  'master-data/components/master-data-reference-selector.tsx',
  'organizations/components/cooperation-wizard.tsx',
  'procurement/document-picker.tsx',
  'procurement/owner-picker.tsx',
  'marketing/components/offer-audience-target-selector.tsx',
  'sales/components/sales-tour-picker.tsx',
  'ticket-catalog/components/reference-picker.tsx',
  'ticket-catalog/components/reference-browser.tsx',
] as const;

describe('search-first form lookups', () => {
  it('keeps server-backed form choices empty until a search term is entered', () => {
    for (const path of guardedLookupSources) {
      const source = readFileSync(
        new URL(`../${path}`, import.meta.url),
        'utf8',
      );
      expect(source).toMatch(/\.trim\(\)/);
      expect(source).toContain('جست‌وجو');
    }
  });
});
