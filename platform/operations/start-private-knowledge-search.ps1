param(
  [string]$PrivateRoot = 'C:\Users\PC\Documents\Codex\Ratio-Conocimiento-Privado'
)
$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonCandidates = @(
  'C:\Users\PC\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe',
  (Get-Command python.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1),
  (Get-Command py.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1)
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
if(-not $pythonCandidates){ throw 'PYTHON_NO_DISPONIBLE' }
& $pythonCandidates[0] (Join-Path $scriptRoot 'private_knowledge_search.py') --private-root $PrivateRoot
if($LASTEXITCODE -ne 0){ throw 'NO_SE_PUDO_ABRIR_LA_BIBLIOTECA' }

