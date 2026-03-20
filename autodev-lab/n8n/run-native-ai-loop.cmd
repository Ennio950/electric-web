@echo off
setlocal

set "ROOT=C:\Users\ennio\OneDrive\Desktop\electric-web copia"
cd /d "%ROOT%"
set "N8N_NATIVE_DEEPSEEK_MODEL=qwen2.5-coder:0.5b"
set "N8N_NATIVE_DEEPSEEK_HOST=127.0.0.1:11435"

node "%ROOT%\autodev-lab\n8n\native-multi-agent-runner.mjs" daemon 1>>"%ROOT%\autodev-lab\n8n\host-native-loop.out.log" 2>>"%ROOT%\autodev-lab\n8n\host-native-loop.err.log"

endlocal
