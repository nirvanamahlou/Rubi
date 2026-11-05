import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

it('keeps Call Center presentation inside its workspace and portalled dossier', () => {
  const shell = fs.readFileSync(
    path.resolve(__dirname, '../../components/layout/app-shell.tsx'),
    'utf8',
  );
  const workspace = fs.readFileSync(
    path.resolve(__dirname, 'workspace.tsx'),
    'utf8',
  );
  const appearance = fs.readFileSync(
    path.resolve(__dirname, 'panel-appearance.module.css'),
    'utf8',
  );

  // Global call providers remain in AppShell, but route-specific visuals do not.
  expect(shell).not.toMatch(
    /(?:call-center|panel)-appearance|IllustrationIcon/,
  );
  expect(shell).toContain('className="flex min-h-screen bg-background"');
  expect(shell).toContain('group.dotClass');
  expect(shell).toContain('strokeWidth={1.7}');

  const panelClass =
    /className=\{`\$\{styles\.workspace\} \$\{appearance\.panel\}`\}/g;
  expect(workspace.match(panelClass)).toHaveLength(2);
  const dossier = workspace.slice(
    workspace.indexOf('function DossierFrame('),
    workspace.indexOf('function ReportPanel('),
  );
  expect(dossier).toContain('<DialogContent');
  expect(dossier).toMatch(panelClass);

  const selectors = [...appearance.matchAll(/(?:^|\})\s*([^{}]+)\{/g)].map(
    ([, selector]) => selector!.trim(),
  );
  expect(selectors).toContain('.panel');
  expect(selectors).toContain(':global(.dark) .panel');
  for (const selector of selectors)
    expect(selector).toMatch(/^(?:\.panel|:global\(\.dark\) \.panel)(?:\s|$)/);
});
