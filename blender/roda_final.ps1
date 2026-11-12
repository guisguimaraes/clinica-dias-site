# Rodada final: luz calculada (mapas de luz e oclusão) e depois as maquetes das 3 partes em 4K (computador 3840×2160, celular 1440×3120).
# uso: powershell -File blender/roda_final.ps1
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz
$t0 = Get-Date
& powershell -ExecutionPolicy Bypass -File "$raiz\blender\roda.ps1" luz 1024 48
if ($LASTEXITCODE -ne 0) { "falhou na luz"; exit 1 }
"luz pronta em $([int]((Get-Date) - $t0).TotalMinutes) min"
& powershell -ExecutionPolicy Bypass -File "$raiz\blender\roda_render.ps1" 1600 900 32 '0,1,2'
if ($LASTEXITCODE -ne 0) { "falhou nas maquetes do computador"; exit 1 }
& powershell -ExecutionPolicy Bypass -File "$raiz\blender\roda_render.ps1" 720 1560 32 '0,1,2'
if ($LASTEXITCODE -ne 0) { "falhou nas maquetes do celular"; exit 1 }
"tudo pronto em $([int]((Get-Date) - $t0).TotalMinutes) min"
