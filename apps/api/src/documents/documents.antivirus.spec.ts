import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  defenderScanStatus,
  scanBufferWithWindowsDefender,
  scanBufferWithClamAV,
  clamavScanStatus,
  scannerExitCode,
} from './documents.antivirus';

describe('Windows Defender document adapter', () => {
  it('maps documented command outcomes without inventing a clean result', () => {
    expect(defenderScanStatus(0)).toBe('CLEAN');
    expect(defenderScanStatus(2)).toBe('INFECTED');
    expect(defenderScanStatus(5)).toBe('SCAN_FAILED');
  });

  it('writes a private temporary file for scanning and removes it afterwards', async () => {
    let scannedPath = '';
    const runner = vi.fn(async (_command: string, args: readonly string[]) => {
      scannedPath = args[4] ?? '';
      expect(existsSync(scannedPath)).toBe(true);
      return { exitCode: 0, stdout: '', stderr: '' };
    });

    const result = await scanBufferWithWindowsDefender(
      {
        commandPath: 'MpCmdRun.exe',
        contents: Buffer.from('%PDF-1.7\nsynthetic clean test'),
        safeFileName: 'document.pdf',
      },
      runner,
    );

    expect(result.status).toBe('CLEAN');
    expect(result.threatCode).toBeNull();
    expect(runner).toHaveBeenCalledOnce();
    expect(existsSync(scannedPath)).toBe(false);
  });
});

describe('ClamAV document adapter', () => {
  it.each([
    { code: 'ENOENT' },
    { code: 'EACCES' },
    { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' },
    { code: 0, killed: true },
    { code: 0, signal: 'SIGTERM' },
  ])('maps process failure %j to scan failure', (error) => {
    expect(scannerExitCode(error)).toBeNull();
    expect(clamavScanStatus(scannerExitCode(error))).toBe('SCAN_FAILED');
  });
  it('preserves only completed process exit codes', () => {
    expect(scannerExitCode(null)).toBe(0);
    expect(scannerExitCode({ code: 1 })).toBe(1);
    expect(scannerExitCode({ code: 2 })).toBe(2);
  });
  it.each([
    [0, 'CLEAN'],
    [1, 'INFECTED'],
    [2, 'SCAN_FAILED'],
    [42, 'SCAN_FAILED'],
    [null, 'SCAN_FAILED'],
  ] as const)('maps exit %s to %s', (code, status) =>
    expect(clamavScanStatus(code)).toBe(status),
  );
  it.each([
    0,
    1,
    2,
    null,
    'ENOENT',
    'EACCES',
    'ETIMEDOUT',
    'SIGNAL',
    'MAXBUFFER',
  ] as const)(
    'cleans private files on outcome %s and never parses stdout',
    async (outcome) => {
      let target = '';
      const contents = Buffer.from('synthetic logo');
      const result = await scanBufferWithClamAV(
        {
          commandPath: '/usr/bin/clamscan',
          contents,
          safeFileName: '../../--remove ;.png',
        },
        async (command, args) => {
          target = args.at(-1)!;
          expect(command).toBe('/usr/bin/clamscan');
          expect(args).toEqual([
            '--no-summary',
            '--infected',
            '--alert-exceeds-max=yes',
            '--',
            target,
          ]);
          expect(target).not.toContain('--remove');
          expect(await readFile(target)).toEqual(contents);
          if (process.platform !== 'win32') {
            expect((await stat(target)).mode & 0o777).toBe(0o600);
            expect((await stat(dirname(target))).mode & 0o777).toBe(0o700);
          }
          if (typeof outcome === 'string')
            throw Object.assign(new Error('private'), { code: outcome });
          return {
            exitCode: outcome,
            stdout: 'CLEAN private content',
            stderr: 'private',
          };
        },
      );
      expect(existsSync(target)).toBe(false);
      expect(existsSync(dirname(target))).toBe(false);
      expect(result.status).toBe(
        outcome === 0 ? 'CLEAN' : outcome === 1 ? 'INFECTED' : 'SCAN_FAILED',
      );
      expect(JSON.stringify(result)).not.toContain('private');
    },
  );
  it('treats a missing real executable as a process failure, not infection', async () => {
    const result = await scanBufferWithClamAV({
      commandPath: '/nonexistent/nora-clamscan',
      contents: Buffer.from('test'),
      safeFileName: 'test.png',
    });
    expect(result.status).toBe('SCAN_FAILED');
    expect(result.threatCode).toBe('CLAMAV_EXIT_PROCESS_FAILED');
  });
});
