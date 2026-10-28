import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {DEFAULT_STATE,prepareRows,filterRows,paginate,pageNumbers,parseState,stateSearch,csvCell} from '../assets/core.mjs';
import {translations,translator} from '../assets/i18n.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const payload=JSON.parse(await readFile(resolve(root,'data/titles.json'),'utf8'));
const rows=prepareRows(payload.rows);
const query=changes=>filterRows(rows,{...DEFAULT_STATE,...changes});

test('all 992 records retain separate regular/badge namespaces',()=>{
  assert.equal(rows.length,992);assert.equal(new Set(rows.map(r=>r.key)).size,992);
  const expected={V4:[144,166],V5:[135,117],V6:[104,92],V7:[97,14],V8:[103,20]};
  for(const [version,[regular,commemorative]] of Object.entries(expected)){
    assert.equal(query({version,kind:'regular'}).length,regular);
    assert.equal(query({version,kind:'commemorative'}).length,commemorative);
  }
});
test('every requirement and review note is available in three languages',()=>{
  for(const row of rows){
    assert.equal(typeof row.name,'string');assert.ok(!('nameTranslations' in row));
    for(const lang of ['ja','en','zh']){
      assert.ok(row.conditions[lang]?.trim(),row.key);assert.ok(row.confidence[lang]?.trim(),row.key);
      assert.deepEqual((row.conditions[lang].match(/\d+/g)||[]).sort(),(row.conditions.zh.match(/\d+/g)||[]).sort(),row.key);
    }
  }
});
test('title names never change with the display language',()=>{
  const title=rows.find(r=>r.key==='V8-regular-96');
  assert.equal(title.name,'天国と地獄');
  for(const lang of ['ja','en','zh'])assert.equal(query({lang,version:'V8',kind:'regular',q:'#96'})[0].name,title.name);
});
test('search matches names, requirements, song references, and exact IDs',()=>{
  assert.deepEqual(query({q:'V8 #83'}).map(r=>r.key),['V8-regular-83']);
  assert.equal(query({version:'V8',kind:'regular',q:'Blue Moon'}).length,3);
  assert.ok(query({q:'3000'}).some(r=>r.key==='V8-regular-96'));
  assert.ok(query({q:'チャレンジャー'}).some(r=>r.key==='V4-regular-2'));
  assert.ok(query({q:'shops'}).some(r=>r.key==='V8-regular-12'));
});
test('game filtering includes shared titles and excludes the opposite game',()=>{
  for(const mode of ['GF','DM']){
    const found=query({mode});assert.ok(found.length);
    assert.ok(found.every(r=>r.mode===mode||r.mode==='GF/DM'));
  }
  assert.ok(query({mode:'DM',version:'V8'}).every(r=>r.mode!=='GF'));
});
test('historical and unconfirmed requirements remain distinct',()=>{
  assert.ok(query({review:'historical',version:'V7'}).some(r=>r.id===1012));
  assert.ok(query({review:'pending'}).length>0);
  assert.ok(query({review:'confirmed'}).every(r=>r.review==='confirmed'));
});
test('pagination clamps out-of-range deep links and handles no results',()=>{
  assert.equal(paginate(rows,10000).page,42);assert.equal(paginate(rows,42).rows.length,8);
  assert.deepEqual(paginate([],30),{rows:[],page:1,pages:1,total:0,start:0,end:0});
  assert.deepEqual(pageNumbers(20,42),[1,'…',19,20,21,'…',42]);
});
test('URL state survives sharing and discards invalid filter values',()=>{
  const state={...DEFAULT_STATE,lang:'en',version:'V8',q:'天国と地獄',review:'pending',title:'V8-regular-96',page:2};
  assert.deepEqual(parseState(stateSearch(state)),state);
  const invalid=parseState('?lang=invalid&version=V99&page=-20&mode=any');
  assert.equal(invalid.lang,'zh');assert.equal(invalid.version,'all');assert.equal(invalid.page,1);assert.equal(invalid.mode,'all');
});
test('interface dictionaries are complete and public display data has no transcription diagnostics',async()=>{
  const keys=Object.keys(translations.zh).sort();
  for(const lang of ['ja','en'])assert.deepEqual(Object.keys(translations[lang]).sort(),keys);
  assert.equal(translator('en')('resultCount',{count:123}),'123 title records found');
  assert.ok(!/OCR|识别失败|识别错误|识別エラー/i.test(JSON.stringify(payload)));
  const markup=await readFile(resolve(root,'index.html'),'utf8');assert.ok(!/OCR|识别错误|识别失败/i.test(markup));
});
test('every referenced original image exists and is an actual PNG',async()=>{
  const paths=new Set(rows.flatMap(r=>Object.values(r.images)));
  assert.equal(paths.size,1124);
  for(const path of paths){assert.ok(!path.startsWith('/'));const body=await readFile(resolve(root,path));assert.equal(body.subarray(1,4).toString(),'PNG',path);}
});
test('download/data files match their recorded hashes',async()=>{
  const manifest=JSON.parse(await readFile(resolve(root,'data/manifest.json'),'utf8'));
  for(const [path,sha] of Object.entries(manifest.files))assert.equal(createHash('sha256').update(await readFile(resolve(root,path))).digest('hex'),sha,path);
  assert.ok((await stat(resolve(root,'downloads/gfdm-titles-ja-en-zh.xlsx'))).size>100000);
});
test('CSV quoting preserves line breaks and blocks spreadsheet formulas',()=>{
  assert.equal(csvCell('a,"b"\nc'),'"a,""b""\nc"');assert.equal(csvCell('=1+1'),'"\'=1+1"');
});
