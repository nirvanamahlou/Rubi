import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { TicketPublicService } from './ticket-public.service';

describe('published ticket MANIFEST choice', () => {
  it('freezes the approved file reference and reads it after template deactivation', async () => {
    const branchId = randomUUID();
    const templateId = randomUUID();
    const fileReferenceId = randomUUID();
    const input = {
      originId: randomUUID(),
      destinationId: randomUUID(),
      departureAt: '2099-10-01T10:00:00.000Z',
      arrivalAt: '2099-10-01T12:00:00.000Z',
      carrierName: 'IRAN AIRTOUR',
      serviceNumber: 'TEST-1',
      cabinClassCode: 'ECONOMY' as const,
      totalCapacity: 10,
      manifestTemplateId: templateId,
    };
    let published: { id: string; version: number; fingerprint: string } | null =
      null;
    const upsert = vi.fn(async ({ create }) => {
      published = {
        id: randomUUID(),
        version: 1,
        fingerprint: create.fingerprint,
      };
      return published;
    });
    const findUnique = vi.fn(async ({ where }) =>
      'createdByUserId_createKey' in where
        ? published
        : {
            branchId,
            manifestTemplateId: templateId,
            manifestTemplateName: 'قالب اسپارتا',
            manifestTemplateVersion: 3,
            manifestTemplateFileReferenceId: fileReferenceId,
          },
    );
    const directory = {
      manifestTemplateById: vi.fn().mockResolvedValue({
        id: templateId,
        name: 'قالب اسپارتا',
        versionNumber: 3,
        fileReferenceId,
      }),
    };
    const service = new TicketPublicService(
      { client: { ticketPublishedOffer: { upsert, findUnique } } } as never,
      directory as never,
    );
    const actor = {
      userId: randomUUID(),
      branchIds: [branchId],
      permissions: ['ticket_catalog.manage'],
    } as never;
    const key = randomUUID();
    const first = await service.publish(input, actor, branchId, key);
    expect(directory.manifestTemplateById).toHaveBeenCalledWith(
      templateId,
      'IRAN AIRTOUR',
      input.destinationId,
      '2099-10-01',
    );
    expect(upsert.mock.calls[0]?.[0].create).toMatchObject({
      manifestTemplateId: templateId,
      manifestTemplateName: 'قالب اسپارتا',
      manifestTemplateVersion: 3,
      manifestTemplateFileReferenceId: fileReferenceId,
    });
    directory.manifestTemplateById.mockRejectedValue(
      new Error('template now inactive'),
    );
    await expect(service.publish(input, actor, branchId, key)).resolves.toEqual(
      first,
    );
    await expect(
      service.manifestTemplateForOffer(randomUUID(), [branchId]),
    ).resolves.toEqual({
      id: templateId,
      name: 'قالب اسپارتا',
      versionNumber: 3,
      fileReferenceId,
    });
    expect(directory.manifestTemplateById).toHaveBeenCalledTimes(1);
  });
});
