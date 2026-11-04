import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../iam/iam.types';
import type { ProcurementService } from './procurement.service';
import type { ProcurementExports } from './procurement.exports';
import { ProcurementController } from './procurement.controller';
describe('Petty fund response', () => {
  it('explicitly sends JSON null for an unconfigured fund instead of an empty HTTP body', async () => {
    const service = { pettyFund: vi.fn().mockResolvedValue(null) };
    const controller = new ProcurementController(
      service as unknown as ProcurementService,
      {} as ProcurementExports,
    );
    const json = vi.fn().mockReturnValue('sent');
    const req = { actor: { userId: 'actor' } } as AuthenticatedRequest;
    await expect(
      controller.pettyFund('branch', req, { json } as unknown as Response),
    ).resolves.toBe('sent');
    expect(json).toHaveBeenCalledWith(null);
    expect(service.pettyFund).toHaveBeenCalledWith('branch', req.actor);
  });
});
