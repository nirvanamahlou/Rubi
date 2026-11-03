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

it('preserves the supplied Ghestiroo logo colors across contract, reservation and voucher headers', () => {
  const logo =
    'data:image/png;base64,' +
    readFileSync('public/brand/ghesati-ro.png').toString('base64');
  const css = readFileSync(
    'src/modules/reservations/components/reservation-form-sheet.module.css',
    'utf8',
  );
  expect(css).toMatch(
    /\.ghesatiLogo\s*\{\s*filter:\s*none;\s*background:\s*transparent;/,
  );
  const output = structuredClone(printFixture);
  output.company.code = 'GHESATI_RO';
  output.company.persianName = 'قسطی رو';
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
      companyCode: 'GHESATI_RO',
      referenceId: 'synthetic',
      name: 'قسطی رو',
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
    expect(html).toMatch(/<img[^>]*class="ghesatiLogo"/);
  }
  // Optional synthetic visual artifacts; never production data or committed output.
  if (process.env.GHESTIROO_DOCUMENT_QA_DIR) {
    const directory = resolve(process.env.GHESTIROO_DOCUMENT_QA_DIR);
    mkdirSync(directory, { recursive: true });
    for (const [name, html] of Object.entries(documents))
      writeFileSync(resolve(directory, name + '.html'), html);
  }
});
