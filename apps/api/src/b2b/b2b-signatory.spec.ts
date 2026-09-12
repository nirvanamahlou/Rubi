import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { b2bSignatoryIssue, type AuthenticatedActor } from '@rubi/contracts';
import { SaveB2bSignatoryDto } from './b2b-signatory.dto';
import { B2bSignatoryService } from './b2b-signatory.service';
import type { B2bSignatoryRepository } from './b2b-signatory.repository';
import type { B2bAgreementDocuments } from './b2b-agreement-documents';
import type { MasterOrganizationDirectory } from '../master-data/master-organization-directory';
const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const actor: AuthenticatedActor = {
  userId: id,
  sessionId: id,
  branchIds: [id],
  permissions: ['b2b.agency.read', 'b2b.agency.manage'],
};
const input = (patch: object = {}) =>
  plainToInstance(SaveB2bSignatoryDto, {
    branchId: id,
    contactId: id,
    documentTypes: ['FRAMEWORK_AGREEMENT'],
    validFrom: '2026-09-01',
    ...patch,
  });
function setup() {
  const save = vi.fn().mockResolvedValue({ id, version: 1 });
  const remove = vi.fn().mockResolvedValue({ id, deleted: true });
  const find = vi.fn().mockResolvedValue({ id, version: 1 });
  const contact = vi.fn().mockResolvedValue({ id, organizationId: id });
  const currency = vi.fn().mockResolvedValue(['IRR']);
  const proof = vi.fn().mockResolvedValue({ documentId: id, versionId: id });
  const service = new B2bSignatoryService(
    { save, remove, find } as unknown as B2bSignatoryRepository,
    {
      signatoryContactReference: contact,
      activeCurrencyCodes: currency,
    } as unknown as MasterOrganizationDirectory,
    { assertDraftReference: proof } as unknown as B2bAgreementDocuments,
  );
  return { service, save, remove, find, contact, currency, proof };
}
describe('signatory registration and authority references', () => {
  it('accepts an inactive entry without proof and serializes large limits without rounding', async () => {
    const { service, save } = setup();
    const dto = input({
      authorityLimit: '9007199254740993.1234',
      currencyCode: 'IRR',
    });
    expect(
      validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).toEqual([]);
    await service.save(id, dto, actor);
    expect(save.mock.calls[0]?.[1].authorityLimit.toString()).toBe(
      '9007199254740993.1234',
    );
    expect(save.mock.calls[0]?.[1]).toMatchObject({
      isActive: false,
      documentVersionId: null,
    });
  });
  it.each([
    { authorityLimit: 123 },
    { contactId: other + 'x' },
    { documentTypes: ['ADMIN'] },
    { isActive: 'true' },
    { status: 'APPROVED' },
  ])('rejects malformed or privilege-injecting DTO %s', (patch) => {
    expect(
      validateSync(input(patch), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }).length,
    ).toBeGreaterThan(0);
  });
  it.each([
    { validFrom: '2026-02-30' },
    { validTo: '2026-08-01' },
    { authorityLimit: '10' },
    { currencyCode: 'IRR' },
    { documentTypes: [] },
    { isActive: true },
  ])('rejects inconsistent authority metadata %s', (patch) => {
    expect(b2bSignatoryIssue(input(patch))).toBeDefined();
  });
  it('denies missing manage permission and another internal branch before touching records', async () => {
    const { service, save, contact } = setup();
    await expect(
      service.save(id, input(), { ...actor, permissions: ['b2b.agency.read'] }),
    ).rejects.toThrow('مجوز');
    await expect(
      service.save(id, input({ branchId: other }), actor),
    ).rejects.toThrow('مجوز');
    expect(save).not.toHaveBeenCalled();
    expect(contact).not.toHaveBeenCalled();
  });
  it('requires an active contact from this organization and an active currency', async () => {
    const { service, contact, currency, save } = setup();
    contact.mockResolvedValueOnce(null);
    await expect(service.save(id, input(), actor)).rejects.toThrow(
      'همین سازمان',
    );
    expect(contact).toHaveBeenCalledWith(id, id);
    currency.mockResolvedValueOnce([]);
    await expect(
      service.save(
        id,
        input({ authorityLimit: '1', currencyCode: 'USD' }),
        actor,
      ),
    ).rejects.toThrow('ارز');
    expect(save).not.toHaveBeenCalled();
  });
  it('checks proof with the Documents owner, pins its exact version and rejects changed versions', async () => {
    const { service, proof, save } = setup();
    await service.save(id, input({ documentId: id, isActive: true }), actor);
    expect(proof).toHaveBeenCalledWith(id, id, id, actor);
    expect(save.mock.calls[0]?.[1].documentVersionId).toBe(id);
    await expect(
      service.save(
        id,
        input({ documentId: id, documentVersionId: other }),
        actor,
      ),
    ).rejects.toThrow('نسخه مدرک');
    proof.mockRejectedValueOnce(new Error('wrong organization proof'));
    await expect(
      service.save(id, input({ documentId: other, isActive: true }), actor),
    ).rejects.toThrow('wrong organization');
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('requires optimistic version and matches organization/branch before editing', async () => {
    const { service, find, save } = setup();
    await expect(service.save(id, input(), actor, id)).rejects.toThrow('نسخه');
    find.mockResolvedValueOnce(null);
    await expect(
      service.save(id, input({ version: 1 }), actor, id),
    ).rejects.toThrow('پرونده');
    expect(find).toHaveBeenCalledWith({ organizationId: id, branchId: id }, id);
    expect(save).not.toHaveBeenCalled();
  });
});
