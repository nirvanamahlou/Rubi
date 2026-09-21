import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import {
  DraftForm,
  rememberSavedRequestFieldOptions,
  savedRequestFieldOptionsKey,
} from './draft-form';
import type { Bootstrap } from './api';
import { emptyDraft } from './model';

const bootstrap: Bootstrap = {
  permissions: ['procurement.request.create'],
  branches: [{ id: 'branch-1', label: 'شعبه مرکزی' }],
  defaultBranchId: 'branch-1',
  currencies: [],
  requester: {
    id: 'employee',
    userId: 'user',
    branchId: 'branch-1',
    label: 'کاربر جاری',
    unitId: null,
  },
  policy: 'POLICY_NOT_CONFIGURED',
  finance: 'NOT_CONNECTED',
  documents: 'UNAVAILABLE',
  travel: 'NOT_CONNECTED',
};
describe('Purchase draft accessibility and persisted input', () => {
  it('adds a newly saved custom choice to the reusable options immediately', () => {
    const client = new QueryClient();
    client.setQueryData(savedRequestFieldOptionsKey, {
      items: [],
      page: 1,
      pageSize: 50,
      hasMore: false,
    });
    const saved = {
      id: 'saved-request',
      number: 'PR-1405-200',
      version: 1,
      requesterUserId: 'user',
      requesterEmployeeId: 'employee',
      ownerUserId: null,
      createdAt: '',
      updatedAt: '',
      status: 'DRAFT' as const,
      draft: {
        ...emptyDraft(),
        branchId: 'branch-1',
        purchaseType: 'خرید نمایشگاهی',
        category: 'تجهیزات غرفه',
        items: [
          {
            id: 'line-1',
            kind: 'GOODS' as const,
            description: 'استند',
            specification: '',
            quantity: '1',
            unit: 'ست',
            period: '',
            acceptanceCriteria: '',
          },
        ],
      },
    };

    rememberSavedRequestFieldOptions(client, saved);

    expect(client.getQueryData(savedRequestFieldOptionsKey)).toMatchObject({
      items: [
        {
          id: 'saved-request',
          draft: {
            purchaseType: 'خرید نمایشگاهی',
            category: 'تجهیزات غرفه',
            items: [{ unit: 'ست' }],
          },
        },
      ],
    });
  });
  it('renders an incomplete draft with optional delivery location and explicit unavailable documents', () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <DraftForm
          bootstrap={bootstrap}
          onClose={() => undefined}
          onSaved={() => undefined}
        />
      </QueryClientProvider>,
    );
    expect(html).toContain('for="proc-title"');
    expect(html).toContain('id="proc-title"');
    expect(html).not.toContain('علت نامشخص بودن برآورد');
    expect(html).toContain('انتخاب محل تحویل (اختیاری)');
    expect(html).toContain('سرویس اسناد در دسترس نیست');
    expect(html).toContain('کاربر جاری');
    expect(html).toContain('شعبه مرکزی');
    expect(html).toContain('انتخاب واحد از منابع انسانی');
    expect(html).toContain('تأمین‌کننده در درخواست اولیه اختیاری است');
    expect(html).toContain('بدون انتخاب یا نوشتن تأمین‌کننده');
    expect(html).not.toContain('id="proc-supplier"');
    expect(html).not.toContain('id="proc-priority"');
    expect(html).toContain('پیوست‌ها و یادداشت‌ها');
    expect(html).not.toContain('نوع منشأ درخواست');
    expect(html).not.toContain('ارجاع از رزرواسیون');
    expect(html).not.toContain('type="date"');
    expect(html).toContain('ذخیره پیش‌نویس');
    expect(html).toContain(
      'شماره درخواست: پس از نخستین ثبت، خودکار تعیین می‌شود',
    );
  });
  it('loads HR employees and units immediately from the requester branch', () => {
    const client = new QueryClient();
    const hrBootstrap: Bootstrap = {
      ...bootstrap,
      requester: { ...bootstrap.requester!, unitId: 'فناوری' },
    };
    client.setQueryData(
      ['procurement', 'requesters', 'branch-1', 'فناوری', '', 1],
      {
        items: [
          { id: 'employee', label: 'کارمند منابع انسانی', unitId: 'فناوری' },
        ],
        page: 1,
        pageSize: 50,
        hasMore: false,
      },
    );
    client.setQueryData(['procurement', 'units', 'branch-1'], {
      items: [{ id: 'فناوری', label: 'فناوری' }],
    });
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <DraftForm
          bootstrap={hrBootstrap}
          onClose={() => undefined}
          onSaved={() => undefined}
        />
      </QueryClientProvider>,
    );
    expect(html).toContain('کارمند منابع انسانی');
    expect(html).toContain('فناوری');
  });
  it('retains exact decimal strings and emergency context when reopening a saved draft', () => {
    const draft = {
      ...emptyDraft(),
      title: 'درخواست آزمایش',
      estimatedAmount: '9007199254740993.1234',
      urgent: true,
      urgencyReason: 'اختلال در عملیات',
      items: [
        {
          id: 'line-1',
          kind: 'SERVICE' as const,
          description: 'پشتیبانی',
          quantity: '1.5000',
          specification: '',
          unit: 'ساعت',
          acceptanceCriteria: 'تأیید مسئول',
          period: 'ماهانه',
        },
      ],
    };
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <DraftForm
          bootstrap={bootstrap}
          request={{
            id: 'draft',
            number: 'PR-1',
            version: 1,
            requesterUserId: 'user',
            requesterEmployeeId: null,
            ownerUserId: null,
            createdAt: '',
            updatedAt: '',
            status: 'DRAFT',
            draft,
          }}
          onClose={() => undefined}
          onSaved={() => undefined}
        />
      </QueryClientProvider>,
    );
    expect(html).toContain('9007199254740993.1234');
    expect(html).toContain('شماره درخواست: PR-1');
    expect(html).toContain('اختلال در عملیات');
    expect(html).toContain('1.5000');
    expect(html).not.toContain('for="line-1-acceptanceCriteria"');
  });
  it('shows saved purchase classifications and measurement units as selected dropdown values', () => {
    const client = new QueryClient();
    client.setQueryData(['procurement', 'saved-request-field-options'], {
      items: [
        {
          draft: {
            branchId: 'branch-1',
            purchaseType: 'خرید عمومی',
            category: 'تجهیزات اداری',
            items: [{ unit: 'عدد', period: 'ماهانه' }],
          },
        },
      ],
      page: 1,
      pageSize: 50,
      hasMore: false,
    });
    const draft = {
      ...emptyDraft(),
      branchId: 'branch-1',
      purchaseType: 'خرید عمومی',
      category: 'تجهیزات اداری',
      items: [
        {
          id: 'item-1',
          kind: 'SERVICE' as const,
          description: 'پشتیبانی',
          specification: '',
          quantity: '1',
          unit: 'عدد',
          period: 'ماهانه',
          acceptanceCriteria: '',
        },
      ],
    };
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <DraftForm
          bootstrap={bootstrap}
          request={{
            id: 'draft',
            number: 'PR-2',
            version: 1,
            requesterUserId: 'user',
            requesterEmployeeId: null,
            ownerUserId: null,
            createdAt: '',
            updatedAt: '',
            status: 'DRAFT',
            draft,
          }}
          onClose={() => undefined}
          onSaved={() => undefined}
        />
      </QueryClientProvider>,
    );
    expect(html).toContain('خرید عمومی');
    expect(html).toContain('تجهیزات اداری');
    expect(html).toContain('عدد');
    expect(html).toContain('role="combobox"');
    expect(html).not.toContain('دوره ارائه خدمت');
    expect(html).not.toContain('مقدار تازهٔ نوع خرید');
  });
  it('renders when a historic request is missing saved classifications', () => {
    const client = new QueryClient();
    const legacyDraft = emptyDraft();
    legacyDraft.branchId = 'branch-1';
    Reflect.deleteProperty(legacyDraft, 'purchaseType');
    Reflect.deleteProperty(legacyDraft, 'category');
    client.setQueryData(savedRequestFieldOptionsKey, {
      items: [{ draft: legacyDraft }],
      page: 1,
      pageSize: 50,
      hasMore: false,
    });

    expect(() =>
      renderToStaticMarkup(
        <QueryClientProvider client={client}>
          <DraftForm
            bootstrap={bootstrap}
            onClose={() => undefined}
            onSaved={() => undefined}
          />
        </QueryClientProvider>,
      ),
    ).not.toThrow();
  });
  it('shows the persisted choices before the saved-options query finishes', () => {
    const draft = {
      ...emptyDraft(),
      branchId: 'branch-1',
      purchaseType: 'خرید عمومی',
      category: 'ملزومات اداری',
      items: [
        {
          id: 'item-1',
          kind: 'SERVICE' as const,
          description: 'پشتیبانی آزمایشی',
          specification: '',
          quantity: '1',
          unit: 'ساعت',
          period: 'ماهانه',
          acceptanceCriteria: '',
        },
      ],
    };
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <DraftForm
          bootstrap={bootstrap}
          request={{
            id: 'draft',
            number: 'PR-3',
            version: 1,
            requesterUserId: 'user',
            requesterEmployeeId: null,
            ownerUserId: null,
            createdAt: '',
            updatedAt: '',
            status: 'DRAFT',
            draft,
          }}
          onClose={() => undefined}
          onSaved={() => undefined}
        />
      </QueryClientProvider>,
    );
    const trigger = (id: string) =>
      html.match(
        new RegExp(`<button[^>]*id="${id}"[^>]*>(.*?)</button>`, 's'),
      )?.[1] ?? '';
    expect(trigger('proc-purchaseType')).toContain('خرید عمومی');
    expect(trigger('proc-category')).toContain('ملزومات اداری');
    expect(trigger('item-1-unit')).toContain('ساعت');
    expect(trigger('item-1-period')).toBe('');
    expect(html).toContain('اقلام و خدمات');
    expect(html).not.toContain('دوره ارائه خدمت');
    expect(html).not.toContain('مقدار تازهٔ نوع خرید');
    expect(html).not.toContain('مقدار تازهٔ دسته خرید');
  });
});
