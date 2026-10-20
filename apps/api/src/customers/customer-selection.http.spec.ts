import 'reflect-metadata';
import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  MANUAL_ACCESS_VERSION,
  type AuthenticatedActor,
} from '@nora/contracts';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { IamService } from '../iam/iam.service';
import { CustomerService } from './customer.service';
import { CustomerSelectionController } from './customer-selection.controller';
import { CustomersController } from './customers.controller';

describe('customer choice HTTP authority', () => {
  it('allows scoped accounting labels without opening the customer dossier or writes', async () => {
    const actor: AuthenticatedActor = {
      userId: 'user',
      sessionId: 'test',
      branchIds: ['00000000-0000-4000-8000-000000000001'],
      permissions: ['finance.account.manage'],
    };
    const selectionOptions = vi
      .fn()
      .mockResolvedValue([{ id: 'id', displayName: 'Label' }]);
    const service = new CustomerService(
      { selectionOptions } as never,
      {} as never,
      {} as never,
    );
    const module = await Test.createTestingModule({
      controllers: [CustomerSelectionController, CustomersController],
      providers: [
        AuthGuard,
        PermissionGuard,
        { provide: CustomerService, useValue: service },
        {
          provide: IamService,
          useValue: {
            authenticate: async () => actor,
            assertPermissions: (user: AuthenticatedActor, codes: string[]) => {
              if (
                codes.some(
                  (code) => !user.permissions.some((grant) => grant === code),
                )
              )
                throw new ForbiddenException();
            },
          },
        },
      ],
    }).compile();
    const app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    const get = (path: string) =>
      request(app.getHttpServer())
        .get(path)
        .set('Cookie', 'nora_access=synthetic');
    try {
      const result = await get(
        '/customers/selections/accounting?kind=person',
      ).expect(200);
      expect(result.body.data).toEqual([{ id: 'id', displayName: 'Label' }]);
      expect(result.headers['cache-control']).toBe('private, no-store');
      await get('/customers').expect(403);
      await get('/customers/person-id').expect(403);
      await request(app.getHttpServer())
        .post('/customers')
        .set('Cookie', 'nora_access=synthetic')
        .send({})
        .expect(403);
      await get(
        '/customers/selections/accounting?branchId=00000000-0000-4000-8000-000000000002',
      ).expect(403);
      await get('/customers/selections/accounting?pageSize=1000').expect(400);
      actor.permissions = [MANUAL_ACCESS_VERSION, 'finance.account.manage'];
      await get('/customers/selections/accounting').expect(403);
      expect(selectionOptions).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });
});
