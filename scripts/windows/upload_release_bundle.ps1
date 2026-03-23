Param(
    [string]$BundlePath = "$env:TEMP\cwscx-release.zip",
    [string]$Server = "cxadmin@172.17.1.213",
    [string]$RemotePath = "/tmp/cwscx-release.zip"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BundlePath)) {
    throw "Bundle not found: $BundlePath"
}

scp "$BundlePath" "$Server`:$RemotePath"
Write-Host "Uploaded $BundlePath to ${Server}:$RemotePath" -ForegroundColor Green
