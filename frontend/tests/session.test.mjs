import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { of, Subject, throwError } from 'rxjs';

const require = createRequire(import.meta.url);
const key = 'dawertech-refresh';
const day = 86_400_000;
const now = 1_800_000_000_000;
const endpoint = 'http://192.168.100.49:5000/api/v1';
const user = { id: 1, name: 'Administrador', role: 'owner', email: 'admin@example.com', must_change_password: false };
const token = expiry => `header.${Buffer.from(JSON.stringify({ exp: expiry / 1000 })).toString('base64url')}.signature`;
const response = { user, access_token: token(now + day / 2), refresh_token: 'rotated-token', expires_in: 43_200 };
const source = readFileSync(new URL('../src/app/core/services/auth.service.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText;

class HttpClient {}
class HttpErrorResponse extends Error { constructor(status) { super(`HTTP ${status}`); this.status = status; } }

function harness({ native = true, saved, secure = new Map(), local = new Map(), request = () => of(response) } = {}) {
  let clock = now;
  if (saved) (native ? secure : local).set(key, JSON.stringify(saved));
  const calls = [];
  const prompts = [];
  const endpointProvider = { current: endpoint, toString: () => endpoint, use: () => {} };
  const storage = {
    getItem: async name => secure.get(name) ?? null,
    setItem: async (name, value) => { secure.set(name, value); },
    removeItem: async name => { secure.delete(name); },
  };
  const module = { exports: {} };
  runInNewContext(compiled, {
    exports: module.exports, module,
    require: name => {
      if (name === '@angular/common/http') return { HttpClient, HttpErrorResponse };
      if (name === '@angular/core') return {
        Injectable: () => value => value,
        inject: dep => dep === HttpClient ? { post: (url, body) => { calls.push({ url, body }); return request(url, body); } } : endpointProvider,
        signal: initial => { let value = initial; const result = () => value; result.set = next => { value = next; }; return result; },
      };
      if (name === '@capacitor/core') return { Capacitor: { getPlatform: () => native ? 'android' : 'web' } };
      if (name === '@aparajita/capacitor-secure-storage') return { SecureStorage: storage };
      if (name === '@aparajita/capacitor-biometric-auth') return { BiometricAuth: {
        checkBiometry: async () => ({ isAvailable: false, deviceIsSecure: true }),
        authenticate: async options => { prompts.push(options); },
      } };
      if (name === '../config') return { API_BASE_URL: 'endpoint' };
      return require(name);
    },
    Date: class extends Date { static now() { return clock; } },
    atob, console, setTimeout: () => 1, clearTimeout: () => {},
    window: { addEventListener: () => {} },
    localStorage: { getItem: name => local.get(name) ?? null, setItem: (name, value) => local.set(name, value), removeItem: name => local.delete(name) },
  });
  return { auth: new module.exports.AuthService(), calls, prompts, secure, local, storage, advanceTime: ms => { clock += ms; } };
}

function savedSession(extra = {}) {
  return { endpoint, token: 'saved-token', user, access_token: token(now + day / 2), last_active_at: now - day, device_lock: false, ...extra };
}

test('Android saves every login without opting into biometrics and restores after process death', async () => {
  const h = harness();
  await h.auth.login('admin@example.com', 'example-password');
  assert.equal(h.calls[0].body.remember_device, true);
  assert.ok(h.secure.has(key));
  assert.equal(h.prompts.length, 0);
  const restarted = harness({ secure: h.secure, local: h.local });
  await restarted.auth.initialize();
  assert.equal(restarted.auth.user().id, 1);
  assert.equal(restarted.calls.length, 0);
  assert.equal(restarted.prompts.length, 0);
});

test('closing and reopening before seven days does not ask for biometrics', async () => {
  const h = harness({ saved: savedSession({ device_lock: true, last_active_at: now - 6 * day }) });
  await h.auth.initialize();
  assert.equal(JSON.parse(h.secure.get(key)).last_active_at, now);
  assert.equal(h.auth.locked(), false);
  assert.equal(h.auth.hasRefreshToken(), true);
  assert.equal(h.prompts.length, 0);
});

test('seven inactive days lock the app, then Android device PIN unlocks without email or password', async () => {
  const h = harness({ saved: savedSession({ device_lock: true, last_active_at: now - 7 * day }) });
  await h.auth.initialize();
  assert.equal(h.auth.locked(), true);
  assert.equal(await h.auth.ensureActiveToken(), null);
  assert.equal(h.auth.hasRefreshToken(), false);
  assert.equal(h.auth.user(), null);
  await h.auth.unlockBiometric();
  assert.equal(h.prompts[0].allowDeviceCredential, true);
  assert.equal(h.auth.locked(), false);
  assert.equal(h.auth.user().id, 1);
  assert.equal(JSON.parse(h.secure.get(key)).last_active_at, now);
  assert.equal(h.calls.length, 0);
});

test('background token renewal does not count as user activity', async () => {
  const h = harness({ saved: savedSession({ device_lock: true, last_active_at: now - 6 * day }) });
  await h.auth.initialize();
  h.advanceTime(60 * 60 * 1000);
  await h.auth.refresh();
  assert.equal(JSON.parse(h.secure.get(key)).last_active_at, now);
  assert.equal(h.calls[0].body.remember_device, true);
});

test('offline backend preserves the saved session, while rejected refresh tokens clear it', async () => {
  const saved = savedSession({ access_token: token(now - day) });
  const offline = harness({ saved, request: () => throwError(() => new HttpErrorResponse(0)) });
  await offline.auth.initialize();
  assert.ok(offline.secure.has(key));
  assert.equal(offline.auth.hasRefreshToken(), true);
  const revoked = harness({ saved, request: () => throwError(() => new HttpErrorResponse(401)) });
  await revoked.auth.initialize();
  assert.equal(revoked.secure.has(key), false);
  assert.equal(revoked.auth.hasRefreshToken(), false);
});

test('logout cannot be undone by a refresh response arriving late', async () => {
  const pending = new Subject();
  const h = harness({ saved: savedSession(), request: url => url.endsWith('/auth/refresh') ? pending : of({}) });
  await h.auth.initialize();
  const refresh = h.auth.refresh();
  await h.auth.logout();
  pending.next(response);
  await assert.rejects(refresh);
  assert.equal(h.secure.has(key), false);
  assert.equal(h.auth.user(), null);
  const restarted = harness({ secure: h.secure, local: h.local });
  await restarted.auth.initialize();
  assert.equal(restarted.auth.hasRefreshToken(), false);
});

test('logout marker prevents restoring credentials if secure storage removal fails', async () => {
  const h = harness({ saved: savedSession() });
  await h.auth.initialize();
  h.storage.removeItem = async () => { throw new Error('Storage unavailable'); };
  await assert.rejects(h.auth.logout());
  const restarted = harness({ secure: h.secure, local: h.local });
  await restarted.auth.initialize();
  assert.equal(restarted.auth.hasRefreshToken(), false);
});

test('PC restores an expired access token using saved renewal credentials', async () => {
  const h = harness({ native: false, saved: savedSession({ access_token: token(now - day) }) });
  await h.auth.initialize();
  assert.equal(h.calls[0].url, `${endpoint}/auth/refresh`);
  assert.equal(h.auth.user().id, 1);
  assert.equal(JSON.parse(h.local.get(key)).token, response.refresh_token);
});

test('another PC tab cannot restore a session after explicit logout', async () => {
  const shared = new Map();
  const first = harness({ native: false, saved: savedSession(), local: shared });
  const second = harness({ native: false, local: shared });
  await first.auth.initialize();
  await second.auth.initialize();
  await first.auth.logout();
  await assert.rejects(second.auth.refresh());
  assert.equal(shared.has(key), false);
  assert.equal(second.auth.user(), null);
});

test('a pending refresh in another PC tab cannot overwrite explicit logout', async () => {
  const shared = new Map();
  const pending = new Subject();
  const first = harness({ native: false, saved: savedSession(), local: shared });
  const second = harness({ native: false, local: shared, request: () => pending });
  await first.auth.initialize();
  await second.auth.initialize();
  const refresh = second.auth.refresh();
  await first.auth.logout();
  pending.next(response);
  await assert.rejects(refresh);
  assert.equal(shared.has(key), false);
});

test('profile enables device protection after checking Android credentials', async () => {
  const h = harness({ saved: savedSession() });
  await h.auth.initialize();
  await h.auth.setDeviceLock(true);
  assert.equal(h.prompts[0].allowDeviceCredential, true);
  const restarted = harness({ secure: h.secure, local: h.local });
  await restarted.auth.initialize();
  assert.equal(restarted.auth.deviceLockEnabled(), true);
  assert.equal(restarted.auth.locked(), false);
});
