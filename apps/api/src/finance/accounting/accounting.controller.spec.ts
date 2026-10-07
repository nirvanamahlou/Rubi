import 'reflect-metadata';
import { buffer } from 'node:stream/consumers';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  ForbiddenException,
  UnauthorizedException,
  type INestApplication,
} from '@nestjs/common';
import request from 'supertest';
import { unzipSync, strFromU8 } from 'fflate';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { IamService } from '../../iam/iam.service';
import { AuthGuard } from '../../iam/auth.guard';
import { PermissionGuard } from '../../iam/permission.guard';
import { ACCESS_COOKIE } from '../../iam/iam.constants';
import type { AuthenticatedActor, IamPermissionCode } from '@nora/contracts';
const books = vi.fn().mockResolvedValue({ books: [], branches: [] });
const report = vi.fn().mockResolvedValue({ rows: [], debit: '0', credit: '0' });
describe('Accounting HTTP authentication and export permissions', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AccountingController],
      providers: [
        AuthGuard,
        PermissionGuard,
        { provide: AccountingService, useValue: { books, report } },
        {
          provide: IamService,
          useValue: {
            authenticate: async (token: string) => {
              if (!['read', 'export'].includes(token))
                throw new UnauthorizedException();
              return {
                permissions: [
                  'finance.read',
                  'finance.journal.read',
                  ...(token === 'export' ? ['finance.export'] : []),
                ],
                branchIds: ['synthetic'],
              } as AuthenticatedActor;
            },
            assertPermissions: (
              actor: AuthenticatedActor,
              codes: IamPermissionCode[],
            ) => {
              if (codes.some((c) => !actor.permissions.includes(c)))
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
  it('rejects missing and invalid session cookies', async () => {
    await request(app.getHttpServer())
      .get('/finance/accounting/books')
      .expect(401);
    await request(app.getHttpServer())
      .get('/finance/accounting/books')
      .set('Cookie', `${ACCESS_COOKIE}=invalid`)
      .expect(401);
  });
  it('passes the authenticated branch scope to the service', async () => {
    await request(app.getHttpServer())
      .get('/finance/accounting/books')
      .set('Cookie', `${ACCESS_COOKIE}=read`)
      .expect(200);
    expect(books).toHaveBeenCalledWith(
      expect.objectContaining({ branchIds: ['synthetic'] }),
    );
  });
  it('denies exports to a read-only actor and streams a workbook to an exporter', async () => {
    await request(app.getHttpServer())
      .get('/finance/accounting/books/book/reports/trial-balance/export')
      .set('Cookie', `${ACCESS_COOKIE}=read`)
      .expect(403);
    const r = await request(app.getHttpServer())
      .get('/finance/accounting/books/book/reports/trial-balance/export')
      .set('Cookie', `${ACCESS_COOKIE}=export`)
      .expect(200);
    expect(r.headers['content-type']).toContain('spreadsheetml');
    expect(r.headers['cache-control']).toBe('private, no-store');
    expect(r.headers['content-disposition']).toContain('.xlsx');
  });
  it('localizes export labels and direction without translating stored account titles', async () => {
    report.mockResolvedValueOnce({
      rows: [
        {
          code: '001',
          title: 'نام ثبت‌شده',
          opening: '0',
          debit: '1',
          credit: '0',
          balance: '1',
        },
      ],
      debit: '1',
      credit: '0',
    });
    const file = await new AccountingController({
      report,
    } as never).exportReport('book', {}, {
      actor: {},
      headers: { 'accept-language': 'en' },
    } as never);
    const sheet = strFromU8(
      unzipSync(await buffer(file.getStream()))['xl/worksheets/sheet1.xml']!,
    );
    expect(sheet).toContain('rightToLeft="0"');
    expect(sheet).toContain('Debit');
    expect(sheet).toContain('نام ثبت‌شده');
    expect(sheet).not.toContain('بدهکار');
  });
});
