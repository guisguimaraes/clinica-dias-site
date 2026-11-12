# Monta o modelo da clínica no Blender com prioridade baixa (o PC continua usável). Log em blender/logs/log-<modo>.txt
# uso: powershell -File blender/roda.ps1 rascunho            (só geometria, ~4 min, sem luz)
#      powershell -File blender/roda.ps1 luz 1024 48         (calcula a luz: resolução e amostras, ~40 min)
param([string]$modo = 'rascunho', [int]$res = 1024, [int]$amostras = 64)
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz
node blender/scripts/planta_json.mjs
if ($LASTEXITCODE -ne 0) { "planta.js com erro: o planta.json não foi atualizado"; exit 1 }
$blender = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
$log = "blender\logs\log-$modo.txt"
$p = Start-Process -FilePath $blender -ArgumentList @('-b', '--factory-startup', '-P', 'blender/scripts/monta_clinica.py', '--', 'blender/dados/planta.json', 'site/passeio/modelos', $modo, $res, $amostras) -RedirectStandardOutput $log -RedirectStandardError "blender\logs\log-$modo-erro.txt" -NoNewWindow -PassThru
$null = $p.Handle  # sem isso o ExitCode volta vazio
$p.WaitForExit()
Select-String -Path $log -Pattern '\[clinica\]|Error|Traceback' | ForEach-Object { $_.Line }
# o bake não tem denoiser: tira o chiado dos mapas de luz/oclusão e depois deixa o primeiro carregamento leve
if ($p.ExitCode -eq 0 -and $modo -ne 'rascunho') { python blender/scripts/limpa_luz.py site/passeio/modelos }
if ($p.ExitCode -eq 0) { python blender/scripts/enxuga_pesos.py site/passeio/modelos }
exit $p.ExitCode
