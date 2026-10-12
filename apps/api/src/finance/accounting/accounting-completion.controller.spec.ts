import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  ForbiddenException,
  UnauthorizedException,
  type INestApplication,
} from '@nestjs/common';
import request from 'supertest';
import type { AuthenticatedActor, IamPermissionCode } from '@nora/contracts';
import { AccountingCompletionController } from './accounting-completion.controller';
import { AccountingCompletionService } from './accounting-completion.service';
import { AuthGuard } from '../../iam/auth.guard';
import { PermissionGuard } from '../../iam/permission.guard';
import { IamService } from '../../iam/iam.service';
import { ACCESS_COOKIE } from '../../iam/iam.constants';

describe('completion HTTP permission boundary', () => {
  let app: INestApplication;
  const journalLines = vi.fn(async () => ({ rows: [], total: 0 }));
  const yearEndReadiness = vi.fn(async () => ({
    diagnosticOnly: true,
    executionAvailable: false,
  }));
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AccountingCompletionController],
      providers: [
        AuthGuard,
        PermissionGuard,
        {
          provide: AccountingCompletionService,
          useValue: { journalLines, yearEndReadiness },
        },
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
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  it('requires authentication and journal-read permission on both endpoints', async () => {
    for (const path of ['journal-lines?periodId=period', 'year-end/period']) {
      const route = `/finance/accounting/books/book/completion/${path}`;
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
  it('passes actor scope and filters to the service and forbids shared caching', async () => {
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
  });
});
