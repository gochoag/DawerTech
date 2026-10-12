import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { apiUrl } from './network-config.mjs';

const frontendDir = fileURLToPath(new URL('..', import.meta.url));
const envFile = resolve(frontendDir, process.env.DAWERTECH_ENV_FILE || '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
else if (process.env.DAWERTECH_ENV_FILE) throw new Error(`No existe el archivo de configuración: ${envFile}`);

const android = process.argv.includes('--android');
const apiBaseUrl = apiUrl();
const androidApiBaseUrl = android ? apiUrl({ android: true }) : undefined;
const release = JSON.parse(readFileSync(resolve(frontendDir, 'app-release.json'), 'utf8'));
if (!Number.isSafeInteger(release.versionCode) || release.versionCode < 1 || release.versionCode > 2100000000 || !/^\d+\.\d+\.\d+$/.test(release.version)) {
  throw new Error('app-release.json debe contener una version y versionCode validos.');
}
const releaseApiUrl = process.env.DAWERTECH_RELEASE_API_URL || 'https://api.github.com/repos/gochoag/DawerTech/releases/latest';
const apkDownloadUrl = process.env.DAWERTECH_APK_DOWNLOAD_URL || 'https://github.com/gochoag/DawerTech/releases/latest/download/dawertech-release.apk';
for (const value of [releaseApiUrl, apkDownloadUrl]) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Las URLs de APK y actualizaciones deben usar HTTPS.');
}
const outputArgument = process.argv.find(argument => argument.startsWith('--output-dir='));
const assetsDir = resolve(frontendDir, outputArgument?.slice('--output-dir='.length) || 'src/assets');
mkdirSync(assetsDir, { recursive: true });
writeFileSync(resolve(assetsDir, 'config.json'), JSON.stringify({ apiBaseUrl, androidApiBaseUrl, useBrowserHost: !process.env.DAWERTECH_API_URL, appRelease: { apiUrl: releaseApiUrl, downloadUrl: apkDownloadUrl, ...release } }));
console.log(`API ${android ? 'Android (red local)' : 'web'}: ${androidApiBaseUrl ?? apiBaseUrl}`);
