import type { DocumentOptionsResponseV1 } from '@nora/contracts';
import type * as ReactModule from 'react';
import type * as OverlaysModule from '@/components/ui/overlays';
import type * as ButtonModule from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';
import { isValidElement, type ReactNode, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ContentPage,
  MarketingAssetUploadDialog,
} from './marketing-reference-pages';
import { MarketingWorkspace } from './marketing-workspace';
import { MarketingActionButton } from './marketing-action-button';

// SSR plus actual event handlers. Only portal placement and hook scheduling
// are replaced; actions, form validation, FormData and shared Button render.
const hooks = vi.hoisted(() => ({
  active: false,
  index: 0,
  values: [] as unknown[],
  buttons: [] as Record<string, unknown>[],
}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    useState(initial: unknown) {
      if (!hooks.active) return actual.useState(initial);
      const index = hooks.index++;
      if (!(index in hooks.values))
        hooks.values[index] =
          typeof initial === 'function' ? initial() : initial;
      return [
        hooks.values[index],
        (next: unknown) => {
          hooks.values[index] =
            typeof next === 'function' ? next(hooks.values[index]) : next;
        },
      ];
    },
  };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/marketing',
}));
vi.mock('@/components/ui/overlays', async (importOriginal) => {
  const actual = await importOriginal<typeof OverlaysModule>();
  return {
    ...actual,
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? children : null,
    DialogContent: ({ children }: { children: ReactNode }) => (
      <div role="dialog">{children}</div>
    ),
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: ReactNode }) => (
      <p>{children}</p>
    ),
  };
});
vi.mock('@/components/ui/button', async (importOriginal) => {
  const actual = await importOriginal<typeof ButtonModule>();
  return {
    ...actual,
    Button: (props: ButtonProps) => {
      hooks.buttons.push(props as Record<string, unknown>);
      return <actual.Button {...props} />;
    },
  };
});

const options: DocumentOptionsResponseV1['data'] = {
  currentUserId: 'owner',
  branches: [{ id: 'branch', code: 'BR', name: 'Branch' }],
  owners: [{ id: 'owner', displayName: 'Owner' }],
  categories: [{ id: 'category', code: 'BRAND_ASSETS', name: 'Brand' }],
  documentTypes: [
    {
      id: 'type',
      code: 'BRAND_ASSET_TEMPLATE',
      name: 'Asset',
      domain: 'BRAND',
      defaultConfidentiality: 'CONFIDENTIAL',
      allowedMimeTypes: ['image/png'],
      maxFileSizeBytes: 10000,
      requiresExpiry: false,
    },
  ],
  uploadPolicy: {
    maxFileSizeBytes: 10000,
    allowedMimeTypes: ['image/png'],
    antivirusAvailable: true,
  },
};
beforeEach(() => {
  hooks.values = [];
  hooks.index = 0;
  hooks.buttons = [];
  hooks.active = false;
});

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children as ReactNode)];
}
function expectIcon(markup: string, label: string) {
  const button = [...markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
    .map((match) => match[0])
    .find((item) => item.includes(`aria-label="${label}"`));
  expect(button, label).toBeDefined();
  expect(button).toContain(`title="${label}"`);
  expect(button).toContain('<svg');
  expect(button!.replace(/<[^>]+>/g, '').trim()).toBe('');
}

describe('reachable Marketing actions and upload correction', () => {
  it('renders the live library upload entry as a named icon', () => {
    const markup = renderToStaticMarkup(
      <ContentPage tab="library" onOpen={vi.fn()} onNotice={vi.fn()} />,
    );
    expectIcon(markup, 'بارگذاری فایل');
  });

  it('submits no-code confidential-type uploads to the owner and accepts protected-code correction', () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    const onOpenChange = vi.fn();
    const tree = () => {
      hooks.index = 0;
      hooks.active = true;
      const result = MarketingAssetUploadDialog({
        open: true,
        options,
        submitting: false,
        error: 'Owner policy response',
        onSubmit,
        onOpenChange,
      });
      hooks.active = false;
      return result;
    };
    let nodes = elements(tree());
    const change = (id: string, target: unknown) =>
      (
        nodes.find((node) => node.props.id === id && node.props.onChange)!.props
          .onChange as (event: unknown) => void
      )({ target });
    change('marketing-asset-file', {
      files: [new File(['test'], 'test.png', { type: 'image/png' })],
    });
    change('marketing-asset-title', { value: 'Test upload' });
    nodes = elements(tree());
    const submit = () =>
      (
        nodes.find((node) => node.type === 'form')!.props.onSubmit as (
          event: unknown,
        ) => void
      )({ preventDefault: vi.fn() });
    submit();
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(
      (onSubmit.mock.calls[0]![0] as FormData).has('confidentialAccessCode'),
    ).toBe(false);
    change('marketing-asset-confidential-code', { value: '123456' });
    nodes = elements(tree());
    submit();
    expect(
      (onSubmit.mock.calls[1]![0] as FormData).get('confidentialAccessCode'),
    ).toBe('123456');
    change('marketing-asset-confidential-code', { value: '' });
    nodes = elements(tree());
    submit();
    expect(
      (onSubmit.mock.calls[2]![0] as FormData).has('confidentialAccessCode'),
    ).toBe(false);
    for (const [form] of onSubmit.mock.calls)
      expect((form as FormData).has('confidentiality')).toBe(false);
    const markup = renderToStaticMarkup(tree());
    expectIcon(markup, 'انصراف از بارگذاری');
    expectIcon(markup, 'ثبت در محتوا و اسناد');
    expect(markup).toContain('Owner policy response');
    const cancel = nodes.find(
      (node) => node.props['aria-label'] === 'انصراف از بارگذاری',
    )!;
    (cancel.props.onClick as () => void)();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps upload pending controls named and disabled', () => {
    const markup = renderToStaticMarkup(
      <MarketingAssetUploadDialog
        open
        options={options}
        submitting
        error=""
        onSubmit={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );
    expectIcon(markup, 'در حال بارگذاری…');
    const submit = hooks.buttons.find((button) => button.type === 'submit')!;
    expect(submit.disabled).toBe(true);
  });

  it('renders and invokes the actual workspace detail close action', () => {
    hooks.values[7] = {
      id: 'asset',
      title: 'Asset details',
      status: 'Active',
      updatedAt: '2026-10-06T00:00:00.000Z',
      description: 'Details',
    };
    hooks.active = true;
    const markup = renderToStaticMarkup(<MarketingWorkspace />);
    hooks.active = false;
    expectIcon(markup, 'تأیید و بستن');
    (
      hooks.buttons.find((button) => button['aria-label'] === 'تأیید و بستن')!
        .onClick as () => void
    )();
    expect(hooks.values[7]).toBeNull();
  });

  it('gives remaining reference action labels an icon and preserves submit/disabled wiring', () => {
    const markup = renderToStaticMarkup(
      <MarketingActionButton disabled type="submit" form="live-form">
        ذخیره تغییرات
      </MarketingActionButton>,
    );
    expectIcon(markup, 'ذخیره تغییرات');
    expect(hooks.buttons[0]).toMatchObject({
      disabled: true,
      type: 'submit',
      form: 'live-form',
      size: 'icon',
    });
  });
});
