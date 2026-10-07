import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const rows=[];
const cases=[...['baseline','1','2','3','4','5','6','7','8','all'].map(a=>[a,'normal']),...['deny','error','mock','cancel','io'].map(s=>['all',s])];
for(const [arm,mode] of cases){
  const before=(()=>{try{return createHash('sha256').update(readFileSync(root+'/workspace/notebook.md')).digest('hex');}catch{return null;}})();
  const r=spawnSync(process.execPath,[root+'/scripts/run.mjs',arm,mode],{cwd:root,encoding:'utf8',timeout:50000,maxBuffer:1000000});
  const out=(r.stdout??'')+(r.stderr??'');
  const expected=mode==='normal'?'OK：':mode==='mock'?'MOCK：':mode==='cancel'?'CANCELLED：':mode==='io'?'固定资料字节数：':'STOP：';
  const after=(()=>{try{return createHash('sha256').update(readFileSync(root+'/workspace/notebook.md')).digest('hex');}catch{return null;}})();
  const ok=r.status===0&&!r.error&&out.includes(expected)&&(mode==='normal'||mode==='io'||before===after);
  rows.push({arm,mode,passed:ok,unchangedOnFailure:mode==='normal'?null:before===after,summary:out.trim().slice(0,600)});
  console.log(arm+'/'+mode+': '+(ok?'PASS':'FAIL')+' '+out.trim());
  if(!ok)break;
}
mkdirSync(root+'/outputs',{recursive:true});
writeFileSync(root+'/outputs/live-report.json',JSON.stringify({version:spawnSync('claude',['--version'],{encoding:'utf8'}).stdout.trim(),generatedAt:new Date().toISOString(),kind:'real Claude Code CLI; no model quality claim',cases:rows},null,2)+'\n');
process.exit(rows.length===cases.length&&rows.every(r=>r.passed)?0:1);
