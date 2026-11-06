@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Instale o Node.js LTS em https://nodejs.org e abra este arquivo novamente.
  pause
  exit /b 1
)
node iniciar.cjs
pause
