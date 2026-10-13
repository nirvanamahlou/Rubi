import type * as ReactModule from 'react';
import { useLayoutEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  layouts: [] as (() => void)[],
  refIndex: 0,
  refs: [] as { current: unknown }[],
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    useEffect: (effect: () => void | (() => void)) => {
      harness.effects.push(effect);
    },
    useLayoutEffect: (effect: () => void) => {
      harness.layouts.push(effect);
    },
    useRef: <T,>(initial: T) => {
      const index = harness.refIndex++;
      harness.refs[index] ??= { current: initial };
      return harness.refs[index] as { current: T };
    },
  };
});

import { useBoundUploadContext } from './use-bound-upload-context';

type BindUpload = ReturnType<typeof useBoundUploadContext>;

function Probe({
  contextKey,
  uploaded,
  busy,
  capture,
}: {
  contextKey: string;
  uploaded: (id: string) => void;
  busy: (value: boolean) => void;
  capture: (bind: BindUpload) => void;
}) {
  const bind = useBoundUploadContext(contextKey, {
    onUploaded: uploaded,
    onBusyChange: busy,
  });
  useLayoutEffect(() => capture(bind), [bind, capture]);
  return <span>{contextKey}</span>;
}

function renderProbe(
  contextKey: string,
  uploaded: (id: string) => void,
  busy: (value: boolean) => void,
) {
  const capture = vi.fn<(bind: BindUpload) => void>();
  harness.refIndex = 0;
  harness.effects.length = 0;
  harness.layouts.length = 0;
  renderToStaticMarkup(
    <Probe
      contextKey={contextKey}
      uploaded={uploaded}
      busy={busy}
      capture={capture}
    />,
  );
  for (const layout of harness.layouts) layout();
  return capture.mock.calls[0]![0];
}

beforeEach(() => {
  harness.effects.length = 0;
  harness.layouts.length = 0;
  harness.refIndex = 0;
  harness.refs.length = 0;
});

describe('bound inline upload lifecycle', () => {
  it('discards delayed callbacks after context replacement and unmount', () => {
    const uploadedA = vi.fn();
    const uploadedB = vi.fn();
    const busyA = vi.fn();
    const busyB = vi.fn();
    const bindA = renderProbe(
      'organization-a|branch-a|session-a|editor-1',
      uploadedA,
      busyA,
    );
    const cleanup = harness.effects[0]!();
    const requestA = bindA();
    expect(requestA.isCurrent()).toBe(true);

    const bindB = renderProbe(
      'organization-b|branch-b|session-b|editor-2',
      uploadedB,
      busyB,
    );
    requestA.uploaded('stale-document');
    requestA.busy(false);
    expect(uploadedA).not.toHaveBeenCalled();
    expect(busyA).not.toHaveBeenCalled();

    const requestB = bindB();
    requestB.uploaded('current-document');
    requestB.busy(true);
    expect(uploadedB).toHaveBeenCalledWith('current-document');
    expect(busyB).toHaveBeenCalledWith(true);

    cleanup?.();
    requestB.uploaded('after-unmount');
    requestB.busy(false);
    expect(uploadedB).toHaveBeenCalledTimes(1);
    expect(busyB).toHaveBeenCalledTimes(1);
  });
});
