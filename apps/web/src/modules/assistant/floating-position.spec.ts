import { describe, expect, it } from 'vitest';
import {
  boundLauncher,
  floatingDragPoint,
  placeFloatingPanel,
} from './floating-position';

describe('floating assistant movement', () => {
  it('distinguishes jitter from dragging and retains a drag after returning to origin', () => {
    const start = { x: 50, y: 500 };
    const origin = { x: 20, y: 470 };
    expect(
      floatingDragPoint(start, { x: 53, y: 503 }, origin, false),
    ).toBeNull();
    expect(floatingDragPoint(start, { x: 56, y: 500 }, origin, false)).toEqual({
      x: 26,
      y: 470,
    });
    expect(floatingDragPoint(start, { x: 50, y: 500 }, origin, true)).toEqual(
      origin,
    );
  });

  it('keeps the launcher visible at all edges and after viewport shrink', () => {
    const size = { width: 60, height: 60 };
    expect(
      boundLauncher({ x: -500, y: -500 }, size, { width: 1440, height: 900 }),
    ).toEqual({ x: 12, y: 12 });
    expect(
      boundLauncher({ x: 2000, y: 2000 }, size, { width: 390, height: 640 }),
    ).toEqual({ x: 318, y: 568 });
    expect(
      boundLauncher({ x: 500, y: 500 }, size, { width: 70, height: 70 }),
    ).toEqual({ x: 5, y: 5 });
  });

  it.each([false, true])(
    'keeps both compact and expanded panels inside the viewport, english=%s',
    (english) => {
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 390, height: 640 },
      ]) {
        const launcher = { width: 56, height: 56 };
        for (const desiredWidth of [360, 640]) {
          const panel = {
            width: Math.min(desiredWidth, viewport.width - 24),
            height: Math.min(420, viewport.height - 104),
          };
          for (const point of [
            { x: 12, y: 12 },
            { x: viewport.width - 68, y: 12 },
            { x: viewport.width - 68, y: viewport.height - 68 },
            { x: viewport.width / 2, y: viewport.height / 2 },
          ]) {
            const placed = placeFloatingPanel(
              point,
              launcher,
              panel,
              viewport,
              english,
            );
            expect(placed.x).toBeGreaterThanOrEqual(12);
            expect(placed.y).toBeGreaterThanOrEqual(12);
            expect(placed.x + panel.width).toBeLessThanOrEqual(
              viewport.width - 12,
            );
            expect(placed.y + panel.height).toBeLessThanOrEqual(
              viewport.height - 12,
            );
          }
        }
      }
    },
  );

  it('opens below a launcher near the top and above one near the bottom', () => {
    const launcher = { width: 60, height: 60 };
    const panel = { width: 360, height: 420 };
    const viewport = { width: 1440, height: 900 };
    expect(
      placeFloatingPanel({ x: 400, y: 12 }, launcher, panel, viewport, false),
    ).toEqual({ x: 400, y: 88 });
    expect(
      placeFloatingPanel({ x: 900, y: 800 }, launcher, panel, viewport, true),
    ).toEqual({ x: 600, y: 364 });
  });
});
