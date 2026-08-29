import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./customer-workspace.tsx', import.meta.url),
  'utf8',
);
const dateFieldSource = readFileSync(
  new URL('./customer-date-field.tsx', import.meta.url),
  'utf8',
);

describe('Customer Operations workspace boundaries', () => {
  it('uses public master-data APIs and keeps Legal Entity out of customer scope', () => {
    expect(source).toContain(
      "import { masterDataApi } from '@/modules/master-data/api/client'",
    );
    expect(source).toContain("listMasterData('organizations')");
    expect(source).toContain("listMasterData('acquaintance-methods')");
    expect(source).toContain("listMasterData('cities')");
    expect(source).not.toMatch(
      /legalEntityId|issuerContext|selectedLegalEntity/,
    );
  });

  it('requires an allowlisted reason before sensitive reveal', () => {
    expect(source).toContain("'customer-verification'");
    expect(source).toContain("'support-request'");
    expect(source).toContain("'data-correction'");
    expect(source).toContain(
      'customersApi.detail(customer.id, sensitiveReason)',
    );
    expect(source).toContain('disabled={busy || !sensitiveReason}');
  });

  it('uses real customer timelines without crossing module boundaries or enabling merge', () => {
    expect(source).toMatch(/\.statusHistory\(customer\.id\)/);
    expect(source).toMatch(/\.activity\(customer\.id\)/);
    expect(source).toMatch(/\.audit\(customer\.id\)/);
    expect(source).toContain(
      'هیچ query مستقیم یا داده ساختگی استفاده نشده است',
    );
    expect(source).toContain('اجرای Merge');
    expect(source).toMatch(/<Button\s+disabled\s+size="sm"/);
  });

  it('auto-remasks sensitive data and never persists PII in browser storage or URL', () => {
    expect(source).toContain('window.setTimeout(remask, 60_000)');
    expect(source).toContain("window.addEventListener('blur', remask)");
    expect(source).toContain("document.visibilityState === 'hidden'");
    expect(source).not.toMatch(/localStorage|sessionStorage/);
    expect(source).not.toContain("params.set('search'");
  });

  it('provides secure filters and a UUID-only customer deep link', () => {
    expect(source).toContain('function safeCustomerId');
    expect(source).toContain("params.set('customerId', selectedId)");
    for (const filter of [
      'kind',
      'branchId',
      'acquaintanceMethodId',
      'createdFrom',
      'createdTo',
      'sortDirection',
    ])
      expect(source).toContain(filter);
  });

  it('shows the primary contact in a dedicated masked list column', () => {
    expect(source).toContain('شماره تماس');
    expect(source).toContain("record.maskedPrimaryContact ?? 'بدون تماس'");
  });

  it('provides an enter-friendly create flow with adjustable companion passengers', () => {
    expect(source).toContain('ثبت مشتری و مسافران همراه');
    expect(source).toContain('handleEnterNavigation');
    expect(source).toContain('resizeCompanions');
    expect(source).toContain("roles: ['passenger']");
    expect(source).toContain('customersApi.addCompanion(createdCustomer.id');
    expect(source).toContain(
      'organizationId: companion.organizationId || null',
    );
    expect(source).toContain("const kind = 'person' as const");
  });

  it('renders filter-scoped KPI cards without inventing Sales purchase data', () => {
    expect(source).toContain('metrics.totalCustomers');
    expect(source).toContain('metrics.totalPassengers');
    expect(source).toContain('metrics.newCustomersLastThreeMonths');
    expect(source).toContain('metrics.returningCustomerRate');
    expect(source).toContain('در انتظار قرارداد عمومی خرید از Sales');
  });

  it('uses the shared blue Persian/Gregorian calendar for list and create dates', () => {
    expect(source).toContain('<CustomerDateField');
    expect(source).toContain('onModeChange={setCalendarMode}');
    expect(dateFieldSource).toContain('<CustomerCalendarSwitch');
    expect(dateFieldSource).toContain('role="dialog"');
    expect(source).toContain('customer-created-from');
    expect(source).not.toContain('customer-updated-to');
    expect(source).not.toContain('customer-updated-from');
    expect(source).not.toContain('type="date"');
  });

  it('uses a centered create dialog and removes technical-only page chrome', () => {
    expect(source).toContain('<Dialog onOpenChange');
    expect(source).toContain('<DialogContent');
    expect(source).not.toContain('<Drawer');
    expect(source).not.toContain('CUSTOMER-002A · PC-A');
    expect(source).not.toContain('Backend واقعی · حفاظت PII');
    expect(source).not.toContain('فیلتر محدوده دسترسی');
  });

  it('keeps internal customer identifiers out of the visible workspace', () => {
    expect(source).not.toContain('function customerCode');
    expect(source).not.toContain('<th className="p-4 text-start">کد</th>');
    expect(source).not.toContain('{item.relatedCustomerId}');
  });

  it('exposes the complete Customer 360 navigation', () => {
    for (const tab of [
      'overview',
      'contacts',
      'addresses',
      'consents',
      'companions',
      'status-history',
      'duplicates',
      'activity',
      'audit',
    ]) {
      expect(source).toContain('value="' + tab + '"');
    }
  });
});
