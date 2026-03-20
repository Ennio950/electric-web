@echo off
setlocal

set "ROOT=C:\Users\ennio\OneDrive\Desktop\electric-web copia"

if exist "%ROOT%\autodev-lab\n8n\host-n8n.out.log" del /f /q "%ROOT%\autodev-lab\n8n\host-n8n.out.log"
if exist "%ROOT%\autodev-lab\n8n\host-n8n.err.log" del /f /q "%ROOT%\autodev-lab\n8n\host-n8n.err.log"

cd /d "%ROOT%"
start "n8n-host" /min cmd /d /k "%ROOT%\autodev-lab\n8n\run-host-n8n.cmd"

endlocal
