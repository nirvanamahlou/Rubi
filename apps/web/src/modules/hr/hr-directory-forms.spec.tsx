import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NewEmployeeForm } from './new-employee-dialog';
import { HrDirectoryPicker } from './hr-directory-picker';
import { ContextualHrForm } from './contextual-hr-form';
import { getHrResource } from '@rubi/contracts';
import {
  validateDocumentUpload,
  emptyDocumentUploadValues,
} from '../documents/model/document-upload-form';
import { validateFinancePreviewDraft } from '../finance/model/finance';

const employee = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'هم‌نام',
  personnelCode: 'HR-1',
  branchId: 'branch-a',
  userId: 'user-id',
  unit: 'واحد',
  position: 'سمت',
};
describe('cross-module form reference values', () => {
  it('preserves the selected canonical employee ID independently of the label or current search page', () => {
    const html = renderToStaticMarkup(
      <HrDirectoryPicker
        branchId="branch-a"
        selected={employee}
        onSelect={() => undefined}
      />,
    );
    expect(html).toContain(`value="${employee.id}" selected=""`);
    expect(html).toContain('هم‌نام · HR-1');
    expect(
      renderToStaticMarkup(
        <HrDirectoryPicker
          branchId="branch-b"
          selected={employee}
          onSelect={() => undefined}
        />,
      ),
    ).not.toContain(employee.id);
  });
  it('shows branch-filtered IAM choices, saves user IDs, and preserves an existing account', () => {
    const html = renderToStaticMarkup(
      <NewEmployeeForm
        existingPersonnelCodes={[]}
        managerOptions={[]}
        branchOptions={['شرکت الف']}
        initialValue={{
          firstName: 'نام',
          lastName: 'خانوادگی',
          personnelCode: 'HR-42',
          employmentType: 'تمام‌وقت',
          branch: 'شرکت الف',
          unit: 'واحد',
          position: 'سمت',
          grade: 'G1',
          manager: 'بدون مدیر مستقیم',
          startedAt: '2026-01-01',
          status: 'فعال',
          userId: 'canonical-user',
        }}
        userOptions={[
          { id: 'canonical-user', label: 'حساب واقعی', branches: ['شرکت الف'] },
          { id: 'other-user', label: 'خارج شعبه', branches: ['شرکت ب'] },
        ]}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(html).toContain('value="canonical-user" selected=""');
    expect(html).not.toContain('other-user');
  });
  it('keeps a document source exclusive and supports an employee before the first archive relation exists', () => {
    const values = {
      ...emptyDocumentUploadValues,
      title: 'مدرک',
      documentTypeId: 'type',
      categoryId: 'category',
      branchId: 'branch',
      ownerUserId: 'user',
      employeeId: employee.id,
    };
    expect(validateDocumentUpload(values, true, false)).toBeNull();
    expect(
      validateDocumentUpload(
        { ...values, sourceRelationId: 'existing-case' },
        true,
        false,
      ),
    ).not.toBeNull();
  });
  it('keeps archive selection compatible with file-required HR forms without requiring a second upload', () => {
    const definition = getHrResource('expenses', 'claims')!;
    const html = renderToStaticMarkup(
      <ContextualHrForm
        context={{
          section: 'expenses',
          tab: 'claims',
          title: 'هزینه',
          description: '',
          mode: 'edit',
          branchId: 'branch-a',
          columns: definition.columns,
          initialValues: [
            'کارمند',
            'هزینه',
            '2026-01-01',
            'IRR',
            '100',
            `document://${employee.id}`,
            '',
          ],
        }}
        onCancel={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(html).toContain('انتخاب سند موجود');
    expect(html).toContain('سند آرشیو انتخاب شده است');
    const file = html.match(/<input[^>]*type="file"[^>]*>/)?.[0];
    expect(file).toBeDefined();
    expect(file).not.toContain('required=""');
  });
  it('keeps finance employee references distinct from other party IDs', () => {
    const draft = {
      title: 'عملیات نمونه',
      partyReference: `hr-employee:${employee.id}`,
      hrEmployeeId: employee.id,
      contractReference: '',
      amount: '10',
      currencyCode: 'IRR' as const,
      description: 'شرح نمونه برای آزمون',
      expectedVersion: '1',
      idempotencyKey: 'finance:preview:test123',
    };
    expect(
      validateFinancePreviewDraft(draft).errors.partyReference,
    ).toBeUndefined();
    expect(
      validateFinancePreviewDraft({ ...draft, hrEmployeeId: 'another-id' })
        .errors.partyReference,
    ).toBeDefined();
  });
});
