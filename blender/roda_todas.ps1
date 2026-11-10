# Refaz o modelo (com oclusão) e renderiza as maquetes num Blender só, com todos os núcleos e sem pausas.
param([int]$w = 1600, [int]$h = 900, [int]$amostras = 48, [string]$indices = '0,1,2,3,4,5,6,7,8', [switch]$semModelo)
$raiz = Split-Path -Parent $PSScriptRoot
if (-not $semModelo) {
  & powershell -ExecutionPolicy Bypass -File "$raiz\blender\roda.ps1" ao 1024 16
}
& powershell -ExecutionPolicy Bypass -File "$raiz\blender\roda_render.ps1" $w $h $amostras $indices
"fim"
