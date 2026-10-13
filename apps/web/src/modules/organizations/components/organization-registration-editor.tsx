'use client';

import type { IamPermissionCode, MasterDataRecord } from '@nora/contracts';
import { ArrowRight, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/surfaces';
import { AgreementWorkflowPanel } from './agreement-workflow-panel';
import { OrganizationAddressesPanel } from './organization-addresses-panel';

function organizationRole(record: MasterDataRecord) {
  return String(record.attributes.roleCodes ?? '')
    .split(',')
    .includes('AGENCY')
    ? 'AGENCY'
    : 'CORPORATE_CUSTOMER';
}

export function OrganizationRegistrationEditor({
  organization,
  contacts,
  contactsLoading,
  contactsError,
  contactPage,
  contactTotal,
  permissions,
  onClose,
  onEditIdentity,
  onAddContact,
  onEditContact,
  onContactPageChange,
}: {
  organization: MasterDataRecord;
  contacts: readonly MasterDataRecord[];
  contactsLoading: boolean;
  contactsError?: string | undefined;
  contactPage: number;
  contactTotal: number;
  permissions: readonly IamPermissionCode[];
  onClose: () => void;
  onEditIdentity: () => void;
  onAddContact: () => void;
  onEditContact: (contact: MasterDataRecord) => void;
  onContactPageChange: (page: number) => void;
}) {
  const canUpdate = permissions.includes('master_data.update');
  return (
    <main className="space-y-4" aria-label="ویرایش اطلاعات ثبت آژانس">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">
            ویرایش پرونده {organization.name}
          </h1>
        </div>
        <Button variant="outline" onClick={onClose}>
          <ArrowRight aria-hidden="true" className="size-4" />
          بازگشت به پرونده
        </Button>
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">هویت و نقش سازمان</h2>
          <Button
            size="sm"
            variant="outline"
            disabled={!canUpdate}
            onClick={onEditIdentity}
          >
            <Pencil aria-hidden="true" className="size-4" />
            ویرایش مشخصات و لوگو
          </Button>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-sm text-muted-foreground">نام ثبتی</dt>
            <dd className="font-medium">{organization.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">شناسه ملی</dt>
            <dd>{String(organization.attributes.nationalId || 'ثبت نشده')}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">شماره ثبت</dt>
            <dd>
              {String(organization.attributes.registrationNumber || 'ثبت نشده')}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">کد اقتصادی</dt>
            <dd>
              {String(organization.attributes.economicCode || 'ثبت نشده')}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">شماره مجوز</dt>
            <dd>
              {String(
                organization.attributes.tourismLicenseNumber || 'ثبت نشده',
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">نوع شخصیت</dt>
            <dd>
              {organization.attributes.personType === 'LEGAL'
                ? 'حقوقی'
                : organization.attributes.personType === 'NATURAL'
                  ? 'حقیقی'
                  : 'ثبت نشده'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">نقش همکاری</dt>
            <dd>
              {organizationRole(organization) === 'AGENCY'
                ? 'آژانس'
                : 'مشتری سازمانی'}
            </dd>
          </div>
        </dl>
      </Card>

      <OrganizationAddressesPanel
        organizationId={organization.id}
        permissions={permissions}
        presentation="cards"
      />

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">نمایندگان و اطلاعات تماس</h2>
          <Button
            size="sm"
            disabled={!permissions.includes('master_data.create')}
            onClick={onAddContact}
          >
            <Plus aria-hidden="true" className="size-4" />
            افزودن نماینده
          </Button>
        </div>
        {contactsLoading ? <p role="status">در حال دریافت نمایندگان…</p> : null}
        {contactsError ? <p role="alert">{contactsError}</p> : null}
        {!contactsLoading && !contactsError && contacts.length === 0 ? (
          <p>نماینده‌ای ثبت نشده است.</p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
            >
              <div className="min-w-0">
                <p className="font-medium">{contact.name}</p>
                <p className="text-sm text-muted-foreground">
                  {String(contact.attributes.jobTitle || 'سمت ثبت نشده')}
                </p>
                <p className="break-all text-sm" dir="ltr">
                  {String(
                    contact.attributes.phoneMasked ||
                      contact.attributes.emailMasked ||
                      '',
                  )}
                </p>
              </div>
              <Button
                size="icon"
                variant="outline"
                title={`ویرایش ${contact.name}`}
                aria-label={`ویرایش ${contact.name}`}
                disabled={!canUpdate}
                onClick={() => onEditContact(contact)}
              >
                <Pencil aria-hidden="true" className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        {contactTotal > 100 ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={contactsLoading || contactPage <= 1}
              onClick={() => onContactPageChange(contactPage - 1)}
            >
              قبلی
            </Button>
            <span className="text-sm">
              صفحه {contactPage.toLocaleString('fa-IR')}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={contactsLoading || contactPage * 100 >= contactTotal}
              onClick={() => onContactPageChange(contactPage + 1)}
            >
              بعدی
            </Button>
          </div>
        ) : null}
      </Card>

      <section aria-label="قرارداد و تضمین ثبت اولیه">
        <h2 className="mb-3 font-bold">قرارداد، اعتبار و تضمین</h2>
        <AgreementWorkflowPanel
          organizationId={organization.id}
          organizationName={organization.name}
          role={organizationRole(organization)}
          view="agreements"
        />
      </section>
    </main>
  );
}
