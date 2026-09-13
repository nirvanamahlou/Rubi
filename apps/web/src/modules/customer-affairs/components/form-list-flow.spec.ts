import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const forms = readFileSync(
  new URL('./customer-affairs-workspace.tsx', import.meta.url),
  'utf8',
);
const workspace = readFileSync(
  new URL('./customer-affairs-rubi-workspace.tsx', import.meta.url),
  'utf8',
);

describe('simplified creation and row-list return', () => {
  it('removes source and queue controls while retaining valid internal intake defaults', () => {
    const leadForm = forms.slice(
      forms.indexOf('export function LeadForm'),
      forms.indexOf('export function TicketForm'),
    );
    expect(leadForm).not.toContain('name="sourceReference"');
    expect(leadForm).not.toContain('name="queueCode"');
    expect(leadForm).not.toContain('label="صف مسئول"');
    expect(leadForm).toContain("sourceReference: 'ثبت مستقیم در امور مشتریان'");
    expect(leadForm).toContain("queueCode: 'customer-affairs-front-office'");
    expect(leadForm).toContain('name="specialPreferences"');
    expect(leadForm).toContain('grid items-start gap-4');
  });
  it('refreshes both lists and does not navigate to the newly created detail', () => {
    for (const view of ['leads', 'tickets']) {
      expect(workspace).toContain(`navigate('${view}');`);
      expect(workspace).not.toContain(
        `onCreated={(row) => navigate('${view}', row.id)}`,
      );
    }
    expect(
      workspace.match(/setRevision\(\(value\) => value \+ 1\)/g),
    ).toHaveLength(2);
    const legacyForms = forms.slice(
      forms.indexOf('{creating ? ('),
      forms.indexOf('{detail ? ('),
    );
    expect(legacyForms).not.toContain('void open(row.id)');
    expect(legacyForms.match(/setDetail\(null\)/g)).toHaveLength(2);
  });
});
