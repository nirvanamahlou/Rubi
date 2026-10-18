import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { IamService } from './iam.service';
import { DatabaseService } from '../database/database.service';
import { MfaTotpService } from './mfa-totp';

describe('IAM unit directory dependency compatibility', () => {
  it('keeps isolated legacy consumers bootable without adding HR read dependencies', async () => {
    const findMany = vi.fn(async () => []);
    const module = await Test.createTestingModule({
      providers: [
        IamService,
        {
          provide: DatabaseService,
          useValue: { client: { role: { findMany } } },
        },
        { provide: JwtService, useValue: {} },
        { provide: MfaTotpService, useValue: {} },
      ],
    }).compile();
    try {
      const service = module.get(IamService);
      expect(await service.listRoleTemplates()).toEqual([]);
      expect(findMany).toHaveBeenCalledOnce();
    } finally {
      await module.close();
    }
  });
});
