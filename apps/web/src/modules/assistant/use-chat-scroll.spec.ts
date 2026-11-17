import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  effects: [] as (() => void | (() => void))[],
}));
vi.mock('react', () => ({
  useRef: (current: unknown) => {
    const i = h.cursor++;
    if (!(i in h.values)) h.values[i] = { current };
    return h.values[i];
  },
  useState: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.values)) h.values[i] = initial;
    return [
      h.values[i],
      (value: unknown) => {
        h.values[i] = value;
      },
    ];
  },
  useEffect: (effect: () => void, deps: unknown[]) => {
    const i = h.cursor++;
    const old = h.values[i] as unknown[] | undefined;
    if (!old || deps.some((value, j) => value !== old[j]))
      h.effects.push(effect);
    h.values[i] = deps;
  },
}));
import { useChatScroll } from './use-chat-scroll';
// The adapter runs the real hook against the deterministic hook host above.
const renderScrollState = useChatScroll;

let resize: () => void;
let disconnect: ReturnType<typeof vi.fn>;
let reduced = false;
let cleanups: (() => void)[];
const viewport = {
  scrollHeight: 1000,
  clientHeight: 300,
  scrollTop: 0,
  scrollTo: vi.fn((options: ScrollToOptions) => {
    viewport.scrollTop = options.top!;
  }),
};
function render(revision = 0) {
  h.cursor = 0;
  const hook = renderScrollState(revision, null, null, null);
  hook.viewport.current = viewport as unknown as HTMLDivElement;
  hook.content.current = {} as HTMLDivElement;
  for (const effect of h.effects.splice(0)) {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  }
  return hook;
}
beforeEach(() => {
  h.values = [];
  h.effects = [];
  reduced = false;
  cleanups = [];
  viewport.scrollHeight = 1000;
  viewport.clientHeight = 300;
  viewport.scrollTop = 0;
  viewport.scrollTo.mockClear();
  disconnect = vi.fn();
  vi.stubGlobal('window', { matchMedia: () => ({ matches: reduced }) });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
});
afterEach(() => {
  cleanups.forEach((cleanup) => cleanup());
  vi.unstubAllGlobals();
});
describe('chat transcript scrolling', () => {
  it('pins new messages and pending/output changes to the transcript bottom', () => {
    render();
    viewport.scrollHeight = 1500;
    render(1);
    expect(viewport.scrollTo).toHaveBeenLastCalledWith({
      top: 1500,
      behavior: 'instant',
    });
  });
  it('preserves reading position when scrolled up and offers latest on new output', () => {
    const hook = render();
    viewport.scrollTop = 120;
    hook.updatePosition();
    viewport.scrollTo.mockClear();
    viewport.scrollHeight = 1400;
    render(1);
    expect(viewport.scrollTop).toBe(120);
    expect(viewport.scrollTo).not.toHaveBeenCalled();
    expect(render(1).showLatest).toBe(true);
  });
  it('resumes automatic following on explicit latest or a new send', () => {
    let hook = render();
    viewport.scrollTop = 0;
    hook.updatePosition();
    hook = render();
    hook.scrollToLatest();
    viewport.scrollHeight = 1700;
    render(1);
    expect(viewport.scrollTo).toHaveBeenLastCalledWith({
      top: 1700,
      behavior: 'instant',
    });
    expect(render(1).showLatest).toBe(false);
  });
  it.each([false, true])(
    'respects reduced motion %s for the latest button',
    (value) => {
      reduced = value;
      render().scrollToLatest(true);
      expect(viewport.scrollTo).toHaveBeenLastCalledWith({
        top: 1000,
        behavior: value ? 'instant' : 'smooth',
      });
    },
  );
  it('follows layout/font/window resizes only while pinned and disconnects observers', () => {
    const hook = render();
    viewport.scrollHeight = 2000;
    resize();
    expect(viewport.scrollTo).toHaveBeenLastCalledWith({
      top: 2000,
      behavior: 'instant',
    });
    viewport.scrollTop = 10;
    hook.updatePosition();
    viewport.scrollTo.mockClear();
    resize();
    expect(viewport.scrollTo).not.toHaveBeenCalled();
    cleanups.forEach((cleanup) => cleanup());
    cleanups = [];
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
