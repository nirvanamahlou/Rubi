import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { DocumentsService } from './documents.service';
import { DocumentsRepository } from './documents.repository';
const actor: AuthenticatedActor = {
  userId: 'website-service',
  sessionId: '',
  branchIds: ['inventory-branch'],
  permissions: ['sales.contracts.create'],
};
function fixture() {
  const source = {
    branchId: 'brand-source-branch',
    currentVersionId: 'version',
  };
  const repository = {
    websiteAirlineLogoSource: vi
      .fn<(...args: unknown[]) => Promise<typeof source | null>>()
      .mockResolvedValue(source),
    appendAudit: vi.fn(),
  };
  const service = new DocumentsService(
    repository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const stream = Readable.from([Buffer.from('synthetic-image')]);
  const preview = vi.spyOn(service, 'previewMasterDataLogo').mockResolvedValue({
    stream,
    mimeType: 'image/png',
    sizeBytes: 15,
    fileName: 'PRIVATE_NAME.png',
  });
  return { source, repository, service, stream, preview };
}
describe('owner-approved website airline BRAND export', () => {
  it('uses only the exact approved attachment and native preview policy, without modifying account memberships', async () => {
    const f = fixture();
    const input = { documentId: 'logo', airlineId: 'airline' };
    const result = await f.service.previewWebsiteAirlineLogo(input, actor);
    expect(f.preview).toHaveBeenCalledWith(
      {
        documentId: 'logo',
        resource: 'airlines',
        recordId: 'airline',
        workflow: 'sales',
      },
      { ...actor, branchIds: [f.source.branchId] },
      {},
    );
    expect(result.fileName).toBe('airline-logo');
    expect(result).not.toHaveProperty('documentId');
    expect(f.repository.appendAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'documents.airline.website.export',
        reason: 'OWNER_APPROVED_WEBSITE_AIRLINE_BRAND',
        versionId: 'version',
      }),
    );
    expect(actor.branchIds).toEqual(['inventory-branch']);
    expect(actor.permissions).toEqual(['sales.contracts.create']);
  });
  it('rejects an ineligible caller or a source outside the exact branding projection', async () => {
    const f = fixture();
    await expect(
      f.service.previewWebsiteAirlineLogo(
        { documentId: 'logo', airlineId: 'airline' },
        { ...actor, permissions: [] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.repository.websiteAirlineLogoSource).not.toHaveBeenCalled();
    f.repository.websiteAirlineLogoSource.mockResolvedValue(null);
    await expect(
      f.service.previewWebsiteAirlineLogo(
        { documentId: 'private', airlineId: 'airline' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.preview).not.toHaveBeenCalled();
  });
  it('retains native scan/confidential preview denial', async () => {
    const f = fixture();
    f.preview.mockRejectedValue(new ForbiddenException());
    await expect(
      f.service.previewWebsiteAirlineLogo(
        { documentId: 'logo', airlineId: 'airline' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.repository.appendAudit).not.toHaveBeenCalled();
  });
  it('closes the stream if its approved source version changes before export', async () => {
    const f = fixture();
    f.repository.websiteAirlineLogoSource
      .mockResolvedValueOnce(f.source)
      .mockResolvedValueOnce({ ...f.source, currentVersionId: 'other' });
    await expect(
      f.service.previewWebsiteAirlineLogo(
        { documentId: 'logo', airlineId: 'airline' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(f.stream.destroyed).toBe(true);
    expect(f.repository.appendAudit).not.toHaveBeenCalled();
  });
  it('queries only active, complete, non-confidential, unexpired exact airline BRAND attachments', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValue({ branchId: 'brand', currentVersionId: 'version' });
    const repository = new DocumentsRepository(
      {
        client: { document: { findFirst } },
      } as never,
      {} as never,
    );
    await repository.websiteAirlineLogoSource('logo', 'airline');
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'logo',
        archiveStatus: 'ACTIVE',
        confidentiality: 'INTERNAL',
        deletedAt: null,
        isIncomplete: false,
        requiresStepUpVerification: false,
        confidentialAccessCodeHash: null,
        OR: [{ validUntil: null }, { validUntil: { gt: expect.any(Date) } }],
        documentType: { domain: 'BRAND' },
        relations: {
          some: {
            relationType: 'PRIMARY_CASE',
            sourceModule: 'master-data',
            sourceEntityType: 'airlines',
            sourceEntityId: 'airline',
          },
        },
      },
      select: { branchId: true, currentVersionId: true },
    });
  });
});
