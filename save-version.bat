@echo off
setlocal
cd /d "%~dp0"
title SiteGen - save a version
REM Saves the SiteGen app's code as a version you can go back to (versions.bat).
REM Your sites, photos and .env are not part of it: they stay as they are (see .gitignore).

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed, so versions can't be saved yet.
  echo Opening the download page. Install it with the normal choices, then run this again.
  start "" https://git-scm.com/download/win
  pause
  exit /b 1
)

set "MSG=%~1"
if "%MSG%"=="" set /p "MSG=What changed? (press Enter for 'Saved by hand'): "
if "%MSG%"=="" set "MSG=Saved by hand"

git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo Nothing has changed since the last saved version.
  if "%~1"=="" pause
  exit /b 0
)
git -c user.name="Leo" -c user.email="345083775+ljames979@users.noreply.github.com" commit -q -m "%MSG%"
echo Saved: %MSG%
git log -1 --format="Version %%h, %%cd" --date=format:"%%Y-%%m-%%d %%H:%%M"
if "%~1"=="" pause
