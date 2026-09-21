@echo off
setlocal
chcp 65001 >nul
title MadePinus - Instalar no boot do Windows

REM Cria atalho na pasta Inicializar do usuario atual.

set "BAT=%~dp0INICIAR-SISTEMA.bat"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "ATALHO=%STARTUP%\MadePinus-Servidor.lnk"

if not exist "%BAT%" (
  echo [ERRO] Nao achei INICIAR-SISTEMA.bat
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s=New-Object -ComObject WScript.Shell; $l=$s.CreateShortcut('%ATALHO%'); $l.TargetPath='%BAT%'; $l.WorkingDirectory='%~dp0'; $l.WindowStyle=7; $l.Description='MadePinus API + tunel'; $l.Save()"

echo.
echo [OK] Atalho criado:
echo     %ATALHO%
echo.
echo O sistema subira automaticamente no login do Windows.
echo Para remover: apague o atalho na pasta Inicializar.
echo.
pause
endlocal
