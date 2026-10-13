param([int]$Port = 3000)

$ErrorActionPreference = 'Stop'
$runtimeRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$webRoot = Join-Path $runtimeRoot 'apps/web'
$branch = (& git -C $runtimeRoot rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'codex/pc-c-assistant-localhost-1011') {
  throw "Unexpected runtime branch: $branch"
}
foreach ($relativePath in @(
  'apps/web/.next/BUILD_ID',
  'apps/web/src/app/(crm)/assistant/page.tsx',
  'apps/web/src/modules/reports/components/reporting-workspace.tsx'
)) {
  if (!(Test-Path -LiteralPath (Join-Path $runtimeRoot $relativePath))) {
    throw "Runtime is not built or complete: $relativePath"
  }
}
if (@(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue).Count -gt 0) {
  throw "Port $Port is occupied. Verify and stop its Web process before starting this runtime."
}
$logRoot = Join-Path $runtimeRoot 'tmp/assistant-localhost'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$nodePath = (Get-Command node -ErrorAction Stop).Source
$nextPath = Join-Path $webRoot 'node_modules/next/dist/bin/next'
$process = Start-Process -FilePath $nodePath -WindowStyle Hidden -WorkingDirectory $webRoot `
  -ArgumentList ('"{0}" start --port {1}' -f $nextPath, $Port) `
  -RedirectStandardOutput (Join-Path $logRoot 'web.log') `
  -RedirectStandardError (Join-Path $logRoot 'web-error.log') -PassThru
@{ pid = $process.Id; root = $runtimeRoot; branch = $branch; port = $Port } |
  ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logRoot 'runtime.json')
Write-Output "Assistant Web started on port $Port (PID $($process.Id)); API remains unchanged."
