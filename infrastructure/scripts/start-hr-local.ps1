param([switch]$Build, [switch]$SkipApi, [int]$Port = 3100)
$ErrorActionPreference = 'Stop'
$repoPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$webPath = Join-Path $repoPath 'apps/web'
$apiPath = Join-Path $repoPath 'apps/api'
$runtimePath = Join-Path $repoPath 'tmp/hr-runtime'
New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null

function Stop-OwnedListener([int]$ListenerPort) {
  $connections = @(Get-NetTCPConnection -LocalPort $ListenerPort -State Listen -ErrorAction SilentlyContinue)
  foreach ($ownerId in ($connections.OwningProcess | Select-Object -Unique)) {
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerId"
    if (!$owner -or !$owner.CommandLine -or !$owner.CommandLine.Contains($repoPath)) {
      throw "Port $ListenerPort belongs to another checkout/process; it was not stopped."
    }
    Stop-Process -Id $ownerId -ErrorAction Stop
  }
}

function Get-WebFingerprint {
  $sourceParts = @()
  foreach ($folder in @('apps/web/src')) {
    $sourceParts += Get-ChildItem -LiteralPath (Join-Path $repoPath $folder) -File -Recurse | Sort-Object FullName | ForEach-Object { "$($_.Name):$((Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash)" }
  }
  foreach ($name in @('next.config.ts','package.json','.env','.env.local','.env.production','.env.production.local')) {
    $configPath = Join-Path $webPath $name
    if (Test-Path -LiteralPath $configPath) { $sourceParts += "$($name):$((Get-FileHash -LiteralPath $configPath -Algorithm SHA256).Hash)" }
  }
  $hasher = [Security.Cryptography.SHA256]::Create()
  try { $fingerprint = [BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes(($sourceParts -join "`n")))).Replace('-','').Substring(0,16).ToLowerInvariant() } finally { $hasher.Dispose() }
  return $fingerprint
}

$commit = (& git -C $repoPath rev-parse HEAD).Trim()
$manifestPath = Join-Path $webPath '.next/hr-build.json'
if ($Build -or !(Test-Path -LiteralPath $manifestPath)) {
  Stop-OwnedListener $Port
  Push-Location $repoPath
  try {
    & pnpm --filter @rubi/web build
    if ($LASTEXITCODE -ne 0) { throw 'HR web build failed.' }
  } finally { Pop-Location }
  $fingerprint = Get-WebFingerprint
  @{commit=$commit;version="hr005-$fingerprint";builtAt=[DateTime]::UtcNow.ToString('O')} | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding utf8
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.commit -ne $commit -or $manifest.version -ne ('hr005-' + (Get-WebFingerprint))) { throw 'The saved build does not match this checkout. Run with -Build.' }
Stop-OwnedListener $Port
$nodePath = (Get-Command node).Source
$env:RUBI_HR_BUILD_ID = $manifest.version
$env:RUBI_HR_COMMIT = $manifest.commit
$nextPath = Join-Path $webPath 'node_modules/next/dist/bin/next'
$webProcess = Start-Process -FilePath $nodePath -ArgumentList @(('"' + $nextPath + '"'),'start','--port',"$Port",'--hostname','127.0.0.1') -WorkingDirectory $webPath -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimePath 'web.log') -RedirectStandardError (Join-Path $runtimePath 'web-error.log')
if (!$SkipApi) {
  $apiMain = Join-Path $apiPath 'dist/main.js'
  $apiEnvironment = Join-Path $apiPath '.env'
  if (!(Test-Path -LiteralPath $apiMain) -or !(Test-Path -LiteralPath $apiEnvironment)) { throw 'API build or local .env is missing.' }
  Stop-OwnedListener 4000
  $apiProcess = Start-Process -FilePath $nodePath -ArgumentList @(('--env-file="' + $apiEnvironment + '"'),('"' + $apiMain + '"')) -WorkingDirectory $apiPath -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimePath 'api.log') -RedirectStandardError (Join-Path $runtimePath 'api-error.log')
}
$ready = $false
for ($attempt=0; $attempt -lt 30; $attempt++) {
  try { $served = Invoke-RestMethod -Uri "http://localhost:$Port/api/hr-runtime" -TimeoutSec 3; if ($served.version -eq $manifest.version) { $ready=$true; break } } catch { Start-Sleep -Milliseconds 500 }
}
if (!$ready) { throw 'Local HR did not start with the expected version; inspect tmp/hr-runtime logs.' }
if (!$SkipApi) {
  $apiReady=$false
  for($attempt=0;$attempt -lt 30;$attempt++) {
    try { $health = Invoke-WebRequest -Uri 'http://localhost:4000/api/v1/health' -TimeoutSec 3 -UseBasicParsing; if($health.StatusCode -eq 200){$apiReady=$true;break} } catch { Start-Sleep -Milliseconds 500 }
  }
  if(!$apiReady){throw 'HR API did not become healthy; inspect tmp/hr-runtime/api-error.log.'}
}
@{url="http://localhost:$Port/hr";version=$served.version;commit=$served.commit;webPid=$webProcess.Id;apiHealthy=(!$SkipApi -and $apiReady)} | ConvertTo-Json
