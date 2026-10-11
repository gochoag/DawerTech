import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureAndroidEnv } from './ensure-android-env.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const frontendDir = resolve(__dirname, '..');
const androidDir = join(frontendDir, 'android');

function run(command, cwd = frontendDir) {
  console.log(`\n\x1b[36m>>> ${command}\x1b[0m (en ${cwd})`);
  execSync(command, { cwd, stdio: 'inherit' });
}

function runSilent(command) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return null;
  }
}

console.log('\x1b[33m============================================================\x1b[0m');
console.log('\x1b[33m>>> Compilando e instalando DawerTech en Android (ADB)...\x1b[0m');
console.log('\x1b[33m============================================================\x1b[0m');

try {
  ensureAndroidEnv(androidDir);

  // 1. Verificar conexión ADB
  const adbDevicesOutput = runSilent('adb devices') || '';
  const lines = adbDevicesOutput
    .split('\n')
    .slice(1)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('*'));

  const connectedDevices = lines.filter(l => l.includes('\tdevice'));

  if (connectedDevices.length === 0) {
    console.warn('\n\x1b[33m[AVISO] No se detectó ningún dispositivo en estado "device" con adb devices.\x1b[0m');
    console.warn('Asegúrate de tener la depuración USB o ADB Wi-Fi conectada.');
    if (lines.length > 0) {
      console.warn('Dispositivos detectados:', lines.join(', '));
    }
  } else {
    console.log(`\x1b[32m[OK] Dispositivo(s) conectado(s):\x1b[0m\n  ${connectedDevices.join('\n  ')}`);
    try {
      console.log('\n\x1b[36m>>> Configurando túnel ADB: adb reverse tcp:5000 tcp:5000...\x1b[0m');
      run('adb reverse tcp:5000 tcp:5000');
      console.log('\x1b[32m[OK] Túnel activo: http://localhost:5000 en el celular conectará directamente a tu PC.\x1b[0m');
    } catch {
      console.warn('\x1b[33m[AVISO] adb reverse omitido o no soportado en esta conexión.\x1b[0m');
    }
  }

  // 2. Compilar aplicación web
  run('node scripts/write-config.mjs');
  run('npx ng build');

  // 3. Sincronizar assets con Capacitor Android
  run('npx cap sync android');

  // 4. Compilar APK Debug con Gradle
  const isWin = process.platform === 'win32';
  const gradlewExe = join(androidDir, isWin ? 'gradlew.bat' : 'gradlew');
  const gradlewCmd = isWin ? `call "${gradlewExe}"` : `"${gradlewExe}"`;
  run(`${gradlewCmd} assembleDebug`, androidDir);

  // 5. Ubicar APK Debug
  const outputDir = join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug');
  const sourceApk = join(outputDir, 'app-debug.apk');

  if (!existsSync(sourceApk)) {
    throw new Error(`No se encontró el APK Debug en: ${sourceApk}`);
  }

  const stats = statSync(sourceApk);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`\n\x1b[32m[OK] APK Debug listo (${sizeMB} MB)\x1b[0m`);

  // 6. Instalar en el celular vía ADB
  console.log('\n\x1b[36m>>> Instalando APK en el dispositivo con adb install -r ...\x1b[0m');
  run(`adb install -r "${sourceApk}"`);

  // 7. Abrir la app automáticamente en el celular
  console.log('\n\x1b[36m>>> Iniciando DawerTech en tu celular...\x1b[0m');
  try {
    execSync('adb shell am start -n com.dawertech.inventory/.MainActivity', { stdio: 'inherit' });
  } catch (launchErr) {
    console.warn('\x1b[33m[INFO] Se instaló con éxito. Inicia la app manualmente desde el menú de tu celular.\x1b[0m');
  }

  console.log('\n\x1b[32m============================================================\x1b[0m');
  console.log('\x1b[32m>>> Aplicación instalada y ejecutándose exitosamente en tu celular!\x1b[0m');
  console.log('\x1b[32m============================================================\x1b[0m\n');
} catch (error) {
  console.error('\n\x1b[31m[ERROR] Falló la instalación en Android:\x1b[0m', error.message || error);
  process.exit(1);
}
