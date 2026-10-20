/** Both elements inherit the same direction, including native RTL scrollLeft. */
export function connectEntryTableScroll(
  upper: HTMLDivElement,
  lower: HTMLDivElement,
) {
  const measure = () => {
    const spacer = upper.firstElementChild as HTMLElement | null;
    if (spacer) spacer.style.width = `${lower.scrollWidth}px`;
    upper.hidden = lower.scrollWidth <= lower.clientWidth;
    upper.scrollLeft = lower.scrollLeft;
  };
  const syncTop = () => {
    if (lower.scrollLeft !== upper.scrollLeft)
      lower.scrollLeft = upper.scrollLeft;
  };
  const syncBottom = () => {
    if (upper.scrollLeft !== lower.scrollLeft)
      upper.scrollLeft = lower.scrollLeft;
  };
  upper.addEventListener('scroll', syncTop, { passive: true });
  lower.addEventListener('scroll', syncBottom, { passive: true });
  const observer =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
  observer?.observe(lower);
  if (lower.firstElementChild) observer?.observe(lower.firstElementChild);
  window.addEventListener('resize', measure);
  measure();
  return () => {
    observer?.disconnect();
    window.removeEventListener('resize', measure);
    upper.removeEventListener('scroll', syncTop);
    lower.removeEventListener('scroll', syncBottom);
  };
}
