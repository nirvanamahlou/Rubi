import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadOrganizationFile } from './organization-download';
import { downloadOrganizationXlsx, unzipWorkbook } from './organization-xlsx';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function browserDownload() {
  vi.useFakeTimers();
  let attached = false;
  const anchor = {
    href: '',
    download: '',
    hidden: false,
    click: vi.fn(() => expect(attached).toBe(true)),
    remove: vi.fn(() => {
      attached = false;
    }),
  };
  const createObjectURL = vi.fn<(blob: Blob) => string>(
    () => 'blob:organizations',
  );
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
  vi.stubGlobal('document', {
    createElement: vi.fn(() => anchor),
    body: {
      appendChild: vi.fn(() => {
        attached = true;
      }),
    },
  });
  vi.stubGlobal('window', { setTimeout });
  return { anchor, createObjectURL, revokeObjectURL };
}

describe('Organizations browser downloads', () => {
  it('downloads the exact server artifact and filename while the URL remains live', () => {
    const { anchor, createObjectURL, revokeObjectURL } = browserDownload();
    const blob = new Blob(['server workbook']);
    downloadOrganizationFile('organizations.xlsx', blob);
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(anchor.download).toBe('organizations.xlsx');
    expect(anchor.href).toBe('blob:organizations');
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(anchor.remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      'blob:organizations',
    );
  });

  it('delivers a readable XLSX with Persian values and formula-like text', async () => {
    const { createObjectURL } = browserDownload();
    downloadOrganizationXlsx('dossier.xlsx', [
      ['کد', 'نام', 'مانده'],
      ['AG-001', 'سازمان <آزمون>', '=1+2'],
    ]);
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const files = await unzipWorkbook(await blob.arrayBuffer());
    expect(files.get('[Content_Types].xml')).toContain(
      'spreadsheetml.sheet.main+xml',
    );
    const worksheet = files.get('xl/worksheets/sheet1.xml');
    expect(worksheet).toContain('AG-001');
    expect(worksheet).toContain('سازمان &lt;آزمون&gt;');
    expect(worksheet).toContain('<t>=1+2</t>');
    expect(worksheet).not.toContain('<f>');
  });

  it('cleans up even if the browser rejects the click', () => {
    const { anchor, revokeObjectURL } = browserDownload();
    anchor.click.mockImplementation(() => {
      throw new Error('click failed');
    });
    expect(() => downloadOrganizationFile('test.xlsx', new Blob())).toThrow(
      'click failed',
    );
    vi.advanceTimersByTime(1000);
    expect(anchor.remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledOnce();
  });
});
