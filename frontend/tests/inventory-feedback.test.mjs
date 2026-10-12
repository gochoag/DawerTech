import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = name => ts.transpileModule(readFileSync(new URL(`../src/app/features/inventory/pages/${name}.component.ts`, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
}).outputText;
const detailSource = source('part-detail');
const listSource = source('parts');
const existing = { id: 1, sku: 'BAT-001', name: 'Batería Samsung A02', variant: 'Original', category: 'Baterías', archived: false };
const created = { ...existing, id: 2, sku: 'BAT-002', purchase_cents: 500, sale_cents: 1000, min_stock: 0, stock: 0, has_image: false, device_ids: [], is_universal: false };

function harness({ detail = true, matches = async () => ({ items: [existing], total: 1, page: 1, limit: 5 }), image = async () => new Blob(['image']), create } = {}) {
  class ApiService {} class ModalLockService {} class ToastService {}
  class ChangeDetectorRef {} class ActivatedRoute {} class Router {}
  const writes = [], messages = [], urls = [], revoked = [], navigations = [];
  let locks = 0, checks = 0;
  const api = {
    partNameMatches: (...args) => { checks++; return matches(...args); },
    suggestSku: async () => 'BAT-002',
    createPart: async data => { writes.push(data); return create ? create(data) : created; },
    part: async () => created, movements: async () => ({ items: [] }),
    devicesByIds: async () => ({ items: [] }), image,
  };
  const deps = new Map([
    [ApiService, api], [ModalLockService, { lock() { locks++; }, unlock() { locks--; }, reset() { locks = 0; } }],
    [ToastService, { show: (...args) => messages.push(args) }], [ChangeDetectorRef, { markForCheck() {} }],
    [ActivatedRoute, { snapshot: { paramMap: { get: () => null } } }],
    [Router, { navigate: async path => { navigations.push(path); return true; } }],
  ]);
  const module = { exports: {} };
  runInNewContext(detail ? detailSource : listSource, {
    exports: module.exports, module, setTimeout, clearTimeout,
    URL: { createObjectURL: blob => { const value = `blob:${urls.length}`; urls.push({ value, blob }); return value; }, revokeObjectURL: value => revoked.push(value) },
    require: name => {
      if (name === '@angular/core') return { Component: () => value => value, HostListener: () => () => {}, ChangeDetectorRef, inject: token => deps.get(token) };
      if (name === '@angular/router') return { ActivatedRoute, Router };
      if (name === '../../../core/services') return { ApiService, ModalLockService, ToastService };
      if (name === '../../../core/models') return { money: String, localDate: String };
      return {};
    },
  });
  const component = detail ? new module.exports.PartDetailComponent() : new module.exports.PartsComponent();
  if (detail) Object.assign(component.form, { name: existing.name, variant: 'AAA', category: existing.category });
  return { component, writes, messages, urls, revoked, navigations, locks: () => locks, checks: () => checks };
}

test('same name warns before creation and explicitly permits a different quality', async () => {
  const h = harness();
  await h.component.save();
  assert.equal(h.writes.length, 0);
  assert.equal(h.component.showDuplicateConfirm, true);
  assert.equal(h.component.nameMatchesTotal, 1);
  assert.equal(h.locks(), 1);
  await h.component.confirmDuplicateCreation();
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].variant, 'AAA');
  assert.equal(h.locks(), 0);
  assert.equal(h.component.showDuplicateConfirm, false);
});

test('a unique name creates directly after checking the current catalog', async () => {
  const h = harness({ matches: async () => ({ items: [], total: 0, page: 1, limit: 5 }) });
  await h.component.save();
  assert.equal(h.checks(), 1);
  assert.equal(h.writes.length, 1);
  assert.equal(h.component.showDuplicateConfirm, false);
});

test('changing the name discards stale results and paginates matches consistently', async () => {
  let completeOld;
  const h = harness({ matches: (name, page) => name === existing.name
    ? new Promise(resolve => { completeOld = resolve; })
    : Promise.resolve({ items: [{ ...existing, id: page + 10, name }], total: 2, page, limit: 1 }) });
  const old = h.component.refreshNameMatches();
  h.component.form.name = 'Otra pieza';
  h.component.nameChanged();
  await h.component.refreshNameMatches();
  completeOld({ items: [existing], total: 1, page: 1 });
  assert.equal(await old, false);
  assert.equal(h.component.nameMatches[0].name, 'Otra pieza');
  await h.component.refreshNameMatches(2);
  assert.equal(h.component.nameMatches.length, 2);
  assert.equal(h.component.nameMatchesPage, 2);
});

test('an unavailable check reports the failure and requires an explicit choice to continue', async () => {
  const h = harness({ matches: async () => { throw new Error('offline'); } });
  await h.component.save();
  assert.equal(h.writes.length, 0);
  assert.match(h.component.nameCheckError, /No se pudo revisar/);
  assert.equal(h.component.showDuplicateConfirm, true);
  await h.component.confirmDuplicateCreation();
  assert.equal(h.writes.length, 1);
});

test('same quality is identified but can still be created after reviewing the warning', async () => {
  const h = harness();
  h.component.form.variant = 'ORIGINAL';
  assert.equal(h.component.sameQuality(existing), true);
  await h.component.save();
  await h.component.confirmDuplicateCreation();
  assert.equal(h.writes[0].variant, 'ORIGINAL');
});

test('changing the form during the final check cannot save stale values', async () => {
  let complete;
  const h = harness({ matches: () => new Promise(resolve => { complete = resolve; }) });
  const saving = h.component.save();
  h.component.form.sale = 100;
  complete({ items: [], total: 0 });
  await saving;
  assert.equal(h.writes.length, 0);
  assert.equal(h.component.saving, false);
  assert.match(h.messages[0][0], /formulario cambió/);
});

test('destroying a form with a pending check never creates a record or opens a dialog', async () => {
  let complete;
  const h = harness({ matches: () => new Promise(resolve => { complete = resolve; }) });
  const saving = h.component.save();
  h.component.ngOnDestroy();
  complete({ items: [existing], total: 1 });
  await saving;
  assert.equal(h.writes.length, 0);
  assert.equal(h.component.showDuplicateConfirm, false);
  assert.equal(h.locks(), 0);
});

test('duplicate SKU remains a server error even after accepting a repeated name', async () => {
  const h = harness({ create: () => { throw { error: { error: { code: 'duplicate_sku', message: 'Este SKU ya existe' } } }; } });
  await h.component.save(true);
  assert.equal(h.component.error, 'Este SKU ya existe');
});

test('a photo is loaded on demand and its object URL and scroll lock are released on close', async () => {
  const h = harness({ detail: false });
  h.component.openPhoto({ ...created, has_image: true });
  await new Promise(setImmediate);
  assert.equal(h.component.photoUrl, 'blob:0');
  assert.equal(h.locks(), 1);
  h.component.closePhoto();
  assert.equal(h.component.photoUrl, '');
  assert.deepEqual(h.revoked, ['blob:0']);
  assert.equal(h.locks(), 0);
});

test('closing a photo while it loads does not revive its image or leak an object URL', async () => {
  let complete;
  const h = harness({ detail: false, image: () => new Promise(resolve => { complete = resolve; }) });
  h.component.openPhoto({ ...created, has_image: true });
  h.component.closePhoto();
  complete(new Blob(['image']));
  await new Promise(setImmediate);
  assert.equal(h.component.activePhotoPart, null);
  assert.equal(h.urls.length, 0);
  assert.equal(h.locks(), 0);
});

test('photo failure shows feedback and supports retry without adding another scroll lock', async () => {
  let fail = true;
  const h = harness({ detail: false, image: async () => { if (fail) throw new Error('offline'); return new Blob(['image']); } });
  h.component.openPhoto({ ...created, has_image: true });
  await new Promise(setImmediate);
  assert.match(h.component.photoError, /No se pudo cargar/);
  fail = false;
  await h.component.loadPhoto();
  assert.equal(h.component.photoUrl, 'blob:0');
  assert.equal(h.component.photoError, '');
  assert.equal(h.locks(), 1);
  h.component.ngOnDestroy();
  assert.equal(h.locks(), 0);
});

test('Sin foto does not open a modal; purchase sorting uses the purchase price', () => {
  const h = harness({ detail: false });
  h.component.openPhoto(created);
  assert.equal(h.component.activePhotoPart, null);
  h.component.parts = [{ ...created, id: 1, purchase_cents: 400, sale_cents: 1200 }, { ...created, id: 2, purchase_cents: 900, sale_cents: 1000 }];
  h.component.setSortOrder('purchase:asc');
  assert.deepEqual(Array.from(h.component.displayedParts, part => part.id), [1, 2]);
  h.component.toggleSort('purchase');
  assert.deepEqual(Array.from(h.component.displayedParts, part => part.id), [2, 1]);
});
