import { describe, expect, it } from 'vitest';
import { documentReturnPath } from './document-return';

describe('document return destination', () => {
  it.each([
    ['workbench-today', '/workbench?tab=today'],
    ['workbench-files', '/workbench?tab=files'],
    ['workbench-stars', '/workbench?tab=stars'],
    ['workbench-calendar', '/workbench?tab=calendar'],
  ])('returns %s to its Workbench tab', (source, destination) => {
    expect(documentReturnPath(source)).toBe(destination);
  });

  it.each([null, '', '/external', 'https://example.com', 'workbench-account'])(
    'ignores unrecognized return destinations',
    (source) => {
      expect(documentReturnPath(source)).toBeNull();
    },
  );
});
