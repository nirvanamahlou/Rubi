import {
  ValidationPipe,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { AuthenticatedActor } from '@rubi/contracts';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../src/iam/auth.guard';
import { PermissionGuard } from '../src/iam/permission.guard';
import { IamService } from '../src/iam/iam.service';
import { MasterDataController } from '../src/master-data/master-data.controller';
import type { MasterDataRepository } from '../src/master-data/master-data.repository';
import { MasterDataService } from '../src/master-data/master-data.service';

const id = '11111111-1111-4111-8111-111111111111';
describe('meal/service HTTP and permission contract', () => {
  let app: INestApplication;
  let actor: AuthenticatedActor;
  const repository = {
    fieldExists: vi.fn().mockResolvedValue(false),
    create: vi
      .fn()
      .mockImplementation(async (_resource, data) => ({
        id,
        ...data,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    update: vi
      .fn()
      .mockImplementation(async (_resource, _id, data) => ({
        id,
        code: 'BB',
        name: 'Meal',
        ...data,
        version: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    list: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  };
  beforeEach(async () => {
    actor = {
      userId: id,
      sessionId: id,
      branchIds: [id],
      permissions: [
        'master_data.read',
        'master_data.create',
        'master_data.update',
        'master_data.status.manage',
      ],
    };
    const module = await Test.createTestingModule({
      controllers: [MasterDataController],
      providers: [
        {
          provide: MasterDataService,
          useValue: new MasterDataService(
            repository as unknown as MasterDataRepository,
          ),
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest().actor = actor;
          return true;
        },
      })
      .overrideGuard(PermissionGuard)
      .useValue(
        new PermissionGuard(new Reflector(), {
          assertPermissions: IamService.prototype.assertPermissions,
        } as IamService),
      )
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });
  it('accepts standard code, multi-selection and review status in the actual create route', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/master-data/meal-services')
      .send({
        values: {
          code: 'bb',
          name: 'وعده آزمون',
          category: 'MEAL_PLAN',
          includedMeals: '["صبحانه","شام"]',
          status: 'under_review',
        },
      })
      .expect(201);
    expect(response.body.data).toMatchObject({
      code: 'BB',
      status: 'inactive',
      attributes: {
        includedMealsJson: '["صبحانه","شام"]',
        isUnderReview: true,
      },
    });
  });
  it('requires create permission even when status management is granted', async () => {
    actor = { ...actor, permissions: ['master_data.status.manage'] };
    await request(app.getHttpServer())
      .post('/api/v1/master-data/meal-services')
      .send({ values: { code: 'BB', name: 'Meal', category: 'MEAL_PLAN' } })
      .expect(403);
    expect(repository.create).not.toHaveBeenCalled();
  });
  it('prevents status smuggling through the ordinary edit endpoint', async () => {
    actor = { ...actor, permissions: ['master_data.update'] };
    await request(app.getHttpServer())
      .patch(`/api/v1/master-data/meal-services/${id}`)
      .send({
        values: { englishName: 'Changed', status: 'under_review' },
        version: 1,
      })
      .expect(403);
    expect(repository.update).not.toHaveBeenCalled();
  });
  it('requires optimistic version and preserves explicit empty meal selection', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/master-data/meal-services/${id}`)
      .send({ values: { includedMeals: [] } })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/v1/master-data/meal-services/${id}`)
      .send({ values: { includedMeals: [] }, version: 1 })
      .expect(200);
    expect(repository.update.mock.calls[0]?.[2]).toEqual({ includedMeals: [] });
  });
  it('supports the dedicated filter but rejects unknown lifecycle values', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/master-data/meal-services?mealServiceStatus=under_review')
      .expect(200);
    expect(repository.list).toHaveBeenCalledWith(
      'meal-services',
      expect.objectContaining({ mealServiceStatus: 'under_review' }),
    );
    await request(app.getHttpServer())
      .get('/api/v1/master-data/meal-services?mealServiceStatus=invalid')
      .expect(400);
  });
});
