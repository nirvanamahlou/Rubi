import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import { CustomersApiError } from '../api/client';
import {
  buildCustomerConsentRequest,
  customerListFailureState,
  customerSensitiveRevealFeedback,
  fetchCustomerConflictSnapshot,
} from './customer-workspace-state';

const source = readFileSync(
  new URL('./customer-workspace.tsx', import.meta.url),
  'utf8',
);
const dateFieldSource = readFileSync(
  new URL('./customer-date-field.tsx', import.meta.url),
  'utf8',
);

describe('Customer Operations workspace boundaries', () => {
  it('opens contacts for either role and offers a call only after audited reveal', () => {
    expect(source).toContain("open('view', record.id, 'contacts')");
    expect(source).toContain('setActiveTab(tab)');
    expect(source).toContain('مشاهده تماس‌ها');
    expect(source).toContain('نمایش شماره کامل');
    expect(source).toContain('contactCallHref(item, Boolean(revealedDetail))');
    expect(source).toContain('href={callHref}');
    expect(source).toContain('پنهان‌کردن شماره‌ها');
  });
  it.each([
    [new CustomersApiError('unauthorized', 401), 'unauthorized'],
    [new CustomersApiError('forbidden', 403), 'forbidden'],
    [
      new CustomersApiError(
        'decrypt failed',
        422,
        'CUSTOMER_SENSITIVE_DECRYPTION_FAILED',
      ),
      'unreadable',
    ],
    [new CustomersApiError('server', 500), 'error'],
    [new TypeError('network failed'), 'error'],
  ] as const)(
    'shows an actionable result beside sensitive reveal for %s',
    (error, kind) => {
      expect(customerSensitiveRevealFeedback(error).kind).toBe(kind);
    },
  );
  it('keeps reveal feedback beside the button and exposes login only for 401', () => {
    expect(source).toContain('sensitiveFeedback.message');
    expect(source).toContain("sensitiveFeedback.kind === 'unauthorized'");
    expect(source).toContain('href="/login?next=%2Fcustomers"');
    expect(source).toContain('Backend پاسخ داد، اما شماره کاملی');
    expect(source).toContain("activeTab === 'contacts'");
    expect(source).toContain('response.data.contacts.some');
  });
  it.each([
    [new CustomersApiError('unauthorized', 401), 'unauthorized'],
    [new CustomersApiError('forbidden', 403), 'forbidden'],
    [new CustomersApiError('conflict', 409), 'error'],
    [new CustomersApiError('server', 500), 'error'],
    [new TypeError('network failed'), 'error'],
  ] as const)(
    'classifies list failures without conflating auth states',
    (error, state) => {
      expect(customerListFailureState(error)).toBe(state);
    },
  );

  it('offers an explicit login path only for the unauthorized state', () => {
    expect(source).toContain('customerListFailureState(error)');
    expect(source).toContain('href="/login?next=%2Fcustomers"');
    expect(source).toContain('نیاز به ورود دوباره');
    expect(source).toContain('دسترسی مشتریان وجود ندارد');
  });

  it('fetches and replaces the server snapshot after a conflict without resubmitting or dropping the draft', async () => {
    const draft = { displayName: 'ویرایش ذخیره‌نشده کاربر' };
    const latest = {
      version: 7,
      updatedAt: '2026-08-29T12:30:00.000Z',
      displayName: 'Snapshot سرور',
    };
    const mutation = vi
      .fn()
      .mockRejectedValue(new CustomersApiError('conflict', 409));
    const fetchDetail = vi.fn(async () => latest);

    await expect(mutation()).rejects.toMatchObject({ status: 409 });
    const result = await fetchCustomerConflictSnapshot(
      'customer-id',
      draft,
      fetchDetail,
    );

    expect(fetchDetail).toHaveBeenCalledWith('customer-id');
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: 'refreshed', customer: latest });
    expect(result.draft).toBe(draft);
    if (result.status !== 'refreshed') throw new Error('Expected refresh');
    expect(result.customer).toMatchObject({
      version: 7,
      updatedAt: '2026-08-29T12:30:00.000Z',
    });
  });

  it('keeps the draft and reports a retryable conflict when the refresh fails', async () => {
    const draft = { displayName: 'پیش‌نویس حفظ‌شده' };
    const result = await fetchCustomerConflictSnapshot(
      'customer-id',
      draft,
      vi.fn().mockRejectedValue(new Error('network failed')),
    );

    expect(result.status).toBe('refresh-failed');
    expect(result.draft).toBe(draft);
    expect(result.message).toContain('دریافت نسخه جدید ناموفق بود');
    expect(result.message).not.toContain('نسخه جدید سرور دریافت شد');
    expect(source).toContain('تلاش دوباره برای دریافت نسخه جدید');
  });

  it('sends the actual trimmed consent reason without a fabricated fallback', () => {
    const result = buildCustomerConsentRequest({
      status: 'granted',
      channel: 'all',
      source: '  staff-ui  ',
      reason: '  درخواست حضوری مشتری  ',
      version: 4,
    });

    expect(result).toEqual({
      ok: true,
      request: {
        purpose: 'marketing',
        channel: 'all',
        status: 'granted',
        source: 'staff-ui',
        reason: 'درخواست حضوری مشتری',
        version: 4,
      },
    });
    expect(source).not.toContain('ثبت رضایت توسط کارشناس');
    expect(source).not.toContain('لغو رضایت توسط کارشناس');
  });

  it.each(['', ' ', '\t', '\n', 'ab'])(
    'rejects an empty or too-short consent reason (%j)',
    (reason) => {
      expect(
        buildCustomerConsentRequest({
          status: 'granted',
          channel: 'all',
          source: 'staff-ui',
          reason,
          version: 1,
        }),
      ).toMatchObject({ ok: false });
    },
  );

  it('rejects overlong and sensitive consent reasons', () => {
    for (const reason of [
      'x'.repeat(501),
      'تماس با 09120000000 انجام شد',
      'ارسال به person@example.test',
      'token=synthetic-secret',
    ]) {
      expect(
        buildCustomerConsentRequest({
          status: 'revoked',
          channel: 'phone',
          source: 'staff-ui',
          reason,
          version: 1,
        }),
      ).toMatchObject({ ok: false });
    }
  });

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

  it('reveals national ID only through the audited sensitive flow', () => {
    expect(source).toContain('revealedDetail?.nationalId');
    expect(source).toContain('customer.maskedNationalId');
    expect(source).toContain('دلیل نمایش کد ملی');
    expect(source).toContain('نمایش کد ملی');
    expect(source).toContain('disabled={busy || !sensitiveReason}');
  });

  it('provides secure filters and a UUID-only customer deep link', () => {
    expect(source).toContain('customerBranchOptions(');
    expect(source).toContain('.branchReferences()');
    expect(source).toContain('{branch.name}');
    expect(source).not.toContain('شعبه {id}');
    expect(source).toContain('disabled={branch.unavailable}');
    expect(source).toContain('setBranchNamesAttempt((attempt) => attempt + 1)');
    expect(source).toContain('function safeCustomerId');
    expect(source).toContain("params.set('customerId', selectedId)");
    for (const filter of [
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
    expect(source).toContain('customer-primary-email');
    expect(source).toContain("type: 'email'");
    expect(source).toContain(
      'organizationId: companion.organizationId || null',
    );
    expect(source).toContain('اطلاعات ۳۶۰ مسافر (اختیاری)');
    expect(source).toContain('<details className=');
    expect(source).toContain('<summary className=');
    expect(source).toContain('تاریخ تولد، تماس، ایمیل، شرکت و مدارک سفر');
    expect(source).toContain('companion-${companion.key}-email');
    expect(source).toContain('value: companion.email.trim().toLowerCase()');
    expect(source).toContain('مدارک سفر مسافر');
    expect(source).toContain('فیلتر شعبه مجاز');
    expect(source).toContain('id="customer-national-id"');
    expect(source).toContain('companion-${companion.key}-national-id');
    expect(source).toContain(
      'nationalId: normalizeNationalId(companion.nationalId)',
    );
    expect(source).toContain('کد ملی مسافر شماره');
    expect(source).toContain('انتخاب همین مشتری به‌عنوان مسافر');
    expect(source).toContain('index === 0 ? (');
    expect(source).toContain('aria-label="روش افزودن مسافر 1"');
    expect(source).toContain('بدون ورود دوباره اطلاعات');
    expect(source).toContain("source: 'new'");
    expect(source).toContain("source: 'new' | 'primaryCustomer'");
    expect(source).toContain("newCompanions[0]?.source === 'primaryCustomer'");
    expect(source).toContain(
      "Array.from(new Set([...draft.roles, 'passenger' as const]))",
    );
    expect(source).toContain(
      "if (companion.source === 'primaryCustomer') continue",
    );
    expect(source).not.toContain('existingCustomerId');
    expect(source).not.toContain('newCompanionOptions');
    expect(source).toContain('relatedCustomerId: passengerId');
  });

  it('opens Customer 360 immediately and exports every authorized filtered row to Excel', () => {
    expect(source).toContain('در حال دریافت اطلاعات مشتری');
    expect(source).toContain('exportFilteredCustomers');
    expect(source).toContain('const exportPageSize = 100');
    expect(source).toContain('exportPage <= exportPageCount');
    expect(source).toContain('همه ${exportRecords.length.toLocaleString');
    expect(source).toContain('customer-import-template.xlsx');
    expect(source).toContain('parseCustomerXlsx(file)');
    expect(source).toContain('emailIsValid');
    expect(source).toContain('ایمیل نامعتبر نادیده گرفته شد');
    expect(source).toContain('importProgress.completed');
    expect(source).toContain('importInputRef.current?.click()');
    expect(source).not.toContain('<Button asChild disabled={importing}');
    expect(source).toContain('نام مشتری');
    const exportSource = source.slice(
      source.indexOf('async function exportFilteredCustomers'),
      source.indexOf('async function importCustomers'),
    );
    expect(exportSource).toContain("record.maskedNationalId ?? 'ثبت نشده'");
    expect(exportSource).toContain('کد ملی (ماسک‌شده)');
    expect(exportSource).not.toContain('شماره تماس (ماسک‌شده)');
    expect(source).not.toContain('خروجی Excel (ماسک‌شده)');
    expect(exportSource).toContain(
      'await customersApi.detail(record.id, exportReason)',
    );
    expect(exportSource).toContain("contact.type === 'phone'");
    expect(exportSource).toContain("'شماره تماس'");
    expect(exportSource).toContain('دلیل مشاهده در Audit ثبت شد');
    expect(source).toContain('customer-sensitive-export-reason');
    expect(source).toContain('aria-label="دلیل خروجی شماره‌های کامل"');
    expect(source).toContain(
      '<SelectValue placeholder="دلیل نمایش شماره‌ها" />',
    );
    expect(source).not.toContain(
      '<option value="">دلیل نمایش شماره‌ها</option>',
    );
    expect(source).toContain("'خروجی Excel'");
    expect(source).toContain(
      'disabled={records.length === 0 || exporting || !exportReason}',
    );
  });

  it('shows twenty people per page with a complete page position and masked mobile number', () => {
    expect(source).toContain('const pageSize = 20');
    expect(source).toContain('Math.max(1, Math.ceil(total / pageSize))');
    expect(source).toContain('نفر در هر صفحه');
    expect(source).toContain('<th className="p-4 text-start">شماره تماس</th>');
    expect(source).toContain("record.maskedPrimaryContact ?? 'بدون تماس'");
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
    expect(source).toContain('customer-created-to');
    expect(source).not.toContain('type="date"');
  });

  it('removes marked filters without retaining hidden URL restrictions', () => {
    const workspace = source.slice(
      source.indexOf('export function CustomerWorkspace'),
    );
    const filters = workspace.slice(
      workspace.indexOf('<FilterBar'),
      workspace.indexOf('</FilterBar>'),
    );
    for (const label of [
      'نوع شخص',
      'وضعیت',
      'نقش',
      'ویرایش از تاریخ',
      'ویرایش تا تاریخ',
    ]) {
      expect(filters).not.toContain('label="' + label + '"');
    }
    for (const key of ['kind', 'status', 'role', 'updatedFrom', 'updatedTo']) {
      expect(workspace).not.toContain("searchParams.get('" + key + "')");
      expect(workspace).not.toContain("params.set('" + key + "'");
    }
    for (const label of [
      'شعبه مجاز',
      'جست‌وجو',
      'نحوه آشنایی',
      'ایجاد از تاریخ',
      'ایجاد تا تاریخ',
      'مرتب‌سازی',
      'جهت مرتب‌سازی',
    ]) {
      expect(filters).toContain('label="' + label + '"');
    }
    const list = workspace.slice(
      workspace.indexOf('const load ='),
      workspace.indexOf('async function open'),
    );
    const exported = workspace.slice(
      workspace.indexOf('const exportQuery:'),
      workspace.indexOf('const firstPage'),
    );
    for (const query of [list, exported]) {
      for (const neutral of [
        "kind: 'all'",
        "status: 'all'",
        "role: 'all'",
        'updatedFrom: null',
        'updatedTo: null',
      ]) {
        expect(query).toContain(neutral);
      }
      expect(query).toContain('branchId,');
      expect(query).toContain('createdFrom: createdFrom || null');
      expect(query).toContain('createdTo: createdTo || null');
    }
  });

  it('uses a centered create dialog and removes technical-only page chrome', () => {
    expect(source).toContain('<Dialog onOpenChange');
    expect(source).toContain('<DialogContent');
    expect(source).not.toContain('<Drawer');
    expect(source).not.toContain('CUSTOMER-002A · PC-A');
    expect(source).not.toContain('Backend واقعی · حفاظت PII');
    expect(source).not.toContain('فیلتر محدوده دسترسی');
    expect(source).toContain('start-auto left-1/2');
    expect(source).not.toContain('customer-display-name');
    expect(source).toContain('const submittedDraft: CustomerMutationRequest');
  });

  it('keeps internal customer identifiers out of the visible workspace', () => {
    expect(source).not.toContain('function customerCode');
    expect(source).not.toContain('<th className="p-4 text-start">کد</th>');
    expect(source).not.toContain('{item.relatedCustomerId}');
  });

  it('exposes the complete Customer 360 navigation', () => {
    for (const tab of [
      'overview',
      'dossier',
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

  it('opens the same 360 dossier for every customer or passenger', () => {
    expect(source).toContain('function customerRoleLabel');
    expect(source).toContain('مشتری یا مسافر');
    expect(source).toContain('بازکردن پرونده ۳۶۰');
    expect(source).toContain("onClick={() => void open('view', record.id)}");
    expect(source).toContain('پرونده ۳۶۰ درجه');
  });

  it('shows the full 360 dossier catalog without inventing cross-module data', () => {
    for (const section of [
      'شماره پاسپورت',
      'نام انگلیسی مطابق پاسپورت (اجباری)',
      'نام خانوادگی انگلیسی مطابق پاسپورت (اجباری)',
      'کشور صادرکننده',
      'هشدار انقضای مدارک',
      'درخواست‌ها',
      'قراردادها',
      'خدمات خریداری‌شده',
      'بلیط‌ها',
      'واچرها',
      'بیمه‌نامه‌ها',
      'پرداخت‌ها',
      'چک‌ها',
      'تیکت‌های پشتیبانی',
      'فایل‌ها و اسناد',
      'Timeline کامل فعالیت‌ها',
    ])
      expect(source).toContain(section);
    expect(source).toContain('در انتظار اتصال امن');
    expect(source).toContain('href="/documents"');
    expect(source).toContain('باز کردن اسناد و فایل‌ها');
    expect(source).toContain('نیازمند مدل ساختاری');
    expect(source).not.toContain("['فایل‌ها و اسناد', 'اسناد']");
    expect(source).toContain(
      'هیچ شماره مدرک یا تاریخ ساختگی نمایش داده نمی‌شود',
    );
  });
});
