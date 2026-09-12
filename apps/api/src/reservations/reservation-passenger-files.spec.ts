import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedActor, CustomerDetail } from '@rubi/contracts';
import type { CustomerService } from '../customers/customer.service';
import type { DocumentsService } from '../documents/documents.service';
import type { TravelWorkflowService } from './travel-workflow.service';
import {
  ReservationPassengerFilesService,
  passengerDocumentSource,
} from './reservation-passenger-files';
function setup() {
  const contractId = randomUUID(),
    id = randomUUID(),
    pid = randomUUID(),
    branch = randomUUID(),
    actor = {
      userId: randomUUID(),
      sessionId: randomUUID(),
      branchIds: [branch],
      permissions: [
        'reservations.read',
        'customers.read',
        'customers.update',
        'documents.upload',
        'documents.list',
        'reservations.documents.manage',
      ],
    } as AuthenticatedActor;
  const customer = {
    id: pid,
    kind: 'person',
    organizationId: null,
    firstName: 'Actual',
    lastName: 'Passenger',
    displayName: 'Actual Passenger',
    roles: ['passenger'],
    acquaintanceMethodId: randomUUID(),
    version: 4,
    ownerBranchId: branch,
    birthDate: '2001-01-01',
    birthDateMasked: false,
    nationalId: 'not-returned',
    maskedNationalId: '00*****99',
    passportNumber: 'not-returned',
    maskedPassportNumber: 'P1*****78',
    passportExpiryDate: '2031-02-03',
  } as CustomerDetail;
  const workflow = {
    detail: vi.fn().mockResolvedValue({
      id,
      branchId: branch,
      contractId,
      snapshot: {
        contractId,
        contractNumber: 'QA-001',
        passengerIds: [pid],
        passengerAssignments: [
          {
            customerId: pid,
            ageCategory: 'ADT',
            serviceClientKeys: [],
          },
        ],
      },
    }),
  };
  const customers = {
    detail: vi.fn().mockResolvedValue({ data: customer }),
    update: vi.fn().mockResolvedValue({
      data: {
        ...customer,
        firstName: 'Edited',
        displayName: 'Edited Passenger',
        version: 5,
      },
    }),
  };
  const documents = {
    list: vi
      .fn()
      .mockResolvedValue({ data: [], meta: { total: 0, totalPages: 0 } }),
    options: vi.fn().mockResolvedValue({
      data: {
        documentTypes: [
          {
            id: randomUUID(),
            name: 'Passport',
            domain: 'CUSTOMER_IDENTITY',
            requiresExpiry: true,
          },
        ],
      },
    }),
    upload: vi.fn().mockResolvedValue({ data: { id: 'doc' } }),
  };
  return {
    contractId,
    id,
    pid,
    branch,
    actor,
    customer,
    workflow,
    customers,
    documents,
    service: new ReservationPassengerFilesService(
      workflow as unknown as TravelWorkflowService,
      customers as unknown as CustomerService,
      documents as unknown as DocumentsService,
    ),
  };
}
describe('Reservations passenger and document consumers', () => {
  it('loads names, contract age and masked identity without leaking full values', async () => {
    const s = setup();
    const r = await s.service.passengers(s.id, s.actor);
    expect(r.canEdit).toBe(true);
    expect(r.data[0]).toEqual({
      id: s.pid,
      firstName: 'Actual',
      lastName: 'Passenger',
      displayName: 'Actual Passenger',
      ageCategory: 'ADL',
      gender: null,
      birthDate: null,
      birthDateMasked: true,
      nationalId: '00*****99',
      nationalIdMasked: true,
      passportNumber: 'P1*****78',
      passportNumberMasked: true,
      passportExpiryDate: '2031-02-03',
      passportIssuePlace: null,
      passportFirstName: null,
      passportLastName: null,
      nationalityCode: null,
      birthCountryCode: null,
      version: 4,
    });
    expect(JSON.stringify(r)).not.toContain('not-returned');
    expect(s.workflow.detail).toHaveBeenCalledWith(s.id, [s.branch]);
    expect(s.customers.detail).toHaveBeenCalledWith(
      s.pid,
      s.actor,
      undefined,
      undefined,
    );
  });
  it('returns full identity only with the existing sensitive-read permission and audit reason', async () => {
    const s = setup();
    const actor = {
      ...s.actor,
      permissions: [...s.actor.permissions, 'customers.sensitive.read'],
    } as AuthenticatedActor;
    const r = await s.service.passengers(s.id, actor, 'trace-1');
    expect(r.data[0]).toMatchObject({
      birthDate: '2001-01-01',
      birthDateMasked: false,
      nationalId: 'not-returned',
      nationalIdMasked: false,
      passportNumber: 'not-returned',
      passportNumberMasked: false,
    });
    expect(s.customers.detail).toHaveBeenCalledWith(
      s.pid,
      actor,
      'trace-1',
      'customer-verification',
    );
  });
  it('requires name edit grants before calling customer mutation', async () => {
    const s = setup();
    await expect(
      s.service.rename(
        s.id,
        s.pid,
        { firstName: 'Edited', lastName: 'Passenger', version: 4 },
        { ...s.actor, permissions: ['reservations.read'] },
      ),
    ).rejects.toThrow();
    expect(s.customers.update).not.toHaveBeenCalled();
  });
  it('rejects a passenger from another contract before accessing their profile', async () => {
    const s = setup();
    await expect(
      s.service.rename(s.id, randomUUID(), {}, s.actor),
    ).rejects.toThrow();
    expect(s.customers.detail).not.toHaveBeenCalled();
    expect(s.customers.update).not.toHaveBeenCalled();
  });
  it('keeps identity, role and acquaintance data while forwarding optimistic version', async () => {
    const s = setup();
    await s.service.rename(
      s.id,
      s.pid,
      { firstName: 'Edited', lastName: 'Passenger', version: 3 },
      s.actor,
    );
    const input = s.customers.update.mock.calls[0]![1];
    expect(input).toMatchObject({
      firstName: 'Edited',
      lastName: 'Passenger',
      version: 3,
      roles: s.customer.roles,
      acquaintanceMethodId: s.customer.acquaintanceMethodId,
    });
    expect(input).not.toHaveProperty('birthDate');
    expect(input).not.toHaveProperty('nationalId');
    expect(input).not.toHaveProperty('passportNumber');
  });
  it('propagates concurrent customer conflicts without retrying the mutation', async () => {
    const s = setup();
    s.customers.update.mockRejectedValueOnce(new Error('VERSION_CONFLICT'));
    await expect(
      s.service.rename(
        s.id,
        s.pid,
        { firstName: 'Edited', lastName: 'Passenger', version: 3 },
        s.actor,
      ),
    ).rejects.toThrow('VERSION_CONFLICT');
    expect(s.customers.update).toHaveBeenCalledTimes(1);
  });
  it('scopes list to the exact contract/passenger case and allowed branch', async () => {
    const s = setup(),
      category = randomUUID();
    await s.service.list(s.id, s.pid, category, '2', s.actor);
    expect(s.documents.list).toHaveBeenCalledWith(
      expect.objectContaining({
        ...passengerDocumentSource(s.contractId, s.pid),
        branchId: s.branch,
        categoryId: category,
        page: 2,
      }),
      s.actor,
    );
    expect(passengerDocumentSource(s.contractId)).not.toEqual(
      passengerDocumentSource(s.contractId, s.pid),
    );
  });
  it('blocks uploads for passengers outside this contract', async () => {
    const s = setup();
    await expect(
      s.service.upload(
        s.id,
        {
          passengerId: randomUUID(),
          documentTypeId: randomUUID(),
          categoryId: randomUUID(),
        },
        undefined,
        s.actor,
        {},
      ),
    ).rejects.toThrow();
    expect(s.documents.upload).not.toHaveBeenCalled();
  });
  it('validates required expiry and creates one owner-controlled archive upload', async () => {
    const s = setup(),
      type = (await s.documents.options()).data.documentTypes[0]!;
    const payload = {
      passengerId: s.pid,
      documentTypeId: type.id,
      categoryId: randomUUID(),
    };
    await expect(
      s.service.upload(s.id, payload, undefined, s.actor, {}),
    ).rejects.toThrow('انقضا');
    const file = {
      buffer: Buffer.from('synthetic'),
      mimetype: 'application/pdf',
      originalname: 'qa.pdf',
      size: 9,
    };
    await s.service.upload(
      s.id,
      { ...payload, validUntil: '2030-01-01' },
      file,
      s.actor,
      {},
    );
    expect(s.documents.upload).toHaveBeenCalledTimes(1);
    expect(s.documents.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        ...passengerDocumentSource(s.contractId, s.pid),
        branchId: s.branch,
        ownerUserId: s.actor.userId,
        sourceDisplayLabel: 'QA-001 · Actual Passenger',
        confidentiality: 'RESTRICTED',
      }),
      file,
      s.actor,
      {},
    );
  });
});
