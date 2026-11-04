import { describe, expect, it } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { printFixture } from '../model/contract-print.fixture';
import { renderContractPdf, resolveContractPdfRuntime } from './contract-pdf';

describe('contract PDF runtime', () => {
  it('finds installed Chrome and the user-installed Nazanin font', async () => {
    const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const font =
      'C:\\Users\\test\\AppData\\Local\\Microsoft\\Windows\\Fonts\\BNazanin.ttf';
    await expect(
      resolveContractPdfRuntime(
        {
          ProgramFiles: 'C:\\Program Files',
          LOCALAPPDATA: 'C:\\Users\\test\\AppData\\Local',
        },
        async (path) => path === chrome || path === font,
      ),
    ).resolves.toEqual({ chromePath: chrome, fontPath: font });
  });

  it('prefers explicit paths and allows PDF generation without an optional font', async () => {
    const chrome = 'D:\\Runtime\\chrome.exe';
    await expect(
      resolveContractPdfRuntime(
        {
          SALES_PDF_CHROME_PATH: chrome,
          SALES_PDF_NAZANIN_PATH: 'D:\\Runtime\\missing.ttf',
        },
        async (path) => path === chrome,
      ),
    ).resolves.toEqual({ chromePath: chrome, fontPath: null });
  });

  it.runIf(process.env.CONTRACT_PDF_RUNTIME_SMOKE === '1')(
    'renders actual PDF bytes with the installed local runtime',
    async () => {
      const output = structuredClone(printFixture);
      output.contract.servicesDetail[0]!.metadata = {
        ...output.contract.servicesDetail[0]!.metadata,
        contractNotice:
          'این یادداشت توسط کارشناس فروش ثبت شده است.\nحضور مسافران سه ساعت پیش از پرواز در فرودگاه الزامی است.\nخدمات هتل مطابق توافق ثبت‌شده در قرارداد ارائه می‌شود.',
      };
      const bytes = await renderContractPdf(output, { names: {} });
      expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
      expect(bytes.length).toBeGreaterThan(10_000);
      if (process.env.CONTRACT_PDF_QA_OUTPUT)
        await writeFile(process.env.CONTRACT_PDF_QA_OUTPUT, bytes);
    },
    45_000,
  );
});
