param(
  [switch]$Restart,
  [switch]$CleanNextCache,
  [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'

# LocalHost 3000 is intentionally owned by this single integrated worktree.
# Dashboard and Reports changes must be made here (or merged here) so Next.js
# hot reloads both modules without silently switching to an older worktree.
$runtimeRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$webRoot = Join-Path $runtimeRoot 'apps/web'
$expectedBranch = 'codex/pc-c-dashboard-reporting-latest'

if (!(Test-Path -LiteralPath (Join-Path $webRoot 'package.json'))) {
  throw "Invalid unified runtime root: $webRoot"
}

$branch = (& git -C $runtimeRoot rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne $expectedBranch) {
  throw "LocalHost runtime must run from '$expectedBranch'; current branch is '$branch'."
}

$requiredFiles = @(
  'apps/web/src/modules/dashboard/components/dashboard-workspace.tsx',
  'apps/web/src/modules/reports/components/reporting-workspace.tsx',
  'apps/web/src/app/(crm)/dashboard/page.tsx',
  'apps/web/src/app/(crm)/reports/page.tsx'
)
foreach ($relativePath in $requiredFiles) {
  if (!(Test-Path -LiteralPath (Join-Path $runtimeRoot $relativePath))) {
    throw "Unified runtime is incomplete; missing $relativePath"
  }
}

function Get-PortListenerPids {
  $pids = @()
  try {
    $pids += @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
      Select-Object -ExpandProperty OwningProcess)
  } catch {
    # Fall back below; some managed sessions hide Get-NetTCPConnection results.
  }
  if ($pids.Count -eq 0) {
    # Use the same OS-level listener table shown by netstat in those sessions.
    $lines = @(netstat -ano -p tcp 2>$null | Select-String -Pattern (":" + $Port + "\s+\S+\s+LISTENING\s+\d+\s*$"))
    foreach ($line in $lines) {
      $parts = ($line.ToString() -split '\s+') | Where-Object { $_ }
      if ($parts.Count -ge 5 -and $parts[0] -eq 'TCP') {
        $pids += $parts[4]
      }
    }
  }
  @($pids | ForEach-Object { [int]$_ } | Sort-Object -Unique)
}

$listenerPids = @(Get-PortListenerPids)
if ($listenerPids.Count -gt 0) {
  if (!$Restart) {
    $pids = $listenerPids -join ', '
    throw "Port $Port is already owned by PID(s) $pids. Stop the old runtime or rerun with -Restart after verifying the PID(s)."
  }

  foreach ($listenerPid in $listenerPids) {
    $process = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue
    if ($process) {
      Stop-Process -Id $process.Id -Force
    }
  }
  Start-Sleep -Milliseconds 400
}

if ($CleanNextCache) {
  $nextCache = Join-Path $webRoot '.next'
  if (Test-Path -LiteralPath $nextCache) {
    $archiveRoot = Join-Path ([IO.Path]::GetTempPath()) 'rubi-next-cache'
    New-Item -ItemType Directory -Path $archiveRoot -Force | Out-Null
    $archivePath = Join-Path $archiveRoot (Get-Date -Format 'yyyyMMdd-HHmmss')
    Move-Item -LiteralPath $nextCache -Destination $archivePath -Force
  }
}

$nextCommand = Join-Path $webRoot 'node_modules/.bin/next.cmd'
if (!(Test-Path -LiteralPath $nextCommand)) {
  throw "Web dependencies are not installed: $nextCommand"
}

Start-Process `
  -FilePath $nextCommand `
  -ArgumentList @('dev', '--port', "$Port") `
  -WorkingDirectory $webRoot `
  -WindowStyle Hidden | Out-Null

Start-Sleep -Seconds 2
$active = @(Get-PortListenerPids)
if ($active.Count -eq 0) {
  throw "Unified runtime did not start on port $Port."
}

Write-Output "LocalHost $Port is served from $runtimeRoot ($branch)."
Write-Output 'Dashboard: http://localhost:3000/dashboard'
Write-Output 'Reports:   http://localhost:3000/reports?view=catalog'
