@echo off
setlocal

set "ROOT=C:\Users\ennio\OneDrive\Desktop\electric-web copia"
set "N8N_USER_FOLDER=%ROOT%\autodev-lab\n8n\.n8n-host"
set "N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=false"
set "N8N_HOST=127.0.0.1"
set "N8N_PORT=5678"
set "N8N_LISTEN_ADDRESS=127.0.0.1"
set "N8N_PROTOCOL=http"
set "WEBHOOK_URL=http://127.0.0.1:5678/"
set "N8N_ENABLE_EXECUTE_COMMAND=true"
set "NODES_EXCLUDE=[]"
set "GENERIC_TIMEZONE=America/Guatemala"

cd /d "%ROOT%"
npx --yes n8n@latest start 1>>"%ROOT%\autodev-lab\n8n\host-n8n.out.log" 2>>"%ROOT%\autodev-lab\n8n\host-n8n.err.log"

endlocal
