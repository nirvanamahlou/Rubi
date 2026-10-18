export interface FloatingPoint {
  x: number;
  y: number;
}
export interface FloatingSize {
  width: number;
  height: number;
}

function bound(value: number, size: number, available: number) {
  const gap = Math.min(12, Math.max(0, (available - size) / 2));
  return Math.max(gap, Math.min(value, Math.max(gap, available - size - gap)));
}

export function boundLauncher(
  point: FloatingPoint,
  launcher: FloatingSize,
  viewport: FloatingSize,
): FloatingPoint {
  return {
    x: bound(point.x, launcher.width, viewport.width),
    y: bound(point.y, launcher.height, viewport.height),
  };
}

export function placeFloatingPanel(
  point: FloatingPoint,
  launcher: FloatingSize,
  panel: FloatingSize,
  viewport: FloatingSize,
  english: boolean,
): FloatingPoint {
  const above = point.y - panel.height - 16;
  const below = point.y + launcher.height + 16;
  return {
    x: bound(
      english ? point.x + launcher.width - panel.width : point.x,
      panel.width,
      viewport.width,
    ),
    y: bound(
      above >= 12 || below + panel.height > viewport.height - 12
        ? above
        : below,
      panel.height,
      viewport.height,
    ),
  };
}

/** A click remains a click until the pointer moves six CSS pixels. */
export function floatingDragPoint(
  start: FloatingPoint,
  current: FloatingPoint,
  origin: FloatingPoint,
  alreadyDragging: boolean,
): FloatingPoint | null {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  if (!alreadyDragging && Math.hypot(dx, dy) < 6) return null;
  return { x: origin.x + dx, y: origin.y + dy };
}
