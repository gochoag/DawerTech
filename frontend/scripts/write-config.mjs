import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
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
const assetsDir = resolve(frontendDir, 'src/assets');
mkdirSync(assetsDir, { recursive: true });
writeFileSync(resolve(assetsDir, 'config.json'), JSON.stringify({ apiBaseUrl, androidApiBaseUrl, useBrowserHost: !process.env.DAWERTECH_API_URL }));
console.log(`API ${android ? 'Android (red local)' : 'web'}: ${androidApiBaseUrl ?? apiBaseUrl}`);
