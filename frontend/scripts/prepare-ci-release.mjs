import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const maxCode = 2100000000;
const tagCode = tag => {
  const match = /^android-v([1-9]\d*)$/.exec(tag ?? '');
  const code = match ? Number(match[1]) : 0;
  if (!Number.isSafeInteger(code) || code > maxCode) throw new Error('Hay un tag Android con versionCode fuera de rango.');
  return code;
};
const versionNumbers = version => {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('La version Android debe tener el formato 1.2.3.');
  const numbers = version.split('.').map(Number);
  if (numbers.some(number => !Number.isSafeInteger(number))) throw new Error('La version Android esta fuera de rango.');
  return numbers;
};
const compare = (first, second) => {
  for (let index = 0; index < 3; index++) if (first[index] !== second[index]) return first[index] > second[index] ? 1 : -1;
  return 0;
};

export function planAndroidRelease({ base, releases, tags, commit }) {
  versionNumbers(base.version);
  if (!Number.isSafeInteger(base.versionCode) || base.versionCode < 1 || base.versionCode > maxCode) throw new Error('app-release.json contiene un versionCode invalido.');
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('No se pudo identificar el commit que se publicara.');
  const published = releases.filter(release => tagCode(release.tag_name) && !release.draft && !release.prerelease &&
    release.assets?.some(asset => asset.name === 'dawertech-release.apk' && asset.state === 'uploaded' && asset.size > 0));
  if (published.some(release => release.target_commitish === commit || tags.some(tag => tag.name === release.tag_name && tag.commit?.sha === commit))) {
    return { publish: false };
  }
  // Reservar tambien los tags de intentos incompletos: nunca reutilizar un codigo.
  const lastCode = Math.max(0, ...tags.map(tag => tagCode(tag.name)), ...releases.map(release => tagCode(release.tag_name)));
  const versionCode = Math.max(base.versionCode, lastCode + 1);
  if (versionCode > maxCode) throw new Error('Se alcanzo el limite de versionCode de Android.');
  const previous = published.sort((first, second) => tagCode(second.tag_name) - tagCode(first.tag_name))[0];
  let version = base.version;
  if (previous) {
    const numbers = versionNumbers(previous.name?.replace(/^DawerTech\s+/, ''));
    if (compare(versionNumbers(version), numbers) <= 0) {
      numbers[2]++;
      version = numbers.join('.');
      versionNumbers(version);
    }
  }
  return { publish: true, version, versionCode, commit };
}

async function githubList(repository, resource) {
  const entries = [];
  for (let page = 1; ; page++) {
    const response = await fetch(`https://api.github.com/repos/${repository}/${resource}?per_page=100&page=${page}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${process.env.GH_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`No se pudo consultar ${resource} en GitHub (HTTP ${response.status}).`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error(`GitHub devolvio una lista invalida de ${resource}.`);
    entries.push(...data);
    if (data.length < 100) return entries;
  }
}

async function prepare() {
  if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.GITHUB_OUTPUT || !process.env.GH_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(process.env.GITHUB_REPOSITORY ?? '')) {
    throw new Error('Este comando solo prepara versiones dentro de GitHub Actions.');
  }
  const releaseFile = fileURLToPath(new URL('../app-release.json', import.meta.url));
  const base = JSON.parse(readFileSync(releaseFile, 'utf8'));
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const [releases, tags] = await Promise.all([
    githubList(process.env.GITHUB_REPOSITORY, 'releases'),
    githubList(process.env.GITHUB_REPOSITORY, 'tags'),
  ]);
  const plan = planAndroidRelease({ base, releases, tags, commit });
  appendFileSync(process.env.GITHUB_OUTPUT, `publish=${plan.publish}\n`);
  if (!plan.publish) {
    console.log('Este commit ya tiene un APK publicado. No se generara otra version.');
    return;
  }
  writeFileSync(releaseFile, `${JSON.stringify({ version: plan.version, versionCode: plan.versionCode }, null, 2)}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${plan.version}\ncode=${plan.versionCode}\ncommit=${plan.commit}\n`);
  console.log(`APK preparado: ${plan.version} (codigo ${plan.versionCode}).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await prepare();
