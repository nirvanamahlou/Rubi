param(
  [Parameter(Mandatory=$true)][string]$ApiEnvFile,
  [Parameter(Mandatory=$true)][string]$DocumentStorageRoot,
  [string[]]$PreviousRuntimeRoot,
  [ValidateRange(1024,65535)][int]$ApiPort = 4191,
  [ValidateRange(1024,65535)][int]$GatewayPort = 3100,
  [ValidateRange(1024,65535)][int]$WebPort = 3110
)
$ErrorActionPreference = 'Stop'
if (($ApiPort,$GatewayPort,$WebPort | Sort-Object -Unique).Count -ne 3) {
  throw 'ApiPort, GatewayPort and WebPort must be different.'
}
$unifiedRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$apiEnv = (Resolve-Path -LiteralPath $ApiEnvFile).Path
$storage = (Resolve-Path -LiteralPath $DocumentStorageRoot).Path
$webRoot = Join-Path $unifiedRoot 'apps/web'
$nextFile = Join-Path $webRoot 'node_modules/next/dist/bin/next'
$apiFile = Join-Path $PSScriptRoot 'start-hr-api.mjs'
$gatewayFile = Join-Path $PSScriptRoot 'runtime-gateway.mjs'
foreach ($builtFile in @((Join-Path $webRoot '.next/BUILD_ID'), (Join-Path $unifiedRoot 'apps/api/dist/main.js'))) {
  if (!(Test-Path -LiteralPath $builtFile)) { throw 'Build Web and API before starting the unified runtime.' }
}
$approvedRoots = @($unifiedRoot)
foreach ($root in @($PreviousRuntimeRoot)) {
  if ($root) { $approvedRoots += (Resolve-Path -LiteralPath $root).Path }
}
# Validate every listener before stopping one. Never stop another task's unknown runtime.
$ownedProcesses = @()
foreach ($port in @($GatewayPort,$WebPort,$ApiPort)) {
  foreach ($connection in @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($connection.OwningProcess)"
    $approved = $false
    foreach ($root in $approvedRoots) {
      $expectedFiles = if ($port -eq $GatewayPort) {
        @((Join-Path $root 'infrastructure/scripts/runtime-gateway.mjs'), (Join-Path $root 'apps/web/node_modules/next/dist/bin/next'))
      } elseif ($port -eq $WebPort) {
        @((Join-Path $root 'apps/web/node_modules/next/dist/bin/next'))
      } else {
        @((Join-Path $root 'infrastructure/scripts/start-hr-api.mjs'))
      }
      foreach ($expected in $expectedFiles) {
        if ($process.Name -eq 'node.exe' -and $process.CommandLine.Replace('\','/').Contains($expected.Replace('\','/'))) { $approved = $true }
      }
    }
    if (!$approved) { throw "Port $port belongs to an unapproved runtime; nothing was stopped." }
    $ownedProcesses += $process
  }
}
$logRoot = Join-Path $unifiedRoot 'tmp/unified-runtime'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$env:NORA_HR_BUILD_ID = 'unified-' + (Get-Content -LiteralPath (Join-Path $webRoot '.next/BUILD_ID')).Trim()
$env:NORA_HR_COMMIT = (& git -C $unifiedRoot rev-parse HEAD).Trim()
foreach ($process in ($ownedProcesses | Sort-Object ProcessId -Unique)) {
  $fresh = Get-CimInstance Win32_Process -Filter "ProcessId=$($process.ProcessId)"
  if ($fresh -and $fresh.CommandLine -ne $process.CommandLine) { throw 'Runtime ownership changed during cutover.' }
  if ($fresh) { Stop-Process -Id $fresh.ProcessId -ErrorAction Stop }
}
$node = (Get-Command node).Source
$started = @()
try {
  $api = Start-Process -FilePath $node -ArgumentList @(('--env-file="'+$apiEnv+'"'), ('"'+$apiFile+'"'), '--api-port',"$ApiPort",'--web-port',"$GatewayPort",'--database','rubi_hr_current_20260908','--documents',('"'+$storage+'"')) -WorkingDirectory (Join-Path $unifiedRoot 'apps/api') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot 'api.log') -RedirectStandardError (Join-Path $logRoot 'api-error.log')
  $started += $api
  $web = Start-Process -FilePath $node -ArgumentList @(('"'+$nextFile+'"'),'start','--port',"$WebPort",'--hostname','127.0.0.1') -WorkingDirectory $webRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot 'web.log') -RedirectStandardError (Join-Path $logRoot 'web-error.log')
  $started += $web

  $ready = $false
  foreach ($attempt in 1..60) {
    try {
      $runtime = Invoke-RestMethod -Uri "http://127.0.0.1:$WebPort/api/hr-runtime" -TimeoutSec 2
      if ($runtime.commit -eq $env:NORA_HR_COMMIT -and $runtime.version -eq $env:NORA_HR_BUILD_ID) { $ready = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  if (!$ready) { throw 'The versioned Web runtime did not become ready on its internal port.' }

  $gateway = Start-Process -FilePath $node -ArgumentList @(('"'+$gatewayFile+'"'),'--listen-port',"$GatewayPort",'--target-port',"$WebPort") -WorkingDirectory $unifiedRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logRoot 'gateway.log') -RedirectStandardError (Join-Path $logRoot 'gateway-error.log')
  $started += $gateway

  $gatewayReady = $false
  foreach ($attempt in 1..20) {
    try {
      $runtime = Invoke-RestMethod -Uri "http://127.0.0.1:$GatewayPort/api/hr-runtime" -TimeoutSec 2
      if ($runtime.commit -eq $env:NORA_HR_COMMIT -and $runtime.version -eq $env:NORA_HR_BUILD_ID) { $gatewayReady = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 250
  }
  if (!$gatewayReady) { throw 'The stable Web gateway did not become ready.' }

  @{gatewayPid=$gateway.Id;webPid=$web.Id;apiPid=$api.Id;url="http://127.0.0.1:$GatewayPort/workbench";commit=$env:NORA_HR_COMMIT;build=$env:NORA_HR_BUILD_ID} | ConvertTo-Json
} catch {
  foreach ($process in $started) {
    if (Get-Process -Id $process.Id -ErrorAction SilentlyContinue) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
  }
  throw
}
