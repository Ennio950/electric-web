@echo off
setlocal

set "ROOT=C:\Users\ennio\OneDrive\Desktop\electric-web copia"
set "DB=%ROOT%\autodev-lab\n8n\.n8n-host\.n8n\database.sqlite"

python "%ROOT%\autodev-lab\n8n\delete-workflows.py" "%DB%" %*

endlocal
