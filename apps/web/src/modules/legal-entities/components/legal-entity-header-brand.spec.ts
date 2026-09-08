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

  it('gives each company a distinct gradient with readable white controls', () => {
    const codes = [
      'NIYAYESH_SEIR_SAHAR',
      'JAHAN_BASTAN',
      'GHESATI_RO',
      'JAHAN_ACADEMIA',
    ];
    const gradients = codes.map((code) => {
      const start = globalStyles.indexOf(
        `header[data-rubi-active-company='${code}'] {`,
      );
      expect(start).toBeGreaterThanOrEqual(0);
      return globalStyles.slice(start, globalStyles.indexOf('}', start));
    });
    const colors = gradients.map((rule) => rule.match(/#[0-9a-f]{6}/gi) ?? []);
    expect(new Set(colors.map((stops) => stops.join(','))).size).toBe(4);
    for (const stops of colors) {
      expect(stops.length).toBeGreaterThanOrEqual(2);
      for (const hex of stops) {
        // White text over the brightest (12%) translucent control background.
        const channels = [1, 3, 5].map((offset) => {
          const channel =
            (parseInt(hex.slice(offset, offset + 2), 16) * 0.88 + 255 * 0.12) /
            255;
          return channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
        });
        const luminance =
          channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
        expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
