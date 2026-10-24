import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { type INestApplication, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from 'vitest';
import {
  MANUAL_ACCESS_VERSION,
  type AuthenticatedActor,
} from '@nora/contracts';
import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
import { MasterSalesDirectory } from '../master-data/master-sales-directory';
import { CustomerService } from '../customers/customer.service';
import { SalesAgencyCustomerController } from './sales-agency-customer.controller';
describe('Sales agency buyer HTTP endpoint', () => {
  let app: INestApplication;
  let actor: AuthenticatedActor;
  const org = '00000000-0000-4000-8000-000000000001';
  const detail = vi.fn();
  const resolveSalesOrganization = vi.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SalesAgencyCustomerController],
      providers: [
        AuthGuard,
        { provide: IamService, useValue: { authenticate: async () => actor } },
        { provide: MasterSalesDirectory, useValue: { detail } },
        { provide: CustomerService, useValue: { resolveSalesOrganization } },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    actor = {
      userId: org,
      sessionId: 'session',
      branchIds: [org],
      permissions: [
        MANUAL_ACCESS_VERSION,
        'sales.contracts.create',
        'ui.screen.sales.new-contract',
      ],
    };
    detail
      .mockReset()
      .mockResolvedValue({ data: { id: org, name: 'Synthetic Agency' } });
    resolveSalesOrganization
      .mockReset()
      .mockResolvedValue({ data: { id: 'buyer', organizationId: org } });
  });
  const post = (id = org) =>
    request(app.getHttpServer())
      .post('/sales/agency-customers/' + id)
      .set('Cookie', 'nora_access=synthetic');
  it('resolves an existing or newly registered buyer for a contract creator without general customer grants', async () => {
    const result = await post().expect(201);
    expect(result.body.data.id).toBe('buyer');
    expect(detail).toHaveBeenCalledWith('organizations', org);
    expect(resolveSalesOrganization).toHaveBeenCalledWith(
      { id: org, name: 'Synthetic Agency' },
      actor,
      undefined,
      undefined,
    );
  });
  it('rejects invalid IDs and inactive organizations before customer writes', async () => {
    await post('not-a-uuid').expect(400);
    expect(detail).not.toHaveBeenCalled();
    detail.mockRejectedValueOnce(new NotFoundException());
    await post().expect(404);
    expect(resolveSalesOrganization).not.toHaveBeenCalled();
  });
  it('denies read-only actors, explicit screen deny, missing branches and foreign branch headers', async () => {
    actor.permissions = ['sales.contracts.read.own'];
    await post().expect(403);
    actor.permissions = [
      MANUAL_ACCESS_VERSION,
      'sales.contracts.create',
      'ui.screen.sales.new-contract',
      'ui.deny.sales.new-contract',
    ];
    await post().expect(403);
    actor.permissions = [
      MANUAL_ACCESS_VERSION,
      'sales.contracts.create',
      'ui.screen.sales.new-contract',
    ];
    await post().set('x-branch-id', 'outside').expect(403);
    actor.branchIds = [];
    await post().expect(403);
    expect(detail).not.toHaveBeenCalled();
    expect(resolveSalesOrganization).not.toHaveBeenCalled();
  });
});
