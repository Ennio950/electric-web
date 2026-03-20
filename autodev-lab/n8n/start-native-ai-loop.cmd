@echo off
setlocal

set "ROOT=C:\Users\ennio\OneDrive\Desktop\electric-web copia"

cd /d "%ROOT%"
netstat -ano | findstr ":11435" >nul
if errorlevel 1 (
  start "ollama-deepseek-cpu-bootstrap" /min cmd /d /c "%ROOT%\autodev-lab\n8n\start-ollama-deepseek-cpu.cmd"
  timeout /t 5 /nobreak >nul
)
start "n8n-native-ai-loop" /min cmd /d /c "%ROOT%\autodev-lab\n8n\run-native-ai-loop.cmd"

endlocal
