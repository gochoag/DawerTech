import { mkdirSync, writeFileSync } from 'node:fs';

const apiBaseUrl = process.env.DAWERTECH_API_URL ?? 'http://localhost:5000/api/v1';
if (!/^https?:\/\/[^/]+/.test(apiBaseUrl)) {
  throw new Error('DAWERTECH_API_URL debe ser una URL HTTP válida');
}
mkdirSync('src/assets', { recursive: true });
writeFileSync('src/assets/config.json', JSON.stringify({ apiBaseUrl }));
