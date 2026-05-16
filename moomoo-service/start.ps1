# moomoo-service launcher
# Uses the shared Python venv at c:\Ampps\www\az\backend\venv which already
# contains all required packages (fastapi, uvicorn, moomoo-api, python-dotenv).
# If you create a local venv\Scripts\uvicorn.exe it will be preferred automatically.

Set-Location $PSScriptRoot

$appData = Join-Path $PSScriptRoot ".runtime\appdata"
New-Item -ItemType Directory -Force -Path $appData | Out-Null
$env:appdata = $appData
$env:APPDATA = $appData

$localVenv = Join-Path $PSScriptRoot "venv"
$sharedVenv = "c:\Ampps\www\az\backend\venv"

if (Test-Path "$localVenv\Scripts\uvicorn.exe") {
    $uvicorn = "$localVenv\Scripts\uvicorn.exe"
} elseif (Test-Path "$sharedVenv\Scripts\uvicorn.exe") {
    $uvicorn = "$sharedVenv\Scripts\uvicorn.exe"
} else {
    Write-Error "Could not find uvicorn. Run: pip install -r requirements.txt in a venv."
    exit 1
}

Write-Output "Starting moomoo-service with: $uvicorn"
& $uvicorn main:app --host 127.0.0.1 --port 8001
