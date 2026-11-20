@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (py tools\prepare_images.py %*) else (python tools\prepare_images.py %*)
echo.
pause
