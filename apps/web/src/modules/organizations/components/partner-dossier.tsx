'use client';
import { useCallback, useEffect, useState } from 'react';
import type { MasterDataRecord, PartnerRoleV1 } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import {
  masterDataApi,
  type MasterDataLogoChange,
} from '@/modules/master-data/api/client';
import { MasterDataLiveForm } from '@/modules/master-data/components/master-data-live-form';
import { getMasterDataDefinition } from '@/modules/master-data/model/catalog';
import { CorporateProfile } from './corporate-profile';
import { AgencyProfilePanel } from './agency-profile-panel';
import { AgencyRatesPanel } from './agency-rates-panel';
import { AgreementWorkflowPanel } from './agreement-workflow-panel';
import { OrganizationAddressesPanel } from './organization-addresses-panel';
import { OrganizationSignatoriesPanel } from './organization-signatories-panel';
import { OrganizationDocumentsPanel } from './organization-documents-panel';
import { OrganizationLogo } from './organization-logo';
import { PartnerFinancePanel } from './partner-finance-panel';
import { useDossierBranch } from './use-dossier-branch';
import { agencyClient } from '../api/agency-client';
import { partnerClient } from '../api/partner-client';
import { BrokerPurchases } from '@/modules/finance/components/broker-purchases';
import { useOrganizationContactDisclosures } from './use-organization-contact-disclosures';
import { MasterDataLogoCell } from '@/modules/master-data/components/master-data-logo-cell';
import './corporate-design.css';
const emptyContacts: readonly MasterDataRecord[] = [];

export function PartnerDossier({
  partner,
  onClose,
}: {
  partner: MasterDataRecord;
  onClose: () => void;
}) {
  const resource = partner.resource === 'brokers' ? 'brokers' : 'suppliers';
  const role: PartnerRoleV1 = resource === 'brokers' ? 'BROKER' : 'SUPPLIER';
  const { permissions, branchId, sessionContextKey, sessionError } =
    useDossierBranch();
  const [organizationId, setOrganizationId] = useState(
    String(partner.attributes.organizationId ?? ''),
  );
  const [refresh, setRefresh] = useState(0);
  const [partnerRecord, setPartnerRecord] = useState(partner);
  const [notice, setNotice] = useState('');
  const [state, setState] = useState<{
    key: string;
    organization?: MasterDataRecord;
    contacts?: readonly MasterDataRecord[];
    total?: number;
    error?: string;
  }>({ key: '' });
  const [busy, setBusy] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [contactPage, setContactPage] = useState(1);
  const [editor, setEditor] = useState<{
    kind: 'identity' | 'contact' | 'partner';
    record?: MasterDataRecord;
  }>();
  const key = `${organizationId}:${sessionContextKey}:${contactPage}:${refresh}`;
  const reload = useCallback(() => setRefresh((value) => value + 1), []);
  useEffect(() => {
    if (!organizationId || !sessionContextKey) return;
    let active = true;
    void Promise.all([
      masterDataApi.detail('organizations', organizationId),
      agencyClient.contacts(organizationId, contactPage),
      masterDataApi.detail(resource, partner.id),
    ])
      .then(([identity, contacts, source]) => {
        if (
          !String(identity.data.attributes.roleCodes ?? '')
            .split(',')
            .includes(role)
        )
          throw new Error('نقش پرونده با طرف همکاری یکسان نیست.');
        if (active) setPartnerRecord(source.data);
        if (active)
          setState({
            key,
            organization: identity.data,
            contacts: contacts.data,
            total: contacts.meta.total,
          });
      })
      .catch((error: unknown) => {
        if (active)
          setState({
            key,
            error:
              error instanceof Error
                ? error.message
                : 'دریافت پرونده ناموفق بود.',
          });
      });
    return () => {
      active = false;
    };
  }, [
    organizationId,
    sessionContextKey,
    contactPage,
    role,
    resource,
    partner.id,
    key,
  ]);
  const current = state.key === key ? state : undefined;
  const organization = current?.organization;
  const contacts = current?.contacts ?? emptyContacts;
  const contactDisclosures = useOrganizationContactDisclosures({
    active: Boolean(organization),
    organizationId,
    contacts,
  });
  async function persist(
    values: Record<string, string>,
    logoChange?: MasterDataLogoChange,
  ) {
    if (!organization || !editor) throw new Error('پرونده آماده نیست.');
    if (editor.kind === 'contact')
      await agencyClient.saveContact(organization.id, values, editor.record);
    else if (editor.kind === 'partner') {
      const saved = await masterDataApi.persistWithLogo({
        resource,
        existing: partnerRecord,
        values,
        title: `لوگوی ${partnerRecord.name}`,
        ...(logoChange ? { logoChange } : {}),
      });
      setPartnerRecord(saved.data);
      setNotice(saved.warning ?? 'اطلاعات اصلی ذخیره شد.');
    } else
      await masterDataApi.persistWithLogo({
        resource: 'organizations',
        existing: organization,
        values: {
          ...values,
          roleCodes: String(organization.attributes.roleCodes),
        },
        title: `لوگوی ${organization.name}`,
        ...(logoChange ? { logoChange } : {}),
      });
    setEditor(undefined);
    reload();
  }
  if (!organizationId)
    return (
      <section className="space-y-4 rounded-xl border p-5">
        <h1 className="text-xl font-bold">پرونده ۳۶۰ درجه {partner.name}</h1>
        <p>
          برای این رکورد قدیمی، پروندهٔ سازمانی متصل هنوز ایجاد نشده است. اتصال
          زیر اطلاعات فعلی را حفظ می‌کند و نقش آژانس اضافه نمی‌کند.
        </p>
        {sessionError || connectError ? (
          <p role="alert">{sessionError || connectError}</p>
        ) : null}
        <Button
          disabled={
            busy ||
            !branchId ||
            !permissions.includes('master_data.create') ||
            !permissions.includes('master_data.update')
          }
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setConnectError('');
            try {
              const result = await partnerClient.connect(
                resource,
                partner.id,
                partner.version,
                branchId,
              );
              setOrganizationId(result.organizationId);
            } catch (error) {
              setConnectError(
                error instanceof Error ? error.message : 'اتصال ناموفق بود.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'در حال اتصال…' : 'ایجاد پرونده متصل با اطلاعات فعلی'}
        </Button>
        <Button variant="outline" onClick={onClose}>
          بازگشت
        </Button>
      </section>
    );
  if (sessionError || current?.error)
    return (
      <section className="space-y-4">
        <p role="alert">{sessionError || current?.error}</p>
        <Button onClick={reload}>تلاش دوباره</Button>
        <Button variant="outline" onClick={onClose}>
          بازگشت
        </Button>
      </section>
    );
  if (!organization) return <p role="status">در حال دریافت پرونده…</p>;
  return (
    <div className="b2b-design min-w-0" dir="rtl">
      <CorporateProfile
        organization={organization}
        cooperationRole={role}
        onClose={onClose}
        canEdit={permissions.includes('master_data.update')}
        onEdit={() => setEditor({ kind: 'identity', record: organization })}
        canDelete={false}
        onDelete={() => undefined}
        logo={
          !organization.attributes.logoFileReference &&
          partnerRecord.attributes.logoFileReference ? (
            <MasterDataLogoCell record={partnerRecord} asCell={false} />
          ) : (
            <OrganizationLogo
              organization={organization}
              permissions={permissions}
            />
          )
        }
        overview={
          <>
            {notice ? <p role="status">{notice}</p> : null}
            <Button
              variant="outline"
              disabled={!permissions.includes('master_data.update')}
              onClick={() =>
                setEditor({ kind: 'partner', record: partnerRecord })
              }
            >
              ویرایش اطلاعات اصلی{' '}
              {role === 'BROKER' ? 'و لیدرهای کارگزار' : 'تأمین‌کننده'}
            </Button>
            <p className="boundary-note">
              اعتبار این پرونده از{' '}
              {role === 'BROKER' ? 'کارگزار' : 'تأمین‌کننده'} به شرکت ما اعطا
              می‌شود.
            </p>
            <OrganizationDocumentsPanel organization={organization} />
            {resource === 'brokers' ? (
              <BrokerPurchases id={partner.id} />
            ) : null}
          </>
        }
        contacts={
          <section className="panel">
            <header className="panel-head">
              <h2>نمایندگان و تماس‌ها</h2>
              <Button
                disabled={!permissions.includes('master_data.create')}
                onClick={() => setEditor({ kind: 'contact' })}
              >
                افزودن نماینده
              </Button>
            </header>
            <div className="panel-body space-y-3">
              {contacts.length ? (
                contacts.map((contact) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                    key={contact.id}
                  >
                    <div>
                      <strong>{contact.name}</strong>
                      <p dir="ltr">
                        {contactDisclosures.disclosure(contact.id)?.phone ??
                          String(contact.attributes.phoneMasked ?? '')}{' '}
                        {contactDisclosures.disclosure(contact.id)?.email ??
                          String(contact.attributes.emailMasked ?? '')}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      disabled={!permissions.includes('master_data.update')}
                      onClick={() =>
                        setEditor({ kind: 'contact', record: contact })
                      }
                    >
                      ویرایش
                    </Button>
                  </div>
                ))
              ) : (
                <p>نماینده یا اطلاعات تماس ثبت نشده است.</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={contactPage <= 1}
                  onClick={() => setContactPage((p) => p - 1)}
                >
                  قبلی
                </Button>
                <Button
                  variant="outline"
                  disabled={contactPage * 100 >= (current?.total ?? 0)}
                  onClick={() => setContactPage((p) => p + 1)}
                >
                  بعدی
                </Button>
              </div>
            </div>
          </section>
        }
        signatories={
          <OrganizationSignatoriesPanel
            organizationId={organization.id}
            onAddContact={() => setEditor({ kind: 'contact' })}
          />
        }
        finance={(tab) => (
          <PartnerFinancePanel
            key={`${role}:${organization.id}:${tab}`}
            organization={organization}
            role={role}
            tab={tab}
          />
        )}
        exposure={
          <PartnerFinancePanel
            organization={organization}
            role={role}
            tab="exposure"
          />
        }
        operations={(view, onReviewCooperation, headerActionTargetId) =>
          view === 'address' ? (
            <OrganizationAddressesPanel
              organizationId={organization.id}
              permissions={permissions}
              presentation="selector"
            />
          ) : view === 'agreements' ||
            view === 'credit' ||
            view === 'temporary' ||
            view === 'guarantees' ? (
            <AgreementWorkflowPanel
              key={`${organization.id}:${role}:${view}`}
              organizationId={organization.id}
              organizationName={organization.name}
              role={role}
              view={view}
              headerActionTargetId={headerActionTargetId}
            />
          ) : view === 'profile' || view === 'manager' ? (
            <AgencyProfilePanel
              organizationId={organization.id}
              role={role}
              onReviewCooperation={onReviewCooperation}
            />
          ) : view === 'rates' ||
            view === 'discounts' ||
            view === 'commission' ? (
            <>
              <AgencyRatesPanel
                key={`${role}:${view}`}
                organizationId={organization.id}
                organizationName={organization.name}
                role={role}
                kind={
                  view === 'rates'
                    ? 'FIXED_AMOUNT'
                    : view === 'discounts'
                      ? 'DISCOUNT_PERCENT'
                      : 'COMMISSION_PERCENT'
                }
                headerActionTargetId={headerActionTargetId}
              />
              {view === 'commission' ? (
                <PartnerFinancePanel
                  organization={organization}
                  role={role}
                  tab="commission"
                />
              ) : null}
            </>
          ) : (
            <OrganizationDocumentsPanel organization={organization} />
          )
        }
      />
      {editor && (
        <MasterDataLiveForm
          key={`${editor.kind}:${editor.record?.id ?? 'new'}`}
          definition={
            editor.kind === 'partner'
              ? getMasterDataDefinition(resource)
              : editor.kind === 'contact'
                ? getMasterDataDefinition('organization-contacts')
                : {
                    ...getMasterDataDefinition('organizations'),
                    fields: getMasterDataDefinition(
                      'organizations',
                    ).fields.filter((field) => field.key !== 'roleCodes'),
                  }
          }
          mode={editor.record ? 'edit' : 'create'}
          open
          onOpenChange={(open) => {
            if (!open) setEditor(undefined);
          }}
          onPersist={persist}
          {...(editor.record ? { record: editor.record } : {})}
        />
      )}
    </div>
  );
}
