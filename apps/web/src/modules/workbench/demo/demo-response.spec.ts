import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { GET } from '../../../app/(crm)/workbench/demo/route';
import TasksPage from '../../../app/(crm)/tasks/page';
import { workbenchDemoEnabled, workbenchDemoHeaders } from './demo-response';

vi.mock(
  '@/modules/module-foundation/components/module-foundation-workspace',
  () => ({
    ModuleFoundationWorkspace: () => null,
  }),
);

const html = readFileSync(
  new URL('./workbench-demo.html', import.meta.url),
  'utf8',
);

describe('Workbench demo in the complete runtime', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns no demo unless explicitly enabled, then returns the exact document', async () => {
    for (const value of ['', '0', 'true']) {
      vi.stubEnv('RUBI_WORKBENCH_DEMO', value);
      expect((await GET()).status).toBe(404);
    }
    expect(workbenchDemoEnabled(undefined)).toBe(false);
    vi.stubEnv('RUBI_WORKBENCH_DEMO', '1');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(html);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('shows the opt-in entry while preserving the original Tasks workspace', () => {
    vi.stubEnv('RUBI_WORKBENCH_DEMO', '0');
    const disabled = TasksPage().props.children;
    expect(disabled[0]).toBe(false);
    vi.stubEnv('RUBI_WORKBENCH_DEMO', '1');
    const enabled = TasksPage().props.children;
    expect(enabled[0].props.children[0].props.href).toBe('/workbench/demo');
    expect(enabled[1].type).toBe(disabled[1].type);
    expect(enabled[1].props.config).toBe(disabled[1].props.config);
  });

  it('retains the opaque sandbox and blocks network and persisted browser state', () => {
    const csp = workbenchDemoHeaders['Content-Security-Policy'];
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain('sandbox allow-scripts allow-forms allow-downloads');
    expect(csp).not.toContain('allow-same-origin');
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';
    expect(script.length).toBeGreaterThan(1000);
    expect(() => new Script(script)).not.toThrow();
    expect(script).not.toMatch(
      /\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.cookie|sendBeacon/,
    );
  });
});
