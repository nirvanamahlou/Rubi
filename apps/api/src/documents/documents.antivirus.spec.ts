import { existsSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import {
  defenderScanStatus,
  scanBufferWithWindowsDefender,
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
