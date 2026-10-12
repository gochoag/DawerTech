import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureAndroidEnv } from './ensure-android-env.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const frontendDir = resolve(__dirname, '..');
const androidDir = join(frontendDir, 'android');
const apkReleaseDir = join(frontendDir, 'apk-release');

function run(command, cwd = frontendDir) {
  console.log(`\n\x1b[36m>>> ${command}\x1b[0m (en ${cwd})`);
  execSync(command, { cwd, stdio: 'inherit' });
}

console.log('\x1b[33m============================================================\x1b[0m');
console.log('\x1b[33m>>> Generando APK Release de DawerTech...\x1b[0m');
console.log('\x1b[33m============================================================\x1b[0m');

try {
  ensureAndroidEnv(androidDir);
  if (!existsSync(join(androidDir, 'key.properties'))) {
    throw new Error('Configura la firma release antes de generar un APK para distribuir.');
  }

  // 1. Compilar aplicación web
  run('npx ng build');
  run('node scripts/write-config.mjs --android --output-dir=www/browser/assets');

  // 2. Sincronizar assets con Capacitor Android
  run('npx cap sync android');

  // 3. Compilar APK Release con Gradle
  const isWin = process.platform === 'win32';
  const gradlewExe = join(androidDir, isWin ? 'gradlew.bat' : 'gradlew');
  const gradlewCmd = isWin ? `call "${gradlewExe}"` : `"${gradlewExe}"`;
  run(`${gradlewCmd} assembleRelease`, androidDir);

  // 4. Buscar APK generado
  const outputDir = join(androidDir, 'app', 'build', 'outputs', 'apk', 'release');
  if (!existsSync(outputDir)) {
    throw new Error(`No se encontró el directorio de salida: ${outputDir}`);
  }

  const files = readdirSync(outputDir).filter(f => f.endsWith('.apk'));
  if (files.length === 0) {
    throw new Error(`No se encontró ningún archivo .apk en ${outputDir}`);
  }

  // Preferir APK firmado 'app-release.apk' o el primero disponible
  const apkFileName = files.find(f => f === 'app-release.apk');
  if (!apkFileName) throw new Error('No se genero un APK firmado app-release.apk.');
  const sourceApk = join(outputDir, apkFileName);

  // 5. Copiar a frontend/apk-release
  if (!existsSync(apkReleaseDir)) {
    mkdirSync(apkReleaseDir, { recursive: true });
  }

  const targetApk = join(apkReleaseDir, 'dawertech-release.apk');
  copyFileSync(sourceApk, targetApk);

  const stats = statSync(targetApk);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('\n\x1b[32m============================================================\x1b[0m');
  console.log(`\x1b[32m>>> APK Release generado exitosamente!\x1b[0m`);
  console.log(`  Archivo: \x1b[1m${targetApk}\x1b[0m`);
  console.log(`  Tamaño:  \x1b[1m${sizeMB} MB\x1b[0m`);
  console.log('\x1b[32m============================================================\x1b[0m\n');
} catch (error) {
  console.error('\n\x1b[31m[ERROR] Falló la generación del APK Release:\x1b[0m', error.message || error);
  process.exit(1);
}
