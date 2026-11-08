import { expect, it, vi } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from '../../iam/auth.guard';
import { InsuranceAutomation } from './insurance-automation';
import { InsuranceDocumentsController } from './insurance-documents.controller';
import { SalesInsuranceDocumentsController } from '../../sales/sales-insurance-documents.controller';
import { SalesService } from '../../sales/sales.service';
import { TravelWorkflowService } from '../travel-workflow.service';
const intakeId = '10000000-0000-4000-8000-000000000001';
const contractId = '10000000-0000-4000-8000-000000000002';
const policyId = '10000000-0000-4000-8000-000000000003';
it('serves an individual original PDF in Sales and Reservations without any Finance dependency and refuses an unreadable Sales contract', async () => {
  const actor = {
    userId: 'owner',
    branchIds: ['branch'],
    permissions: [
      'sales.contracts.read.own',
      'reservations.read',
      'customers.read',
    ],
  };
  const insurance = {
    prepare: vi.fn(async () => ({ total: 1, policies: [] })),
    summary: vi.fn(async () => ({ ready: true, policies: [{ id: policyId }] })),
    download: vi.fn(async () => ({
      bytes: Buffer.from('%PDF-synthetic'),
      type: 'application/pdf',
      filename: 'sandbox-insurance.pdf',
    })),
  };
  const sales = { detail: vi.fn(async () => ({ data: {} })) };
  const travel = { forContract: vi.fn(async () => ({ id: intakeId })) };
  const module = await Test.createTestingModule({
    controllers: [
      InsuranceDocumentsController,
      SalesInsuranceDocumentsController,
    ],
    providers: [
      { provide: InsuranceAutomation, useValue: insurance },
      { provide: SalesService, useValue: sales },
      { provide: TravelWorkflowService, useValue: travel },
    ],
  })
    .overrideGuard(AuthGuard)
    .useValue({
      canActivate(context: ExecutionContext) {
        context.switchToHttp().getRequest().actor = actor;
        return true;
      },
    })
    .compile();
  const app = module.createNestApplication();
  await app.init();
  try {
    for (const path of [
      `/reservations/requests/${intakeId}/insurance`,
      `/sales/contracts/${contractId}/insurance`,
    ]) {
      const summary = await request(app.getHttpServer()).get(path).expect(200);
      expect(summary.body.ready).toBe(true);
      await request(app.getHttpServer())
        .post(path + '/prepare')
        .expect(201);
      const pdf = await request(app.getHttpServer())
        .get(path + '/pdf/' + policyId)
        .expect(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');
      expect(pdf.headers['content-disposition']).toContain(
        'sandbox-insurance.pdf',
      );
      expect(pdf.headers['cache-control']).toContain('no-store');
    }
    expect(insurance.download).toHaveBeenLastCalledWith(
      intakeId,
      actor,
      policyId,
      contractId,
    );
    insurance.download.mockClear();
    sales.detail.mockRejectedValueOnce(new ForbiddenException());
    await request(app.getHttpServer())
      .get(`/sales/contracts/${contractId}/insurance/pdf/${policyId}`)
      .expect(403);
    expect(insurance.download).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
});
