# Renderiza maquetes no Cycles com todos os núcleos. uso: roda_render.ps1 <largura> <altura> <amostras> [indices]
param([int]$w = 1600, [int]$h = 900, [int]$amostras = 48, [string]$indices = '')
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz
$blender = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
$log = "blender\log-render.txt"
$args_ = @('-b', 'blender/clinica.blend', '-P', 'blender/render_maquetes.py', '--', 'blender/planta.json', 'site/passeio/modelos/maquetes', $w, $h, $amostras, $indices)
$p = Start-Process -FilePath $blender -ArgumentList $args_ -RedirectStandardOutput $log -RedirectStandardError "blender\log-render-erro.txt" -NoNewWindow -PassThru
$null = $p.Handle  # sem isso o ExitCode volta vazio
$p.WaitForExit()
Select-String -Path $log -Pattern '\[maquete\]|Error|Traceback' | ForEach-Object { $_.Line }
