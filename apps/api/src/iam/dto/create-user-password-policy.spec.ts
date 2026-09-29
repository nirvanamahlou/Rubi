import 'reflect-metadata';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto password length', () => {
  it.each([
    [9, false],
    [10, true],
    [11, true],
    [12, true],
    [200, true],
    [201, false],
  ])('validates length %i as %s', async (length, accepted) => {
    const dto = Object.assign(new CreateUserDto(), {
      username: 'synthetic-user',
      displayName: 'Synthetic test',
      password: 'A'.repeat(Number(length)),
      roleIds: [],
      branchIds: [],
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'password')).toBe(
      !accepted,
    );
  });
});
