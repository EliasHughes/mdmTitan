@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
set "POWERSHELL=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
set "INSTALLER=%SCRIPT_DIR%Install-TitanMDMAgent-GPO.ps1"
set "CONFIG=%SCRIPT_DIR%config.json"

if not exist "%INSTALLER%" (
    exit /b 10
)

if not exist "%CONFIG%" (
    exit /b 11
)

"%POWERSHELL%" ^
    -NoLogo ^
    -NoProfile ^
    -NonInteractive ^
    -ExecutionPolicy Bypass ^
    -WindowStyle Hidden ^
    -File "%INSTALLER%" ^
    -ConfigPath "%CONFIG%"

set "EXITCODE=%ERRORLEVEL%"

exit /b %EXITCODE%