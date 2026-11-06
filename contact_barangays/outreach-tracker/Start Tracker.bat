@echo off
title Barangay Outreach Tracker Launcher
setlocal
cd /d "%~dp0" || goto startup_error

echo =======================================================
echo               BARANGAY OUTREACH TRACKER
echo =======================================================
echo.
echo [1/2] Checking Python...
python --version
if errorlevel 1 (
    echo [ERROR] Python could not start. Make sure it is installed and on PATH.
    pause
    exit /b 1
)

echo.
echo [2/2] Launching the local dashboard...
echo Project folder: "%CD%"
cd "C:\Users\Hans\Downloads\Personal\CODE\BAGUIO\contact_barangays\outreach-tracker"

echo Keep this window open while using the tracker.
echo -------------------------------------------------------
python server.py --port 8766 %*

if errorlevel 1 goto startup_error
exit /b 0

:startup_error
echo.
echo [ERROR] The tracker could not start. See the error above.
pause
exit /b 1
