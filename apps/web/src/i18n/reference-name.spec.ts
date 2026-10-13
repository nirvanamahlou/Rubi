import { describe, expect, it } from 'vitest';
import { referenceDisplayName } from './reference-name';

describe('official English reference names', () => {
  it('uses existing English attributes without mutating the record', () => {
    const record = {
      id: 'city-1',
      name: 'عنوان اختصاصی شهر',
      attributes: { englishName: 'Official city name' },
    };
    expect(referenceDisplayName(record, 'en')).toBe('Official city name');
    expect(referenceDisplayName(record, 'fa')).toBe('عنوان اختصاصی شهر');
    expect(record.id).toBe('city-1');
    expect(record.name).toBe('عنوان اختصاصی شهر');
  });
  it('preserves unknown names when no English name exists', () => {
    expect(referenceDisplayName({ name: 'عنوان اختصاصی شهر' }, 'en')).toBe(
      'عنوان اختصاصی شهر',
    );
  });
});
