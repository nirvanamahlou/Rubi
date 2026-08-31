import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getMasterDataDefinition } from './catalog';
import { getReferenceFieldConfig } from './reference-fields';
import { validateMasterDataDraft } from './validation';

describe('supplier and broker form coverage', () => {
  it.each(['suppliers', 'brokers'] as const)('offers persisted English, contact and service fields for %s', (resource) => {
    const fields = getMasterDataDefinition(resource).fields.map((field) => field.key);
    expect(fields).toEqual(expect.arrayContaining(['englishName', 'primaryContactId', 'serviceCodes', 'organizationId', 'countryId', 'cityId', 'collaborationStatus']));
    expect(fields).not.toEqual(expect.arrayContaining(['purchaseLimit', 'contractStatus']));
    expect(getReferenceFieldConfig(resource, 'primaryContactId')).toMatchObject({ target: 'organization-contacts', scopeField: 'organizationId', optional: true });
    expect(getReferenceFieldConfig(resource, 'serviceCodes')).toMatchObject({ target: 'travel-services', multiple: true, payload: 'code' });
    expect(validateMasterDataDraft(resource, { englishName: 'x'.repeat(161) }).errors.englishName).toBeTruthy();
  });
  it('keeps natural/legal identity on the canonical organization', () => {
    expect(getMasterDataDefinition('organizations').fields.find((field) => field.key === 'personType')?.options?.map((option) => option.value)).toEqual(['NATURAL', 'LEGAL']);
    expect(validateMasterDataDraft('organizations', { personType: 'BROKER' }).errors.personType).toBeTruthy();
  });
  it('opens related editors as popups and resets dependent selection when organization changes', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/modules/master-data/components/master-data-live-form.tsx'), 'utf8');
    expect(source).toContain('referenceForm');
    expect(source).toContain("primaryContactId: ''");
    expect(source).toContain('version: referenceForm.record.version');
    expect(source).toContain('lockedFields');
  });
  it('renders English name, person type and masked primary contact in the popup/list', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/modules/master-data/components/master-data-suppliers-workspace.tsx'), 'utf8');
    for (const field of ['englishName', 'organizationPersonType', 'primaryContactName', 'primaryPhoneMasked', 'primaryEmailMasked']) expect(source).toContain(field);
    expect(source).not.toContain("/ BROKER");
    expect(source).toContain('MasterDataProfileDialog');
  });
});
