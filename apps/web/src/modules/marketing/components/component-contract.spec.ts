import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const workspaceSource = readFileSync(
  join(
    process.cwd(),
    'src',
    'modules',
    'marketing',
    'components',
    'marketing-workspace.tsx',
  ),
  'utf8',
);
const formSource = readFileSync(
  join(
    process.cwd(),
    'src',
    'modules',
    'marketing',
    'components',
    'campaign-form.tsx',
  ),
  'utf8',
);
const pageSource = readFileSync(
  join(process.cwd(), 'src', 'app', '(crm)', 'marketing', 'page.tsx'),
  'utf8',
);

describe('marketing workspace component contract', () => {
  it('routes marketing to its dedicated workspace', () => {
    expect(pageSource).toContain('MarketingWorkspace');
    expect(pageSource).toContain('return <MarketingWorkspace />');
  });

  it('covers dashboard sections and all required preview states', () => {
    for (const label of [
      'داشبورد',
      'کمپین‌ها',
      'مخاطبان',
      'کانال‌ها',
      'پیشنهادها',
      'انتساب',
      'بودجه',
      'تاریخچه',
      'رضایت و منع',
    ]) {
      expect(workspaceSource).toContain(label);
    }
    for (const state of [
      'preview',
      'loading',
      'empty',
      'error',
      'unauthorized',
      'forbidden',
      'conflict',
      'awaiting-integration',
    ]) {
      expect(workspaceSource).toContain(state);
    }
  });

  it('provides responsive campaign cards without a horizontal table', () => {
    expect(workspaceSource).toContain('جزئیات کامل کمپین');
    expect(workspaceSource).toContain('sm:grid-cols-2');
    expect(workspaceSource).not.toContain('overflow-x-auto');
    expect(workspaceSource).not.toContain('<table');
  });

  it('provides create, view and edit flows with campaign safety fields', () => {
    for (const field of [
      'expectedVersion',
      'Segment مخاطب',
      'بودجه مصوب',
      'Offer Intent',
      'UTM Campaign',
      'محدودیت تکرار ارسال',
      'Suppression',
      'پیش‌نمایش نهایی',
    ]) {
      expect(formSource).toContain(field);
    }
    expect(workspaceSource).toContain("openCampaign('create')");
    expect(workspaceSource).toContain("onOpen('view'");
    expect(workspaceSource).toContain("onOpen('edit'");
  });

  it('labels analytics, attribution and dispatch as contract-gated', () => {
    expect(workspaceSource).toContain('MARKETING_ANALYTICS_STATUS');
    expect(workspaceSource).toContain('MARKETING_ATTRIBUTION_STATUS');
    expect(workspaceSource).toContain('MARKETING_DISPATCH_STATUS');
  });
});
