import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CustomerSummary } from '@nora/contracts';
import { describe, expect, it } from 'vitest';
import { CustomerPicker } from './customer-picker';

describe('Customers and passengers picker', () => {
  it('shows the selected public customer without exposing an editable ID', () => {
    const selected = {
      id: 'person-1',
      displayName: 'نام انتخاب‌شده',
      maskedPrimaryContact: '***1234',
    } as CustomerSummary;
    const html = renderToStaticMarkup(
      <CustomerPicker selected={selected} onSelect={() => {}} />,
    );
    expect(html).toContain('انتخاب از مشتریان B2c');
    expect(html).toContain('نام انتخاب‌شده');
    expect(html).toContain('***1234');
    expect(html).not.toContain('CustomerReference');
    expect(html).not.toContain('name="customerId"');
    expect(html).toContain('href="/customers"');
    expect(html).toContain('ثبت مشتری یا مسافر جدید');
    expect(html).toMatch(
      /<button[^>]*type="button"[^>]*>.*?ثبت مشتری یا مسافر جدید/s,
    );
  });

  it('preserves the current reference while its name is loading', () => {
    const html = renderToStaticMarkup(
      <CustomerPicker
        initialCustomerId="person-1"
        selected={null}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain('در حال دریافت نام مشتری فعلی');
    expect(html).toContain('/customers?customerId=person-1');
    expect(html).toContain('noopener noreferrer');
  });

  it('waits for a search before loading accessible records, then queries all roles with pagination', () => {
    const source = readFileSync(
      new URL('./customer-picker.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain("role: 'all'");
    expect(source).not.toContain("role: 'customer'");
    expect(source).toContain('customerPickerPagination(page)');
    expect(source).toContain('customerPickerVisibleRecords(');
    expect(source).toContain('if (!search.trim()) return;');
    expect(source).toContain(
      "const [state, setState] = useState<LookupState>('idle')",
    );
    expect(source).toContain('response.meta.total');
    expect(source).toContain('page * pagination.displayPageSize >= total');
    expect(source).toContain('if (signal?.aborted) return;');
    expect(source).toContain('setPage(1)');
    expect(source).toContain('maxLength={100}');
    expect(source).toContain("setSearch('')");
    expect(source).toContain('onSelect(customer)');
    expect(source).toContain('onClose={() => setCreating(false)}');
    expect(source).toContain('ref={createButtonRef}');
    expect(source).toContain('permission="customers.create"');
    expect(source).toContain('returnFocusRef={createButtonRef}');
    expect(source).toContain('error.status === 401');
    expect(source).toContain('error.status === 403');
  });

  it('uses the same picker in requests and tickets and sends its selected ID', () => {
    const forms = readFileSync(
      new URL('./customer-affairs-workspace.tsx', import.meta.url),
      'utf8',
    );
    for (const form of [
      forms.slice(
        forms.indexOf('export function LeadForm'),
        forms.indexOf('export function TicketForm'),
      ),
      forms.slice(
        forms.indexOf('export function TicketForm'),
        forms.indexOf('export function DetailPanel'),
      ),
    ]) {
      expect(form).toContain('<CustomerPicker');
      expect(form).toContain('onSelect={setCustomer}');
      expect(form).toContain('selected={customer}');
      expect(form).toContain('customerId: customer?.id ?? null');
    }
  });

  it('opens the canonical Customers create form and prevents duplicate retry after partial creation', () => {
    const createDialog = readFileSync(
      new URL(
        '../../customers/components/customer-create-dialog.tsx',
        import.meta.url,
      ),
      'utf8',
    );
    const customersForm = readFileSync(
      new URL(
        '../../customers/components/customer-workspace.tsx',
        import.meta.url,
      ),
      'utf8',
    );
    expect(createDialog).toContain('<CustomerDrawer');
    expect(createDialog).toContain('mode="create"');
    expect(createDialog).toContain('onPartiallyCreated={onCreated}');
    expect(createDialog).toContain(
      'onSaved={async (_message, detail) => onCreated(detail)}',
    );
    expect(customersForm).toContain(
      'if (busy || partialCustomer || creationOutcomeUncertain) return;',
    );
    expect(customersForm).toContain('انتخاب پروندهٔ ایجادشده');
    expect(customersForm).toContain('setCreationOutcomeUncertain(true)');
    expect(customersForm).toContain('isUncertainCustomerCreateFailure(error)');
    expect(customersForm).toContain('بررسی فهرست مشتریان B2c');
    expect(customersForm).toContain('customersApi.create(submittedDraft)');
    expect(customersForm).toContain('if (createSubmitting.current) return;');
    expect(customersForm).toContain('validateCustomerEntryRows');
    expect(customersForm).toContain('returnFocusRef.current?.focus()');
    expect(customersForm).toContain(
      'if (returnFocusRef) event.stopPropagation()',
    );
  });
});
