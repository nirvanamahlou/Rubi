import { unzipSync, zipSync } from 'fflate';
import {
  buildTemplateManifest,
  templateManifestWarnings,
  type TemplatePassenger,
} from '../common/manifest/workbook-template';
import { addManifestWarnings } from './manifest-warnings';

const latinName = (value: string | undefined) =>
  (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const country = (value: string | undefined) =>
  /^[A-Z]{3}$/.test((value ?? '').trim().toUpperCase())
    ? value!.trim().toUpperCase()
    : '';

const date = (value: string | undefined) => {
  const iso = (value ?? '').replaceAll('/', '-');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const day = new Date(iso + 'T00:00:00Z');
  return Number.isFinite(day.valueOf()) &&
    day.toISOString().slice(0, 10) === iso
    ? iso
    : '';
};

/** Airline-supplied layout; template data rows are blank and VBA is copied, never executed. */
export function buildPnlManifest(
  template: Uint8Array,
  passengers: readonly TemplatePassenger[],
) {
  const rows = passengers.map((p) => ({
    ...p,
    birthDate: date(p.birthDate),
    passportExpiryDate: date(p.passportExpiryDate),
    firstName: latinName(p.firstName),
    lastName: latinName(p.lastName),
    gender:
      p.gender === 'MR'
        ? 'MR'
        : p.gender === 'MS' || p.gender === 'MRS'
          ? 'MS'
          : '',
    nationality: country(p.nationality),
    passportIssuingCountry: country(p.passportIssuingCountry),
    birthCountry: country(p.birthCountry),
    passportNumber: p.passportNumber?.trim().toUpperCase() ?? '',
  }));
  const warning = templateManifestWarnings(template, rows);
  const files = unzipSync(
    buildTemplateManifest(template, rows, { maxPassengers: 10000 }),
  );
  const approved = unzipSync(template);
  // Only this bundled, owner-approved airline workbook is emitted as XLSM.
  // Registered/uploaded templates continue through the macro-stripping path.
  for (const path of [
    '[Content_Types].xml',
    'xl/_rels/workbook.xml.rels',
    'xl/vbaProject.bin',
    'xl/_rels/vbaProject.bin.rels',
    'xl/vbaProjectSignature.bin',
    'xl/vbaProjectSignatureAgile.bin',
  ]) {
    if (approved[path]) files[path] = approved[path];
  }
  return addManifestWarnings(
    zipSync(files, { level: 6 }),
    warning.labels,
    warning.rows,
    warning.firstDataRow,
  );
}
