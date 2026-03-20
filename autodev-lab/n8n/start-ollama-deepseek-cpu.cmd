@echo off
setlocal

set "OLLAMA_HOST=127.0.0.1:11435"
set "OLLAMA_LLM_LIBRARY=cpu"
set "CUDA_VISIBLE_DEVICES=-1"
set "OLLAMA_NO_CLOUD=1"

start "ollama-deepseek-cpu" cmd /d /k "set ""OLLAMA_HOST=%OLLAMA_HOST%"" && set ""OLLAMA_LLM_LIBRARY=%OLLAMA_LLM_LIBRARY%"" && set ""CUDA_VISIBLE_DEVICES=%CUDA_VISIBLE_DEVICES%"" && set ""OLLAMA_NO_CLOUD=%OLLAMA_NO_CLOUD%"" && ""C:\Users\ennio\AppData\Local\Programs\Ollama\ollama.exe"" serve"

endlocal
