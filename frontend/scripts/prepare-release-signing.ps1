$ErrorActionPreference = 'Stop'
$android = Join-Path (Split-Path -Parent $PSScriptRoot) 'android'
$signing = Join-Path $android 'signing'
$keystore = Join-Path $signing 'dawertech-release.jks'
$properties = Join-Path $android 'key.properties'
if ((Test-Path -LiteralPath $keystore) -or (Test-Path -LiteralPath $properties)) {
  throw 'Ya existe una clave de firma; consérvala para todas las actualizaciones.'
}
New-Item -ItemType Directory -Path $signing -Force | Out-Null
$password = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(36)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
$keytool = Join-Path $env:JAVA_HOME 'bin/keytool.exe'
if (-not (Test-Path -LiteralPath $keytool)) { $keytool = (Get-Command keytool.exe -ErrorAction Stop).Source }
& $keytool -genkeypair -noprompt -keystore $keystore -storetype PKCS12 -storepass $password -keypass $password -alias dawertech -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=DawerTech, OU=Inventario, O=DawerTech, C=EC'
if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar el keystore.' }
@(
  'storeFile=signing/dawertech-release.jks'
  'keyAlias=dawertech'
  "storePassword=$password"
  "keyPassword=$password"
) | Set-Content -LiteralPath $properties -Encoding utf8
Write-Output 'Clave de firma creada. Respalda android/signing/dawertech-release.jks y android/key.properties fuera del equipo.'
