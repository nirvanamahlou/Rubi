import 'reflect-metadata';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto password length', () => {
  it.each([
    [3, false],
    [4, true],
    [9, true],
    [10, true],
    [11, true],
    [12, true],
    [200, true],
    [201, false],
  ])('validates length %i as %s', async (length, accepted) => {
    const dto = Object.assign(new CreateUserDto(), {
      username: 'synthetic-user',
      displayName: 'Synthetic test',
      password: '0'.repeat(Number(length)),
      roleIds: [],
      branchIds: [],
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'password')).toBe(
      !accepted,
    );
  });
});
