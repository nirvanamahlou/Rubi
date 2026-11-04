import { expect, it } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { reservationPdfHtml } from './reservation-pdf-html';
import { voucherServiceFixture } from '../model/voucher-passenger-services.fixture';
import { contractPrintHtml } from '@/modules/sales/model/contract-print';
import {
  printFixture,
  printReferences,
} from '@/modules/sales/model/contract-print.fixture';

it('keeps Jahan contract, reservation and voucher logos transparent with issuer-only footers', () => {
  const logo =
    'data:image/png;base64,' +
    readFileSync('public/brand/jahan-bastan-transparent.png').toString(
      'base64',
    );
  const css = readFileSync(
    'src/modules/reservations/components/reservation-form-sheet.module.css',
    'utf8',
  );
  expect(css).toMatch(/\.jahanBrand\s*\{\s*background:\s*transparent;/);
  expect(css).toMatch(
    /\.jahanLogo\s*\{\s*filter:\s*brightness\(0\) invert\(1\);/,
  );
  const output = structuredClone(printFixture);
  output.company.code = 'JAHAN_BASTAN';
  output.company.persianName = 'نیایش سیر سحر';
  const documents: Record<string, string> = {
    contract: contractPrintHtml(output, {
      ...printReferences,
      logoDataUrl: logo,
    }),
  };
  for (const voucher of [false, true]) {
    const { intake, refs } = voucherServiceFixture();
    intake.workflow.branding = {
      kind: 'OWN',
      companyCode: 'JAHAN_BASTAN',
      referenceId: 'synthetic',
      name: 'نیایش سیر سحر',
      logoFileId: null,
    };
    intake.workflow.voucherSettings!.flags.withLetterhead = true;
    intake.workflow.supplierFormSettings = structuredClone(
      intake.workflow.voucherSettings!,
    );
    documents[voucher ? 'voucher' : 'reservation'] = reservationPdfHtml(
      intake,
      refs,
      logo,
      css,
      voucher,
    );
  }
  for (const html of Object.values(documents)) {
    expect(html).toContain(logo);
    const footers = html.match(/<footer[\s\S]*?<\/footer>/g) ?? [];
    expect(footers.length).toBeGreaterThan(0);
    expect(footers.join('')).toMatch(/Jahan Bastan|جهان باستان/);
    expect(footers.join('')).not.toMatch(/نیایش|Niyay|Nystkt|niyay/i);
  }
  // Optional synthetic visual artifacts; never production data or committed output.
  if (process.env.JAHAN_DOCUMENT_QA_DIR) {
    const directory = resolve(process.env.JAHAN_DOCUMENT_QA_DIR);
    mkdirSync(directory, { recursive: true });
    for (const [name, html] of Object.entries(documents))
      writeFileSync(resolve(directory, name + '.html'), html);
  }
});
