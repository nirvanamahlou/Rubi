import {
  USER_JOB_TITLES,
  USER_ACCESS_PROFILE_PERMISSION,
  USER_ACCESS_SCREENS,
  screenPermission,
} from '@nora/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { recommendRoleAccess } from './role-access-presets';
import { RoleAccessProposal } from './role-access-proposal';
const codes = [
  'iam.users.manage',
  'customers.read',
  'sales.contracts.read.own',
  'sales.contracts.read.all',
  'sales.contracts.create',
  'sales.contracts.update.own',
  'finance.read',
  'finance.payment.create',
  'finance.receipt.approve',
  'finance.account.manage',
  'finance.financial_release.approve',
  'reservations.read',
  'reservations.documents.manage',
  'reservations.arrangements.update',
  'reservations.hotel_purchase.write',
  'ticket_catalog.read',
  'ticket_catalog.tours.manage',
  'ticket_catalog.manage',
  'hr.read',
  'hr.manage',
  'hr.approve',
  'hr.sensitive',
  'customer_affairs.ticket.read',
  'customer_affairs.ticket.create',
  'reporting.read',
  'reporting.finance.read',
  'reporting.export',
  'documents.list',
  'documents.travel.read',
  'documents.sensitive.read',
  'customers.sensitive.read',
];
const permissions = codes.map((code) => ({ id: code, code, name: code }));
const proposal = (title: string) =>
  recommendRoleAccess(title, permissions, codes);
describe('role access recommendations', () => {
  it.each(USER_JOB_TITLES)('has an explicit recommendation for %s', (title) => {
    const result = proposal(title);
    expect(result.screenIds.length).toBeGreaterThan(0);
    expect(result.reason.length).toBeGreaterThan(10);
    expect(result.permissions.every((p) => codes.includes(p.code))).toBe(true);
  });
  it('keeps sales own-contract grants separate from finance approvals and user administration', () => {
    const result = proposal('کارشناس فروش');
    expect(result.permissionIds).toContain('sales.contracts.read.own');
    expect(result.permissionIds).toContain('sales.contracts.create');
    expect(result.permissionIds).toContain('ticket_catalog.tours.manage');
    expect(result.permissionIds).not.toContain('sales.contracts.read.all');
    expect(result.permissionIds).not.toContain('finance.receipt.approve');
    expect(result.permissionIds).not.toContain('iam.users.manage');
  });
  it('separates finance staff operations from manager approvals', () => {
    expect(proposal('مالی').permissionIds).toContain('finance.payment.create');
    expect(proposal('مالی').permissionIds).not.toContain(
      'finance.financial_release.approve',
    );
    expect(proposal('مدیر مالی').permissionIds).toContain(
      'finance.financial_release.approve',
    );
    expect(proposal('مدیر مالی').permissionIds).not.toContain(
      'iam.users.manage',
    );
  });
  it('reserves ticket management and hotel purchase for reservation managers', () => {
    expect(proposal('کارمند رزرواسیون').permissionIds).toContain(
      'reservations.arrangements.update',
    );
    expect(proposal('کارمند رزرواسیون').permissionIds).not.toContain(
      'ticket_catalog.manage',
    );
    expect(proposal('مدیر رزرواسیون').permissionIds).toContain(
      'ticket_catalog.manage',
    );
    expect(proposal('مدیر رزرواسیون').permissionIds).toContain(
      'reservations.hotel_purchase.write',
    );
  });
  it('keeps AI analysis read-only and HR approval/sensitive grants manual', () => {
    expect(proposal('تیم هوش مصنوعی').permissionIds).toContain(
      'reporting.read',
    );
    expect(proposal('تیم هوش مصنوعی').permissionIds).not.toContain(
      'reporting.export',
    );
    expect(proposal('منابع انسانی').permissionIds).not.toContain('hr.approve');
    expect(proposal('منابع انسانی').permissionIds).not.toContain(
      'hr.sensitive',
    );
  });
  it('intersects even manager recommendations with actor grants and available options', () => {
    const actor = [
      USER_ACCESS_PROFILE_PERMISSION,
      screenPermission('system.users'),
      'iam.users.manage',
    ];
    const result = recommendRoleAccess('مدیر', permissions, actor);
    expect(result.screenIds).toEqual(['system.users']);
    expect(result.permissionIds).toEqual(['iam.users.manage']);
    expect(recommendRoleAccess('مدیر', [], actor).permissionIds).toEqual([]);
  });
  it('offers every catalogued section and native permission to a system administrator', () => {
    const result = recommendRoleAccess('مدیر', permissions, [], true);
    expect(result.screenIds).toHaveLength(USER_ACCESS_SCREENS.length);
    expect(result.permissionIds).toHaveLength(permissions.length);
  });
  it('does not give fallback grants to unknown roles and never mutates existing option arrays', () => {
    const before = JSON.stringify(permissions);
    expect(proposal('unknown').permissionIds).toEqual([]);
    expect(proposal('unknown').screenIds).toEqual([]);
    proposal('مدیر');
    expect(JSON.stringify(permissions)).toBe(before);
  });
  it('presents explicit non-submit confirmation/customization controls and pending-save guidance', () => {
    const html = renderToStaticMarkup(
      <RoleAccessProposal
        title="مالی"
        proposal={proposal('مالی')}
        onApply={() => {}}
        onKeep={() => {}}
      />,
    );
    expect(html).toContain('تأیید و اعمال پیشنهاد');
    expect(html).toContain('اعمال و سفارشی‌سازی');
    expect(html).toContain('حفظ تیک‌های فعلی');
    expect(html).toContain('تا ذخیره نکنید');
    expect(html).not.toContain('type="submit"');
  });
});

it('recommends branch-wide contracts for the sales manager without global access', () => {
  const codes = [
    'sales.contracts.read.branch',
    'sales.contracts.update.branch',
    'sales.contracts.read.all',
  ];
  const available = codes.map((code) => ({ id: code, code, name: code }));
  const proposal = recommendRoleAccess('مدیر فروش', available, codes);
  expect(proposal.permissionIds).toContain('sales.contracts.read.branch');
  expect(proposal.permissionIds).toContain('sales.contracts.update.branch');
  expect(proposal.permissionIds).not.toContain('sales.contracts.read.all');
});
