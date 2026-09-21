@echo off
setlocal EnableExtensions
chcp 65001 >nul
title MadePinus - Inicializacao do Servidor

REM ============================================================================
REM  INICIAR-SISTEMA.bat
REM  Sobe API + tunel HTTPS + alinha Netlify apos reinicio do PC.
REM  Logs: COMANDO\logs\
REM ============================================================================

set "RAIZ=%~dp0.."
pushd "%RAIZ%" >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Nao foi possivel acessar a pasta do projeto.
  pause
  exit /b 1
)
set "RAIZ=%CD%"
popd >nul

set "PS1=%~dp0iniciar-sistema.ps1"
set "LOGDIR=%~dp0logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

echo.
echo  ============================================================
echo   MadePinus - Inicializacao automatica do servidor local
echo   Pasta: %RAIZ%
echo  ============================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Raiz "%RAIZ%" -LogDir "%LOGDIR%"
set "CODIGO=%ERRORLEVEL%"

echo.
if "%CODIGO%"=="0" (
  echo  [OK] Sistema pronto. Pode fechar esta janela.
) else (
  echo  [FALHA] Codigo %CODIGO%. Veja os logs em:
  echo          %LOGDIR%
  echo.
  pause
)

endlocal & exit /b %CODIGO%
