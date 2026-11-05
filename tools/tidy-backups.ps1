# Tidy the backup folders: every _backup-before-* folder in the SiteGen folder is packed into one zip in _backups\,
# checked, and only then removed. Nothing else is touched. Run tidy-backups.bat (double-click) from the tools folder.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dirs = @(Get-ChildItem -LiteralPath $root -Directory -Filter '_backup-before-*')
if ($dirs.Count -eq 0) { Write-Host 'No _backup-before-* folders to tidy.'; exit 0 }
$store = Join-Path $root '_backups'
New-Item -ItemType Directory -Force -Path $store | Out-Null
$zip = Join-Path $store ('old-backups-' + (Get-Date -Format 'yyyy-MM-dd-HHmm') + '.zip')
Write-Host ('Packing ' + $dirs.Count + ' backup folders into ' + $zip + ' ...')
Compress-Archive -Path ($dirs | ForEach-Object { $_.FullName }) -DestinationPath $zip -CompressionLevel Optimal
# check: the zip holds as many files as the folders do
$want = @($dirs | ForEach-Object { Get-ChildItem -LiteralPath $_.FullName -Recurse -File }).Count
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead($zip)
$have = @($z.Entries | Where-Object { $_.Name -ne '' }).Count
$z.Dispose()
if ($have -lt $want) { Write-Host ('Stopped: the zip has ' + $have + ' files but the folders have ' + $want + '. Nothing was removed.'); exit 1 }
$dirs | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force }
Write-Host ('Done: ' + $have + ' files are in ' + $zip + ' and the ' + $dirs.Count + ' folders were removed.')
