import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { WebsitePublicationSwitch } from './publication-switch';
import { canonicalTestTree } from '@/i18n/test-tree';

const fixture = vi.hoisted(() => ({
  state: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  dependencies: [] as unknown[][],
  effectCursor: 0,
  buttons: [] as React.ComponentProps<'button'>[],
  select: undefined as
    undefined | { value: string; onValueChange: (value: string) => void },
  dialog: undefined as
    undefined | { open: boolean; onOpenChange: (value: boolean) => void },
  fetch: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const index = fixture.cursor++;
    if (!(index in fixture.state)) fixture.state[index] = initial;
    return [
      fixture.state[index],
      (value: unknown) => {
        fixture.state[index] = value;
      },
    ];
  },
  useEffect: (effect: () => unknown, dependencies: unknown[]) => {
    const index = fixture.effectCursor++;
    if (
      JSON.stringify(fixture.dependencies[index]) !==
      JSON.stringify(dependencies)
    ) {
      fixture.dependencies[index] = dependencies;
      fixture.effects.push(effect);
    }
  },
}));
vi.mock('@/lib/environment', () => ({ getPublicApiBaseUrl: () => '/api/v1' }));
vi.mock('@/i18n/localized-fetch', () => ({ localizedFetch: fixture.fetch }));
vi.mock('@/components/ui', () => {
  const Box = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  return {
    Button: (props: React.ComponentProps<'button'>) => {
      fixture.buttons.push({
        ...props,
        children: canonicalTestTree(props.children),
      });
      return <button disabled={props.disabled}>{props.children}</button>;
    },
    Dialog: (
      props: NonNullable<typeof fixture.dialog> & React.PropsWithChildren,
    ) => {
      fixture.dialog = props;
      return props.open ? (
        <section role="dialog">{props.children}</section>
      ) : null;
    },
    DialogContent: Box,
    DialogTitle: Box,
    DialogDescription: Box,
    Select: (
      props: NonNullable<typeof fixture.select> & React.PropsWithChildren,
    ) => {
      fixture.select = props;
      return <div>{props.children}</div>;
    },
    SelectTrigger: Box,
    SelectValue: () => null,
    SelectContent: Box,
    SelectItem: ({
      children,
      value,
    }: React.PropsWithChildren<{ value: string }>) => (
      <div data-site={value}>{children}</div>
    ),
  };
});

const ok = (enabled = false, version = 4) => ({
  ok: true,
  json: async () => ({ data: { enabled, version } }),
});
async function settle() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
function render(kind: 'tour' | 'ticket' = 'tour', disabled = false) {
  fixture.cursor = 0;
  fixture.effectCursor = 0;
  fixture.buttons = [];
  fixture.select = undefined;
  return renderToStaticMarkup(
    <WebsitePublicationSwitch
      kind={kind}
      resourceId="synthetic-resource"
      disabled={disabled}
    />,
  );
}
function button(label: string) {
  const match = fixture.buttons.find((props) => props.children === label);
  expect(match, label).toBeDefined();
  return match!;
}
function click(label: string) {
  const props = button(label);
  expect(props.disabled, label).toBeFalsy();
  props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
}
async function load(enabled = false, version = 4) {
  fixture.fetch.mockResolvedValueOnce(ok(enabled, version));
  render();
  fixture.effects.splice(0).forEach((effect) => effect());
  await settle();
  render();
}
beforeEach(() => {
  fixture.state = [];
  fixture.dependencies = [];
  fixture.effects = [];
  fixture.fetch.mockReset();
});

it('opens the site list without publishing, requires selection and cancels without writes', async () => {
  await load();
  click('انتشار در سایت');
  const html = render();
  expect(html).toContain('data-site="nss"');
  expect(html).toContain('نیایش سیر');
  expect(html.match(/data-site=/g)).toHaveLength(1);
  expect(html).not.toContain('type="checkbox"');
  expect(button('انتشار').disabled).toBe(true);
  fixture.select!.onValueChange('nss');
  render();
  expect(button('انتشار').disabled).toBe(false);
  click('انصراف');
  expect(render()).not.toContain('role="dialog"');
  expect(fixture.fetch).toHaveBeenCalledTimes(1);
  click('انتشار در سایت');
  render();
  expect(fixture.select!.value).toBe('');
});

it('publishes only after confirmation using the selected site and current version', async () => {
  await load(false, 7);
  click('انتشار در سایت');
  render();
  fixture.select!.onValueChange('nss');
  render();
  fixture.fetch.mockResolvedValueOnce(ok(true, 8));
  click('انتشار');
  await settle();
  const html = render();
  expect(fixture.fetch).toHaveBeenLastCalledWith(
    '/api/v1/sales/site-commerce/v1/nss/publications/tour/synthetic-resource',
    expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ enabled: true, version: 7 }),
    }),
  );
  expect(html).not.toContain('role="dialog"');
  expect(html).toContain('منتشرشده در نیایش سیر');
});

it('preserves deliberate unpublishing and uses the latest returned version', async () => {
  await load(true, 9);
  click('انتشار در سایت');
  render();
  expect(button('لغو انتشار').disabled).toBe(true);
  fixture.select!.onValueChange('nss');
  render();
  fixture.fetch.mockResolvedValueOnce(ok(false, 10));
  click('لغو انتشار');
  await settle();
  expect(render()).not.toContain('منتشرشده در نیایش سیر');
  expect(fixture.fetch).toHaveBeenLastCalledWith(
    expect.any(String),
    expect.objectContaining({
      body: JSON.stringify({ enabled: false, version: 9 }),
    }),
  );
});

it('keeps failed publication open and does not claim it was published', async () => {
  await load();
  click('انتشار در سایت');
  render();
  fixture.select!.onValueChange('nss');
  render();
  fixture.fetch.mockResolvedValueOnce({ ok: false });
  click('انتشار');
  await settle();
  const html = render();
  expect(html).toContain('role="dialog"');
  expect(html).toContain('role="alert"');
  expect(html).not.toContain('منتشرشده در نیایش سیر');
  expect(button('انتشار').disabled).toBe(false);
});

it('prevents duplicate writes and closing while a confirmation is pending', async () => {
  await load();
  click('انتشار در سایت');
  render();
  fixture.select!.onValueChange('nss');
  render();
  let resolve!: (value: ReturnType<typeof ok>) => void;
  fixture.fetch.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  click('انتشار');
  render();
  expect(button('در حال ثبت…').disabled).toBe(true);
  fixture.dialog!.onOpenChange(false);
  expect(render()).toContain('role="dialog"');
  expect(fixture.fetch).toHaveBeenCalledTimes(2);
  resolve(ok(true, 5));
  await settle();
  expect(render()).not.toContain('role="dialog"');
});

it('retains loading/read-only guards and does not publish unsupported site IDs', async () => {
  render();
  expect(button('انتشار در سایت').disabled).toBe(true);
  fixture.state = [];
  fixture.dependencies = [];
  fixture.effects = [];
  await load();
  render('tour', true);
  expect(button('انتشار در سایت').disabled).toBe(true);
  render();
  click('انتشار در سایت');
  render();
  fixture.select!.onValueChange('unregistered-site');
  render();
  click('انتشار');
  await settle();
  expect(fixture.fetch).toHaveBeenCalledTimes(1);
});

it('retains ticket resource identity and aborts the status read on unmount', async () => {
  fixture.fetch.mockResolvedValueOnce(ok());
  render('ticket');
  const cleanup = fixture.effects.shift()!() as () => void;
  await settle();
  expect(fixture.fetch).toHaveBeenCalledWith(
    '/api/v1/sales/site-commerce/v1/nss/publications/ticket/synthetic-resource',
    expect.objectContaining({
      cache: 'no-store',
      credentials: 'include',
      signal: expect.any(AbortSignal),
    }),
  );
  const signal = fixture.fetch.mock.calls[0]![1].signal as AbortSignal;
  cleanup();
  expect(signal.aborted).toBe(true);
});

it('pauses and resumes sales for the explicitly selected website without unpublishing', async () => {
  await load(true, 9);
  click('انتشار در سایت');
  render();
  fixture.select!.onValueChange('nss');
  render();
  fixture.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      data: { enabled: true, salesStopped: true, version: 10 },
    }),
  });
  click('توقف فروش سایت');
  await settle();
  expect(render()).toContain('نمایش در سایت؛ فروش متوقف است');
  expect(JSON.parse(fixture.fetch.mock.calls.at(-1)![1].body)).toEqual({
    enabled: true,
    salesStopped: true,
    version: 9,
  });
  click('انتشار در سایت');
  render();
  fixture.select!.onValueChange('nss');
  render();
  fixture.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      data: { enabled: true, salesStopped: false, version: 11 },
    }),
  });
  click('ادامه فروش');
  await settle();
  const html = render();
  expect(html).toContain('منتشرشده در نیایش سیر');
  expect(html).not.toContain('نمایش در سایت؛ فروش متوقف است');
  expect(JSON.parse(fixture.fetch.mock.calls.at(-1)![1].body)).toEqual({
    enabled: true,
    salesStopped: false,
    version: 10,
  });
});
