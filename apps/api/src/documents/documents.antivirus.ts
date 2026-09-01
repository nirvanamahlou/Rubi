import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';

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
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type DefenderCommandRunner = (
  command: string,
  args: readonly string[],
) => Promise<DefenderCommandResult>;

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
          exitCode:
            typeof error?.code === 'number' ? error.code : error ? 1 : 0,
          stdout,
          stderr,
        });
      },
    );
  });
}

export function defenderScanStatus(exitCode: number) {
  if (exitCode === 0) return 'CLEAN' as const;
  if (exitCode === 2) return 'INFECTED' as const;
  return 'SCAN_FAILED' as const;
}

export async function scanBufferWithWindowsDefender(
  input: {
    commandPath: string;
    contents: Buffer;
    safeFileName: string;
  },
  runner: DefenderCommandRunner = runDefenderCommand,
): Promise<LocalAntivirusResult> {
  const scanRoot = await mkdtemp(join(tmpdir(), 'rubi-document-scan-'));
  const extension = extname(input.safeFileName)
    .replace(/[^.A-Za-z0-9]/g, '')
    .slice(0, 12);
  const target = join(scanRoot, `document${extension}`);
  try {
    await writeFile(target, input.contents, { flag: 'wx', mode: 0o600 });
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
    const candidate = configuredCommand || defaultCommand;
    this.commandPath =
      mode === 'windows-defender' &&
      process.platform === 'win32' &&
      existsSync(candidate)
        ? candidate
        : null;
  }

  get available() {
    return this.commandPath !== null;
  }

  async scan(contents: Buffer, safeFileName: string) {
    if (!this.commandPath) {
      return {
        status: 'SCAN_FAILED',
        adapterReference: 'windows-defender:unavailable',
        scannedAt: new Date(),
        engineVersion: 'Microsoft Defender',
        threatCode: 'ANTIVIRUS_ADAPTER_UNAVAILABLE',
      } satisfies LocalAntivirusResult;
    }
    return scanBufferWithWindowsDefender({
      commandPath: this.commandPath,
      contents,
      safeFileName,
    });
  }
}
