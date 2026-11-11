import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';
import { accessSync, constants, statSync } from 'node:fs';
import { mkdtemp, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, isAbsolute, join } from 'node:path';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LocalAntivirusResult {
  status: 'CLEAN' | 'INFECTED' | 'SCAN_FAILED';
  adapterReference: string;
  scannedAt: Date;
  engineVersion: string;
  threatCode: string | null;
}

export interface DefenderCommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export type DefenderCommandRunner = (
  command: string,
  args: readonly string[],
) => Promise<DefenderCommandResult>;

export function scannerExitCode(
  error: { code?: unknown; killed?: unknown; signal?: unknown } | null,
): number | null {
  if (!error) return 0;
  if (error.killed || error.signal) return null;
  return typeof error.code === 'number' ? error.code : null;
}

function executableFile(candidate: string) {
  try {
    if (!isAbsolute(candidate) || !statSync(candidate).isFile()) return false;
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function runDefenderCommand(
  command: string,
  args: readonly string[],
): Promise<DefenderCommandResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      [...args],
      { maxBuffer: 1024 * 1024, timeout: 120_000, windowsHide: true },
      (error, stdout, stderr) => {
        resolve({
          exitCode: scannerExitCode(error),
          stdout,
          stderr,
        });
      },
    );
  });
}

export function defenderScanStatus(exitCode: number | null) {
  if (exitCode === 0) return 'CLEAN' as const;
  if (exitCode === 2) return 'INFECTED' as const;
  return 'SCAN_FAILED' as const;
}

export function clamavScanStatus(exitCode: number | null) {
  if (exitCode === 0) return 'CLEAN' as const;
  if (exitCode === 1) return 'INFECTED' as const;
  return 'SCAN_FAILED' as const;
}

type ScanContents = Buffer | { stream: Readable; sha256: string };

class ScanIntegrityError extends Error {}

async function* verifyScanContents(
  stream: AsyncIterable<Buffer>,
  expectedSha256: string,
) {
  const hash = createHash('sha256');
  for await (const chunk of stream) {
    hash.update(chunk);
    yield chunk;
  }
  if (hash.digest('hex') !== expectedSha256)
    throw new ScanIntegrityError('Document scan SHA-256 mismatch.');
}

function writeScanFile(target: string, contents: ScanContents) {
  return writeFile(
    target,
    Buffer.isBuffer(contents)
      ? contents
      : verifyScanContents(contents.stream, contents.sha256),
    { flag: 'wx', mode: 0o600 },
  );
}

export async function scanBufferWithClamAV(
  input: { commandPath: string; contents: ScanContents; safeFileName: string },
  runner: DefenderCommandRunner = runDefenderCommand,
): Promise<LocalAntivirusResult> {
  // mkdtemp creates a private0700 directory; no user-controlled path or options.
  const scanRoot = await mkdtemp(join(tmpdir(), 'nora-document-scan-'));
  const target = join(scanRoot, 'document.bin');
  let status: LocalAntivirusResult['status'] = 'SCAN_FAILED';
  let code: number | null = null;
  try {
    await writeScanFile(target, input.contents);
    const result = await runner(input.commandPath, [
      '--no-summary',
      '--infected',
      '--alert-exceeds-max=yes',
      '--',
      target,
    ]);
    code = result.exitCode;
    status = clamavScanStatus(code);
  } catch (error) {
    if (error instanceof ScanIntegrityError) throw error;
    // Spawn, permission, timeout and runner failures never indicate infection/clean.
  } finally {
    await rm(target, { force: true }).catch(() => undefined);
    await rmdir(scanRoot).catch(() => undefined);
  }
  return {
    status,
    adapterReference: `clamav:${basename(input.commandPath)}`,
    scannedAt: new Date(),
    engineVersion: 'ClamAV',
    threatCode:
      status === 'INFECTED'
        ? 'CLAMAV_DETECTED'
        : status === 'SCAN_FAILED'
          ? `CLAMAV_EXIT_${code ?? 'PROCESS_FAILED'}`
          : null,
  };
}

export async function scanBufferWithWindowsDefender(
  input: {
    commandPath: string;
    contents: ScanContents;
    safeFileName: string;
  },
  runner: DefenderCommandRunner = runDefenderCommand,
): Promise<LocalAntivirusResult> {
  const scanRoot = await mkdtemp(join(tmpdir(), 'nora-document-scan-'));
  const extension = extname(input.safeFileName)
    .replace(/[^.A-Za-z0-9]/g, '')
    .slice(0, 12);
  const target = join(scanRoot, `document${extension}`);
  try {
    await writeScanFile(target, input.contents);
    const result = await runner(input.commandPath, [
      '-Scan',
      '-ScanType',
      '3',
      '-File',
      target,
      '-DisableRemediation',
    ]);
    const status = defenderScanStatus(result.exitCode);
    return {
      status,
      adapterReference: `windows-defender:${basename(input.commandPath)}`,
      scannedAt: new Date(),
      engineVersion: 'Microsoft Defender',
      threatCode:
        status === 'INFECTED'
          ? 'WINDOWS_DEFENDER_DETECTED'
          : status === 'SCAN_FAILED'
            ? `WINDOWS_DEFENDER_EXIT_${result.exitCode}`
            : null,
    };
  } finally {
    await rm(target, { force: true }).catch(() => undefined);
    await rmdir(scanRoot).catch(() => undefined);
  }
}

@Injectable()
export class WindowsDefenderAntivirus {
  private readonly commandPath: string | null;
  private readonly engine: 'clamav' | 'windows-defender';

  constructor(@Inject(ConfigService) config: ConfigService) {
    const mode = config
      .get<string>('DOCUMENTS_ANTIVIRUS_MODE')
      ?.trim()
      .toLowerCase();
    const configuredCommand = config
      .get<string>('DOCUMENTS_ANTIVIRUS_COMMAND')
      ?.trim();
    const defaultCommand = join(
      process.env.ProgramFiles ?? 'C:\\Program Files',
      'Windows Defender',
      'MpCmdRun.exe',
    );
    this.engine = mode === 'clamav' ? 'clamav' : 'windows-defender';
    const candidate =
      configuredCommand ||
      (this.engine === 'clamav' ? '/usr/bin/clamscan' : defaultCommand);
    this.commandPath =
      ((mode === 'windows-defender' && process.platform === 'win32') ||
        (mode === 'clamav' && process.platform === 'linux')) &&
      executableFile(candidate)
        ? candidate
        : null;
  }

  get available() {
    return this.commandPath !== null;
  }

  async scan(contents: ScanContents, safeFileName: string) {
    if (!this.commandPath) {
      if (!Buffer.isBuffer(contents)) contents.stream.destroy();
      return {
        status: 'SCAN_FAILED',
        adapterReference: `${this.engine}:unavailable`,
        scannedAt: new Date(),
        engineVersion:
          this.engine === 'clamav' ? 'ClamAV' : 'Microsoft Defender',
        threatCode: 'ANTIVIRUS_ADAPTER_UNAVAILABLE',
      } satisfies LocalAntivirusResult;
    }
    const scan =
      this.engine === 'clamav'
        ? scanBufferWithClamAV
        : scanBufferWithWindowsDefender;
    try {
      return await scan({
        commandPath: this.commandPath,
        contents,
        safeFileName,
      });
    } catch (error) {
      if (!(error instanceof ScanIntegrityError)) throw error;
      return {
        status: 'SCAN_FAILED',
        adapterReference: 'storage-integrity-check',
        scannedAt: new Date(),
        engineVersion: 'SHA-256',
        threatCode: 'STORAGE_HASH_MISMATCH',
      } satisfies LocalAntivirusResult;
    } finally {
      if (!Buffer.isBuffer(contents)) contents.stream.destroy();
    }
  }
}
