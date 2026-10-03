<#
  EMR_GitHub_Setup.ps1
  Puts the EMR into a GitHub repository with this layout, then commits and pushes it:

    index.html                                 main EMR home
    facility_register\facility_register.html   Health Facility Registry
    phu_emr\phu_emr.html                       Case Based Entry Form
    DPC\Malaria\index.html, DPC\HIV\index.html, ...  directorate folder, then programme folder (in the zip)

  It never overwrites a programme's index.html that is already there, and it removes the old
  facility_register.html and phu_emr.html from the top of the repository.

  HOW TO RUN
    1. Put EMR.zip and this script in the same folder (for example Downloads).
    2. Open PowerShell in that folder and run:
         powershell -ExecutionPolicy Bypass -File .\EMR_GitHub_Setup.ps1 -RepoPath "C:\path\to\your-repo"
       If the repository is not on this computer yet, give its address instead and it is cloned:
         powershell -ExecutionPolicy Bypass -File .\EMR_GitHub_Setup.ps1 -RepoUrl "https://github.com/USER/REPO.git" -RepoPath "C:\GitHub\REPO"
#>
param(
  [Parameter(Mandatory = $true)] [string] $RepoPath,
  [string] $RepoUrl = "",
  [string] $ZipPath = (Join-Path $PSScriptRoot "EMR.zip"),
  [string] $Message = "EMR: home page, facility register and PHU EMR in their folders, programme folders"
)

$ErrorActionPreference = "Stop"
$utf8 = New-Object System.Text.UTF8Encoding($false)   # UTF-8 without BOM, as GitHub Pages expects

function Say($text, $color = "Cyan") { Write-Host $text -ForegroundColor $color }

# ---------- 1. checks ----------
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git is not installed. Install it from https://git-scm.com and run this again." }
if (-not (Test-Path $ZipPath)) { throw "EMR.zip was not found at $ZipPath. Put it beside this script or pass -ZipPath." }

if (-not (Test-Path (Join-Path $RepoPath ".git"))) {
  if ($RepoUrl -eq "") { throw "$RepoPath is not a git repository. Pass -RepoUrl to clone it first." }
  Say "Cloning $RepoUrl into $RepoPath ..."
  git clone $RepoUrl $RepoPath
  if ($LASTEXITCODE -ne 0) { throw "git clone failed." }
}
Set-Location $RepoPath
Say "Getting the latest from GitHub ..."
git pull
if ($LASTEXITCODE -ne 0) { throw "git pull failed. Sort out any local changes, then run this again." }

# ---------- 2. the EMR files from the zip ----------
$tmp = Join-Path $env:TEMP ("emr_" + [guid]::NewGuid().ToString("N"))
Expand-Archive -Path $ZipPath -DestinationPath $tmp -Force

New-Item -ItemType Directory -Force -Path (Join-Path $RepoPath "facility_register") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $RepoPath "phu_emr") | Out-Null
Copy-Item (Join-Path $tmp "index.html") (Join-Path $RepoPath "index.html") -Force
Copy-Item (Join-Path $tmp "facility_register\facility_register.html") (Join-Path $RepoPath "facility_register\facility_register.html") -Force
Copy-Item (Join-Path $tmp "phu_emr\phu_emr.html") (Join-Path $RepoPath "phu_emr\phu_emr.html") -Force
Remove-Item $tmp -Recurse -Force
Say "Copied index.html, facility_register\facility_register.html and phu_emr\phu_emr.html" "Green"

# the facility register reads facilities.csv from its own folder
$csvTop = Join-Path $RepoPath "facilities.csv"
$csvReg = Join-Path $RepoPath "facility_register\facilities.csv"
if ((Test-Path $csvTop) -and -not (Test-Path $csvReg)) {
  Copy-Item $csvTop $csvReg
  Say "Copied facilities.csv into facility_register\" "Green"
}

# ---------- 3. remove the old copies at the top ----------
foreach ($old in @("facility_register.html", "phu_emr.html")) {
  if (Test-Path (Join-Path $RepoPath $old)) {
    git rm -q -- $old
    Say "Removed the old $old from the top of the repository" "Yellow"
  }
}

# ---------- 4. one folder per MoH Analytics programme ----------
# folder name, programme code, programme name, directorate
$programmes = @(
  @("DPC\Malaria",   "NMCP",      "National Malaria Control Programme",       "DPC, Directorate of Disease Prevention and Control"),
  @("DPC\HIV",       "HIV",       "National HIV and AIDS Programme",          "DPC, Directorate of Disease Prevention and Control"),
  @("DPC\TB",        "TB",        "National Tuberculosis Programme",          "DPC, Directorate of Disease Prevention and Control"),
  @("DPC\NTD",       "NTD",       "Neglected Tropical Diseases Programme",    "DPC, Directorate of Disease Prevention and Control"),
  @("RCH-N\EPI",       "EPI",       "Expanded Programme on Immunisation",       "RCH-N, Directorate of Reproductive, Child Health and Nutrition"),
  @("RCH-N\CHP",       "CHP",       "Child Health Programme",                   "RCH-N, Directorate of Reproductive, Child Health and Nutrition"),
  @("RCH-N\FP",        "FP",        "Family Planning",                          "RCH-N, Directorate of Reproductive, Child Health and Nutrition"),
  @("RCH-N\Nutrition", "NUTRITION", "Food and Nutrition",                       "RCH-N, Directorate of Reproductive, Child Health and Nutrition"),
  @("DPHC\CHW",       "CHW",       "Community Health Workers",                 "DPHC, Directorate of Primary Health Care"),
  @("DPHC\HE",        "HE",        "Health Education and Promotion",           "DPHC, Directorate of Primary Health Care"),
  @("DPHC\EYE",       "EYE",       "Eye Health",                               "DPHC, Directorate of Primary Health Care"),
  @("DPS\NMSA",      "NMSA",      "National Medical Supplies Agency",         "DPS, Directorate of Pharmaceutical Services"),
  @("DPS\LMIS",      "LMIS",      "Logistics Management Information System",  "DPS, Directorate of Pharmaceutical Services"),
  @("DHS\Hospital",  "HOSPITAL",  "Hospital Services",                        "DHS, Directorate of Hospital Services"),
  @("DHS\NEMS",      "NEMS",      "National Emergency Medical Service",       "DHS, Directorate of Hospital Services"),
  @("DHS\LAB",       "LAB",       "Laboratory Services",                      "DHS, Directorate of Hospital Services")
)

# programme folders left at the top by the earlier layout move into their directorate folder
foreach ($p in $programmes) {
  $leaf = Split-Path $p[0] -Leaf
  $oldTop = Join-Path $RepoPath $leaf
  $newPath = Join-Path $RepoPath $p[0]
  if ((Test-Path $oldTop) -and -not (Test-Path $newPath)) {
    New-Item -ItemType Directory -Force -Path (Split-Path $newPath -Parent) | Out-Null
    git mv -- $leaf $p[0].Replace("\", "/")
    Say ("Moved " + $leaf + " into " + $p[0]) "Yellow"
  }
}

# each programme folder comes from the zip with its index.html; a page already in the repository is kept
$tmp2 = Join-Path $env:TEMP ("emr_" + [guid]::NewGuid().ToString("N"))
Expand-Archive -Path $ZipPath -DestinationPath $tmp2 -Force
foreach ($p in $programmes) {
  $folder = Join-Path $RepoPath $p[0]
  $page = Join-Path $folder "index.html"
  New-Item -ItemType Directory -Force -Path $folder | Out-Null
  if (Test-Path $page) {
    Say ("Kept the existing " + $p[0] + "\index.html") "Gray"
  } else {
    Copy-Item (Join-Path $tmp2 ($p[0] + "\index.html")) $page
    Say ("Added " + $p[0] + "\index.html") "Green"
  }
}
Remove-Item $tmp2 -Recurse -Force

# ---------- 5. commit and push ----------
git add -A
$changes = git status --porcelain
if (-not $changes) { Say "Nothing changed, so nothing to push." "Yellow"; exit 0 }
git commit -m $Message
if ($LASTEXITCODE -ne 0) { throw "git commit failed." }
git push
if ($LASTEXITCODE -ne 0) { throw "git push failed. Check that you are signed in to GitHub, then run: git push" }
Say "Done. GitHub Pages updates within a minute or two." "Green"
