import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isOptInCallCenterPermission,
  PERMISSION_SEED_DATA,
} from '../src/permission-seed-data';
describe('Call Center opt-in catalogue', () => {
  it('repairs the four pre-existing native choices through migrations without changing role grants', () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        'prisma/migrations/20261022070000_call_center_base_permissions/migration.sql',
      ),
      'utf8',
    );
    const codes = [
      ...sql.matchAll(/'((?:customer_affairs\.call_center\.)[^']+)'/g),
    ].map((m) => m[1]);
    expect(codes.sort()).toEqual([
      'customer_affairs.call_center.calls.create',
      'customer_affairs.call_center.notes.create',
      'customer_affairs.call_center.read',
      'customer_affairs.call_center.workflow.manage',
    ]);
    expect(sql).toContain('ON CONFLICT (code) DO NOTHING');
    expect(sql).not.toMatch(
      /\b(?:UPDATE|DELETE|DROP|TRUNCATE|iam_role_permissions|iam_user_roles)\b/i,
    );
  });
  it('registers granular choices without auto-granting them to existing administrator roles', () => {
    const codes = PERMISSION_SEED_DATA.filter(([code]) =>
      code.startsWith('customer_affairs.call_center.'),
    ).map(([code]) => code);
    expect(codes).toContain('customer_affairs.call_center.scope.v1');
    expect(codes.filter(isOptInCallCenterPermission)).toContain(
      'customer_affairs.call_center.recordings.read',
    );
    expect(codes.filter(isOptInCallCenterPermission)).toHaveLength(11);
    expect(
      codes.filter((code) => !isOptInCallCenterPermission(code)).sort(),
    ).toEqual([
      'customer_affairs.call_center.calls.create',
      'customer_affairs.call_center.notes.create',
      'customer_affairs.call_center.read',
      'customer_affairs.call_center.workflow.manage',
    ]);
    expect(isOptInCallCenterPermission('customer_affairs.ticket.read')).toBe(
      false,
    );
  });
});
