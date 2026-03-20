param(
  [ValidateSet('codex', 'claude', 'both')]
  [string]$Agent = 'both',
  [switch]$DryRun,
  [int]$MaxCycles = 0
)

$args = @('scripts/loop-until-stopped.js', '--agent', $Agent)

if ($DryRun) {
  $args += '--dry-run'
}

if ($MaxCycles -gt 0) {
  $args += '--max-cycles'
  $args += $MaxCycles
}

node @args
