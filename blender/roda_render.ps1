# Renderiza as maquetes (imagens prontas de cada parte) no Cycles com todos os núcleos. Log em blender/logs/log-render.txt
# uso: powershell -File blender/roda_render.ps1 <largura> <altura> <amostras> [indices, ex.: '0,1,2']
param([int]$w = 1600, [int]$h = 900, [int]$amostras = 48, [string]$indices = '')
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz
$blender = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
$log = "blender\logs\log-render.txt"
$args_ = @('-b', 'blender/clinica.blend', '-P', 'blender/scripts/render_maquetes.py', '--', 'blender/dados/planta.json', 'site/passeio/modelos/maquetes', $w, $h, $amostras, $indices)
$p = Start-Process -FilePath $blender -ArgumentList $args_ -RedirectStandardOutput $log -RedirectStandardError "blender\logs\log-render-erro.txt" -NoNewWindow -PassThru
$null = $p.Handle  # sem isso o ExitCode volta vazio
$p.WaitForExit()
Select-String -Path $log -Pattern '\[maquete\]|Error|Traceback' | ForEach-Object { $_.Line }
exit $p.ExitCode
