@echo off
setlocal
cd /d "%~dp0"

for /f "delims=" %%i in ('go env GOPATH') do set "GP=%%i"

set "WAILS=%GP%\bin\wails.exe"
if not exist "%WAILS%" set "WAILS=%USERPROFILE%\go\bin\wails.exe"

if not exist "%WAILS%" (
    echo [*] wails not found, installing...
    go install github.com/wailsapp/wails/v2/cmd/wails@latest
    if errorlevel 1 goto :fail
    set "WAILS=%GP%\bin\wails.exe"
    if not exist "%WAILS%" set "WAILS=%USERPROFILE%\go\bin\wails.exe"
)

if not exist "%WAILS%" (
    echo [x] wails not found
    goto :fail
)

echo [*] Stopping running app...
taskkill /IM podlets-wdtt.exe /F >nul 2>&1
timeout /t 2 >nul

if exist "build\bin" rmdir /S /Q "build\bin"

echo [*] Building...
"%WAILS%" build -platform windows/amd64 -clean -ldflags "-s -w"
if errorlevel 1 goto :fail

if not exist "build\bin\podlets-wdtt.exe" (
    echo [x] build\bin\podlets-wdtt.exe not found
    goto :fail
)

echo.
echo [OK] build\bin\podlets-wdtt.exe
echo [OK] Path: %CD%\build\bin
start "" "%CD%\build\bin"
exit /b 0

:fail
echo.
echo [x] BUILD FAILED
pause
exit /b 1
