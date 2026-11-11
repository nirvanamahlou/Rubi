import { describe, expect, it } from 'vitest';
import { boundPanel, resizeEdges, resizePanel } from './floating-resize';
const box = { left: 300, top: 200, width: 360, height: 420 };
const viewport = { width: 1200, height: 900 };
describe('floating chat manual resizing', () => {
  it('moves the selected physical corner while keeping the opposite corner fixed', () => {
    expect(resizePanel(box, 'nw', -100, -80, viewport)).toEqual({
      left: 200,
      top: 120,
      width: 460,
      height: 500,
    });
    expect(resizePanel(box, 'se', 100, 80, viewport)).toEqual({
      left: 300,
      top: 200,
      width: 460,
      height: 500,
    });
    expect(resizePanel(box, 'ne', 100, -80, viewport)).toEqual({
      left: 300,
      top: 120,
      width: 460,
      height: 500,
    });
    expect(resizePanel(box, 'sw', -100, 80, viewport)).toEqual({
      left: 200,
      top: 200,
      width: 460,
      height: 500,
    });
  });
  it.each(resizeEdges)(
    'keeps %s within the viewport for extreme drags in both directions',
    (edge) => {
      for (const delta of [-10000, 10000]) {
        const result = resizePanel(box, edge, delta, delta, viewport);
        expect(result.left).toBeGreaterThanOrEqual(12);
        expect(result.top).toBeGreaterThanOrEqual(12);
        expect(result.left + result.width).toBeLessThanOrEqual(1188);
        expect(result.top + result.height).toBeLessThanOrEqual(888);
        expect(result.width).toBeGreaterThanOrEqual(280);
        expect(result.height).toBeGreaterThanOrEqual(300);
      }
    },
  );
  it('fits smaller viewports even below the normal minimum size', () => {
    const small = { width: 240, height: 280 };
    const fit = boundPanel(box, small);
    expect(fit).toEqual({ left: 12, top: 12, width: 216, height: 256 });
    expect(resizePanel(fit, 'nw', 10000, 10000, small)).toEqual(fit);
  });
});
