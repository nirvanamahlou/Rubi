param(
  [Parameter(Mandatory=$true)][string]$ApiEnvFile,
  [Parameter(Mandatory=$true)][string]$DocumentStorageRoot,
  [string]$PreviousRuntimeRoot
)
$ErrorActionPreference = 'Stop'
$unifiedRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$apiEnv = (Resolve-Path -LiteralPath $ApiEnvFile).Path
$storage = (Resolve-Path -LiteralPath $DocumentStorageRoot).Path
$webRoot = Join-Path $unifiedRoot 'apps/web'
$nextFile = Join-Path $webRoot 'node_modules/next/dist/bin/next'
$apiFile = Join-Path $PSScriptRoot 'start-hr-api.mjs'
foreach ($builtFile in @((Join-Path $webRoot '.next/BUILD_ID'), (Join-Path $unifiedRoot 'apps/api/dist/main.js'))) {
  if (!(Test-Path -LiteralPath $builtFile)) { throw 'Build Web and API before starting the unified runtime.' }
}
$approvedRoots = @($unifiedRoot)
if ($PreviousRuntimeRoot) { $approvedRoots += (Resolve-Path -LiteralPath $PreviousRuntimeRoot).Path }
# Validate both listeners before stopping either. Never stop another task's unknown runtime.
$ownedProcesses = @()
foreach ($port in @(3100,4190)) {
  foreach ($connection in @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($connection.OwningProcess)"
    $approved = $false
    foreach ($root in $approvedRoots) {
      $expected = if ($port -eq 3100) { Join-Path $root 'apps/web/node_modules/next/dist/bin/next' } else { Join-Path $root 'infrastructure/scripts/start-hr-api.mjs' }
      if ($process.Name -eq 'node.exe' -and $process.CommandLine.Contains($expected)) { $approved = $true }
    }
    if (!$approved) { throw "Port $port belongs to an unapproved runtime; nothing was stopped." }
    $ownedProcesses += $process
  }
}
$logRoot = Join-Path $unifiedRoot 'tmp/unified-runtime'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$env:RUBI_HR_BUILD_ID = 'unified-' + (Get-Content -LiteralPath (Join-Path $webRoot '.next/BUILD_ID')).Trim()
$env:RUBI_HR_COMMIT = (& git -C $unifiedRoot rev-parse HEAD).Trim()
foreach ($process in ($ownedProcesses | Sort-Object ProcessId -Unique)) {
  $fresh = Get-CimInstance Win32_Process -Filter "ProcessId=$($process.ProcessId)"
  if ($fresh -and $fresh.CommandLine -ne $process.CommandLine) { throw 'Runtime ownership changed during cutover.' }
  if ($fresh) { Stop-Process -Id $fresh.ProcessId -ErrorAction Stop }
}
$node = (Get-Command node).Source
$api = Start-Process -FilePath $node -ArgumentList @(('--env-file="'+$apiEnv+'"'), ('"'+$apiFile+'"'), '--api-port','4190','--web-port','3100','--database','rubi_hr_current_20260908','--documents',('"'+$storage+'"')) -WorkingDirectory (Join-Path $unifiedRoot 'apps/api') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot 'api.log') -RedirectStandardError (Join-Path $logRoot 'api-error.log')
$web = Start-Process -FilePath $node -ArgumentList @(('"'+$nextFile+'"'),'start','--port','3100','--hostname','127.0.0.1') -WorkingDirectory $webRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot 'web.log') -RedirectStandardError (Join-Path $logRoot 'web-error.log')
@{webPid=$web.Id;apiPid=$api.Id;url='http://127.0.0.1:3100/customer-affairs';commit=$env:RUBI_HR_COMMIT;build=$env:RUBI_HR_BUILD_ID} | ConvertTo-Json
