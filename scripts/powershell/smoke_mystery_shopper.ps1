param(
  [string]$ApiBase = "http://localhost:8001",
  [int]$AdminUserId = 1,
  [int]$RepresentativeUserId = 3
)

$ErrorActionPreference = "Stop"

function Invoke-Json {
  param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers,
    [object]$Body = $null
  )

  try {
    if ($null -ne $Body) {
      return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers -Body ($Body | ConvertTo-Json -Depth 6) -ContentType "application/json"
    }

    return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers
  } catch {
    $response = $_.Exception.Response
    if ($response -and $response.GetResponseStream) {
      $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
      $bodyText = $reader.ReadToEnd()
      if ($bodyText) {
        Write-Host "HTTP error body: $bodyText" -ForegroundColor Red
      }
    }
    throw
  }
}

$adminHeaders = @{
  "X-User-Id" = "$AdminUserId"
  "X-Role" = "Admin"
}

$repHeaders = @{
  "X-User-Id" = "$RepresentativeUserId"
  "X-Role" = "Representative"
}

Write-Host "[0/8] Checking backend health at $ApiBase/health ..."
try {
  $health = Invoke-RestMethod -Method "GET" -Uri "$ApiBase/health"
  Write-Host "  backend_status=$($health.status)"
} catch {
  Write-Host "Backend is not reachable at $ApiBase" -ForegroundColor Red
  Write-Host "Start services first:" -ForegroundColor Yellow
  Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\\powershell\\run_db.ps1"
  Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\\powershell\\run_backend.ps1"
  throw
}

Write-Host "[1/8] Bootstrapping Mystery Shopper schema..."
$bootstrap = Invoke-Json -Method "POST" -Url "$ApiBase/mystery-shopper/bootstrap" -Headers $adminHeaders
Write-Host "  survey_type_id=$($bootstrap.survey_type_id), question_count=$($bootstrap.question_count)"

Write-Host "[2/8] Listing locations..."
$locationsBefore = Invoke-Json -Method "GET" -Url "$ApiBase/mystery-shopper/locations" -Headers $adminHeaders
$locationCount = @($locationsBefore).Count
Write-Host "  existing_locations=$locationCount"

$tempLocationName = "MS Smoke " + (Get-Date -Format "yyyyMMdd-HHmmss")
Write-Host "[3/8] Creating temp location '$tempLocationName'..."
$createdLocation = Invoke-Json -Method "POST" -Url "$ApiBase/mystery-shopper/locations" -Headers $adminHeaders -Body @{ name = $tempLocationName }
Write-Host "  location_id=$($createdLocation.id)"

Write-Host "[4/8] Checking question retrieval..."
$questions = Invoke-Json -Method "GET" -Url "$ApiBase/questions?survey_type=Mystery%20Shopper" -Headers $repHeaders
$questionCount = @($questions).Count
Write-Host "  questions_loaded=$questionCount"

$today = Get-Date -Format "yyyy-MM-dd"
$visitPayload = @{
  location_id = [int]$createdLocation.id
  representative_id = [int]$RepresentativeUserId
  created_by = [int]$RepresentativeUserId
  visit_date = $today
  visit_type = "Planned"
  visit_time = "10:30"
  purpose_of_visit = "General Enquiry"
  staff_on_duty = "Smoke Test Staff"
  shopper_name = "Smoke Test Shopper"
}

Write-Host "[5/8] Creating mystery visit draft..."
$createdVisit = Invoke-Json -Method "POST" -Url "$ApiBase/mystery-shopper/visits" -Headers $repHeaders -Body $visitPayload
$visitId = "$($createdVisit.visit_id)"
Write-Host "  visit_id=$visitId"

Write-Host "[6/8] Verifying draft list includes created visit..."
$drafts = Invoke-Json -Method "GET" -Url "$ApiBase/mystery-shopper/visits/drafts?representative_id=$RepresentativeUserId" -Headers $repHeaders
$draftMatch = $drafts | Where-Object { "$($_.visit_id)" -eq $visitId }
if (-not $draftMatch) {
  throw "Created visit not found in drafts list"
}
Write-Host "  draft_found=true"

Write-Host "[7/8] Submitting visit (UTC+4 completion date expected)..."
$submitted = Invoke-Json -Method "PUT" -Url "$ApiBase/mystery-shopper/visits/$visitId/submit" -Headers $repHeaders
Write-Host "  status=$($submitted.status), report_completed_date=$($submitted.report_completed_date)"

Write-Host "[8/8] Deactivating temp location..."
$deactivated = Invoke-Json -Method "DELETE" -Url "$ApiBase/mystery-shopper/locations/$($createdLocation.id)" -Headers $adminHeaders
Write-Host "  location_active=$($deactivated.active)"

Write-Host ""
Write-Host "Mystery Shopper smoke test completed successfully." -ForegroundColor Green
