import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  calendarMonthDays,
  calendarParts,
  moveCalendarMonth,
} from './date-picker.utils';

const calendars = [
  'components/ui/date-picker.tsx',
  'modules/customers/components/customer-date-field.tsx',
  'modules/ticket-catalog/components/ticket-date-picker.tsx',
  'modules/sales/components/flight-date-range.tsx',
  'modules/marketing/components/campaign-calendar.tsx',
  'modules/workbench/workbench-calendar.tsx',
  'modules/hr/shift-calendar.tsx',
];

function attribute(node: ts.JsxOpeningElement, name: string): string {
  const value = node.attributes.properties.find(
    (item): item is ts.JsxAttribute =>
      ts.isJsxAttribute(item) && item.name.getText() === name,
  );
  return value?.initializer?.getText() ?? '';
}

describe('project-wide calendar physical direction', () => {
  for (const path of calendars) {
    it(`${path}: previous at left, next at right, aligned LTR weekday/day grid`, () => {
      const source = ts.createSourceFile(
        path,
        readFileSync(join(process.cwd(), 'src', path), 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const arrows: ts.JsxSelfClosingElement[] = [];
      const grids: ts.JsxOpeningElement[] = [];
      function visit(node: ts.Node) {
        if (
          ts.isJsxSelfClosingElement(node) &&
          ['ChevronLeft', 'ChevronRight'].includes(node.tagName.getText())
        )
          arrows.push(node);
        if (
          ts.isJsxOpeningElement(node) &&
          /grid-cols-7|ui\.shiftGrid/.test(attribute(node, 'className'))
        )
          grids.push(node);
        ts.forEachChild(node, visit);
      }
      visit(source);
      expect(arrows.map((arrow) => arrow.tagName.getText())).toEqual([
        'ChevronLeft',
        'ChevronRight',
      ]);
      for (const [index, arrow] of arrows.entries()) {
        let button: ts.Node | undefined = arrow.parent;
        while (
          button &&
          !(
            ts.isJsxElement(button) &&
            ['button', 'Button', 'HrButton'].includes(
              button.openingElement.tagName.getText(),
            )
          )
        )
          button = button.parent;
        expect(button && ts.isJsxElement(button)).toBe(true);
        const opening = (button as ts.JsxElement).openingElement;
        expect(attribute(opening, 'onClick')).toMatch(
          index === 0 ? /Backward|\(-1\)|, -1/ : /Forward|\(1\)|, 1/,
        );
        let container: ts.Node | undefined = button?.parent;
        while (
          container &&
          !(
            ts.isJsxElement(container) &&
            container.openingElement.tagName.getText() === 'div'
          )
        )
          container = container.parent;
        expect(
          attribute((container as ts.JsxElement).openingElement, 'dir'),
        ).toBe('"ltr"');
      }
      expect(grids.length).toBeGreaterThan(0);
      for (const grid of grids) expect(attribute(grid, 'dir')).toBe('"ltr"');
    });
  }

  it('keeps Saturday-first columns and month/year rollover correct', () => {
    for (const anchor of [
      new Date(2026, 2, 20, 12),
      new Date(2026, 9, 3, 12),
    ]) {
      const days = calendarMonthDays(anchor, 'persian');
      expect(new Date(`${days[0]!.isoDate}T12:00:00`).getDay()).toBe(6);
      const current = calendarParts(anchor, 'persian');
      const next = calendarParts(
        moveCalendarMonth(anchor, 1, 'persian'),
        'persian',
      );
      expect(next.month).toBe(current.month === 12 ? 1 : current.month + 1);
      expect(next.year).toBe(current.year + (current.month === 12 ? 1 : 0));
      expect(
        calendarParts(
          moveCalendarMonth(
            moveCalendarMonth(anchor, 1, 'persian'),
            -1,
            'persian',
          ),
          'persian',
        ).month,
      ).toBe(current.month);
    }
  });
});
