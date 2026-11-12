# Refaz o modelo só com oclusão (sem a luz calculada) e renderiza as maquetes. Para a versão final use roda_final.ps1.
# Atenção: o modo 'ao' grava um luz.json sem mapas de luz, então o passeio fica sem a luz assada até rodar o roda_final.ps1.
param([int]$w = 1600, [int]$h = 900, [int]$amostras = 48, [string]$indices = '', [switch]$semModelo)
$raiz = Split-Path -Parent $PSScriptRoot
if (-not $semModelo) {
  & powershell -ExecutionPolicy Bypass -File "$raiz\blender\roda.ps1" ao 1024 16
  if ($LASTEXITCODE -ne 0) { "falhou no modelo"; exit 1 }
}
& powershell -ExecutionPolicy Bypass -File "$raiz\blender\roda_render.ps1" $w $h $amostras $indices
"fim"
