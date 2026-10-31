import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  NewEmployeeForm,
  validateNewEmployeeForm,
  type NewEmployeeFormValue,
} from './new-employee-dialog';
import {
  PersonnelIdentityFields,
  defaultPersonnelIdentity,
  personnelContactError,
  personnelIdentityError,
} from './personnel-identity-fields';

describe('observed Radan personnel entry', () => {
  it('offers only previously defined cities of the selected issuing province', () => {
    const values = [...defaultPersonnelIdentity];
    values[8] = 'تهران';
    const html = renderToStaticMarkup(
      <PersonnelIdentityFields
        values={values}
        onChange={() => {}}
        groupControl={null}
        contacts={[]}
        onContacts={() => {}}
        onPhoto={() => {}}
        onPhotoValidUntil={() => {}}
        photoValidityError=""
        error=""
        cityOptions={[
          { province: 'تهران', city: 'شهر ثبت‌شده' },
          { province: 'گیلان', city: 'شهر استان دیگر' },
        ]}
      />,
    );
    expect(html).toContain('<datalist');
    expect(html).toContain('شهر ثبت‌شده');
    expect(html).not.toContain('شهر استان دیگر');
  });

  it('retains the existing archive validity rule when a photo is selected', () => {
    const value: NewEmployeeFormValue = {
      firstName: 'Synthetic',
      lastName: 'Worker',
      personnelCode: 'HR-1001',
      employmentType: 'تمام‌وقت',
      branch: 'نیایش سیر',
      unit: 'عملیات',
      position: 'کارشناس',
      grade: 'کارشناس',
      manager: 'بدون مدیر مستقیم',
      startedAt: '2026-10-20',
      status: 'فعال',
      photoFile: new File(['synthetic'], 'photo.png', { type: 'image/png' }),
    };
    expect(validateNewEmployeeForm(value, []).photoFile).toContain(
      'تاریخ اعتبار',
    );
    expect(
      validateNewEmployeeForm({ ...value, photoValidUntil: '2027-10-20' }, [])
        .photoFile,
    ).toBeUndefined();
  });

  it('opens personal information in the existing form with the observed wizard and fields', () => {
    const html = renderToStaticMarkup(
      <NewEmployeeForm
        personnelMode
        existingPersonnelCodes={[]}
        managerOptions={[]}
        groupOptions={[]}
        onCancel={() => {}}
        onSubmit={() => {}}
      />,
    );
    for (const label of [
      'کد ملی',
      'شماره شناسنامه',
      'نام پدر',
      'تاریخ تولد',
      'جنسیت',
      'وضعیت تأهل',
      'تحصیلات',
      'ملیت',
      'وضعیت نظام وظیفه',
      'شماره‌های تماس (0)',
      'عکس پرسنلی',
      'بعدی',
    ])
      expect(html).toContain(label);
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(html).not.toContain('مراحل فرم پرسنلی');
    expect(html).toContain('value="مرد"');
  });
  it('accepts an optional national code and still requires province before city', () => {
    expect(personnelIdentityError(defaultPersonnelIdentity)).toBe('');
    const values = [...defaultPersonnelIdentity];
    values[2] = '۰۱۲۳۴۵۶۷۸۹';
    expect(personnelIdentityError(values)).toBe('');
    values[9] = 'تهران';
    expect(personnelIdentityError(values)).not.toBe('');
    values[8] = 'تهران';
    expect(personnelIdentityError(values)).toBe('');
  });
  it('validates typed contacts, normalized duplicates and bounded list size', () => {
    expect(personnelContactError(['موبایل', '۰۹۱۲۳۴۵۶۷۸۹'], [])).toBe('');
    expect(personnelContactError(['ناشناخته', '09123456789'], [])).not.toBe('');
    expect(
      personnelContactError(
        ['موبایل', '0912-3456789'],
        [['موبایل', '۰۹۱۲۳۴۵۶۷۸۹']],
      ),
    ).not.toBe('');
    expect(personnelContactError(['موبایل', '<invalid>'], [])).not.toBe('');
    expect(
      personnelContactError(
        ['خانه', '02112345678'],
        Array.from({ length: 20 }, (_, i) => ['موبایل', String(i)]),
      ),
    ).not.toBe('');
  });
});

describe('optional personnel national ID', () => {
  it('allows missing or blank IDs and validates supplied digits', () => {
    for (const id of ['', '   ', '0123456789', '۰۱۲۳۴۵۶۷۸۹']) {
      const values = [...defaultPersonnelIdentity];
      values[2] = id;
      expect(personnelIdentityError(values)).toBe('');
    }
    const invalid = [...defaultPersonnelIdentity];
    invalid[2] = '123';
    expect(personnelIdentityError(invalid)).not.toBe('');
    const html = renderToStaticMarkup(
      <PersonnelIdentityFields
        values={[...defaultPersonnelIdentity]}
        onChange={() => {}}
        groupControl={null}
        contacts={[]}
        onContacts={() => {}}
        onPhoto={() => {}}
        onPhotoValidUntil={() => {}}
        photoValidityError=""
        error=""
      />,
    );
    expect(html).not.toMatch(/required=""/);
    expect(html).not.toContain('کد ملی *');
  });
});
