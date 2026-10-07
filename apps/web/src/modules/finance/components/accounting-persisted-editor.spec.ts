import { describe, expect, it, vi } from 'vitest';
import { submitPersistedEditor } from './accounting-persisted-editor';

describe('persisted accounting editor command path', () => {
  it.each(['save-account-group', 'save-detail-group'])(
    'adopts created and consecutively updated %s identity/version and retains it after failure',
    async (action) => {
      let selected: { id: string; version: number } | null = null;
      const run = vi
        .fn()
        .mockResolvedValueOnce({ id: 'group-1', version: 1 })
        .mockResolvedValueOnce({ id: 'group-1', version: 2 })
        .mockResolvedValueOnce({ id: 'group-1', version: 3 })
        .mockResolvedValueOnce(undefined);
      const adopt = (saved: { id: string; version: number }) => {
        selected = saved;
      };

      for (let call = 0; call < 4; call += 1)
        await submitPersistedEditor(
          run,
          action,
          { code: `G${call}` },
          selected,
          adopt,
        );

      expect(run.mock.calls).toEqual([
        [action, { code: 'G0' }, undefined],
        [action, { code: 'G1', id: 'group-1' }, 1],
        [action, { code: 'G2', id: 'group-1' }, 2],
        [action, { code: 'G3', id: 'group-1' }, 3],
      ]);
      expect(selected).toEqual({ id: 'group-1', version: 3 });
    },
  );

  it.each(['AUTOMATIC', 'REVALUATION', 'CLOSING'])(
    'adopts created and consecutively updated %s template identity/version and retains it after failure',
    async (kind) => {
      let selected: { id: string; version: number } | null = null;
      const run = vi
        .fn()
        .mockResolvedValueOnce({ id: 'template-1', version: 1 })
        .mockResolvedValueOnce({ id: 'template-1', version: 2 })
        .mockResolvedValueOnce({ id: 'template-1', version: 3 })
        .mockResolvedValueOnce(undefined);
      const adopt = (saved: { id: string; version: number }) => {
        selected = saved;
      };

      for (let call = 0; call < 4; call += 1)
        await submitPersistedEditor(
          run,
          'save-template',
          { kind, code: `T${call}` },
          selected,
          adopt,
        );

      expect(run.mock.calls).toEqual([
        ['save-template', { kind, code: 'T0' }, undefined],
        ['save-template', { kind, code: 'T1', id: 'template-1' }, 1],
        ['save-template', { kind, code: 'T2', id: 'template-1' }, 2],
        ['save-template', { kind, code: 'T3', id: 'template-1' }, 3],
      ]);
      expect(selected).toEqual({ id: 'template-1', version: 3 });
    },
  );
});
