@echo off
setlocal

set "ROOT=C:\Users\ennio\OneDrive\Desktop\electric-web copia"
cd /d "%ROOT%"

node "%ROOT%\autodev-lab\n8n\native-multi-agent-runner.mjs" stop

endlocal
