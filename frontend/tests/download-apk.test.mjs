import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto, createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(new URL('../src/app/core/http/download-apk.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function harness(response, crypto = webcrypto) {
  const module = { exports: {} };
  runInNewContext(compiled, { module, exports: module.exports, Blob, Uint8Array, DOMException, crypto,
    fetch: async () => response });
  return module.exports.downloadApkFile;
}
const bytes = Uint8Array.from([80,75,3,4,5,6]);
const apk = body => new Response(body ?? bytes, { headers: { 'content-type': 'application/vnd.android.package-archive' } });

test('APK download reports real byte progress and produces the complete file', async () => {
  const progress=[];
  let index=0;
  const stream=new ReadableStream({pull(controller){if(index===0)controller.enqueue(bytes.slice(0,2));else if(index===1)controller.enqueue(bytes.slice(2));else controller.close();index++;}});
  const result=await harness(apk(stream))('https://site/download-apk',6,undefined,new AbortController().signal,(received,total)=>progress.push([received,total]));
  assert.deepEqual(progress,[[2,6],[6,6]]);
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()),bytes);
  assert.equal(result.type,'application/vnd.android.package-archive');
});

test('HTML fallback and unsuccessful proxy responses never become downloaded APKs', async () => {
  for(const response of [new Response('<html>login</html>',{headers:{'content-type':'text/html'}}),new Response('error',{status:502})]) {
    await assert.rejects(harness(response)('https://site/download-apk',6,undefined,new AbortController().signal,()=>{}),/No se pudo descargar/);
  }
});

test('truncated, oversized and excessive announced APKs are rejected', async () => {
  await assert.rejects(harness(apk())('https://site/download-apk',7,undefined,new AbortController().signal,()=>{}),/incompleta/);
  await assert.rejects(harness(apk())('https://site/download-apk',5,undefined,new AbortController().signal,()=>{}),/inesperado/);
  await assert.rejects(harness(apk())('https://site/download-apk',64*1024*1024+1,undefined,new AbortController().signal,()=>{}),/no es válido/);
});

test('cancelled transfer releases its stream and never returns a partial APK', async () => {
  const controller=new AbortController();let cancelled=false;
  const stream=new ReadableStream({pull(output){output.enqueue(bytes.slice(0,2));},cancel(){cancelled=true;}});
  await assert.rejects(harness(apk(stream))('https://site/download-apk',6,undefined,controller.signal,()=>controller.abort()),error=>error.name==='AbortError');
  assert.equal(cancelled,true);
  assert.equal(stream.locked,false);
});

test('published SHA-256 digest is checked before exposing the download', async () => {
  const expected=createHash('sha256').update(bytes).digest('hex');
  const result=await harness(apk())('https://site/download-apk',6,expected,new AbortController().signal,()=>{});
  assert.equal(result.size,6);
  await assert.rejects(harness(apk())('https://site/download-apk',6,'0'.repeat(64),new AbortController().signal,()=>{}),/verificación/);
});
