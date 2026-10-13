import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../src/app/core/services/app-release.service.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
}).outputText;
const data = (code = 3) => ({ tag_name: `android-v${code}`, name: 'DawerTech 1.2.0', draft: false, prerelease: false,
  assets: [{ name: 'dawertech-release.apk', state: 'uploaded', size: 1000, browser_download_url: 'https://github.com/gochoag/DawerTech/releases/download/android-v3/dawertech-release.apk' }] });

function harness({ native = true, response = () => ({ ok: true, status: 200, json: async () => data() }), saved = new Map(),
  state = () => ({ phase: 'idle', received: 0, total: 0 }), install = async () => ({ phase: 'installing', received: 1000, total: 1000 }),
  webDownload = async (url, size, hash, signal, progress) => { progress(size / 2, size); progress(size, size); return new Blob([new Uint8Array(size)]); } } = {}) {
  const config = { apiUrl: 'https://api.github.com/repos/gochoag/DawerTech/releases/latest', downloadUrl: 'https://github.com/gochoag/DawerTech/releases/latest/download/dawertech-release.apk', version: '1.1.0', versionCode: 2 };
  const module = { exports: {} }, downloads = [], installs = [], webCalls = [];
  let requests = 0;
  const signal = initial => { let value = initial; const read = () => value; read.set = next => { value = next; }; return read; };
  runInNewContext(source, {
    module, exports: module.exports, URL, Date, Blob, AbortController, setTimeout, clearTimeout, setInterval: () => 1, clearInterval: () => {},
    localStorage: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) },
    fetch: async (...args) => { requests++; return response(...args); },
    window: { location: { href: 'https://dawertech.pages.dev/login' } },
    document: { hidden: false, body: { appendChild: () => {} }, createElement: () => {
      const link = { style: {}, remove: () => {}, click: () => downloads.push({ filename: link.download, url: link.href }) }; return link;
    } },
    require: name => {
      if (name === '@angular/core') return { Injectable: () => value => value, inject: () => config, signal, computed: fn => fn };
      if (name === '@capacitor/core') return { Capacitor: { isNativePlatform: () => native }, registerPlugin: () => ({
        download: async options => { downloads.push(options); return { phase: 'downloading', received: 0, total: options.size }; },
        getState: async () => state(), install: async () => { installs.push(true); return install(); },
        cancel: async () => ({ phase: 'idle', received: 0, total: 0 }),
        deferInstall: async () => ({ phase: 'idle', received: 0, total: 0 }),
      }) };
      if (name === '../http/download-apk') return { downloadApkFile: (...args) => { webCalls.push(args); return webDownload(...args); } };
      if (name === '@capacitor/app') return { App: { getInfo: async () => ({ build: '2', version: '1.1.0' }) } };
      return {};
    },
  });
  return { service: new module.exports.AppReleaseService(), parse: module.exports.parseAndroidRelease, requests: () => requests, downloads, installs, webCalls, saved };
}

test('only completed public Android releases with a safe APK are offered', () => {
  const { parse } = harness();
  assert.equal(parse(data()).versionCode, 3);
  for (const change of [{ draft: true }, { prerelease: true }, { tag_name: 'v1.2.0' }, { tag_name: 'android-v2100000001' }, { assets: [] }, { assets: {} }]) assert.equal(parse({ ...data(), ...change }), null);
  for (const url of ['http://example.com/file.apk', 'javascript:alert(1)', 'not a URL']) {
    const release = data(); release.assets[0].browser_download_url = url;
    assert.equal(parse(release), null);
  }
});

test('Android offers a newer build and starts the native download with its expected size', async () => {
  const h = harness();
  assert.equal(h.service.isLatest(), false);
  await h.service.check(true);
  assert.equal(h.service.isLatest(), false);
  assert.equal(h.service.showNotice(), true);
  await h.service.download();
  assert.equal(h.downloads[0].url, h.service.latest().url);
  assert.equal(h.downloads[0].size, 1000);
  assert.equal(h.service.downloadPhase(), 'downloading');
  const same = harness({ response: () => ({ ok: true, json: async () => data(2) }) });
  await same.service.check(true); assert.equal(same.service.updateAvailable(), false);
  assert.equal(same.service.isLatest(), true);
});

test('Later persists the choice and the six-hour cache survives process restarts', async () => {
  const h = harness(); await h.service.check(true); h.service.dismiss();
  assert.equal(h.service.showNotice(), false);
  const reopened = harness({ saved: h.saved });
  await reopened.service.initialize();
  assert.equal(reopened.requests(), 0);
  assert.equal(reopened.service.showNotice(), false);
  assert.equal(reopened.service.latest().versionCode, 3);
});

test('simultaneous checks share the request and offline checks do not touch session data', async () => {
  let complete;
  const saved = new Map([['dawertech-refresh', 'preserve-session']]);
  const h = harness({ saved, response: () => new Promise(resolve => { complete = resolve; }) });
  const first = h.service.check(), second = h.service.check();
  assert.equal(first, second); assert.equal(h.requests(), 1);
  complete({ ok: false, status: 503 }); await first;
  assert.equal(h.service.checking(), false);
  assert.equal(saved.get('dawertech-refresh'), 'preserve-session');
  await h.service.check(); assert.equal(h.requests(), 1);
});

test('web streams an APK into a download without showing a native installer', async () => {
  const h = harness({ native: false }); await h.service.check(true);
  assert.equal(h.service.updateAvailable(), false);
  await h.service.download();
  assert.equal(h.webCalls[0][0], 'https://dawertech.pages.dev/download-apk?code=3');
  assert.equal(h.downloads[0].filename, 'dawertech-release.apk');
  assert.equal(h.service.downloadPhase(), 'saved');
  assert.equal(h.service.downloadPercent(), 100);
  assert.equal(h.installs.length, 0);
  h.service.ngOnDestroy();
});

test('completed native download opens the installer once and preserves saved authentication', async () => {
  const saved = new Map([['dawertech-refresh', 'preserve-session']]);
  const h = harness({ saved, state: () => ({ phase: 'ready', received: 1000, total: 1000, autoInstall: true }) });
  await h.service.resumeDownload();
  assert.equal(h.installs.length, 1);
  assert.equal(h.service.downloadPhase(), 'installing');
  assert.equal(h.service.downloadPercent(), 100);
  assert.equal(saved.get('dawertech-refresh'), 'preserve-session');
});

test('permission and cancelled installer can be retried without downloading again', async () => {
  const h = harness({ state: () => ({ phase: 'permission', received: 1000, total: 1000, autoInstall: false }) });
  await h.service.resumeDownload();
  assert.equal(h.installs.length, 0);
  await h.service.download();
  assert.equal(h.installs.length, 1);
  assert.equal(h.downloads.length, 0);
});

test('a downloaded update can be deferred without forcing installation or dropping the session', async () => {
  const h = harness({ saved: new Map([['dawertech-refresh', 'preserve-session']]), state: () => ({ phase: 'ready', received: 1000, total: 1000, autoInstall: false }) });
  await h.service.check(true); await h.service.resumeDownload();
  await h.service.deferUpdate();
  assert.equal(h.service.downloadPhase(), 'idle');
  assert.equal(h.service.showNotice(), false);
  assert.equal(h.installs.length, 0);
  assert.equal(h.saved.get('dawertech-refresh'), 'preserve-session');
});

test('preparing a cancelled download cannot start a transfer when the metadata arrives late', async () => {
  let finish;
  const h = harness({ response: () => new Promise(resolve => { finish = resolve; }) });
  const pending = h.service.download();
  await h.service.cancelDownload();
  finish({ ok: true, status: 200, json: async () => data() });
  await pending;
  assert.equal(h.downloads.length, 0);
  assert.equal(h.service.downloadPhase(), 'idle');
});

test('background completion waits until the app returns before opening Android installation', async () => {
  const h = harness({ state: () => ({ phase: 'ready', received: 1000, total: 1000, autoInstall: true }) });
  h.service.appStateChanged(false);
  await h.service.resumeDownload();
  assert.equal(h.installs.length, 0);
  h.service.appStateChanged(true);
  await h.service.resumeDownload();
  assert.equal(h.installs.length, 1);
});

test('repeated taps share one web transfer and failed files are never saved', async () => {
  let finish;
  const h = harness({ native: false, webDownload: () => new Promise((resolve, reject) => { finish = reject; }) });
  const first = h.service.download(), second = h.service.download();
  assert.equal(first, second);
  await h.service.check();
  await Promise.resolve();
  finish(new Error('incomplete-file'));
  await first;
  assert.equal(h.webCalls.length, 1);
  assert.equal(h.downloads.length, 0);
  assert.equal(h.service.downloadPhase(), 'error');
});

test('an unpublished release is handled without blocking app startup', async () => {
  const h = harness({ response: () => ({ ok: false, status: 404 }) });
  await h.service.check(true);
  assert.equal(h.service.latest(), null); assert.equal(h.service.checking(), false);
  assert.match(h.service.message(), /publicada/);
});
