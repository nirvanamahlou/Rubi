import { canonicalTestTree } from '@/i18n/test-tree';
import { isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { MarketingAssetViewV1 } from '@nora/contracts';
import {
  automationDraftFromAsset,
  automationInputFromDraft,
  type AutomationDraft,
} from '../model/durable-records';
import { AutomationGraphCanvas } from './marketing-durable-panels';

const ports = ['top', 'right', 'bottom', 'left'] as const;
function draftWithNodes(count: number): AutomationDraft {
  return {
    id: 'saved',
    version: 7,
    name: 'Saved graph',
    nodes: Array.from({ length: count }, (_, index) => ({
      id: `node-${index}`,
      title: 'مرحله با عنوان طولانی و چند خطی '.repeat(index + 1),
    })),
    edges: ports.map((port, index) => ({
      source: 'node-0',
      target: `node-${count - 1}`,
      sourcePort: port,
      targetPort: ports[(index + 2) % 4]!,
    })),
  };
}
function attributes(element: string) {
  return Object.fromEntries(
    [...element.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
}

describe('AutomationGraphCanvas shared rendered geometry', () => {
  it.each([2, 5, 11])(
    'aligns every side after save/reopen/edit for %i nodes at multiple viewport sizes',
    (count) => {
      const original = draftWithNodes(count);
      const saved = automationInputFromDraft(original);
      const reopened = automationDraftFromAsset({
        ...saved,
        id: 'saved',
        version: 8,
      } as MarketingAssetViewV1);
      reopened.nodes.push({ id: 'added', title: 'مرحله جدید' });
      reopened.edges[0] = { ...reopened.edges[0]!, target: 'added' };
      const html = renderToStaticMarkup(
        <AutomationGraphCanvas draft={reopened} />,
      );
      const svg = attributes(html.match(/<svg[^>]+>/)![0]);
      const [, , width, height] = svg.viewBox!.split(' ').map(Number);
      const boxes = [...html.matchAll(/<foreignObject[^>]+>/g)].map((match) =>
        attributes(match[0]),
      );
      const lines = [...html.matchAll(/<line\s[^>]+>/g)].map((match) =>
        attributes(match[0]),
      );
      expect(lines).toHaveLength(4);
      expect(svg.preserveAspectRatio).not.toBe('none');
      expect(html).toContain('box-border size-full overflow-auto');
      for (const [viewportWidth, viewportHeight] of [
        [320, 180],
        [600, 448],
        [1200, 900],
      ]) {
        const scale = Math.min(
          viewportWidth! / width!,
          viewportHeight! / height!,
        );
        const screen = (x: number, y: number) => [
          x * scale + (viewportWidth! - width! * scale) / 2,
          y * scale + (viewportHeight! - height! * scale) / 2,
        ];
        for (const line of lines) {
          for (const [end, xy] of [
            ['source', '1'],
            ['target', '2'],
          ]) {
            const id = line[`data-${end}`]!;
            const side = line[`data-${end}-port`]!;
            const card = boxes.find((box) => box['data-node'] === id)!;
            const port = boxes.find(
              (box) => box['data-node-port'] === `${id}:${side}`,
            )!;
            const expectedX =
              Number(card.x) +
              Number(card.width) *
                (side === 'left' ? 0 : side === 'right' ? 1 : 0.5);
            const expectedY =
              Number(card.y) +
              Number(card.height) *
                (side === 'top' ? 0 : side === 'bottom' ? 1 : 0.5);
            // Derive card boundary, rendered button center and SVG endpoint
            // independently from actual markup before transforming to pixels.
            expect(
              screen(
                Number(port.x) + Number(port.width) / 2,
                Number(port.y) + Number(port.height) / 2,
              ),
            ).toEqual(screen(expectedX, expectedY));
            expect(
              screen(Number(line[`x${xy}`]), Number(line[`y${xy}`])),
            ).toEqual(screen(expectedX, expectedY));
            expect(Number(card.y) + Number(card.height)).toBeLessThan(height!);
          }
        }
      }
      expect(automationInputFromDraft(reopened)).toMatchObject({
        expectedVersion: 8,
        payload: { nodes: reopened.nodes, edges: reopened.edges },
      });
    },
  );

  it('routes all four actual port buttons to the selected node and disables read-only ports', () => {
    const select = vi.fn();
    const buttons = (node: ReactNode): Array<Record<string, unknown>> => {
  node = canonicalTestTree(node);
      if (Array.isArray(node)) return node.flatMap(buttons);
      if (!isValidElement<{ children?: ReactNode }>(node)) return [];
      return node.type === 'button'
        ? [node.props]
        : buttons(node.props.children);
    };
    const interactive = buttons(
      AutomationGraphCanvas({ draft: draftWithNodes(2), onPortSelect: select }),
    );
    interactive.forEach((button) => (button.onClick as () => void)());
    expect(select.mock.calls).toEqual(
      ['node-0', 'node-1'].flatMap((id) => ports.map((port) => [id, port])),
    );
    expect(
      buttons(AutomationGraphCanvas({ draft: draftWithNodes(2) })).every(
        (button) => button.disabled === true,
      ),
    ).toBe(true);
  });
});
