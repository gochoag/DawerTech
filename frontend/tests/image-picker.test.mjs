import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/app/shared/components/image-picker.component.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
}).outputText;

function harness(clipboard, { permission = 'granted', unsupportedPermission = false } = {}) {
  const module = { exports: {} };
  const dependency = { lock() {}, unlock() {}, reset() {}, markForCheck() {} };
  class Emitter {
    values = [];
    emit(value) { this.values.push(value); }
  }
  runInNewContext(compiled, {
    module, exports: module.exports, File, navigator: {
      clipboard,
      permissions: { query: async () => {
        if (unsupportedPermission) throw new TypeError('Unsupported permission name');
        return { state: permission };
      } },
    },
    require: name => name === '@angular/core' ? {
      Component: () => value => value,
      Input: () => () => {}, Output: () => () => {},
      ViewChild: () => () => {}, HostListener: () => () => {},
      ChangeDetectionStrategy: { OnPush: 0 }, EventEmitter: Emitter,
      inject: () => dependency,
    } : {},
  });
  const picker = new module.exports.ImagePickerComponent();
  picker.directPasteAvailable = Boolean(clipboard?.read);
  picker.pasteArea = { nativeElement: { focus() {} } };
  return picker;
}

const image = (name = 'photo.png', type = 'image/png') => new File(['image bytes'], name, { type });
function pasteEvent(file) {
  return {
    prevented: false,
    clipboardData: { items: file ? [{ type: file.type, getAsFile: () => file }] : [], files: [] },
    preventDefault() { this.prevented = true; },
  };
}

test('Ctrl+V emits the clipboard image through the existing file selection output', () => {
  const picker = harness();
  const file = image();
  const event = pasteEvent(file);
  picker.onPaste(event);
  assert.equal(event.prevented, true);
  assert.equal(picker.fileSelected.values[0], file);
});

test('unsupported clipboard permission does not open the browser Paste menu', async () => {
  const picker = harness({ read: async () => { throw new Error('Must not open native paste menu'); } }, { unsupportedPermission: true });
  await picker.ngOnInit();
  assert.equal(picker.directPasteAvailable, false);
  await picker.pasteFromClipboard();
  assert.match(picker.feedback, /Ctrl\+V/);
  picker.onPaste(pasteEvent(image()));
  assert.equal(picker.fileSelected.values.length, 1);
});

test('clipboard permission selects direct paste or the shortcut without reading clipboard data', async () => {
  for (const state of ['granted', 'prompt', 'denied']) {
    const picker = harness({ read: () => { throw new Error('Initialization must not read clipboard'); } }, { permission: state });
    await picker.ngOnInit();
    assert.equal(picker.directPasteAvailable, state !== 'denied');
  }
});

test('paste accepts image files when clipboard items are unavailable', () => {
  const picker = harness();
  const file = image();
  const event = pasteEvent();
  event.clipboardData.files = [file];
  picker.onPaste(event);
  assert.equal(picker.fileSelected.values[0], file);
});

test('a copied URL does not upload a file or cancel normal paste', () => {
  const picker = harness();
  const event = pasteEvent();
  event.clipboardData.items = [{ type: 'text/plain', getAsFile: () => null }];
  picker.onPaste(event);
  assert.equal(event.prevented, false);
  assert.equal(picker.fileSelected.values.length, 0);
  assert.match(picker.feedback, /Copiar imagen/);
});

test('file selection still emits files and resets the input to allow selecting them again', () => {
  const picker = harness();
  const file = image('photo.jpg', 'image/jpeg');
  const target = { files: [file], value: 'photo.jpg' };
  picker.onFileInputChange({ target });
  assert.equal(picker.fileSelected.values[0], file);
  assert.equal(target.value, '');
});

test('unsupported and oversized images are rejected before any upload', () => {
  const picker = harness();
  picker.onPaste(pasteEvent(image('vector.svg', 'image/svg+xml')));
  assert.match(picker.feedback, /PNG, JPEG o WebP/);
  picker.onPaste(pasteEvent(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })));
  assert.match(picker.feedback, /5 MB/);
  picker.onPaste(pasteEvent(new File([], 'empty.png', { type: 'image/png' })));
  assert.match(picker.feedback, /vacía/);
  assert.equal(picker.fileSelected.values.length, 0);
});

test('clipboard button emits a named image file and clears its loading state', async () => {
  const blob = image();
  const picker = harness({ read: async () => [{ types: ['text/html', 'image/png'], getType: async () => blob }] });
  await picker.pasteFromClipboard();
  assert.equal(picker.fileSelected.values[0].type, 'image/png');
  assert.equal(picker.fileSelected.values[0].name, 'imagen-portapapeles.png');
  assert.equal(picker.readingClipboard, false);
});

test('HTTP without clipboard API offers Ctrl+V as a working fallback', async () => {
  const picker = harness();
  await picker.pasteFromClipboard();
  assert.match(picker.feedback, /Ctrl\+V/);
  picker.onPaste(pasteEvent(image()));
  assert.equal(picker.fileSelected.values.length, 1);
  assert.equal(picker.feedback, '');
});

test('permission denial offers the keyboard fallback without leaving a loading state', async () => {
  const picker = harness({ read: async () => { throw new Error('NotAllowedError'); } });
  await picker.pasteFromClipboard();
  assert.match(picker.feedback, /Ctrl\+V/);
  assert.equal(picker.readingClipboard, false);
});

test('clipboard button explains when only text has been copied', async () => {
  const picker = harness({ read: async () => [{ types: ['text/plain'] }] });
  await picker.pasteFromClipboard();
  assert.match(picker.feedback, /Copiar imagen/);
  assert.equal(picker.fileSelected.values.length, 0);
});

test('disabled picker does not read, paste, clear, or select an image', async () => {
  const picker = harness({ read: () => { throw new Error('Must not read'); } });
  picker.disabled = true;
  const event = pasteEvent(image());
  picker.onPaste(event);
  picker.onFileInputChange({ target: { files: [image()], value: 'image' } });
  picker.onClear();
  await picker.pasteFromClipboard();
  assert.equal(event.prevented, false);
  assert.equal(picker.fileSelected.values.length, 0);
  assert.equal(picker.cleared.values.length, 0);
});

test('an old clipboard read cannot replace a newer file selection', async () => {
  let complete;
  const picker = harness({ read: () => new Promise(resolve => { complete = resolve; }) });
  const pending = picker.pasteFromClipboard();
  const newer = image('newer.webp', 'image/webp');
  picker.onFileInputChange({ target: { files: [newer], value: 'newer.webp' } });
  complete([{ types: ['image/png'], getType: async () => image() }]);
  await pending;
  assert.deepEqual(picker.fileSelected.values, [newer]);
  assert.equal(picker.readingClipboard, false);
});

test('clearing or destroying the picker cancels pending clipboard selection', async () => {
  for (const action of ['onClear', 'ngOnDestroy']) {
    let complete;
    const picker = harness({ read: () => new Promise(resolve => { complete = resolve; }) });
    const pending = picker.pasteFromClipboard();
    picker[action]();
    complete([{ types: ['image/png'], getType: async () => image() }]);
    await pending;
    assert.equal(picker.fileSelected.values.length, 0);
  }
});
