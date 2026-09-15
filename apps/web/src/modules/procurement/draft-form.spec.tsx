import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { DraftForm } from './draft-form';
import type { Bootstrap } from './api';
import { emptyDraft } from './model';

const bootstrap: Bootstrap = {
  permissions: ['procurement.request.create'],
  branches: [{ id: 'branch-1', label: 'شعبه مرکزی' }],
  currencies: [],
  requester: {
    id: 'employee',
    userId: 'user',
    label: 'کاربر جاری',
    unitId: null,
  },
  policy: 'POLICY_NOT_CONFIGURED',
  finance: 'NOT_CONNECTED',
  documents: 'UNAVAILABLE',
  travel: 'NOT_CONNECTED',
};
describe('Purchase draft accessibility and persisted input', () => {
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
    expect(html).not.toContain('type="date"');
    expect(html).toContain('ذخیره پیش‌نویس');
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
    expect(html).toContain('ماهانه');
    expect(html).toContain('role="combobox"');
    expect(html).not.toContain('مقدار تازهٔ نوع خرید');
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
    expect(trigger('item-1-period')).toContain('ماهانه');
    expect(html).not.toContain('مقدار تازهٔ نوع خرید');
    expect(html).not.toContain('مقدار تازهٔ دسته خرید');
  });
});
