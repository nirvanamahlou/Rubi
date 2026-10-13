import { afterEach, describe, expect, it, vi } from 'vitest';

import { DOWNLOAD_OBJECT_URL_TTL_MS, downloadFile } from './download-file';

describe('downloadFile', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps the object URL alive until the bounded cleanup delay', () => {
    vi.useFakeTimers();
    const click = vi.fn();
    const remove = vi.fn();
    const append = vi.fn();
    const revokeObjectURL = vi.fn();
    const anchor = { href: '', download: '', click, remove };
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { append },
    });
    vi.stubGlobal('window', {
      URL: {
        createObjectURL: vi.fn(() => 'blob:master-data-xlsx'),
        revokeObjectURL,
      },
      setTimeout,
    });

    downloadFile(new Blob(['PK\u0003\u0004']), 'master-data.xlsx');

    expect(anchor).toMatchObject({
      href: 'blob:master-data-xlsx',
      download: 'master-data.xlsx',
    });
    expect(append).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(DOWNLOAD_OBJECT_URL_TTL_MS - 1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:master-data-xlsx');
  });
});
