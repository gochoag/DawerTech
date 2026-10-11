import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function ensureAndroidEnv(androidDir) {
  const localPropPath = join(androidDir, 'local.properties');
  let sdkDir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;

  if (!sdkDir && process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const defaultWinSdk = join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
    if (existsSync(defaultWinSdk)) {
      sdkDir = defaultWinSdk;
    }
  }

  if (!existsSync(localPropPath) && sdkDir) {
    const formatted = sdkDir.replace(/\\/g, '/');
    writeFileSync(localPropPath, `sdk.dir=${formatted}\n`, 'utf-8');
    console.log(`\x1b[32m[OK] Archivo local.properties creado automáticamente con sdk.dir=${formatted}\x1b[0m`);
  }

  if (existsSync(localPropPath)) {
    const content = readFileSync(localPropPath, 'utf-8');
    const match = content.match(/sdk\.dir=(.+)/);
    if (match) {
      const resolvedDir = match[1].trim();
      process.env.ANDROID_HOME = resolvedDir;
      process.env.ANDROID_SDK_ROOT = resolvedDir;
    }
  }
}

