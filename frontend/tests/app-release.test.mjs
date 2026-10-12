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

function harness({ native = true, response = () => ({ ok: true, status: 200, json: async () => data() }), saved = new Map() } = {}) {
  const config = { apiUrl: 'https://api.github.com/repos/gochoag/DawerTech/releases/latest', downloadUrl: 'https://github.com/gochoag/DawerTech/releases/latest/download/dawertech-release.apk', version: '1.1.0', versionCode: 2 };
  const module = { exports: {} }, downloads = [];
  let requests = 0;
  const signal = initial => { let value = initial; const read = () => value; read.set = next => { value = next; }; return read; };
  runInNewContext(source, {
    module, exports: module.exports, URL, Date, AbortController, setTimeout, clearTimeout,
    localStorage: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) },
    fetch: async (...args) => { requests++; return response(...args); },
    window: { open: (...args) => downloads.push(args) },
    require: name => {
      if (name === '@angular/core') return { Injectable: () => value => value, inject: () => config, signal, computed: fn => fn };
      if (name === '@capacitor/core') return { Capacitor: { isNativePlatform: () => native }, registerPlugin: () => ({ open: async options => downloads.push(options) }) };
      if (name === '@capacitor/app') return { App: { getInfo: async () => ({ build: '2', version: '1.1.0' }) } };
      return {};
    },
  });
  return { service: new module.exports.AppReleaseService(), parse: module.exports.parseAndroidRelease, requests: () => requests, downloads, saved };
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

test('Android notices only a newer installed build and offers an external download', async () => {
  const h = harness(); await h.service.check(true);
  assert.equal(h.service.showNotice(), true);
  await h.service.download();
  assert.equal(h.downloads[0].url, h.service.latest().url);
  const same = harness({ response: () => ({ ok: true, json: async () => data(2) }) });
  await same.service.check(true); assert.equal(same.service.updateAvailable(), false);
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

test('web offers the release download without showing an Android update prompt', async () => {
  const h = harness({ native: false }); await h.service.check(true);
  assert.equal(h.service.updateAvailable(), false);
  await h.service.download(); assert.equal(h.downloads[0][0], h.service.latest().url);
});

test('an unpublished release is handled without blocking app startup', async () => {
  const h = harness({ response: () => ({ ok: false, status: 404 }) });
  await h.service.check(true);
  assert.equal(h.service.latest(), null); assert.equal(h.service.checking(), false);
  assert.match(h.service.message(), /publicada/);
});
