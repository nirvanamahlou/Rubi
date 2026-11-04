import {
  ForbiddenException,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
import { PermissionGuard } from '../iam/permission.guard';
import { CustomerService } from './customer.service';
import { CustomersController } from './customers.controller';
import { SalesPeopleController } from './sales-people.controller';
let app: INestApplication;
const person = '11111111-1111-4111-8111-111111111111';
let actor: AuthenticatedActor;
const service = {
  salesEntryActor: CustomerService.prototype.salesEntryActor,
  list: vi.fn().mockResolvedValue({ data: [] }),
  createForSales: vi.fn().mockResolvedValue({ data: { id: person } }),
  update: vi.fn().mockResolvedValue({ data: { id: person } }),
  detail: vi.fn().mockResolvedValue({ data: { id: person, kind: 'person' } }),
  registrationLookup: vi.fn().mockResolvedValue({ data: null }),
  addContact: vi.fn().mockResolvedValue({ data: { id: person } }),
};
beforeEach(async () => {
  actor = {
    userId: person,
    sessionId: person,
    branchIds: [person],
    permissions: ['sales.contracts.create'],
  };
  const module = await Test.createTestingModule({
    controllers: [SalesPeopleController, CustomersController],
    providers: [
      { provide: CustomerService, useValue: service },
      AuthGuard,
      PermissionGuard,
      {
        provide: IamService,
        useValue: {
          authenticate: vi.fn(async () => actor),
          assertPermissions: vi.fn(
            (current: AuthenticatedActor, required: string[]) => {
              if (
                required.some((p) => !current.permissions.includes(p as never))
              )
                throw new ForbiddenException();
            },
          ),
        },
      },
    ],
  }).compile();
  app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();
});
afterEach(async () => {
  await app.close();
  vi.clearAllMocks();
});
const mutation = {
  kind: 'person',
  firstName: 'Synthetic',
  lastName: 'Person',
  displayName: 'Synthetic Person',
  roles: ['passenger'],
};
it.each([false, true])(
  'completes person entry with only contract access (manual=%s)',
  async (manual) => {
    if (manual)
      actor = {
        ...actor,
        permissions: [
          'ui.manual.v3',
          'sales.contracts.create',
          'ui.screen.sales.new-contract',
          'ui.allow.sales.new-contract',
        ] as AuthenticatedActor['permissions'],
      };
    const originalPermissions = [...actor.permissions];
    const http = request(app.getHttpServer());
    await http
      .get('/sales/people?kind=organization&status=inactive')
      .set('Cookie', 'nora_access=test')
      .expect(200);
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'person', status: 'active' }),
      expect.objectContaining({ userId: person, branchIds: [person] }),
    );
    await http
      .post('/sales/people')
      .set('Cookie', 'nora_access=test')
      .send(mutation)
      .expect(201);
    await http
      .get('/sales/people/' + person)
      .set('Cookie', 'nora_access=test')
      .expect(200);
    await http
      .patch('/sales/people/' + person)
      .set('Cookie', 'nora_access=test')
      .send({
        ...mutation,
        version: 1,
        gender: 'M',
        passportFirstName: 'SYNTHETIC',
        passportLastName: 'PERSON',
      })
      .expect(200);
    expect(service.update).toHaveBeenCalledWith(
      person,
      expect.objectContaining({ passportFirstName: 'SYNTHETIC' }),
      expect.objectContaining({
        permissions: expect.arrayContaining([
          'customers.update',
          'customers.sensitive.read',
        ]),
      }),
      undefined,
      undefined,
    );
    await http
      .post('/sales/people/' + person + '/contacts')
      .set('Cookie', 'nora_access=test')
      .send({ type: 'phone', value: '09120000000', version: 1 })
      .expect(201);
    await http
      .post('/sales/people/registration-lookup')
      .set('Cookie', 'nora_access=test')
      .send({
        firstName: 'Synthetic',
        lastName: 'Person',
        nationalId: '0012345678',
      })
      .expect(201);
    await http
      .post('/customers')
      .set('Cookie', 'nora_access=test')
      .send(mutation)
      .expect(403);
    expect(actor.permissions).toEqual(originalPermissions);
  },
);
it('rejects organization mutation, missing capability, missing branch, anonymous requests and unexposed admin routes', async () => {
  const http = request(app.getHttpServer());
  await http
    .post('/sales/people')
    .set('Cookie', 'nora_access=test')
    .send({ kind: 'organization', displayName: 'Agency', roles: ['customer'] })
    .expect(400);
  await http
    .post('/sales/people/' + person + '/status')
    .set('Cookie', 'nora_access=test')
    .send({})
    .expect(404);
  await http.get('/sales/people').expect(401);
  actor = { ...actor, permissions: [] };
  await http.get('/sales/people').set('Cookie', 'nora_access=test').expect(403);
  actor = { ...actor, permissions: ['sales.contracts.create'], branchIds: [] };
  await http.get('/sales/people').set('Cookie', 'nora_access=test').expect(403);
});
it('forwards a validated registration receipt with contract-only permission', async () => {
  const key = '55555555-5555-4555-8555-555555555555';
  await request(app.getHttpServer())
    .post('/sales/people')
    .set('Cookie', 'nora_access=test')
    .set('x-registration-key', key)
    .send(mutation)
    .expect(201);
  expect(service.createForSales).toHaveBeenCalledWith(
    mutation,
    expect.objectContaining({
      permissions: expect.arrayContaining([
        'customers.create',
        'customers.update',
      ]),
    }),
    undefined,
    undefined,
    key,
  );
  await request(app.getHttpServer())
    .post('/sales/people')
    .set('Cookie', 'nora_access=test')
    .set('x-registration-key', 'invalid')
    .send(mutation)
    .expect(400);
});
