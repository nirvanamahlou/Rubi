import { afterEach, expect, it, vi } from 'vitest';
import {
  bannerExportDimensions,
  downloadPackageBanner,
} from './package-banner-download';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('renders the selected template at exact export dimensions regardless of viewport', () => {
  expect(bannerExportDimensions(1080, 1920, 360)).toEqual({
    scale: 3,
    width: 360,
    height: 640,
  });
  expect(() => bannerExportDimensions(1080, 1920, 0)).toThrow();
  expect(() => bannerExportDimensions(100000, 100000, 360)).toThrow();
});
it('downloads actual PNG pixels and releases the temporary object URL', async () => {
  vi.useFakeTimers();
  const canvas = {
    toBlob: (done: (blob: Blob) => void) =>
      done(new Blob(['png'], { type: 'image/png' })),
  };
  const capture = vi.fn().mockResolvedValue(canvas);
  const click = vi.fn(),
    remove = vi.fn(),
    appendChild = vi.fn();
  const link = { click, remove, href: '', download: '' };
  const createObjectURL = vi.fn().mockReturnValue('blob:banner'),
    revokeObjectURL = vi.fn();
  vi.stubGlobal('window', { html2canvas: capture });
  vi.stubGlobal('document', {
    fonts: { ready: Promise.resolve() },
    body: { appendChild },
    createElement: () => link,
  });
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
  await downloadPackageBanner(
    { getBoundingClientRect: () => ({ width: 360 }) } as HTMLElement,
    { width: 1080, height: 1920, format: 'PNG', filename: 'package-1-v2' },
  );
  expect(capture.mock.calls[0]?.[1]).toMatchObject({
    width: 360,
    height: 640,
    scale: 3,
    allowTaint: false,
    onclone: expect.any(Function),
  });
  const setProperty = vi.fn();
  const style = { setProperty };
  const root = { style, querySelectorAll: () => [] };
  const clone = {
    documentElement: { style: { backgroundColor: 'oklch(1 0 0)' } },
    body: { style: { backgroundColor: 'oklch(1 0 0)' } },
    querySelector: () => root,
    defaultView: {
      getComputedStyle: () => ({ getPropertyValue: () => 'oklch(1 0 0)' }),
    },
    createElement: () => ({
      getContext: () => ({
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        getImageData: () => ({ data: [255, 255, 255, 255] }),
      }),
    }),
  };
  (capture.mock.calls[0]?.[1].onclone as (doc: Document) => void)(
    clone as unknown as Document,
  );
  expect(clone.body.style.backgroundColor).toBe('transparent');
  expect(clone.documentElement.style.backgroundColor).toBe('transparent');
  expect(setProperty).toHaveBeenCalledWith('color', 'rgba(255,255,255,1)');
  expect(link.download).toBe('package-1-v2.png');
  expect(click).toHaveBeenCalledOnce();
  expect(remove).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1000);
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:banner');
});
it('creates a real PDF at the selected landscape dimensions and never downloads after rendering failure', async () => {
  const addImage = vi.fn(),
    save = vi.fn();
  const Pdf = vi.fn(function () {
    return { addImage, save };
  });
  const capture = vi
    .fn()
    .mockResolvedValue({ toDataURL: () => 'data:image/png;base64,cGl4ZWxz' });
  vi.stubGlobal('window', { html2canvas: capture, jspdf: { jsPDF: Pdf } });
  vi.stubGlobal('document', { fonts: { ready: Promise.resolve() } });
  const element = {
    getBoundingClientRect: () => ({ width: 600 }),
  } as HTMLElement;
  const options = {
    width: 1200,
    height: 600,
    format: 'PDF' as const,
    filename: 'package',
  };
  await downloadPackageBanner(element, options);
  expect(Pdf).toHaveBeenCalledWith(
    expect.objectContaining({ orientation: 'landscape', format: [1200, 600] }),
  );
  expect(addImage).toHaveBeenCalledWith(
    expect.any(String),
    'PNG',
    0,
    0,
    1200,
    600,
  );
  expect(save).toHaveBeenCalledWith('package.pdf');
  save.mockClear();
  capture.mockRejectedValueOnce(new Error('render failed'));
  await expect(downloadPackageBanner(element, options)).rejects.toThrow(
    'render failed',
  );
  expect(save).not.toHaveBeenCalled();
});
