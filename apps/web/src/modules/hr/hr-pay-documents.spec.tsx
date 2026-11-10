import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { HrEmployeeDto, HrRecordDto } from '@nora/contracts';
import type { HrStore } from './hr-store';
import { HrPayDocuments, payDocumentType } from './hr-pay-documents';
const employee = { id: 'employee-a', branchId: 'branch-a' } as HrEmployeeDto;
const record = (
  title: string,
  section = 'فیش‌های حقوقی',
  employeeId = employee.id,
  deletedAt: string | null = null,
) =>
  ({
    id: title,
    employeeId,
    section: 'employee',
    tab: 'docs',
    deletedAt,
    values: [payDocumentType(section), title, '', '2026-11-10'],
    data: { documentId: 'document-a' },
  }) as HrRecordDto;
const render = (write: boolean, section = 'فیش‌های حقوقی') =>
  renderToStaticMarkup(
    <HrPayDocuments
      employee={employee}
      section={section}
      records={[
        record('own-document'),
        record('other-section', 'حقوق و کسورات'),
        record('other-employee', section, 'employee-b'),
        record('deleted', section, employee.id, '2026-11-10'),
      ]}
      store={{ data: { capabilities: { write } } } as HrStore}
      onSaved={() => undefined}
    />,
  );
describe('employee pay evidence', () => {
  it('displays only undeleted evidence for the selected employee and pay section', () => {
    const html = render(true);
    expect(html).toContain('own-document');
    expect(html).not.toContain('other-section');
    expect(html).not.toContain('other-employee');
    expect(html).not.toContain('>deleted<');
  });
  it.each(['حقوق و کسورات', 'فیش‌های حقوقی', 'فیش‌های واردشده'])(
    'provides an upload action in %s',
    (section) => expect(render(true, section)).toContain('افزودن مدرک'),
  );
  it('does not offer creation to read-only users', () =>
    expect(render(false)).not.toContain('افزودن مدرک'));
});
