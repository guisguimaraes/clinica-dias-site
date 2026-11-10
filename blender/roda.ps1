# Roda o Blender com prioridade baixa (o PC continua usável) e grava o log em blender/log-<modo>.txt
# uso: powershell -File blender/roda.ps1 rascunho            (só geometria, ~30 s)
#      powershell -File blender/roda.ps1 luz 512 16          (calcula a luz: resolução e amostras)
param([string]$modo = 'rascunho', [int]$res = 1024, [int]$amostras = 64)
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz
node blender/planta_json.mjs
$blender = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
$log = "blender\log-$modo.txt"
$p = Start-Process -FilePath $blender -ArgumentList @('-b', '--factory-startup', '-P', 'blender/monta_clinica.py', '--', 'blender/planta.json', 'site/passeio/modelos', $modo, $res, $amostras) -RedirectStandardOutput $log -RedirectStandardError "blender\log-$modo-erro.txt" -NoNewWindow -PassThru
$null = $p.Handle  # sem isso o ExitCode volta vazio
$p.WaitForExit()
Select-String -Path $log -Pattern '\[clinica\]|Error|Traceback' | ForEach-Object { $_.Line }
# deixa o primeiro carregamento leve (texturas do glb e mapas de luz/oclusão com menos peso)
if ($p.ExitCode -eq 0) { python blender/enxuga_pesos.py site/passeio/modelos }
exit $p.ExitCode
