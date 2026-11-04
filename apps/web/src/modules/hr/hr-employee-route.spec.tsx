import { beforeEach, expect, it, vi } from 'vitest';
import {
  canViewRoute,
  denyPermission,
  screenPermission,
  USER_ACCESS_PROFILE_PERMISSION,
} from '@nora/contracts';
import Page from '@/app/(crm)/hr/page';

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((url: string): never => {
    throw new Error(url);
  }),
}));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/i18n/metadata', () => ({ localizedMetadata: vi.fn() }));
vi.mock('./hr-workspace', () => ({ HrWorkspace: () => null }));
beforeEach(() => {
  redirect.mockClear();
});

it('opens a legacy employee link through the existing authorized summary route', async () => {
  const entry = '/hr?section=employee&employee=employee-id';
  const target = `${entry}&tab=summary`;
  const permissions = [
    USER_ACCESS_PROFILE_PERMISSION,
    'hr.employees.read',
    screenPermission('hr.employee.summary'),
  ];
  expect(canViewRoute(permissions, entry)).toBe(true);
  expect(canViewRoute(permissions, target)).toBe(true);
  expect(
    canViewRoute(permissions, entry.replace('/hr?', '/human-resources?')),
  ).toBe(true);
  expect(canViewRoute([], entry)).toBe(false);
  expect(canViewRoute([], target)).toBe(false);
  expect(canViewRoute(permissions, `${entry}&tab=contact`)).toBe(false);
  expect(canViewRoute(permissions, `${entry}&workspace=payroll`)).toBe(false);
  expect(canViewRoute(permissions, '/hr?section=employee')).toBe(false);
  expect(
    canViewRoute(
      [...permissions, denyPermission('hr.employee.summary')],
      target,
    ),
  ).toBe(false);
  expect(
    canViewRoute(
      [...permissions, denyPermission('hr.employee.summary')],
      entry,
    ),
  ).toBe(false);
  await expect(
    Page({
      searchParams: Promise.resolve({
        section: 'employee',
        employee: 'employee-id',
      }),
    }),
  ).rejects.toThrow(target);
});

it('retains an encoded record target when adding the default profile tab', async () => {
  await expect(
    Page({
      searchParams: Promise.resolve({
        section: 'employee',
        employee: 'employee-id',
        record: 'record&other=value',
      }),
    }),
  ).rejects.toThrow(
    '/hr?section=employee&employee=employee-id&tab=summary&record=record%26other%3Dvalue',
  );
});

it('preserves an explicitly selected profile tab', async () => {
  const page = await Page({
    searchParams: Promise.resolve({
      section: 'employee',
      employee: 'employee-id',
      tab: 'contact',
    }),
  });
  expect(redirect).not.toHaveBeenCalled();
  expect(page.props).toMatchObject({
    employeeId: 'employee-id',
    tabId: 'contact',
  });
});

it('does not turn an employee list or missing identity into a profile route', async () => {
  await Page({ searchParams: Promise.resolve({ section: 'employees' }) });
  await Page({ searchParams: Promise.resolve({ section: 'employee' }) });
  expect(redirect).not.toHaveBeenCalled();
});
