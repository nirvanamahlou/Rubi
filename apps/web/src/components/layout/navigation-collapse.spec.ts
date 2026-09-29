import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('navigation collapse across route changes', () => {
  const source = readFileSync('src/components/layout/app-shell.tsx', 'utf8');
  const state = source.slice(
    source.indexOf('const [closedGroups'),
    source.indexOf('function renderItem'),
  );
  it('starts with sales expanded and keeps group state route-independent', () => {
    expect(state).not.toContain('pathname');
    expect(state).toContain(".filter((group) => group.id !== 'sales')");
    expect(state).toContain('.map((group) => group.id)');
    expect(state).toContain('ids.filter((value) => value !== id)');
    expect(state).toContain('[...ids, id]');
  });
  it('retains accessible, individually controlled groups', () => {
    expect(source).toContain('aria-expanded={!isGroupClosed(group.id)}');
    expect(source).toContain('hidden={isGroupClosed(group.id)}');
    expect(source).toContain('onClick={() => toggleGroup(group.id)}');
  });
});
