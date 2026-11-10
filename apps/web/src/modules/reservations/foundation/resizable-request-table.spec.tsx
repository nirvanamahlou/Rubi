import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ResizableRequestTable } from './resizable-request-table';
import { reservationColumns } from './reservation-table';

const fixture = vi.hoisted(() => ({
  values: [] as unknown[],
  stateIndex: 0,
  refs: [] as { current: unknown }[],
  refIndex: 0,
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const index = fixture.stateIndex++;
    if (!(index in fixture.values)) fixture.values[index] = initial;
    return [
      fixture.values[index],
      (next: unknown) => {
        fixture.values[index] = next;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = fixture.refIndex++;
    fixture.refs[index] ??= { current: initial };
    return fixture.refs[index];
  },
}));

const naturalWidths = reservationColumns.map((_, index) => 90 + index * 3);
const capture = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() };
const measuredTable = {
  ...capture,
  querySelectorAll: () =>
    naturalWidths.map((width) => ({
      getBoundingClientRect: () => ({ width }),
    })),
};
function render() {
  fixture.stateIndex = 0;
  fixture.refIndex = 0;
  const tree = ResizableRequestTable({
    children: (
      <tbody>
        <tr>
          <td>Unchanged row</td>
        </tr>
      </tbody>
    ),
  });
  const ref = tree.props.ref as React.RefObject<unknown>;
  ref.current = measuredTable;
  return tree;
}
function handles(tree: React.ReactNode): React.ComponentProps<'span'>[] {
  if (!React.isValidElement<React.ComponentProps<'span'>>(tree)) return [];
  if (tree.props.role === 'separator') return [tree.props];
  return React.Children.toArray(tree.props.children).flatMap(handles);
}
function sizes(tree: ReturnType<typeof render>) {
  const colgroup = React.Children.toArray(tree.props.children).find(
    (node) => React.isValidElement(node) && node.type === 'colgroup',
  ) as React.ReactElement<{
    children: React.ReactElement<React.ComponentProps<'col'>>[];
  }>;
  return colgroup.props.children.map((col) => col.props.style!.width as number);
}
function pointer(clientX: number, pointerId = 7, button = 0) {
  return {
    clientX,
    pointerId,
    button,
    currentTarget: capture,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.PointerEvent<HTMLSpanElement> &
    React.PointerEvent<HTMLTableElement>;
}
beforeEach(() => {
  fixture.values = [];
  fixture.refs = [];
  vi.stubGlobal('getComputedStyle', () => ({ direction: 'rtl' }));
});
afterEach(() => vi.unstubAllGlobals());

it('retains automatic initial layout and exposes a keyboard-focusable handle for every column', () => {
  const tree = render();
  expect(tree.props.style).toBeUndefined();
  const controls = handles(tree);
  expect(controls).toHaveLength(reservationColumns.length);
  expect(
    controls.every(
      (control) =>
        control.tabIndex === 0 && control['aria-orientation'] === 'vertical',
    ),
  ).toBe(true);
  const html = renderToStaticMarkup(tree);
  expect(html).not.toContain('<colgroup>');
  expect(html).not.toContain('data-resized');
  expect(html).toContain('Unchanged row');
});

it('freezes measured widths then enlarges only the dragged RTL column and table by the same amount', () => {
  const index = reservationColumns.indexOf('Hotel');
  const control = handles(render())[index]!;
  const down = pointer(600);
  control.onPointerDown!(
    down as unknown as React.PointerEvent<HTMLSpanElement>,
  );
  expect(down.preventDefault).toHaveBeenCalled();
  expect(capture.setPointerCapture).toHaveBeenCalledWith(7);
  expect(sizes(render())).toEqual(naturalWidths);
  render().props.onPointerMove!(pointer(520));
  const tree = render();
  const expected = [...naturalWidths];
  expected[index]! += 80;
  expect(sizes(tree)).toEqual(expected);
  expect(tree.props.style).toEqual({
    tableLayout: 'fixed',
    minWidth: 0,
    width: expected.reduce((a, b) => a + b, 0),
  });
  render().props.onPointerUp!(pointer(520));
  render().props.onPointerMove!(pointer(100));
  expect(sizes(render())).toEqual(expected);
  expect(render().props['data-resizing']).toBeUndefined();
});

it('bounds shrinking/expanding, ignores other pointers and stops after capture is lost', () => {
  const control = handles(render())[0]!;
  control.onPointerDown!(pointer(500, 7, 2));
  expect(render().props.style).toBeUndefined();
  control.onPointerDown!(pointer(500));
  render().props.onPointerMove!(pointer(6000, 8));
  expect(sizes(render())[0]).toBe(naturalWidths[0]);
  render().props.onPointerMove!(pointer(6000));
  expect(sizes(render())[0]).toBe(44);
  render().props.onPointerMove!(pointer(-6000));
  expect(sizes(render())[0]).toBe(1200);
  render().props.onLostPointerCapture!(pointer(-6000));
  render().props.onPointerMove!(pointer(500));
  expect(sizes(render())[0]).toBe(1200);
});

it('uses the actual table direction for LTR drag and keyboard resizing', () => {
  vi.stubGlobal('getComputedStyle', () => ({ direction: 'ltr' }));
  const control = handles(render())[1]!;
  control.onPointerDown!(pointer(500));
  render().props.onPointerMove!(pointer(550));
  expect(sizes(render())[1]).toBe(naturalWidths[1]! + 50);
  render().props.onPointerUp!(pointer(550));
  const event = {
    key: 'ArrowRight',
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLSpanElement>;
  handles(render())[1]!.onKeyDown!(event);
  expect(sizes(render())[1]).toBe(naturalWidths[1]! + 66);
  vi.stubGlobal('getComputedStyle', () => ({ direction: 'rtl' }));
  handles(render())[1]!.onKeyDown!(event);
  expect(sizes(render())[1]).toBe(naturalWidths[1]! + 50);
});

it('keeps widths on a table refresh but resets to natural sizes on a new inbox visit', () => {
  const control = handles(render())[2]!;
  control.onPointerDown!(pointer(500));
  render().props.onPointerMove!(pointer(420));
  render().props.onPointerUp!(pointer(420));
  expect(sizes(render())[2]).toBe(naturalWidths[2]! + 80);
  expect(sizes(render())[2]).toBe(naturalWidths[2]! + 80);
  fixture.values = [];
  fixture.refs = [];
  const reopened = render();
  expect(reopened.props.style).toBeUndefined();
  expect(renderToStaticMarkup(reopened)).not.toContain('<colgroup>');
});
