param(
  [string]$ApiBase = "http://127.0.0.1:8001",
  [string]$DbUrl = "postgresql://b2b:b2b@127.0.0.1:5432/b2b",
  [switch]$UseDevBypass,
  [string]$AccessToken = "",
  [switch]$AppendTracklist = $true,
  [string]$TracklistPath = ""
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot/../.."
$Backend = Join-Path $Root "backend"
$PythonExe = Join-Path $Root ".venv/Scripts/python.exe"
if (-not (Test-Path $PythonExe)) {
  $PythonExe = Join-Path $Backend ".venv/Scripts/python.exe"
}
if (-not (Test-Path $PythonExe)) {
  throw "Python executable not found in .venv paths."
}

if (-not $TracklistPath) {
  $TracklistPath = Join-Path $Root "TRACKLIST.md"
}

function Write-Step {
  param([string]$Message)
  Write-Host "`n=== $Message ==="
}

function Invoke-CurlDetailed {
  param(
    [string]$Url,
    [int]$Timeout = 10,
    [string[]]$Headers = @()
  )

  $args = @("--max-time", "$Timeout", "--silent", "--show-error", "--write-out", "`nHTTP_STATUS:%{http_code}", $Url)
  foreach ($h in $Headers) {
    $args += @("-H", $h)
  }

  try {
    $raw = & curl.exe @args 2>&1
    $joined = ($raw | Out-String).Trim()
    $status = "000"
    if ($joined -match "HTTP_STATUS:(\d{3})") {
      $status = $matches[1]
    }
    $body = $joined -replace "(?s)\nHTTP_STATUS:\d{3}\s*$", ""
    return [pscustomobject]@{
      Url = $Url
      Status = $status
      Body = $body
      Raw = $joined
      Success = $status -ne "000"
    }
  } catch {
    return [pscustomobject]@{
      Url = $Url
      Status = "000"
      Body = ""
      Raw = $_.Exception.Message
      Success = $false
    }
  }
}

function Append-Tracklist {
  param(
    [string]$FilePath,
    [string]$Content
  )
  Add-Content -Path $FilePath -Value $Content
}

$headers = @()
if ($UseDevBypass) {
  $headers += "X-Dev-Auth-Bypass: true"
  $headers += "X-User-Id: 999999"
  $headers += "X-User-Role: Admin"
} elseif ($AccessToken) {
  $headers += "Authorization: Bearer $AccessToken"
}

$authMode = "none"
if ($UseDevBypass) {
  $authMode = "dev-bypass"
} elseif ($AccessToken) {
  $authMode = "bearer-token"
}

Write-Step "Backend health"
$health = Invoke-CurlDetailed -Url "$ApiBase/health" -Timeout 8 -Headers $headers
Write-Host $health.Raw

Write-Step "Database row counts"
$env:DATABASE_URL = $DbUrl
Set-Location $Backend
$dbRaw = @'
import os
import psycopg2

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()
tables = ["users", "businesses", "questions", "visits", "responses", "b2b_visit_responses", "survey_types"]
for table in tables:
    try:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        print(f"{table}: {cur.fetchone()[0]}")
    except Exception as exc:
        conn.rollback()
        print(f"{table}: ERROR -> {exc}")
cur.close()
conn.close()
'@ | & $PythonExe - 2>&1
$dbText = ($dbRaw | Out-String).Trim()
if ($LASTEXITCODE -ne 0) {
  $dbText = "Database check command failed with exit code $LASTEXITCODE"
}
Write-Host $dbText


Write-Step "API smoke checks"
$analytics = Invoke-CurlDetailed -Url "$ApiBase/analytics?survey_type=B2B" -Timeout 12 -Headers $headers
Write-Host $analytics.Raw

$nps = Invoke-CurlDetailed -Url "$ApiBase/dashboard/nps?survey_type=B2B" -Timeout 12 -Headers $headers
Write-Host $nps.Raw

$visits = Invoke-CurlDetailed -Url "$ApiBase/dashboard-visits/all?survey_type=B2B" -Timeout 12 -Headers $headers
Write-Host $visits.Raw

$verifyStatus = "pass"
if ($health.Status -ne "200" -or $analytics.Status -eq "000" -or $nps.Status -eq "000" -or $visits.Status -eq "000") {
  $verifyStatus = "fail"
}

$timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
$summaryLines = @()
$summaryLines += ""
$summaryLines += "## Session: TDD Verify $timestamp"
$summaryLines += ""
$summaryLines += "### Config"
$summaryLines += ""
$summaryLines += "- API Base: $ApiBase"
$summaryLines += "- DB URL: $DbUrl"
$summaryLines += "- Auth Mode: $authMode"
$summaryLines += ""
$summaryLines += "### Results"
$summaryLines += ""
$summaryLines += ("- Verify Status: " + $verifyStatus)
$summaryLines += ("- Health HTTP: " + $health.Status)
$summaryLines += ("- Analytics HTTP: " + $analytics.Status)
$summaryLines += ("- NPS HTTP: " + $nps.Status)
$summaryLines += ("- Visits HTTP: " + $visits.Status)
$summaryLines += ""
$summaryLines += "### Verbatim Output"
$summaryLines += ""
$summaryLines += "#### Health"
$summaryLines += '```'
$summaryLines += [string]$health.Raw
$summaryLines += '```'
$summaryLines += ""
$summaryLines += "#### Database Counts"
$summaryLines += '```'
$summaryLines += [string]$dbText
$summaryLines += '```'
$summaryLines += ""
$summaryLines += "#### Analytics"
$summaryLines += '```'
$summaryLines += [string]$analytics.Raw
$summaryLines += '```'
$summaryLines += ""
$summaryLines += "#### Dashboard NPS"
$summaryLines += '```'
$summaryLines += [string]$nps.Raw
$summaryLines += '```'
$summaryLines += ""
$summaryLines += "#### Dashboard Visits"
$summaryLines += '```'
$summaryLines += [string]$visits.Raw
$summaryLines += '```'
$summary = [string]::Join([Environment]::NewLine, $summaryLines)

if ($AppendTracklist) {
  Append-Tracklist -FilePath $TracklistPath -Content $summary
  Write-Host "`nAppended verification results to: $TracklistPath"
}

if ($verifyStatus -eq "fail") {
  throw "TDD verification failed. Ensure backend is running and reachable at $ApiBase before rerunning."
}

Write-Step "Done"
Write-Host "TDD verify completed."
