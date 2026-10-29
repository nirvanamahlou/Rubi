import { expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { SalesService } from './sales.service';
import { SalesPaymentReceiptsService } from './sales-payment-receipts';
import type {
  DocumentsService,
  UploadedDocumentFile,
} from '../documents/documents.service';
const actor = {
  userId: 'reader',
  branchIds: ['branch'],
  permissions: ['sales.contracts.read.branch'],
} as unknown as AuthenticatedActor;
const row = {
  branchId: 'branch',
  ownerUserId: 'other',
  contractNumber: 'SYNTHETIC',
  payments: [
    {
      id: 'payment',
      dueAt: new Date('2099-01-01'),
      paymentReference: 'SYNTHETIC-REF',
    },
  ],
};
function setup() {
  const findById = vi.fn(async () => row);
  const sales = Object.assign(Object.create(SalesService.prototype), {
    repository: { findById },
  });
  const options = vi.fn(async () => ({
    data: {
      currentUserId: 'reader',
      branches: [{ id: 'branch' }, { id: 'elsewhere' }],
      owners: [{ id: 'reader' }, { id: 'other' }],
      organizationBranches: [],
      documentTypes: [
        {
          id: 'receipt',
          code: 'RECEIPT',
          domain: 'FINANCE',
          requiresExpiry: false,
        },
        { id: 'foreign', code: 'OTHER', domain: 'GENERAL' },
      ],
      categories: [
        { id: 'category', code: 'PROCUREMENT_FINANCE' },
        { id: 'other', code: 'GENERAL' },
      ],
      uploadPolicy: {},
    },
  }));
  const documents = {
    options,
    list: vi.fn(async () => ({ data: [], meta: { total: 0 } })),
    upload: vi.fn(async () => ({ data: { id: 'document' } })),
    download: vi.fn(async () => ({ fileName: 'receipt.pdf' })),
  };
  return {
    findById,
    sales,
    documents,
    service: new SalesPaymentReceiptsService(
      sales,
      documents as unknown as DocumentsService,
    ),
  };
}
const file = {
  buffer: Buffer.from('%PDF-1.4'),
  size: 8,
  mimetype: 'application/pdf',
  originalname: 'receipt.pdf',
} satisfies UploadedDocumentFile;
it('authorizes every operation through actual contract read scope, with no global Documents grant', async () => {
  const s = setup(),
    before = structuredClone(actor);
  expect(await s.service.entries('contract', actor)).toEqual({
    data: [
      {
        id: 'payment',
        dueAt: '2099-01-01T00:00:00.000Z',
        paymentReference: 'SYNTHETIC-REF',
      },
    ],
  });
  const options = await s.service.options('contract', 'payment', actor);
  expect(options.data.documentTypes.map((t) => t.id)).toEqual(['receipt']);
  expect(options.data.owners.map((o) => o.id)).toEqual(['reader']);
  await s.service.list('contract', 'payment', actor, 2);
  expect(s.documents.list).toHaveBeenCalledWith(
    expect.objectContaining({
      branchId: 'branch',
      sourceModule: 'sales',
      sourceEntityType: 'SalesContractPaymentEntry',
      sourceEntityId: 'payment',
      page: 2,
    }),
    expect.objectContaining({
      branchIds: ['branch'],
      permissions: expect.arrayContaining([
        'documents.download',
        'documents.upload',
        'documents.finance.read',
      ]),
    }),
  );
  await s.service.upload('contract', 'payment', file, actor, {});
  expect(s.documents.upload).toHaveBeenCalledWith(
    expect.objectContaining({
      documentTypeId: 'receipt',
      categoryId: 'category',
      ownerUserId: 'reader',
      branchId: 'branch',
      confidentiality: 'RESTRICTED',
      sourceEntityId: 'payment',
    }),
    file,
    expect.anything(),
    {},
  );
  await s.service.download('contract', 'payment', 'document', actor, {});
  expect(s.documents.download).toHaveBeenCalledWith(
    'document',
    expect.anything(),
    expect.objectContaining({ sensitiveReason: expect.any(String) }),
    {
      sourceModule: 'sales',
      sourceEntityType: 'SalesContractPaymentEntry',
      sourceEntityId: 'payment',
    },
  );
  expect(actor).toEqual(before);
});
it.each(['options', 'list', 'upload', 'download'] as const)(
  'rejects foreign payment before %s touches Documents',
  async (action) => {
    const s = setup();
    const run =
      action === 'upload'
        ? () => s.service.upload('contract', 'foreign', file, actor, {})
        : action === 'download'
          ? () =>
              s.service.download('contract', 'foreign', 'document', actor, {})
          : () => s.service[action]('contract', 'foreign', actor);
    await expect(run()).rejects.toThrow();
    expect(s.documents.options).not.toHaveBeenCalled();
    expect(s.documents[action]).not.toHaveBeenCalled();
  },
);
it.each([
  {
    userId: 'reader',
    branchIds: ['elsewhere'],
    permissions: ['sales.contracts.read.branch'],
  },
  {
    userId: 'reader',
    branchIds: ['branch'],
    permissions: ['sales.contracts.read.own'],
  },
  {
    userId: 'reader',
    branchIds: ['branch'],
    permissions: ['documents.upload', 'documents.download'],
  },
])(
  'does not substitute Documents permissions for contract access',
  async (denied) => {
    const s = setup();
    await expect(
      s.service.upload(
        'contract',
        'payment',
        file,
        denied as unknown as AuthenticatedActor,
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(s.documents.options).not.toHaveBeenCalled();
    expect(s.documents.upload).not.toHaveBeenCalled();
  },
);
it('keeps the existing own and all-contract read semantics', async () => {
  const s = setup();
  await expect(
    s.sales.paymentReceiptScope(
      'contract',
      {
        ...actor,
        userId: 'other',
        permissions: ['sales.contracts.read.own'],
      } as AuthenticatedActor,
      'payment',
    ),
  ).resolves.toBeDefined();
  await expect(
    s.sales.paymentReceiptScope(
      'contract',
      {
        ...actor,
        branchIds: [],
        permissions: ['sales.contracts.read.all'],
      } as AuthenticatedActor,
      'payment',
    ),
  ).resolves.toBeDefined();
});
it('rejects unsupported file types and invalid pagination without storage changes', async () => {
  const s = setup();
  await expect(
    s.service.upload(
      'contract',
      'payment',
      { ...file, mimetype: 'image/svg+xml' },
      actor,
      {},
    ),
  ).rejects.toThrow();
  await expect(
    s.service.list('contract', 'payment', actor, NaN),
  ).rejects.toThrow();
  expect(s.documents.upload).not.toHaveBeenCalled();
  expect(s.documents.list).not.toHaveBeenCalled();
});

it('keeps cross-branch read-all receipt uploads on the contract branch with an existing branch owner', async () => {
  const s = setup();
  const options = await s.documents.options();
  s.documents.options.mockResolvedValue({
    ...options,
    data: { ...options.data, owners: [{ id: 'other' }] },
  });
  await s.service.upload(
    'contract',
    'payment',
    file,
    {
      ...actor,
      branchIds: [],
      permissions: ['sales.contracts.read.all'],
    } as AuthenticatedActor,
    {},
  );
  expect(s.documents.upload).toHaveBeenCalledWith(
    expect.objectContaining({ branchId: 'branch', ownerUserId: 'other' }),
    file,
    expect.objectContaining({ branchIds: ['branch'] }),
    {},
  );
});
