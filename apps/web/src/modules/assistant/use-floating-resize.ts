'use client';
import {
  useEffect,
  useRef,
  type PointerEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {
  boundPanel,
  resizePanel,
  type PanelBox,
  type ResizeEdge,
} from './floating-resize';

export function useFloatingResize(
  panel: RefObject<HTMLElement | null>,
  open = true,
) {
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    box: PanelBox;
    edge: ResizeEdge;
    target: HTMLButtonElement;
  } | null>(null);
  const resized = useRef(false);
  useEffect(() => {
    if (open) return;
    const current = gesture.current;
    gesture.current = null;
    panel.current?.removeAttribute('data-resizing');
    if (current?.target.hasPointerCapture(current.id))
      current.target.releasePointerCapture(current.id);
  }, [open, panel]);
  const viewport = () => ({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const measure = (): PanelBox | null => {
    const rect = panel.current?.getBoundingClientRect();
    return rect
      ? {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        }
      : null;
  };
  const apply = (box: PanelBox) => {
    if (!panel.current) return;
    Object.assign(panel.current.style, {
      position: 'fixed',
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      right: 'auto',
      bottom: 'auto',
    });
    resized.current = true;
  };
  useEffect(() => {
    const constrain = () => {
      const element = panel.current;
      if (!resized.current || !element || element.hidden) return;
      const rect = element.getBoundingClientRect();
      const box = boundPanel(
        {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
        { width: window.innerWidth, height: window.innerHeight },
      );
      Object.assign(element.style, {
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      });
    };
    window.addEventListener('resize', constrain);
    window.visualViewport?.addEventListener('resize', constrain);
    return () => {
      window.removeEventListener('resize', constrain);
      window.visualViewport?.removeEventListener('resize', constrain);
    };
  }, [panel]);
  const end = (event: PointerEvent<HTMLButtonElement>) => {
    if (gesture.current?.id !== event.pointerId) return;
    gesture.current = null;
    panel.current?.removeAttribute('data-resizing');
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (edge: ResizeEdge) => ({
    onPointerDown(event: PointerEvent<HTMLButtonElement>) {
      if (!event.isPrimary || event.button !== 0) return;
      const box = measure();
      if (!box) return;
      event.preventDefault();
      event.stopPropagation();
      gesture.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        box,
        edge,
        target: event.currentTarget,
      };
      panel.current?.setAttribute('data-resizing', 'true');
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLButtonElement>) {
      const current = gesture.current;
      if (!current || current.id !== event.pointerId) return;
      event.preventDefault();
      apply(
        resizePanel(
          current.box,
          current.edge,
          event.clientX - current.x,
          event.clientY - current.y,
          viewport(),
        ),
      );
    },
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
    onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
      const step = event.shiftKey ? 48 : 16;
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const move = delta[event.key],
        box = measure();
      if (!move || !box) return;
      event.preventDefault();
      event.stopPropagation();
      apply(resizePanel(box, edge, move[0], move[1], viewport()));
    },
  });
}
