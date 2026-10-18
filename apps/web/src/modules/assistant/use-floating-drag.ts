'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import {
  boundLauncher,
  floatingDragPoint,
  placeFloatingPanel,
  type FloatingPoint,
} from './floating-position';

interface Gesture {
  id: number;
  start: FloatingPoint;
  origin: FloatingPoint;
  moved: boolean;
}

export function useFloatingDrag({
  launcher,
  panel,
  open,
  expanded,
  english,
}: {
  launcher: RefObject<HTMLButtonElement | null>;
  panel: RefObject<HTMLElement | null>;
  open: boolean;
  expanded: boolean;
  english: boolean;
}) {
  const [position, setPosition] = useState<FloatingPoint | null>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>();
  const [dragging, setDragging] = useState(false);
  const [viewportRevision, setViewportRevision] = useState(0);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const viewport = () => ({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const resize = () => {
      const button = launcher.current;
      if (button)
        setPosition((point) =>
          point
            ? boundLauncher(point, button.getBoundingClientRect(), viewport())
            : null,
        );
      setViewportRevision((value) => value + 1);
    };
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
    };
  }, [launcher]);

  useEffect(() => {
    setPosition(null);
    gesture.current = null;
    setDragging(false);
  }, [english]);

  useLayoutEffect(() => {
    if (!position || !open || !panel.current || !launcher.current) {
      setPanelStyle(undefined);
      return;
    }
    const point = placeFloatingPanel(
      position,
      launcher.current.getBoundingClientRect(),
      panel.current.getBoundingClientRect(),
      viewport(),
      english,
    );
    setPanelStyle({
      position: 'fixed',
      left: point.x,
      top: point.y,
      right: 'auto',
      bottom: 'auto',
    });
  }, [position, open, expanded, english, panel, launcher, viewportRevision]);

  const move = (point: FloatingPoint) => {
    const button = launcher.current;
    if (button)
      setPosition(
        boundLauncher(point, button.getBoundingClientRect(), viewport()),
      );
  };

  const pointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    suppressClick.current = false;
    gesture.current = {
      id: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: { x: rect.left, y: rect.top },
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current || event.pointerId !== current.id) return;
    const point = floatingDragPoint(
      current.start,
      { x: event.clientX, y: event.clientY },
      current.origin,
      current.moved,
    );
    if (!point) return;
    current.moved = true;
    suppressClick.current = true;
    setDragging(true);
    event.preventDefault();
    move(point);
  };
  const pointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (gesture.current?.id !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Home') {
      event.preventDefault();
      setPosition(null);
      return;
    }
    const delta: Record<string, FloatingPoint> = {
      ArrowLeft: { x: -20, y: 0 },
      ArrowRight: { x: 20, y: 0 },
      ArrowUp: { x: 0, y: -20 },
      ArrowDown: { x: 0, y: 20 },
    };
    const step = delta[event.key];
    if (!step || !launcher.current) return;
    event.preventDefault();
    const rect = launcher.current.getBoundingClientRect();
    move({ x: rect.left + step.x, y: rect.top + step.y });
  };

  return {
    dragging,
    widgetStyle: position
      ? ({
          left: position.x,
          top: position.y,
          right: 'auto',
          bottom: 'auto',
        } satisfies CSSProperties)
      : undefined,
    panelStyle,
    consumeClick(detail: number) {
      const suppressed = suppressClick.current && detail !== 0;
      suppressClick.current = false;
      return suppressed;
    },
    launcherEvents: {
      onPointerDown: pointerDown,
      onPointerMove: pointerMove,
      onPointerUp: pointerEnd,
      onPointerCancel: pointerEnd,
      onLostPointerCapture: pointerEnd,
      onKeyDown: keyDown,
    },
  };
}
