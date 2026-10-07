import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const [arm='all', mode='normal']=process.argv.slice(2);
if (!['baseline','all','1','2','3','4','5','6','7','8'].includes(arm)) throw new Error('arm must be baseline, all, 1..8');
const commands={normal:'/research-run normal',deny:'/research-run deny',error:'/research-run error',mock:'/research-run mock',cancel:'/research-run cancel',status:'/research-status',classify:'/research-classify',agents:'/research-agents',io:'/research-io'};
if (!(mode in commands)) throw new Error('unknown scenario');
const cfg=Object.fromEntries(Array.from({length:8},(_,i)=>['e'+(i+1),arm==='all'||arm===String(i+1)]));
cfg.classify=mode==='classify'; if(mode==='classify')cfg.modelTimeoutMs=90000; cfg.readOnlyIO=mode==='io';
const args=['-p',commands[mode],'--plugin-dir',root+'/plugins/research-notebook'];
if(cfg.e8) args.push('--plugin-dir',root+'/plugins/research-audit');
args.push('--no-session-persistence','--max-budget-usd','0.15','--max-turns','2','--permission-mode','default','--tools',mode==='agents'?'Read,Agent':'Read','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--settings',JSON.stringify({pluginConfigs:{'research-notebook@inline':{options:cfg}}}));
const r=spawnSync('claude',args,{cwd:root+'/workspace',encoding:'utf8',timeout:mode==='classify'?110000:45000,maxBuffer:1000000});
process.stdout.write(r.stdout??''); process.stderr.write(r.stderr??'');
if(r.error) { console.error('Bounded CLI run ended: '+r.error.code); process.exit(1); }
if(/hook skipped|not loaded|Execution error/.test((r.stdout??'')+(r.stderr??''))) process.exit(1);
process.exit(r.status??1);
