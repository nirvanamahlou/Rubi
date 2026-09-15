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
  requester: { id: 'employee', userId: 'user', label: 'کاربر جاری', unitId: null },
  policy: 'POLICY_NOT_CONFIGURED',
  finance: 'NOT_CONNECTED',
  documents: 'UNAVAILABLE',
  travel: 'NOT_CONNECTED',
};
describe('Purchase draft accessibility and persisted input', () => {
  it('renders an incomplete draft with optional delivery location and explicit unavailable documents', () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <DraftForm bootstrap={bootstrap} onClose={() => undefined} onSaved={() => undefined} />
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
      <QueryClientProvider client={new QueryClient()}><DraftForm
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
      /></QueryClientProvider>,
    );
    expect(html).toContain('9007199254740993.1234');
    expect(html).toContain('اختلال در عملیات');
    expect(html).toContain('1.5000');
    expect(html).not.toContain('for="line-1-acceptanceCriteria"');
  });
});
