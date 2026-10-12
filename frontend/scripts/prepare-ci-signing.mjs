import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const names = ['ANDROID_KEYSTORE_BASE64', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD'];
for (const name of names) if (!process.env[name]) throw new Error(`Falta el secreto ${name}.`);
const signing = resolve('android/signing');
mkdirSync(signing, { recursive: true });
writeFileSync(resolve(signing, 'release.jks'), Buffer.from(process.env.ANDROID_KEYSTORE_BASE64, 'base64'), { mode: 0o600 });
const escape = value => value.split('').map(char => {
  const code = char.charCodeAt(0);
  if (code < 32 || code > 126) return `\\u${code.toString(16).padStart(4, '0')}`;
  return /[\\ :!=#]/.test(char) ? `\\${char}` : char;
}).join('');
const properties = `storeFile=signing/release.jks\nstorePassword=${escape(process.env.ANDROID_KEYSTORE_PASSWORD)}\nkeyAlias=${escape(process.env.ANDROID_KEY_ALIAS)}\nkeyPassword=${escape(process.env.ANDROID_KEY_PASSWORD)}\n`;
writeFileSync(resolve('android/key.properties'), properties, { mode: 0o600 });
console.log('Firma Android configurada.');
