@echo off
set AGENT=%1
if "%AGENT%"=="" set AGENT=both

node scripts\loop-until-stopped.js --agent %AGENT%
