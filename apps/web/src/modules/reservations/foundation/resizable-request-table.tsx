'use client';

import { useRef, useState, type ReactNode } from 'react';
import { reservationColumns } from './reservation-table';
import styles from './workspace.module.css';

const minColumnWidth = 44;
const maxColumnWidth = 1200;
const boundWidth = (width: number) =>
  Math.max(minColumnWidth, Math.min(maxColumnWidth, width));

/** Local to this mounted inbox table: never persist a user's temporary widths. */
export function ResizableRequestTable({ children }: { children: ReactNode }) {
  const table = useRef<HTMLTableElement>(null);
  const drag = useRef<{
    index: number;
    pointerId: number;
    startX: number;
    widths: number[];
    direction: number;
  } | null>(null);
  const [widths, setWidths] = useState<number[] | null>(null);
  const [resizing, setResizing] = useState<number | null>(null);

  function currentWidths() {
    return (
      (widths && [...widths]) ??
      Array.from(
        table.current!.querySelectorAll('thead th'),
        (header) => header.getBoundingClientRect().width,
      )
    );
  }

  function direction() {
    return getComputedStyle(table.current!).direction === 'rtl' ? -1 : 1;
  }

  return (
    <table
      ref={table}
      className={styles.requestTable}
      data-resized={widths ? true : undefined}
      data-resizing={resizing !== null ? true : undefined}
      style={
        widths
          ? {
              tableLayout: 'fixed',
              minWidth: 0,
              width: widths.reduce((total, width) => total + width, 0),
            }
          : undefined
      }
    >
      {widths && (
        <colgroup>
          {reservationColumns.map((column, index) => (
            <col key={column} style={{ width: widths[index] }} />
          ))}
        </colgroup>
      )}
      <thead>
        <tr>
          {reservationColumns.map((column, index) => (
            <th
              key={column}
              scope="col"
              data-room-category={
                ['SGL', 'DBL', 'EXT', 'FAM/TPL'].includes(column) || undefined
              }
            >
              <span className={styles.columnTitle} title={column}>
                {column}
              </span>
              <span
                className={styles.columnResizeHandle}
                role="separator"
                aria-orientation="vertical"
                aria-label={`تغییر عرض ستون ${column}`}
                aria-valuemin={minColumnWidth}
                aria-valuemax={maxColumnWidth}
                aria-valuenow={widths ? Math.round(widths[index]!) : undefined}
                tabIndex={0}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const measured = currentWidths();
                  drag.current = {
                    index,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    widths: measured,
                    direction: direction(),
                  };
                  setWidths(measured);
                  setResizing(index);
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  const active = drag.current;
                  if (!active || event.pointerId !== active.pointerId) return;
                  const next = [...active.widths];
                  next[active.index] = boundWidth(
                    active.widths[active.index]! +
                      (event.clientX - active.startX) * active.direction,
                  );
                  setWidths(next);
                }}
                onPointerUp={(event) => {
                  if (drag.current?.pointerId !== event.pointerId) return;
                  drag.current = null;
                  setResizing(null);
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onLostPointerCapture={() => {
                  drag.current = null;
                  setResizing(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
                    return;
                  event.preventDefault();
                  event.stopPropagation();
                  const measured = currentWidths();
                  const delta = event.key === 'ArrowRight' ? 16 : -16;
                  measured[index] = boundWidth(
                    measured[index]! + delta * direction(),
                  );
                  setWidths([...measured]);
                }}
              />
            </th>
          ))}
        </tr>
      </thead>
      {children}
    </table>
  );
}
