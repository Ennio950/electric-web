$ErrorActionPreference = 'SilentlyContinue'

$root = 'C:\Users\ennio\OneDrive\Desktop\electric-web copia'
$statePath = Join-Path $root 'autodev-lab\n8n\..\reports\n8n-native-team\continuous-state.json'
$reportsDir = Join-Path $root 'autodev-lab\reports\n8n-native-team'
$mobileDir = Join-Path $root 'apps\mobile'

while ($true) {
  Clear-Host
  Write-Host 'Estado del ciclo infinito' -ForegroundColor Cyan
  Write-Host ''

  if (Test-Path $statePath) {
    Get-Content $statePath
  } else {
    Write-Host 'No existe continuous-state.json todavia.'
  }

  Write-Host ''
  Write-Host 'Ultimos reportes' -ForegroundColor Cyan
  Get-ChildItem $reportsDir -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 8 Name, LastWriteTime, Length |
    Format-Table -AutoSize

  Write-Host ''
  Write-Host 'Ultimos archivos tocados en apps/mobile' -ForegroundColor Cyan
  Get-ChildItem $mobileDir -Recurse -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 15 FullName, LastWriteTime |
    Format-Table -Wrap -AutoSize

  Start-Sleep -Seconds 3
}
