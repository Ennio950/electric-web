@echo off
setlocal

set "ROOT=C:\Users\ennio\OneDrive\Desktop\electric-web copia"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\autodev-lab\n8n\watch-native-loop-status.ps1"

endlocal
