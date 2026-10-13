import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source=readFileSync(new URL('../../functions/download-apk.js',import.meta.url),'utf8').replace('export async function','async function')+'\nmodule.exports={onRequestGet};';
const release={tag_name:'android-v3',draft:false,prerelease:false,assets:[{name:'dawertech-release.apk',state:'uploaded',size:4,browser_download_url:'https://github.com/gochoag/DawerTech/releases/download/android-v3/dawertech-release.apk'}]};
async function proxy({metadata=release,code='3',assetStatus=200}={}) {
  const module={exports:{}},requests=[];
  runInNewContext(source,{module,URL,Response,AbortSignal,fetch:async(url,options)=>{
    requests.push({url,options});
    if(requests.length===1)return Response.json(metadata);
    const result=new Response(Uint8Array.from([80,75,3,4]),{status:assetStatus});
    Object.defineProperty(result,'url',{value:'https://release-assets.githubusercontent.com/file.apk'});
    result.arrayBuffer=()=>{throw new Error('Proxy must stream, not buffer the APK');};
    return result;
  }});
  const response=await module.exports.onRequestGet({request:new Request(`https://dawertech.pages.dev/download-apk?code=${code}`),env:{}});
  return {response,requests};
}

test('web APK proxy streams the requested immutable release with APK headers',async()=>{
  const {response,requests}=await proxy();
  assert.equal(response.status,200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()),Uint8Array.from([80,75,3,4]));
  assert.equal(response.headers.get('content-type'),'application/vnd.android.package-archive');
  assert.equal(response.headers.get('x-apk-size'),'4');
  assert.equal(requests[0].url,'https://api.github.com/repos/gochoag/DawerTech/releases/tags/android-v3');
  assert.equal(requests[1].options.headers,undefined);
});

test('invalid build numbers never make upstream requests',async()=>{
  for(const code of ['0','-1','invalid','2100000001']){
    const {response,requests}=await proxy({code});assert.equal(response.status,400);assert.equal(requests.length,0);
  }
});

test('private, unfinished, excessive and foreign APKs are never proxied',async()=>{
  for(const change of [{draft:true},{prerelease:true},{tag_name:'android-v4'},{assets:[]},
    {assets:[{...release.assets[0],size:65*1024*1024}]},{assets:[{...release.assets[0],state:'new'}]},
    {assets:[{...release.assets[0],browser_download_url:'https://attacker.example/file.apk'}]}]){
    const {response,requests}=await proxy({metadata:{...release,...change}});assert.equal(response.status,502);assert.equal(requests.length,1);
  }
  assert.equal((await proxy({assetStatus:404})).response.status,502);
});
