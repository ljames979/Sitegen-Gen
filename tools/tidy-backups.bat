@echo off
rem Packs every _backup-before-* folder into one zip in _backups\ and removes the folders (see tidy-backups.ps1).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tidy-backups.ps1"
pause
