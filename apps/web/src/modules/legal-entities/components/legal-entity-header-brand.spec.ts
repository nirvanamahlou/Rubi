import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Jahan Bastan header brand integration', () => {
  const selectorSource = fs.readFileSync(
    path.resolve(__dirname, 'legal-entity-context.tsx'),
    'utf8',
  );
  const loginSource = fs.readFileSync(
    path.resolve(__dirname, '../../../app/login/login-form.tsx'),
    'utf8',
  );
  const globalStyles = fs.readFileSync(
    path.resolve(__dirname, '../../../app/globals.css'),
    'utf8',
  );

  it('synchronizes the active legal entity with the surrounding header', () => {
    expect(selectorSource).toContain(
      'header.dataset.rubiActiveCompany = selection',
    );
    expect(globalStyles).toContain(
      "header[data-rubi-active-company='JAHAN_BASTAN']",
    );
    expect(globalStyles).toContain('#061a3f');
  });

  it('shows the authenticated display name and login time in the header', () => {
    expect(selectorSource).toContain('data-header-session-summary');
    expect(selectorSource).toContain('identity?.displayName ??');
    expect(selectorSource).toContain('ورود {formatHeaderLoginTime');
    expect(loginSource).toContain('rememberHeaderSession(session.user)');
  });
});
