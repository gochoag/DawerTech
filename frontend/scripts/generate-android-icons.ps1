$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$inkscape = (Get-Command inkscape.com -ErrorAction Stop).Source
$sizes = @{
  'mdpi' = @(48, 108)
  'hdpi' = @(72, 162)
  'xhdpi' = @(96, 216)
  'xxhdpi' = @(144, 324)
  'xxxhdpi' = @(192, 432)
}
foreach ($density in $sizes.Keys) {
  $directory = Join-Path $root "android/app/src/main/res/mipmap-$density"
  $icon = Join-Path $root 'src/assets/dt-app-icon.svg'
  $mark = Join-Path $root 'src/assets/dt-mark.svg'
  $iconSize = $sizes[$density][0]
  $foregroundSize = $sizes[$density][1]
  & $inkscape $icon "--export-filename=$(Join-Path $directory 'ic_launcher.png')" "--export-width=$iconSize"
  & $inkscape $icon "--export-filename=$(Join-Path $directory 'ic_launcher_round.png')" "--export-width=$iconSize"
  & $inkscape $mark "--export-filename=$(Join-Path $directory 'ic_launcher_foreground.png')" "--export-width=$foregroundSize"
}
