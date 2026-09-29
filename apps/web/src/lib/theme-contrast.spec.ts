import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/app/globals.css', 'utf8');
const dark = css.match(/\.dark\s*\{([^}]+)\}/)![1]!;
const tokens: Record<string, string> = Object.fromEntries(
  [...dark.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map((m) => [
    m[1]!,
    m[2]!,
  ]),
);
function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((c) => {
      const value = parseInt(c, 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}
describe('dark theme readability', () => {
  it.each(['background', 'surface', 'muted', 'popover'])(
    'keeps primary and secondary text readable on %s',
    (surface) => {
      expect(
        contrast(tokens.foreground!, tokens[surface]!),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(tokens['muted-foreground']!, tokens[surface]!),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );
  it('keeps controls and focus indicators distinguishable', () => {
    expect(
      contrast(tokens['primary-foreground']!, tokens.primary!),
    ).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.input!, tokens.surface!)).toBeGreaterThanOrEqual(3);
    expect(contrast(tokens.ring!, tokens.surface!)).toBeGreaterThanOrEqual(3);
  });
  it('uses neutral base surfaces', () => {
    for (const name of ['background', 'surface', 'muted', 'popover']) {
      const channels = tokens[name]!.slice(1)
        .match(/../g)!
        .map((c) => parseInt(c, 16));
      expect(Math.max(...channels) - Math.min(...channels)).toBeLessThanOrEqual(
        5,
      );
    }
  });
  it('keeps each reservation status legible', () => {
    const statuses = readFileSync(
      'src/modules/reservations/foundation/workspace.module.css',
      'utf8',
    );
    const blocks = [
      ...statuses.matchAll(
        /:global\(\.dark\) \.workspace \[data-tone='[^']+'\]\s*\{([^}]+)\}/g,
      ),
    ];
    expect(blocks).toHaveLength(5);
    expect(statuses).toMatch(
      /\[data-tone='darkGray'\][\s\S]*--tone-bg:\s*#334b5c;[\s\S]*--tone-edge:\s*#8fb4cc;/,
    );
    for (const [, block] of blocks) {
      const background = block!.match(/--tone-bg:\s*(#[\da-f]{6})/)![1]!;
      const foreground = block!.match(/--tone-text:\s*(#[\da-f]{6})/)![1]!;
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('legacy dark surfaces', () => {
  it('pairs every fallback color surface with readable foreground text', () => {
    const fallback = css.slice(css.indexOf('/* Legacy light utility'));
    for (const family of [
      'blue',
      'sky',
      'cyan',
      'indigo',
      'violet',
      'purple',
      'emerald',
      'green',
      'teal',
      'amber',
      'yellow',
      'orange',
      'red',
      'rose',
      'pink',
      'slate',
      'gray',
      'zinc',
      'neutral',
    ]) {
      const bg = fallback
        .slice(fallback.indexOf(`bg-${family}-50`))
        .match(/background-color:\s*(#[\da-f]{6})/)![1]!;
      const fg = fallback
        .slice(fallback.indexOf(`text-${family}-600`))
        .match(/color:\s*(#[\da-f]{6})/)![1]!;
      expect(contrast(fg, bg), family).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('keeps white banner labels readable along the complete blue/violet gradient', () => {
    for (const color of ['#1d4ed8', '#2563eb', '#7c3aed']) {
      expect(contrast('#ffffff', color)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
