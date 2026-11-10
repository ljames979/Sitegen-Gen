@echo off
setlocal
cd /d "%~dp0"
title SiteGen - versions
REM Lists the saved versions of the SiteGen app's code and can put an older one back.
REM Before going back it saves the code as it is now, so going back can itself be undone.
REM Your sites, photos and .env are never touched.

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed. Run save-version.bat once: it opens the download page.
  pause
  exit /b 1
)

echo The last 25 saved versions (newest first):
echo.
git log -25 --format="  %%h  %%cd  %%s" --date=format:"%%Y-%%m-%%d %%H:%%M"
echo.
set "PICK="
set /p "PICK=To go back, type the version code (the first column), or press Enter to close: "
if "%PICK%"=="" exit /b 0
git rev-parse --verify --quiet "%PICK%^{commit}" >nul 2>nul
if errorlevel 1 (
  echo "%PICK%" is not one of the versions. Nothing changed.
  pause
  exit /b 1
)
echo.
echo Stop SiteGen first (close its window or press Ctrl+C in it).
set "OK="
set /p "OK=Put version %PICK% back? Type yes: "
if /i not "%OK%"=="yes" ( echo Nothing changed. & pause & exit /b 0 )

git add -A
git diff --cached --quiet || git -c user.name="Leo" -c user.email="345083775+ljames979@users.noreply.github.com" commit -q -m "Before going back to %PICK%"
git restore --source=%PICK% --staged --worktree -- .
git -c user.name="Leo" -c user.email="345083775+ljames979@users.noreply.github.com" commit -q -m "Went back to version %PICK%"
echo Done. The code is now version %PICK%. Start SiteGen again with start.bat.
echo (Changed your mind? Run versions.bat again and pick the "Before going back" version.)
pause
