import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PassengerPreflightDto } from './passenger-preflight.dto';
import { SiteCommerceController } from './site-commerce.controller';

const actor = {
  userId: 'site-user',
  sessionId: 'session',
  permissions: ['sales.contracts.create'],
  branchIds: ['branch', 'another'],
};
const person = {
  kind: 'person' as const,
  roles: ['passenger' as const],
  displayName: 'Synthetic Passenger',
  firstName: 'Synthetic',
  lastName: 'Passenger',
  nationalId: '1234567891',
  passportNumber: 'P1234567',
};
const before = process.env.SITE_COMMERCE_BINDINGS;
afterEach(() => {
  if (before === undefined) delete process.env.SITE_COMMERCE_BINDINGS;
  else process.env.SITE_COMMERCE_BINDINGS = before;
});
function fixture() {
  process.env.SITE_COMMERCE_BINDINGS = JSON.stringify({
    test: { userId: actor.userId, branchId: 'branch' },
  });
  const checkWebsitePassenger = vi.fn().mockResolvedValue({ valid: true });
  const controller = new SiteCommerceController(
    {} as never,
    { checkWebsitePassenger } as never,
    {} as never,
    {} as never,
  );
  return { controller, checkWebsitePassenger };
}
describe('website passenger preflight transport', () => {
  it('checks a batch once using only the bound branch', async () => {
    const f = fixture();
    expect(
      await f.controller.checkPeople('test', { passengers: [person] }, {
        actor,
      } as never),
    ).toEqual({ data: [{ index: 0, valid: true }] });
    expect(f.checkWebsitePassenger).toHaveBeenCalledExactlyOnceWith(
      person,
      { ...actor, branchIds: ['branch'] },
      'branch',
    );
  });
  it('marks both passengers when a passport is repeated inside a batch', async () => {
    const f = fixture();
    const result = await f.controller.checkPeople(
      'test',
      {
        passengers: [person, { ...person, nationalId: '1234567892' }],
      },
      { actor } as never,
    );
    expect(result.data).toEqual(
      [0, 1].map((index) => ({
        index,
        valid: false,
        code: 'DUPLICATE_PASSENGER',
      })),
    );
  });
  it('does not disclose validation details or swallow authorization errors', async () => {
    const f = fixture();
    f.checkWebsitePassenger.mockRejectedValueOnce(
      new BadRequestException('private details'),
    );
    expect(
      await f.controller.checkPeople('test', { passengers: [person] }, {
        actor,
      } as never),
    ).toEqual({
      data: [{ index: 0, valid: false, code: 'INVALID_PASSENGER' }],
    });
    f.checkWebsitePassenger.mockRejectedValueOnce(new ForbiddenException());
    await expect(
      f.controller.checkPeople('test', { passengers: [person] }, {
        actor,
      } as never),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      f.controller.checkPeople('other', { passengers: [person] }, {
        actor,
      } as never),
    ).rejects.toThrow(ForbiddenException);
  });
  it('rejects empty and oversized batches, and validates nested passport syntax', async () => {
    for (const passengers of [
      [],
      Array.from({ length: 31 }, () => person),
      [{ ...person, passportNumber: '!' }],
    ]) {
      expect(
        (await validate(plainToInstance(PassengerPreflightDto, { passengers })))
          .length,
      ).toBeGreaterThan(0);
    }
  });
});
