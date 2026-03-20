@echo off
setlocal

set "ROOT=C:\Users\ennio\OneDrive\Desktop\electric-web copia"

cd /d "%ROOT%"
start "electric-backend" cmd /d /k "cd /d ""%ROOT%"" && npm run dev:backend"
start "electric-mobile-web" cmd /d /k "cd /d ""%ROOT%\apps\mobile"" && npx expo start --web --port 8082"

endlocal
