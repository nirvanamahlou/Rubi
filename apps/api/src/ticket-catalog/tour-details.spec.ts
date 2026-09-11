import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@rubi/contracts';
import type { DatabaseService } from '../database/database.service';
import type { MasterTravelDirectory } from '../master-data/master-travel-directory';
import type { DocumentsService } from '../documents/documents.service';
import { TourPublicService } from './tour-public.service';

const id = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const actor: AuthenticatedActor = {
  userId: id,
  sessionId: id,
  branchIds: [id],
  permissions: [
    'ticket_catalog.manage',
    'ticket_catalog.read',
    'documents.metadata.read',
  ],
};
const input = {
  name: 'Synthetic tour',
  originId: id,
  destinationId: other,
  hotelIds: [],
  transferOutbound: false,
  transferReturn: false,
  visa: false,
  details: {
    version: 1,
    summary: 'Summary',
    basePrice: { amount: '111.125', currency: 'USD' },
    itinerary: [
      { title: 'First', startTime: '09:30' },
      { title: 'Second', stayDays: 2 },
    ],
  },
};
function setup(imagePatch = {}) {
  let saved: unknown;
  const upsert = vi.fn(async ({ create }: { create: object }) => {
    saved = { ...create, id, version: 1, createdAt: new Date('2026-01-01') };
    return saved;
  });
  const database = {
    client: {
      tourPackage: {
        findUnique: vi.fn(async () => null),
        upsert,
        findMany: vi.fn(async () => [saved]),
      },
    },
  } as unknown as DatabaseService;
  const references = {
    assertTourReferences: vi.fn(async () => {}),
  } as unknown as MasterTravelDirectory;
  const detail = vi.fn(async () => ({
    data: {
      type: { domain: 'BRAND' },
      branchId: id,
      archiveStatus: 'ACTIVE',
      confidentiality: 'INTERNAL',
      requiresStepUpVerification: false,
      currentVersion: { scanStatus: 'CLEAN', detectedMimeType: 'image/png' },
      capabilities: { viewFile: true },
      ...imagePatch,
    },
  }));
  const documents = { detail } as unknown as DocumentsService;
  return {
    service: new TourPublicService(database, references, documents),
    upsert,
    detail,
  };
}
describe('tour details persistence boundary', () => {
  it('writes extended definition unchanged and returns it on list/reload', async () => {
    const { service, upsert } = setup();
    const result = await service.createPackage(input, actor, id, 'test-create');
    expect(result.data.details).toEqual(input.details);
    expect((await service.packages(actor)).data[0]?.details).toEqual(
      input.details,
    );
    expect(upsert.mock.calls[0]?.[0].create).toMatchObject({
      definition: input,
    });
  });
  it('uses public Documents validation before saving an image reference', async () => {
    const { service, detail } = setup();
    await service.createPackage(
      { ...input, details: { ...input.details, imageDocumentId: other } },
      actor,
      id,
      'image',
    );
    expect(detail).toHaveBeenCalledWith(other, actor, {});
  });
  it.each([
    { type: { domain: 'CUSTOMER' } },
    { branchId: other },
    { archiveStatus: 'ARCHIVED' },
    { confidentiality: 'RESTRICTED' },
    { requiresStepUpVerification: true },
    { capabilities: { viewFile: false } },
    {
      currentVersion: { scanStatus: 'PENDING', detectedMimeType: 'image/png' },
    },
    {
      currentVersion: {
        scanStatus: 'CLEAN',
        detectedMimeType: 'image/svg+xml',
      },
    },
  ])('rejects unauthorized or unsafe images %j', async (patch) => {
    const { service, upsert } = setup(patch);
    await expect(
      service.createPackage(
        { ...input, details: { ...input.details, imageDocumentId: other } },
        actor,
        id,
        'image',
      ),
    ).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });
  it('requires image metadata permission without expanding tour access', async () => {
    const { service, upsert } = setup();
    await expect(
      service.createPackage(
        { ...input, details: { ...input.details, imageDocumentId: other } },
        { ...actor, permissions: ['ticket_catalog.manage'] },
        id,
        'image',
      ),
    ).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });
});
