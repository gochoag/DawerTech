import assert from 'node:assert/strict';
import test from 'node:test';
import { planAndroidRelease } from '../scripts/prepare-ci-release.mjs';

const commit = 'a'.repeat(40);
const olderCommit = 'b'.repeat(40);
const base = { version: '1.1.0', versionCode: 2 };
const release = (code, version = '1.1.0', extra = {}) => ({
  tag_name: `android-v${code}`, name: `DawerTech ${version}`, target_commitish: olderCommit,
  draft: false, prerelease: false,
  assets: [{ name: 'dawertech-release.apk', state: 'uploaded', size: 1000 }], ...extra,
});
const plan = changes => planAndroidRelease({ base, releases: [], tags: [], commit, ...changes });

test('the first automatic release keeps the configured version and build code', () => {
  assert.deepEqual(plan(), { publish: true, version: '1.1.0', versionCode: 2, commit });
});

test('frontend changes get a newer display version and build without editing the baseline', () => {
  assert.equal(plan({ releases: [release(8, '1.1.6')] }).version, '1.1.7');
  assert.equal(plan({ releases: [release(8, '1.1.6')] }).versionCode, 9);
  assert.equal(base.versionCode, 2);
  assert.equal(base.version, '1.1.0');
});

test('major or minor version changes can override the automatically increasing patch', () => {
  const result = plan({ base: { version: '2.0.0', versionCode: 20 }, releases: [release(8, '1.1.6')] });
  assert.equal(result.version, '2.0.0');
  assert.equal(result.versionCode, 20);
});

test('retrying a published commit does not rebuild or publish the same changes', () => {
  assert.deepEqual(plan({ releases: [release(8, '1.1.6', { target_commitish: commit })] }), { publish: false });
  assert.deepEqual(plan({ releases: [release(8, '1.1.6', { target_commitish: 'main' })],
    tags: [{ name: 'android-v8', commit: { sha: commit } }] }), { publish: false });
});

test('unfinished releases and reserved tags get a fresh code on retry', () => {
  const result = plan({ releases: [release(8, '1.1.6'), release(9, '1.1.7', { draft: true, target_commitish: commit })],
    tags: [{ name: 'android-v10' }, { name: 'v99.0.0' }] });
  assert.equal(result.publish, true);
  assert.equal(result.versionCode, 11);
  assert.equal(result.version, '1.1.7');
  assert.equal(plan({ releases: [release(3, '1.1.1', { assets: [], target_commitish: commit })] }).publish, true);
});

test('an Android release unrelated to the most recent non-Android release is still considered', () => {
  const result = plan({ releases: [{ tag_name: 'server-v100', name: 'Server 100' }, release(8, '1.1.6'), release(4, '1.1.2')] });
  assert.equal(result.versionCode, 9);
  assert.equal(result.version, '1.1.7');
});

test('malformed metadata or exhausted Android build numbers stop publication', () => {
  for (const value of [0, -1, 1.5, 2100000001]) assert.throws(() => plan({ base: { ...base, versionCode: value } }), /invalido/);
  assert.throws(() => plan({ tags: [{ name: 'android-v2100000000' }] }), /limite/);
  assert.throws(() => plan({ tags: [{ name: 'android-v2100000001' }] }), /fuera de rango/);
  assert.throws(() => plan({ base: { ...base, version: '1.1' } }), /formato/);
  assert.throws(() => plan({ releases: [release(8, 'version invalida')] }), /formato/);
  assert.throws(() => plan({ commit: 'main' }), /commit/);
});
