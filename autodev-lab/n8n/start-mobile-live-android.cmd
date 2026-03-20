@echo off
setlocal

set "ROOT=C:\Users\ennio\OneDrive\Desktop\electric-web copia"
set "ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_HOME=%ANDROID_SDK_ROOT%"
set "JAVA_HOME=C:\Program Files\Android\openjdk\jdk-21.0.8"
set "PATH=%JAVA_HOME%\bin;%ANDROID_SDK_ROOT%\platform-tools;%ANDROID_SDK_ROOT%\emulator;%PATH%"
set "AVD_NAME=Medium_Phone_API_36.1"
set "EXPO_PORT=8084"

cd /d "%ROOT%"
start "electric-backend" cmd /d /k "cd /d ""%ROOT%"" && npm run dev:backend"

adb devices | findstr /r /c:"emulator-[0-9][0-9][0-9][0-9]" >nul
if errorlevel 1 (
  start "electric-android-emulator" "%ANDROID_SDK_ROOT%\emulator\emulator.exe" -avd "%AVD_NAME%"
  timeout /t 20 /nobreak >nul
)

adb wait-for-device >nul 2>nul
adb reverse tcp:%EXPO_PORT% tcp:%EXPO_PORT%

start "electric-mobile-android" cmd /d /k "cd /d ""%ROOT%\apps\mobile"" && set ""JAVA_HOME=%JAVA_HOME%"" && set ""ANDROID_HOME=%ANDROID_HOME%"" && set ""ANDROID_SDK_ROOT=%ANDROID_SDK_ROOT%"" && set ""PATH=%JAVA_HOME%\bin;%ANDROID_SDK_ROOT%\platform-tools;%ANDROID_SDK_ROOT%\emulator;%PATH%"" && npx expo run:android --port %EXPO_PORT%"

endlocal
