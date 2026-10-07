import {spawnSync} from 'node:child_process';
import {readdirSync,existsSync,mkdirSync,copyFileSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function run(bin,args){const r=spawnSync(bin,args,{cwd:root,encoding:'utf8',timeout:30000});process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.error||r.status!==0||/\b[1-9]\d* fail\b/.test(r.stdout??''))process.exit(1);}
for(const name of readdirSync(root+'/plugins')){
  const dir=root+'/plugins/'+name;
  if(!existsSync(dir+'/.claude-plugin/plugin.json'))continue;
  // Offline fallback is a real 2.1.289 host snapshot, not hand-written API types.
  if(!existsSync(dir+'/.claude-plugin/types/claude-code/index.d.ts')){
    for(const noun of ['claude-code','claude-code-tools']){
      mkdirSync(dir+'/.claude-plugin/types/'+noun,{recursive:true});
      copyFileSync(root+'/docs/api/2.1.289/'+noun+'/index.d.ts',dir+'/.claude-plugin/types/'+noun+'/index.d.ts');
    }
    writeFileSync(dir+'/.claude-plugin/types/tsconfig.json',JSON.stringify({compilerOptions:{target:'es2023',lib:['es2023'],module:'esnext',moduleResolution:'bundler',strict:true,noUncheckedIndexedAccess:true,noEmit:true,skipLibCheck:true,typeRoots:['.'],types:['claude-code','claude-code-tools']},include:['../../hooks','../../types','../../tests']},null,2));
  }
  if(!existsSync(dir+'/tsconfig.json'))writeFileSync(dir+'/tsconfig.json','{"extends":"./.claude-plugin/types/tsconfig.json"}\n');
  const first=readFileSync(dir+'/.claude-plugin/types/claude-code/index.d.ts','utf8').split('\n')[0];
  console.log(name+' types: '+first);
  run('claude',['plugin','validate','--strict',dir]);
  run('tsc',['-p',dir]);
  if(existsSync(dir+'/tests'))run('claude',['plugin','test',dir]);
}
