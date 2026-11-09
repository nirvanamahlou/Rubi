import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import {
  MANUAL_ACCESS_VERSION,
  type AuthenticatedActor,
} from '@nora/contracts';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { IamService } from '../iam/iam.service';
import { CustomersController } from './customers.controller';
import { CustomerService } from './customer.service';
import { CustomerDossierService } from './customer-dossier.service';
describe('customer dossier HTTP boundary', () => {
  it('enforces authentication, customer permission, dossier screen, UUID and no-store', async () => {
    const actor: AuthenticatedActor = {
      userId: 'u',
      sessionId: 's',
      branchIds: ['branch'],
      permissions: ['customers.read'],
    };
    const read = vi.fn().mockImplementation(async (customerId: string) => ({
      data: { customerId, sections: [] },
    }));
    const module = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        AuthGuard,
        PermissionGuard,
        { provide: CustomerService, useValue: {} },
        { provide: CustomerDossierService, useValue: { read } },
        {
          provide: IamService,
          useValue: {
            authenticate: async () => actor,
            assertPermissions: (a: AuthenticatedActor, codes: string[]) => {
              if (codes.some((c) => !a.permissions.some((p) => p === c)))
                throw new ForbiddenException();
            },
          },
        },
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.init();
    const id = '00000000-0000-4000-8000-000000000001';
    const get = (value = id) =>
      request(app.getHttpServer())
        .get(`/customers/${value}/dossier`)
        .set('Cookie', 'nora_access=synthetic');
    try {
      await request(app.getHttpServer())
        .get(`/customers/${id}/dossier`)
        .expect(401);
      const result = await get().expect(200);
      expect(result.headers['cache-control']).toBe('private, no-store');
      expect(result.headers.vary).toContain('Cookie');
      expect(read).toHaveBeenCalledWith(id, actor);
      await get('not-a-uuid').expect(400);
      actor.permissions = [];
      await get().expect(403);
      actor.permissions = [MANUAL_ACCESS_VERSION, 'customers.read'];
      await get().expect(403);
      expect(read).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  }, 30000);
});
