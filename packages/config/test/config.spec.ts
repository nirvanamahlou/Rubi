import { describe, expect, it } from 'vitest';

import { parseCommaSeparatedList, parseRedisUrl } from '../src';

describe('shared configuration helpers', () => {
  it('normalizes comma-separated values', () => {
    expect(
      parseCommaSeparatedList('http://localhost:3000, https://rubi.test '),
    ).toEqual(['http://localhost:3000', 'https://rubi.test']);
  });

  it('parses authenticated Redis URLs without exposing credentials', () => {
    expect(parseRedisUrl('redis://worker:secret@localhost:6380')).toEqual({
      host: 'localhost',
      port: 6380,
      username: 'worker',
      password: 'secret',
    });
  });
});
