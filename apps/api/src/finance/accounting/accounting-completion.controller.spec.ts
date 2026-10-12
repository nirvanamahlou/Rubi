import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  Module,
  ForbiddenException,
  UnauthorizedException,
  type INestApplication,
} from '@nestjs/common';
import request from 'supertest';
import type { AuthenticatedActor, IamPermissionCode } from '@nora/contracts';
import { FinanceModule } from '../finance.module';
import { AccountingCompletionModule } from './accounting-completion.module';
import { AccountingCompletionService } from './accounting-completion.service';
import { AccountingTaxpayerService } from './accounting-taxpayer.service';
import { IamModule } from '../../iam/iam.module';
import { IamService } from '../../iam/iam.service';
import { DatabaseModule } from '../../database/database.module';
import { ACCESS_COOKIE } from '../../iam/iam.constants';

@Module({})
class EmptyModule {}
@Module({
  providers: [
    {
      provide: IamService,
      useValue: {
        authenticate: async (token: string) => {
          if (!['reader', 'other'].includes(token))
            throw new UnauthorizedException();
          return {
            branchIds: ['synthetic'],
            permissions:
              token === 'reader'
                ? ['finance.read', 'finance.journal.read']
                : ['finance.read'],
          };
        },
        assertPermissions: (
          actor: AuthenticatedActor,
          codes: IamPermissionCode[],
        ) => {
          if (codes.some((code) => !actor.permissions.includes(code)))
            throw new ForbiddenException();
        },
      },
    },
  ],
  exports: [IamService],
})
class TestIamModule {}

describe('registered completion module HTTP boundary', () => {
  let app: INestApplication;
  const journalLines = vi.fn(async () => ({ rows: [], total: 0 }));
  const yearEndReadiness = vi.fn(async () => ({
    diagnosticOnly: true,
    executionAvailable: false,
  }));
  const saveSeller = vi.fn();
  beforeAll(async () => {
    // Discover the module through the real parent registration; omitting it must make HTTP tests fail.
    const imports = (
      Reflect.getMetadata(
        'imports',
        FinanceModule,
      ) as (typeof AccountingCompletionModule)[]
    ).filter((module) => module === AccountingCompletionModule);
    expect(imports).toHaveLength(1);
    const module = await Test.createTestingModule({ imports })
      .overrideModule(IamModule)
      .useModule(TestIamModule)
      .overrideModule(DatabaseModule)
      .useModule(EmptyModule)
      .overrideProvider(AccountingCompletionService)
      .useValue({ journalLines, yearEndReadiness })
      .overrideProvider(AccountingTaxpayerService)
      .useValue({ seller: async () => null, saveSeller })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  it('requires authentication and journal-read permission on every mounted read endpoint', async () => {
    for (const path of [
      'completion/journal-lines?periodId=period',
      'completion/year-end/period',
      'taxpayer/seller',
    ]) {
      const route = `/finance/accounting/books/book/${path}`;
      await request(app.getHttpServer()).get(route).expect(401);
      await request(app.getHttpServer())
        .get(route)
        .set('Cookie', `${ACCESS_COOKIE}=invalid`)
        .expect(401);
      await request(app.getHttpServer())
        .get(route)
        .set('Cookie', `${ACCESS_COOKIE}=other`)
        .expect(403);
    }
    expect(journalLines).not.toHaveBeenCalled();
    expect(yearEndReadiness).not.toHaveBeenCalled();
  });
  it('forwards book/filter/actor scope, forbids caching and keeps seller writes protected', async () => {
    const report = await request(app.getHttpServer())
      .get(
        '/finance/accounting/books/book/completion/journal-lines?periodId=period&page=2',
      )
      .set('Cookie', `${ACCESS_COOKIE}=reader`)
      .expect(200);
    expect(report.headers['cache-control']).toBe('private, no-store');
    expect(journalLines).toHaveBeenCalledWith(
      'book',
      { periodId: 'period', page: '2' },
      expect.objectContaining({ branchIds: ['synthetic'] }),
    );
    const readiness = await request(app.getHttpServer())
      .get('/finance/accounting/books/book/completion/year-end/period')
      .set('Cookie', `${ACCESS_COOKIE}=reader`)
      .expect(200);
    expect(readiness.body.executionAvailable).toBe(false);
    expect(readiness.headers['cache-control']).toBe('private, no-store');
    await request(app.getHttpServer())
      .get('/finance/accounting/books/book/taxpayer/seller')
      .set('Cookie', `${ACCESS_COOKIE}=reader`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/finance/accounting/books/book/taxpayer/seller')
      .set('Cookie', `${ACCESS_COOKIE}=reader`)
      .send({})
      .expect(403);
    expect(saveSeller).not.toHaveBeenCalled();
  });
});
