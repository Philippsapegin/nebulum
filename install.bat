@echo off
setlocal

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-nebulum.ps1"
if errorlevel 1 (
  echo.
  echo Nebulum install failed.
  pause
  exit /b 1
)

exit /b 0
