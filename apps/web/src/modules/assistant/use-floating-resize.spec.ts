import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent, KeyboardEvent, RefObject } from 'react';
import { useFloatingResize } from './use-floating-resize';
const effects = vi.hoisted(() => [] as Array<() => (() => void) | void>);
vi.mock('react', () => ({
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => (() => void) | void) => effects.push(effect),
}));
afterEach(() => {
  effects.splice(0);
  vi.unstubAllGlobals();
});
function fixture(open = true) {
  const listeners = new Map<string, () => void>();
  const window = {
    innerWidth: 1200,
    innerHeight: 900,
    addEventListener: (key: string, fn: () => void) => listeners.set(key, fn),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('window', window);
  const style: Record<string, string> = {};
  const panel = {
    style,
    hidden: false,
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    getBoundingClientRect: () => ({
      left: parseFloat(style.left ?? '300'),
      top: parseFloat(style.top ?? '200'),
      width: parseFloat(style.width ?? '360'),
      height: parseFloat(style.height ?? '420'),
    }),
  };
  const target = {
    setPointerCapture: vi.fn(),
    hasPointerCapture: () => true,
    releasePointerCapture: vi.fn(),
  };
  const event = (x: number, y: number, id = 1) =>
    ({
      pointerId: id,
      clientX: x,
      clientY: y,
      button: 0,
      isPrimary: true,
      currentTarget: target,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }) as unknown as PointerEvent<HTMLButtonElement>;
  // React hooks above are mocked: exercise gesture handlers without a DOM renderer.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handlers = useFloatingResize(
    {
      current: panel,
    } as unknown as RefObject<HTMLElement>,
    open,
  );
  return { style, panel, window, listeners, target, event, handlers };
}
describe('manual resize gestures', () => {
  it('releases capture and ignores subsequent moves when the chat closes', () => {
    const f = fixture(false),
      h = f.handlers('se');
    h.onPointerDown(f.event(660, 620));
    for (const effect of effects) effect();
    h.onPointerMove(f.event(800, 800));
    expect(f.style.width).toBeUndefined();
    expect(f.target.releasePointerCapture).toHaveBeenCalledWith(1);
  });
  it('uses pointer capture, ignores other pointers and ends cleanly on cancellation', () => {
    const f = fixture(),
      h = f.handlers('nw');
    h.onPointerDown(f.event(300, 200));
    expect(f.target.setPointerCapture).toHaveBeenCalledWith(1);
    h.onPointerMove(f.event(200, 120, 2));
    expect(f.style.width).toBeUndefined();
    h.onPointerMove(f.event(200, 120));
    expect(f.style).toMatchObject({
      left: '200px',
      top: '120px',
      width: '460px',
      height: '500px',
    });
    h.onPointerCancel(f.event(200, 120));
    h.onPointerMove(f.event(100, 100));
    expect(f.style.width).toBe('460px');
    expect(f.target.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(f.panel.removeAttribute).toHaveBeenCalledWith('data-resizing');
  });
  it('supports keyboard resizing and clamps an existing large panel after viewport shrink', () => {
    const f = fixture(),
      h = f.handlers('se');
    h.onKeyDown({
      key: 'ArrowRight',
      shiftKey: true,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent<HTMLButtonElement>);
    expect(f.style.width).toBe('408px');
    for (const effect of effects) effect();
    f.window.innerWidth = 320;
    f.window.innerHeight = 400;
    f.listeners.get('resize')?.();
    expect(f.style).toMatchObject({
      left: '12px',
      top: '12px',
      width: '296px',
      height: '376px',
    });
  });
});
