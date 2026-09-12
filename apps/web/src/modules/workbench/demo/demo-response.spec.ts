import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../../app/(crm)/workbench/demo/route';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { gzipSync } from 'node:zlib';
import {
  workbenchDemoEnabled,
  workbenchDemoHeaders,
  workbenchDemoResponse,
} from './demo-response';

const html = readFileSync(
  new URL('./workbench-demo.html', import.meta.url),
  'utf8',
);
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';

describe('explicit isolated Workbench demo', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('serves the exact HTML only when the runtime gate is enabled', async () => {
    vi.stubEnv('RUBI_WORKBENCH_DEMO', '0');
    expect((await GET()).status).toBe(404);
    vi.stubEnv('RUBI_WORKBENCH_DEMO', '1');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(html);
    const page = readFileSync(
      new URL('../../../app/(crm)/workbench/page.tsx', import.meta.url),
      'utf8',
    );
    expect(page).toContain("export const dynamic = 'force-dynamic'");
  });
  it('is disabled unless deliberately enabled by the server', () => {
    for (const value of [undefined, '', '0', 'true', 'yes']) {
      expect(workbenchDemoEnabled(value)).toBe(false);
    }
    expect(workbenchDemoEnabled('1')).toBe(true);
  });

  it('isolates the document from network, cookies, forms and storage', async () => {
    const response = workbenchDemoResponse(html);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const csp = workbenchDemoHeaders['Content-Security-Policy'];
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain('sandbox allow-scripts allow-forms allow-downloads');
    expect(csp).not.toContain('allow-same-origin');
    expect(csp).not.toContain('allow-top-navigation');
    expect(await response.text()).toBe(html);
    expect(script).not.toMatch(
      /\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie|sendBeacon/,
    );
  });

  it('retains all eight reference sections and compiles its interactions', () => {
    for (const title of [
      'امروز من',
      'کارتابل درخواست‌ها',
      'پیام‌ها',
      'فایل‌های من',
      'ستاره‌دارها',
      'فعالیت‌های من',
      'یادداشت‌ها',
      'حساب و تنظیمات',
    ]) {
      expect(html).toContain(title);
    }
    expect(script.length).toBeGreaterThan(1000);
    expect(() => new Script(script)).not.toThrow();
    expect(gzipSync(script).length).toBeLessThan(80 * 1024);
  });

  it('keeps fixtures visibly synthetic, resettable and separate from real navigation', () => {
    expect(html).toContain('محیط آزمایشی میزکار');
    expect(html).toContain('بازنشانی داده‌های آزمایشی');
    expect(html).toContain('بدون اتصال به اطلاعات واقعی');
    expect(html).not.toContain("location.href='b2b-detailed.html'");
    expect(html).not.toContain("location.href='human-resources.html'");
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<form[^>]+action=/);
  });

  it('keeps the original production authorization and unavailable-data behavior', () => {
    const workspace = readFileSync(
      new URL('../workbench-workspace.tsx', import.meta.url),
      'utf8',
    );
    expect(workspace).toContain(
      'canAccessWorkbench(identity.user.permissions)',
    );
    expect(workspace).not.toContain('workbench-demo.html');
    expect(workspace).not.toContain('localStorage');
    const route = readFileSync(
      new URL('../../../app/(crm)/workbench/demo/route.ts', import.meta.url),
      'utf8',
    );
    expect(route).toContain('RUBI_WORKBENCH_DEMO');
    expect(route).toContain('status: 404');
    expect(route).not.toMatch(
      /export (?:async )?function (POST|PUT|DELETE|PATCH)/,
    );
  });
});
