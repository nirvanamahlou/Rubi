param(
  [Parameter(Mandatory = $true)][string]$AmiHost,
  [string]$Username = 'admin',
  [int]$Port = 5038,
  [ValidateRange(1, 600)][int]$Seconds = 120,
  [switch]$CompanyNetwork,
  [switch]$Tls
)
$ErrorActionPreference = 'Stop'
if (-not $Tls -and -not $CompanyNetwork) {
  throw 'For port5038, run on the trusted company network with -CompanyNetwork.'
}
$node = (Get-Command node -ErrorAction Stop).Source
$password = Read-Host 'AMI password (input hidden)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
try {
  $start = [Diagnostics.ProcessStartInfo]::new($node)
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.ArgumentList.Add('--disable-warning=MODULE_TYPELESS_PACKAGE_JSON')
  $start.ArgumentList.Add((Join-Path $PSScriptRoot 'ami-observe.mjs'))
  $start.ArgumentList.Add('--connect')
  $start.Environment['AMI_OBSERVE_HOST'] = $AmiHost
  $start.Environment['AMI_OBSERVE_PORT'] = [string]$Port
  $start.Environment['AMI_OBSERVE_USERNAME'] = $Username
  $start.Environment['AMI_OBSERVE_SECRET'] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  $start.Environment['AMI_OBSERVE_SECONDS'] = [string]$Seconds
  $start.Environment['AMI_OBSERVE_COMPANY_NETWORK'] = $CompanyNetwork.IsPresent.ToString().ToLowerInvariant()
  $start.Environment['AMI_OBSERVE_TLS'] = $Tls.IsPresent.ToString().ToLowerInvariant()
  $child = [Diagnostics.Process]::Start($start)
  $start.Environment.Remove('AMI_OBSERVE_SECRET') | Out-Null
  $child.WaitForExit()
  exit $child.ExitCode
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  $password.Dispose()
}
