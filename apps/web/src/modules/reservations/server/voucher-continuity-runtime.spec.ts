import { expect, it } from 'vitest';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { voucherServiceFixture } from '../model/voucher-passenger-services.fixture';
import { defaultVoucherSettings } from '../model/voucher-settings';
import { renderReservationPdf } from './reservation-pdf';

it.runIf(process.env.VOUCHER_CONTINUITY_SMOKE === '1')(
  'prints consecutive passenger rows over real PDF pages without repeating hotel sections',
  async () => {
    const directory = join(tmpdir(), 'rubi-voucher-continuity-1108');
    await mkdir(directory, { recursive: true });
    const css = await readFile(
      'src/modules/reservations/components/reservation-form-sheet.module.css',
      'utf8',
    );
    for (const count of [6, 40, 80]) {
      const { intake, refs } = voucherServiceFixture();
      const template = intake.snapshot.passengerAssignments![0]!;
      const ids = Array.from({ length: count }, (_, i) => `runtime-${i}`);
      intake.snapshot.passengerIds = ids;
      intake.snapshot.passengerAssignments = ids.map((customerId, i) => ({
        ...template,
        customerId,
        displayNameSnapshot: `CONTINUOUS GUEST ${String(i + 1).padStart(3, '0')}`,
      }));
      intake.workflow.roomOrder = ids;
      intake.outputPassengers = [];
      delete intake.workflow.voucherSettings;
      intake.workflow.voucherSettings = defaultVoucherSettings(intake, refs);
      intake.workflow.voucherSettings.flags.withLetterhead = false;
      const pdf = await renderReservationPdf(intake, refs, '', css, true);
      const file = join(directory, `guests-${count}.pdf`);
      await writeFile(file, pdf);
      const info = spawnSync('pdfinfo', [file], { encoding: 'utf8' });
      expect(info.status).toBe(0);
      const pages = Number(info.stdout.match(/^Pages:\s+(\d+)/m)?.[1]);
      expect(pages).toBeGreaterThanOrEqual(count === 80 ? 2 : 1);
      const output = spawnSync(
        process.env.VOUCHER_PDF_PYTHON ?? 'python3',
        [
          '-c',
          'import sys; from pypdf import PdfReader; print("\\n".join(p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages))',
          file,
        ],
        {
          encoding: 'utf8',
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        },
      );
      expect(output.status).toBe(0);
      const text = output.stdout;
      expect(text.match(/HOTEL INFORMATION/g)).toHaveLength(1);
      expect(text.match(/TOUR SERVICES/g)).toHaveLength(1);
      expect(text).not.toContain('OTHER SERVICES');
      let position = -1;
      for (let i = 1; i <= count; i++) {
        const name = `CONTINUOUS GUEST ${String(i).padStart(3, '0')}`;
        const next = text.indexOf(name);
        expect(next).toBeGreaterThan(position);
        expect(text.indexOf(name, next + name.length)).toBe(-1);
        position = next;
      }
      expect(
        spawnSync('pdftoppm', [
          '-scale-to',
          '1200',
          '-png',
          file,
          join(directory, `guests-${count}`),
        ]).status,
      ).toBe(0);
    }
  },
  240000,
);
