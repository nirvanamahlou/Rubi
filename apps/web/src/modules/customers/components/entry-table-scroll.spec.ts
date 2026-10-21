import { afterEach, expect, it, vi } from 'vitest';
import { connectEntryTableScroll } from './entry-table-scroll';

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const win = new EventTarget();
  vi.stubGlobal('window', win);
  let resize = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  const upper = Object.assign(new EventTarget(), {
    scrollLeft: 0,
    hidden: false,
    firstElementChild: { style: { width: '' } },
  });
  const lower = Object.assign(new EventTarget(), {
    scrollLeft: 0,
    scrollWidth: 1800,
    clientWidth: 900,
    firstElementChild: {},
  });
  const cleanup = connectEntryTableScroll(
    upper as unknown as HTMLDivElement,
    lower as unknown as HTMLDivElement,
  );
  return { upper, lower, cleanup, disconnect, resize: () => resize(), win };
}

it.each([-450, 450])(
  'synchronizes native RTL/LTR positions in both directions (%s)',
  (position) => {
    const { upper, lower, cleanup } = setup();
    expect(upper.firstElementChild.style.width).toBe('1800px');
    upper.scrollLeft = position;
    upper.dispatchEvent(new Event('scroll'));
    expect(lower.scrollLeft).toBe(position);
    lower.scrollLeft = position / 2;
    lower.dispatchEvent(new Event('scroll'));
    expect(upper.scrollLeft).toBe(position / 2);
    cleanup();
  },
);

it('remeasures dynamic columns, hides the spare bar when it fits, and removes listeners', () => {
  const { upper, lower, resize, win, cleanup, disconnect } = setup();
  lower.scrollWidth = 2200;
  resize();
  expect(upper.firstElementChild.style.width).toBe('2200px');
  expect(upper.hidden).toBe(false);
  lower.clientWidth = 2400;
  win.dispatchEvent(new Event('resize'));
  expect(upper.hidden).toBe(true);
  cleanup();
  expect(disconnect).toHaveBeenCalledOnce();
  upper.scrollLeft = -500;
  upper.dispatchEvent(new Event('scroll'));
  expect(lower.scrollLeft).toBe(0);
});
