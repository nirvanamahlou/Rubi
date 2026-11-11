import { describe, expect, it } from 'vitest';
import { errorDiagnostics } from './error-diagnostics';

describe('safe unexpected error diagnostics', () => {
  it('retains source locations and nested machine codes without exception data', () => {
    const cause = Object.assign(new Error('password=private database query'), {
      code: 'ECONNREFUSED',
    });
    const error = new TypeError('private passenger data', { cause });
    error.stack =
      'TypeError: private passenger data\n    at read (C:\\private-user\\app\\src\\hr\\hr.service.ts:42:9)';
    expect(errorDiagnostics(error)).toEqual({
      type: 'TypeError',
      frames: ['src/hr/hr.service.ts:42:9'],
      cause: expect.objectContaining({ code: 'ECONNREFUSED' }),
    });
    const output = JSON.stringify(errorDiagnostics(error));
    expect(output).not.toMatch(
      /password|passenger|private-user|database query/,
    );
  });
  it('bounds cyclic causes and ignores arbitrary codes and non-errors', () => {
    const error = Object.assign(new Error('hidden'), {
      code: 'SECRET',
      cause: undefined as unknown,
    });
    error.cause = error;
    expect(JSON.stringify(errorDiagnostics(error))).not.toContain('SECRET');
    expect(errorDiagnostics({ token: 'hidden' })).toEqual({
      type: 'NonErrorThrown',
    });
  });
});
