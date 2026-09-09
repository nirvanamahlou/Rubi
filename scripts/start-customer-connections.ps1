param([ValidateSet('api', 'web')][string]$Service = 'api')
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$baseEnv = [IO.Path]::GetFullPath((Join-Path $repoRoot '../../.env'))
if (!(Test-Path -LiteralPath $baseEnv)) { throw 'Local base .env was not found.' }
foreach ($line in Get-Content -LiteralPath $baseEnv) {
  if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim().Trim('"').Trim("'"), 'Process')
  }
}
if (([Uri]$env:DATABASE_URL).Host -notin @('localhost', '127.0.0.1', '::1')) {
  throw 'This launcher accepts only the local database.'
}
$runtimeRoot = Join-Path $repoRoot 'tmp/customer-connections'
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
$keyFile = Join-Path $runtimeRoot 'documents-key.clixml'
if (!(Test-Path -LiteralPath $keyFile)) {
  $keyBytes = [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
  $secret = ConvertTo-SecureString -String ([Convert]::ToBase64String($keyBytes)) -AsPlainText -Force
  $secret | Export-Clixml -LiteralPath $keyFile
  [Array]::Clear($keyBytes, 0, $keyBytes.Length)
}
$savedKey = Import-Clixml -LiteralPath $keyFile
$env:DOCUMENTS_STORAGE_ENCRYPTION_KEY_BASE64 = ConvertFrom-SecureString -SecureString $savedKey -AsPlainText
$env:DOCUMENTS_STORAGE_ROOT = Join-Path $runtimeRoot 'documents'
$env:NODE_ENV = 'development'
$env:API_PORT = '4101'
$env:CORS_ORIGINS = 'http://localhost:3101'
$env:NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4101/api/v1'
Set-Location -LiteralPath $repoRoot
if ($Service -eq 'api') {
  node apps/api/dist/main.js
} else {
  pnpm --filter @rubi/web exec next dev --hostname localhost --port 3101
}
