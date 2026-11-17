import { useEffect, useRef, useState } from 'react';

/** Scroll only the transcript, never the surrounding ERP page. */
export function useChatScroll(
  messages: unknown,
  pending: unknown,
  result: unknown,
  error: unknown,
) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const updatePosition = () => {
    const element = viewport.current;
    if (!element) return;
    following.current =
      element.scrollHeight - element.clientHeight - element.scrollTop <= 48;
    setShowLatest(!following.current);
  };
  const scrollToLatest = (smooth = false) => {
    following.current = true;
    const element = viewport.current;
    if (!element) return;
    element.scrollTo({
      top: element.scrollHeight,
      behavior:
        smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'smooth'
          : 'instant',
    });
    setShowLatest(false);
  };
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    if (following.current) {
      element.scrollTo({ top: element.scrollHeight, behavior: 'instant' });
      setShowLatest(false);
    } else {
      setShowLatest(
        element.scrollHeight - element.clientHeight - element.scrollTop > 48,
      );
    }
  }, [messages, pending, result, error]);
  useEffect(() => {
    const element = viewport.current;
    const body = content.current;
    if (!element || !body || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (following.current) {
        element.scrollTo({ top: element.scrollHeight, behavior: 'instant' });
      }
      setShowLatest(
        element.scrollHeight - element.clientHeight - element.scrollTop > 48,
      );
    });
    observer.observe(element);
    observer.observe(body);
    return () => observer.disconnect();
  }, []);
  return { viewport, content, showLatest, updatePosition, scrollToLatest };
}
