import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const currentDirectory = process.cwd();
const webRoot = currentDirectory.replaceAll('\\', '/').endsWith('/apps/web')
  ? currentDirectory
  : resolve(currentDirectory, 'apps/web');
const crmRoot = resolve(webRoot, 'src/app/(crm)');
const source = (path: string) => readFileSync(resolve(webRoot, path), 'utf8');

const approvedRoutes = [
  'dashboard',
  'customers',
  'customer-affairs',
  'reservations',
  'ticket-management',
  'sales',
  'purchases',
  'finance',
  'marketing',
  'organizations',
  'human-resources',
  'tasks',
  'documents',
  'reports',
  'integrations',
  'system',
  'master-data',
] as const;

const foundationRoutes = [
  'reservations',
  'sales',
  'purchases',
  'marketing',
  'organizations',
  'human-resources',
  'tasks',
  'documents',
  'reports',
  'integrations',
  'system',
] as const;

describe('17-route module foundation', () => {
  it('keeps every approved main route reviewable', () => {
    for (const route of approvedRoutes) {
      expect(() =>
        readFileSync(resolve(crmRoot, route, 'page.tsx'), 'utf8'),
      ).not.toThrow();
    }
  });

  it('connects every incomplete route to the shared workspace', () => {
    for (const route of foundationRoutes) {
      const page = readFileSync(resolve(crmRoot, route, 'page.tsx'), 'utf8');
      expect(page).toContain('ModuleFoundationWorkspace');
      expect(page).toContain(`foundationModules['${route}']`);
    }
  });

  it('preserves connected workspaces and the Master Data hub-to-section flow', () => {
    expect(
      readFileSync(resolve(crmRoot, 'ticket-management/page.tsx'), 'utf8'),
    ).toContain('TicketWorkspace');
    expect(
      readFileSync(resolve(crmRoot, 'customers/page.tsx'), 'utf8'),
    ).toContain('CustomerWorkspace');
    expect(
      readFileSync(resolve(crmRoot, 'customer-affairs/page.tsx'), 'utf8'),
    ).toContain('CustomerAffairsWorkspace');
    expect(
      readFileSync(resolve(crmRoot, 'finance/page.tsx'), 'utf8'),
    ).toContain('FinanceWorkspace');
    expect(
      readFileSync(resolve(crmRoot, 'master-data/page.tsx'), 'utf8'),
    ).toContain('MasterDataHub');
    expect(
      readFileSync(resolve(crmRoot, 'master-data/[section]/page.tsx'), 'utf8'),
    ).toContain('MasterDataWorkspace');
  });

  it('covers dashboard queues and prevents sidebar horizontal overflow', () => {
    const dashboard = source('src/components/dashboard/dashboard-shell.tsx');
    for (const capability of [
      'Holdهای نزدیک انقضا',
      'Manifestهای آماده بازبینی',
      'چک‌های نزدیک سررسید',
      'بدهی کارگزاران',
      'سود قرارداد و خدمت',
      'فعالیت دو سایت',
      'Ticket و Task عقب‌افتاده',
    ]) {
      expect(dashboard).toContain(capability);
    }

    const shell = source('src/components/layout/app-shell.tsx');
    expect(shell).toContain('overflow-x-hidden');
    expect(shell).toContain('truncate whitespace-nowrap');
  });
});
