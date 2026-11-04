import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHrResource } from '@nora/contracts';
import { strToU8, zipSync } from 'fflate';
import {
  assertTemplateIntervals,
  durationMinutes,
  transferSplit,
  validateCompletionValues,
} from './hr-radan-completion.domain';
import { recordValues } from './hr.validation';
import {
  privateCommandFingerprint,
  protectHrValues,
  revealHrValues,
  publicHrData,
} from './hr-private-values';
import { readPayslipWorkbook } from './hr-payslip-import';

afterEach(() => vi.unstubAllEnvs());
describe('observed Radan data boundaries', () => {
  it('keeps exact minutes including Persian digits and rejects malformed time', () => {
    expect(durationMinutes('۱۶:۲۰')).toBe(980);
    expect(durationMinutes('1000:01')).toBe(60001);
    for (const value of ['1:60', '-1:20', '1.5', '00:99'])
      expect(() => durationMinutes(value)).toThrow();
  });
  it('balances carry, burn and buyback without silently losing a minute', () => {
    const rule = [
      'قاعده',
      '1405',
      '10:00',
      '08:00',
      '02:00',
      '01:00',
      '06:00',
      '00:00',
      '00:00',
    ];
    expect(transferSplit(660, rule)).toEqual({
      carry: 480,
      burn: 120,
      buyback: 60,
    });
    expect(transferSplit(360, rule)).toEqual({
      carry: 360,
      burn: 0,
      buyback: 0,
    });
    expect(() => transferSplit(659, rule)).toThrow();
  });
  it('keeps independent transfer thresholds, strict boundaries and historical rules compatible', () => {
    const rule = [
      'قاعده',
      '1405',
      '10:00',
      '08:00',
      '02:00',
      '01:00',
      '06:00',
      '00:00',
      '00:00',
      '08:00',
    ];
    expect(transferSplit(660, rule)).toEqual({
      carry: 480,
      burn: 120,
      buyback: 60,
    });
    expect(transferSplit(360, rule)).toEqual({
      carry: 360,
      burn: 0,
      buyback: 0,
    });
    for (const balance of [480, 540, 600])
      expect(() => transferSplit(balance, rule)).toThrow('محدوده');
    const schema = getHrResource('time', 'leaveTransferRules')!;
    expect(recordValues(rule.slice(0, 9), schema)).toEqual([
      ...rule.slice(0, 9),
      '',
    ]);
    expect(() =>
      validateCompletionValues(schema.key, schema.columns, [
        ...rule.slice(0, 9),
        '11:00',
      ]),
    ).toThrow('حد پایین');
    expect(() => transferSplit(660, [...rule.slice(0, 9), '11:00'])).toThrow();
    expect(() =>
      recordValues([...rule.slice(0, 9), '-1:00'], schema),
    ).toThrow();
    expect(transferSplit(360, [...rule.slice(0, 9), ''])).toEqual({
      carry: 360,
      burn: 0,
      buyback: 0,
    });
  });
  it('encrypts private values, binds branch/employee/resource and strips ciphertext from DTO data', () => {
    vi.stubEnv(
      'HR_PRIVATE_ENCRYPTION_KEY_BASE64',
      randomBytes(32).toString('base64'),
    );
    const values = ['نام', 'نام خانوادگی', '0123456789'];
    const data = protectHrValues(values, 'branch:employee:identity');
    expect(JSON.stringify(data)).not.toContain('0123456789');
    expect(revealHrValues(data, 'branch:employee:identity')).toEqual(values);
    expect(() => revealHrValues(data, 'other:employee:identity')).toThrow();
    expect(publicHrData({ ...data, reason: 'safe' })).toEqual({
      reason: 'safe',
    });
    expect(
      protectHrValues(values, 'branch:employee:identity').privatePayload,
    ).not.toBe(data.privatePayload);
  });
  it('fails closed when no encryption key exists', () => {
    vi.stubEnv('HR_PRIVATE_ENCRYPTION_KEY_BASE64', '');
    vi.stubEnv('CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64', '');
    expect(() => protectHrValues(['secret'], 'context')).toThrow();
  });
  it('allows only observed contact categories and requires province before city', () => {
    const phones = getHrResource('employee', 'phones')!;
    expect(recordValues(['موبایل', '09120000000'], phones)).toEqual([
      'موبایل',
      '09120000000',
    ]);
    expect(() => recordValues(['ناشناخته', '09120000000'], phones)).toThrow();
    const identity = getHrResource('employee', 'identity')!;
    expect(() =>
      recordValues(
        [
          'نام',
          'فامیل',
          '0123456789',
          '',
          '',
          '',
          '',
          '',
          '',
          'تهران',
          '',
          '',
          '',
          '',
        ],
        identity,
      ),
    ).toThrow();
  });
  it('rejects unsupported hourly leave and mission combinations', () => {
    const leave = getHrResource('requests', 'radanLeave')!;
    expect(() =>
      recordValues(
        [
          'کارمند',
          'زایمان',
          '2026-10-20',
          '2026-10-20',
          'ساعتی',
          '09:00',
          '10:00',
          'خیر',
        ],
        leave,
      ),
    ).toThrow();
    expect(() =>
      recordValues(
        [
          'کارمند',
          'استحقاقی',
          '2026-10-20',
          '2026-10-20',
          'ساعتی',
          '09:00',
          '10:00',
          'بله',
        ],
        leave,
      ),
    ).toThrow();
    expect(
      recordValues(
        [
          'کارمند',
          'استحقاقی',
          '2026-10-20',
          '2026-10-20',
          'ساعتی',
          '09:00',
          '10:00',
          'خیر',
        ],
        leave,
      )[4],
    ).toBe('ساعتی');
  });
  it('rejects unobserved request types in a procedure', () => {
    expect(() =>
      recordValues(
        ['روند', '', JSON.stringify(['unobserved'])],
        getHrResource('requests', 'procedures')!,
      ),
    ).toThrow();
  });
});
describe('payslip Excel boundary', () => {
  function workbook(sheet: string, extra: Record<string, Uint8Array> = {}) {
    return Buffer.from(
      zipSync({ 'xl/worksheets/sheet1.xml': strToU8(sheet), ...extra }),
    );
  }
  const sheet =
    '<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>کد پرسنلی</t></is></c><c r="B1" t="inlineStr"><is><t>خالص</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>HR-1</t></is></c><c r="B2"><v>123456789012345.25</v></c></row></sheetData></worksheet>';
  it('preserves exact numeric strings without converting salary to float', () => {
    expect(readPayslipWorkbook(workbook(sheet), 'pay.xlsx')).toEqual([
      ['کد پرسنلی', 'خالص'],
      ['HR-1', '123456789012345.25'],
    ]);
  });

  it('reads a real BIFF8 Workbook stream with Unicode shared strings', () => {
    const record = (id: number, data: Buffer) => {
      const head = Buffer.alloc(4);
      head.writeUInt16LE(id);
      head.writeUInt16LE(data.length, 2);
      return Buffer.concat([head, data]);
    };
    const names = ['کد پرسنلی', 'خالص', 'HR-1'];
    const shared = Buffer.concat(
      names.map((text) => {
        const head = Buffer.alloc(3);
        head.writeUInt16LE(text.length);
        head[2] = 1;
        return Buffer.concat([head, Buffer.from(text, 'utf16le')]);
      }),
    );
    const counts = Buffer.alloc(8);
    counts.writeUInt32LE(3);
    counts.writeUInt32LE(3, 4);
    const sst = record(0xfc, Buffer.concat([counts, shared])),
      bound = Buffer.alloc(8);
    bound.writeUInt32LE(4 + 12 + sst.length + 4); // BOF + BOUNDSHEET + SST + global EOF
    const label = (row: number, column: number, index: number) => {
      const data = Buffer.alloc(10);
      data.writeUInt16LE(row);
      data.writeUInt16LE(column, 2);
      data.writeUInt32LE(index, 6);
      return record(0xfd, data);
    };
    const numeric = Buffer.alloc(14);
    numeric.writeUInt16LE(1);
    numeric.writeUInt16LE(1, 2);
    numeric.writeDoubleLE(1234.25, 6);
    const stream = Buffer.concat([
      record(0x809, Buffer.alloc(0)),
      record(0x85, bound),
      sst,
      record(0x0a, Buffer.alloc(0)),
      label(0, 0, 0),
      label(0, 1, 1),
      label(1, 0, 2),
      record(0x203, numeric),
      record(0x0a, Buffer.alloc(0)),
    ]);
    const file = Buffer.alloc(512 * 11);
    Buffer.from('d0cf11e0a1b11ae1', 'hex').copy(file);
    file.writeUInt16LE(9, 30);
    file.writeUInt16LE(6, 32);
    file.writeUInt32LE(1, 44);
    file.writeInt32LE(1, 48);
    file.writeUInt32LE(4096, 56);
    file.writeInt32LE(-2, 60);
    file.writeInt32LE(-2, 68);
    for (let i = 0; i < 109; i++) file.writeInt32LE(-1, 76 + i * 4);
    file.writeInt32LE(0, 76);
    for (let i = 0; i < 128; i++) file.writeInt32LE(-1, 512 + i * 4);
    file.writeInt32LE(-3, 512);
    file.writeInt32LE(-2, 516);
    for (let i = 2; i < 10; i++)
      file.writeInt32LE(i === 9 ? -2 : i + 1, 512 + i * 4);
    const directory = 1024;
    Buffer.from('Root Entry\0', 'utf16le').copy(file, directory);
    file.writeUInt16LE(22, directory + 64);
    file[directory + 66] = 5;
    file.writeInt32LE(-2, directory + 116);
    const entry = directory + 128;
    Buffer.from('Workbook\0', 'utf16le').copy(file, entry);
    file.writeUInt16LE(18, entry + 64);
    file[entry + 66] = 2;
    file.writeInt32LE(2, entry + 116);
    file.writeBigUInt64LE(4096n, entry + 120);
    stream.copy(file, 1536);
    expect(readPayslipWorkbook(file, 'pay.xls')).toEqual([
      ['کد پرسنلی', 'خالص'],
      ['HR-1', '1234.25'],
    ]);
  });
  it('rejects formulas, external links, entities, wrong extensions and oversized uploads', () => {
    expect(() =>
      readPayslipWorkbook(
        workbook(sheet.replace('<v>', '<f>SUM(A1)</f><v>')),
        'pay.xlsx',
      ),
    ).toThrow();
    expect(() =>
      readPayslipWorkbook(
        workbook(sheet, {
          'xl/_rels/workbook.xml.rels': strToU8(
            '<Relationship TargetMode="External"/>',
          ),
        }),
        'pay.xlsx',
      ),
    ).toThrow();
    expect(() =>
      readPayslipWorkbook(workbook('<!DOCTYPE x>' + sheet), 'pay.xlsx'),
    ).toThrow();
    expect(() => readPayslipWorkbook(workbook(sheet), 'pay.xlsm')).toThrow();
    expect(() =>
      readPayslipWorkbook(Buffer.alloc(10 * 1024 * 1024 + 1), 'pay.xlsx'),
    ).toThrow();
    expect(() =>
      readPayslipWorkbook(Buffer.from('not CFB'), 'pay.xls'),
    ).toThrow();
  });
});

it('rejects overlapping long calendar shifts instead of attributing the same time twice', () => {
  expect(() =>
    assertTemplateIntervals([
      ['2026-10-20', '08:00', '16:00', 'دو روز بعد'],
      ['2026-10-21', '08:00', '16:00', 'همان روز'],
    ]),
  ).toThrow();
  expect(() =>
    assertTemplateIntervals([
      ['2026-10-20', '08:00', '16:00', 'دو روز بعد'],
      ['2026-10-23', '08:00', '16:00', 'همان روز'],
    ]),
  ).not.toThrow();
});

it('binds private idempotency fingerprints to the server key and actor', () => {
  vi.stubEnv(
    'HR_PRIVATE_ENCRYPTION_KEY_BASE64',
    randomBytes(32).toString('base64'),
  );
  const value = { networkPassword: 'synthetic-password' };
  const fingerprint = privateCommandFingerprint(value, 'actor-a');
  expect(privateCommandFingerprint(value, 'actor-a')).toBe(fingerprint);
  expect(privateCommandFingerprint(value, 'actor-b')).not.toBe(fingerprint);
  expect(
    privateCommandFingerprint({ networkPassword: 'changed' }, 'actor-a'),
  ).not.toBe(fingerprint);
  vi.stubEnv(
    'HR_PRIVATE_ENCRYPTION_KEY_BASE64',
    randomBytes(32).toString('base64'),
  );
  expect(privateCommandFingerprint(value, 'actor-a')).not.toBe(fingerprint);
});
