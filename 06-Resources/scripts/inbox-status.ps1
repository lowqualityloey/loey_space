# Reports inbox pressure once per session.
# Counts tagged/untagged capture lines in the dump plus any loose inbox notes,
# and reports the age of the oldest item. Read-only.

$ErrorActionPreference = "SilentlyContinue"

# Resolve the vault root from the script's own location, falling back to the
# working directory when the script is piped or dot-sourced without a path.
$vaultRoot = if ($PSScriptRoot) { (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path } else { (Get-Location).Path }

$dumpPath = Join-Path $vaultRoot "00-Inbox\quick-capture-dump.md"
$inboxDir = Join-Path $vaultRoot "00-Inbox"

$TOKENS = '#do|#dev|#concept|#learn|#ref|#personal|#project|#bin'

$open = 0
$tagged = 0
$oldest = $null
$inTriaged = $false
$currentDate = $null

if (Test-Path $dumpPath) {
  foreach ($line in Get-Content -LiteralPath $dumpPath) {
    # Everything below the Triaged log is history, not workload.
    if ($line -match '^##\s+.*Triaged') { $inTriaged = $true; continue }
    if ($line -match '^##\s+' -and $line -notmatch 'Triaged') { $inTriaged = $false }
    if ($inTriaged) { continue }

    if ($line -match '^###\s+.*?(\d{4}-\d{2}-\d{2})') { $currentDate = $Matches[1]; continue }

    if ($line -match '^\s*-\s+\S') {
      $open++
      if ($line -match $TOKENS) { $tagged++ }
      if ($currentDate -and (-not $oldest -or $currentDate -lt $oldest)) { $oldest = $currentDate }
    }
  }
}

$looseNotes = 0
if (Test-Path $inboxDir) {
  $looseNotes = @(Get-ChildItem -LiteralPath $inboxDir -Filter *.md -File |
    Where-Object { $_.Name -notlike "_*" -and $_.Name -ne "quick-capture-dump.md" }).Count
}

$total = $open + $looseNotes

if ($total -eq 0) {
  Write-Output "Inbox: clear."
  exit 0
}

$agePart = ""
if ($oldest) {
  $days = [int]((Get-Date).Date - ([datetime]$oldest).Date).TotalDays
  if ($days -gt 0) { $agePart = ", oldest $days day" + $(if ($days -ne 1) { "s" } else { "" }) }
}

$itemWord = "item" + $(if ($total -ne 1) { "s" } else { "" })
$readyPart = if ($tagged -gt 0) { " $tagged ready to sweep." } else { " None tagged yet." }

Write-Output "Inbox: $total $itemWord$agePart.$readyPart Tag lines with #do #dev #concept #learn #ref #personal #project #bin, then run Triage Sweep."
