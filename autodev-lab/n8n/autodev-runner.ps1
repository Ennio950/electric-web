Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = 'C:\Users\ennio\OneDrive\Desktop\electric-web copia'

function Fail([string]$Message, [int]$ExitCode = 1) {
  Write-Error $Message
  exit $ExitCode
}

function Invoke-AutoDevStep([string]$Label, [string[]]$Arguments) {
  Write-Host "==> $Label"
  & node @Arguments
  if ($LASTEXITCODE -ne 0) {
    Fail "El paso '$Label' fallo con codigo $LASTEXITCODE." $LASTEXITCODE
  }
}

if (-not (Test-Path -LiteralPath $RepoRoot -PathType Container)) {
  Fail "No existe el directorio del proyecto: $RepoRoot" 2
}

try {
  $null = Get-Command node -ErrorAction Stop
} catch {
  Fail 'Node.js no esta disponible en PATH.' 3
}

Write-Host 'AutoDev n8n runner'
Write-Host "Repo: $RepoRoot"

Set-Location -LiteralPath $RepoRoot

Invoke-AutoDevStep 'Ejecutar siguiente tarea segura' @(
  'autodev-lab/scripts/run-task.js',
  '--next-safe'
)

Invoke-AutoDevStep 'Listar tareas generadas' @(
  'autodev-lab/scripts/list-tasks.js'
)

Write-Host 'AutoDev n8n runner finalizado.'
exit 0
