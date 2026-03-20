@echo off
setlocal

set "ROOT=C:\Users\ennio\OneDrive\Desktop\electric-web copia"
set "OUT=%ROOT%\autodev-lab\n8n\host-native-loop.out.log"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "if (!(Test-Path '%OUT%')) { Write-Host 'Aun no existe el log del loop.'; exit 0 }; Get-Content '%OUT%' -Tail 120 -Wait"

endlocal
