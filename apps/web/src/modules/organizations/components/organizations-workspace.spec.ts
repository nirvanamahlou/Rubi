import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./organizations-workspace.tsx', import.meta.url),
  'utf8',
);
const client = readFileSync(
  new URL('../api/agency-client.ts', import.meta.url),
  'utf8',
);
const connections = readFileSync(
  new URL('./agency-connections-panel.tsx', import.meta.url),
  'utf8',
);
const profile = readFileSync(
  new URL('./corporate-profile.tsx', import.meta.url),
  'utf8',
);
const dossierSummary = readFileSync(
  new URL('./agency-dossier-summary.tsx', import.meta.url),
  'utf8',
);
const cooperationWizard = readFileSync(
  new URL('./cooperation-wizard.tsx', import.meta.url),
  'utf8',
);
const agreementEditor = readFileSync(
  new URL('./agreement-terms-editor.tsx', import.meta.url),
  'utf8',
);

describe('agency to Master Organization integration', () => {
  it('uses the public Master Data client and the canonical AGENCY role', () => {
    expect(client).toContain("masterDataApi.list('organizations'");
    expect(client).toContain('organizationRole: role');
    expect(client).toContain("masterDataApi.list('organization-contacts'");
    expect(source).not.toContain('@prisma/client');
    expect(source).not.toContain('MasterDataRepository');
  });

  it('has real request states, filters and pagination', () => {
    for (const state of [
      "'loading'",
      "'empty'",
      "'unauthorized'",
      "'forbidden'",
      "'error'",
    ])
      expect(source).toContain(state);
    expect(source).toContain('setSearch');
    expect(source).toContain('setStatus');
    expect(source).toContain('setPage');
  });

  it('suppresses Human Resources requests throughout the organization dossier route', () => {
    expect(source).toContain('useSuppressHrConnections(true)');
    expect(source).not.toContain('useSuppressHrConnections(!profileOpen)');
    expect(profile).not.toContain('useSuppressHrConnections');
  });

  it('keeps Excel export and import available without the redundant template action', () => {
    expect(source).toContain('void exportExcel()');
    expect(source).toContain('setExcelOpen(true)');
    expect(source).toContain('ورود از Excel');
    expect(source).not.toContain('دانلود قالب ورود');
  });

  it('keeps contract and guarantee uploads inside registration without a change-reason field', () => {
    expect(cooperationWizard).toContain('pendingAgreementDocument');
    expect(cooperationWizard).toContain('pendingGuaranteeDocuments');
    expect(agreementEditor).toContain("'سند قرارداد'");
    expect(agreementEditor).toContain('`سند تضمین ${index + 1}`');
    expect(agreementEditor).not.toContain('دلیل ثبت یا اصلاح این نسخه');
  });

  it('keeps the five-stage phone workflow stale-safe and development-only explicit', () => {
    expect(cooperationWizard).toContain("'تأیید شماره',");
    expect(cooperationWizard).not.toContain('کد یک‌بارمصرف شماره همراه');
    expect(cooperationWizard).toContain('کد آزمایشی؛ پیامک واقعی ارسال نشده');
    expect(cooperationWizard).toContain('PhoneVerificationRequestGate');
    expect(cooperationWizard).toContain('phoneRequests.current.invalidate()');
    expect(cooperationWizard).toContain(
      'phoneRequests.current.isCurrent(requestId)',
    );
    expect(cooperationWizard).toContain('phoneVerificationExpiresAt');
    expect(cooperationWizard).not.toContain('localStorage');
  });

  it('loads operational and address data through public APIs without inventing Finance exposure', () => {
    expect(source).not.toContain('BLOCKED_FOR_MIGRATION');
    expect(client).toContain('workspace(organizationId');
    expect(connections).toContain('agencyClient.workspace');
    expect(connections).toContain('createOrganizationAddress');
    expect(connections).toContain('upsertCreditPolicy');
    expect(connections).toContain('createAgreedRate');
    expect(connections).toContain('projectCredit(');
    expect(source).toContain('phoneMasked');
    expect(source).toContain('emailMasked');
  });

  it('keeps CRM relationships backend-backed without exposing a standalone connections section', () => {
    expect(profile).not.toContain("['connections', 'ارتباطات CRM']");
    expect(profile).not.toContain('OrganizationCrmConnectionsPanel');
    expect(client).toContain('crmConnections(');
    expect(client).toContain('/crm-connections');
    expect(dossierSummary).toContain('<OrganizationCrmKpis');
    expect(profile).toContain('<OrganizationFinancePreview');
  });
});
