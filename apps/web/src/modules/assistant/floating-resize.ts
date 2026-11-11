import type { FloatingSize } from './floating-position';

export const resizeEdges = [
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
] as const;
export type ResizeEdge = (typeof resizeEdges)[number];
export interface PanelBox extends FloatingSize {
  left: number;
  top: number;
}
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

export function boundPanel(box: PanelBox, viewport: FloatingSize): PanelBox {
  const width = Math.min(box.width, Math.max(1, viewport.width - 24));
  const height = Math.min(box.height, Math.max(1, viewport.height - 24));
  return {
    width,
    height,
    left: clamp(box.left, 12, Math.max(12, viewport.width - width - 12)),
    top: clamp(box.top, 12, Math.max(12, viewport.height - height - 12)),
  };
}

/** Physical edges are independent of the chat language. Opposite edges stay fixed. */
export function resizePanel(
  box: PanelBox,
  edge: ResizeEdge,
  dx: number,
  dy: number,
  viewport: FloatingSize,
): PanelBox {
  const start = boundPanel(box, viewport);
  let { left, top, width, height } = start;
  const right = left + width,
    bottom = top + height;
  const minWidth = Math.max(1, Math.min(280, start.width, viewport.width - 24)),
    minHeight = Math.max(1, Math.min(300, start.height, viewport.height - 24));
  if (edge.includes('w')) {
    left = clamp(left + dx, 12, right - minWidth);
    width = right - left;
  }
  if (edge.includes('e'))
    width = clamp(width + dx, minWidth, viewport.width - left - 12);
  if (edge.includes('n')) {
    top = clamp(top + dy, 12, bottom - minHeight);
    height = bottom - top;
  }
  if (edge.includes('s'))
    height = clamp(height + dy, minHeight, viewport.height - top - 12);
  return { left, top, width, height };
}
