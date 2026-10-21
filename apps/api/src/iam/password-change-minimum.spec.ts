import 'reflect-metadata';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { ChangePasswordDto } from './dto/change-password.dto';
import { changeIamPassword } from './password-change';

const actor = {
  userId: 'self',
  sessionId: 'session',
  branchIds: [],
  permissions: [],
};
describe('self-service password minimum', () => {
  it.each(['1234', '۱۲۳۴', 'abcd', 'x'.repeat(200)])(
    'accepts simple passwords within the DTO bounds',
    async (password) => {
      const dto = Object.assign(new ChangePasswordDto(), {
        currentPassword: 'old',
        newPassword: password,
      });
      expect(await validate(dto)).toEqual([]);
      const reachedTransaction = new Error('validated');
      const transaction = vi.fn().mockRejectedValue(reachedTransaction);
      await expect(
        changeIamPassword(
          { $transaction: transaction } as never,
          actor,
          'old',
          password,
          {},
        ),
      ).rejects.toBe(reachedTransaction);
      expect(transaction).toHaveBeenCalledOnce();
    },
  );
  it.each(['', '123', 'x'.repeat(201)])(
    'rejects passwords outside the bounds before database access',
    async (password) => {
      const dto = Object.assign(new ChangePasswordDto(), {
        currentPassword: 'old',
        newPassword: password,
      });
      expect((await validate(dto)).length).toBeGreaterThan(0);
      const transaction = vi.fn();
      await expect(
        changeIamPassword(
          { $transaction: transaction } as never,
          actor,
          'old',
          password,
          {},
        ),
      ).rejects.toMatchObject({ response: { code: 'IAM_PASSWORD_POLICY' } });
      expect(transaction).not.toHaveBeenCalled();
    },
  );
});
