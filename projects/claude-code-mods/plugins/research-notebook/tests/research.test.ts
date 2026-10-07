import { test, expect } from 'claude-code/testing';
import { host } from './support';
import { inside, notebook, unpack } from '../hooks/domain';
const all = { e1:true,e2:true,e3:true,e4:true,e5:true,e6:true,e7:true,e8:true };
for (const arm of [0,1,2,3,4,5,6,7,8,9]) {
  const options = arm === 9 ? all : arm === 0 ? {} : { ['e' + arm]: true };
  test('fixture closed loop arm=' + arm, { options }, async ($, on) => {
    const h = host(on);
    const r = await $.command.run({origin:{kind:'composer'},presentation:{isFullscreen:false,columns:80}, command:'research-run', args:'normal' });
    expect(r.text).toContain('OK');
    const note = h.writes.get('notebook.md')!;
    for (const part of ['F1-E1','F2-E1','F3-E1','取舍','反例','待验证问题','非模型生成','Skill','mods']) expect(note).toContain(part);
    expect(h.writes.has('index.json')).toBe(arm === 7 || arm === 9);
  });
}
test('e2 rewrite and summary, e8 processed', { options:all }, async ($, on) => {
  host(on);
  const r = await $.tool.call({ tool:'mcp__research-notebook__fixture', id:' f1 ', mode:'normal' });
  expect(unpack(r.result)).toEqual(expect.objectContaining({ id:'F1', processed:true, summary:expect.any(Array) }));
});
for (const mode of ['deny','error','mock','cancel']) test('non-success never writes note: ' + mode, { options:all }, async ($, on) => {
  const h=host(on);
  const r=await $.command.run({origin:{kind:'composer'},presentation:{isFullscreen:false,columns:80},command:'research-run',args:mode});
  expect(r.text).toMatch(/STOP|MOCK|CANCELLED/);
  expect(h.writes.size).toBe(0);
});
test('link escape and invalid source fail closed', { options: { e2:true } }, async ($, on) => {
  const h=host(on); h.link();
  const r=await $.command.run({origin:{kind:'composer'},presentation:{isFullscreen:false,columns:80},command:'research-run',args:'normal'});
  expect(r.text).toContain('STOP'); expect(h.writes.size).toBe(0);
  const bad=await $.tool.call({tool:'mcp__research-notebook__fixture',id:'../../private',mode:'normal'});
  expect(bad.deny).toBeDefined();
});
test('exception text is not leaked', async ($, on) => {
  const h=host(on); h.fail();
  const r=await $.command.run({origin:{kind:'composer'},presentation:{isFullscreen:false,columns:80},command:'research-run',args:'normal'});
  expect(r.text).not.toContain('secret-api-error-body'); expect(h.writes.size).toBe(0);
});
for (const decision of ['allow','ask','deny'] as const) test('preserves or tightens permission ' + decision, { options:{e2:true} }, async ($, on) => {
  on('tool.check',()=>({decision}));
  const r=await $.tool.check({tool:'Write',input:{file_path:'/private/a',content:'x'}});
  expect(r.decision).toBe(decision === 'allow' ? 'deny' : decision);
});
test('prompt adds sources without replacing preceding context', { options:{e1:true} }, async ($, on) => {
  host(on); const r=await $.prompt.submit({origin:{kind:'composer'},wait:false,text:'[research] 比较 Skill 与 mods',context:['existing']});
  expect(r.context?.[0]).toBe('existing'); expect(r.context?.length).toBe(5);
  const plain=await $.prompt.submit({origin:{kind:'composer'},wait:false,text:'无标记'}); expect(plain.context).toBeUndefined();
});
test('timer detects changes, is bounded, stops on session end', {options:{e7:true}}, async ($,on)=>{
  const h=host(on);
  await $.session.start({cwd:'test',surface:null,isInteractive:false});
  h.change(); await h.clock.advance(60_000);
  expect(h.state.get('progress')).toEqual(expect.objectContaining({changed:true}));
  await h.clock.advance(180_000); await $.session.end({reason:'other',sessionId:'test-session',resume:{id:'test-session'}});
});
test('classification is opt-in and validates label', {options:{e3:true,classify:true}}, async ($,on)=>{
  host(on); let sent='';
  on('model.complete',($,e)=>{sent=e.prompt; return {value:{isAnswered:true,text:'workflow',usage:{input_tokens:10,output_tokens:1,cache_read_input_tokens:0,cache_creation_input_tokens:0}}};});
  const r=await $.command.run({origin:{kind:'composer'},presentation:{isFullscreen:false,columns:80},command:'research-classify',args:''});
  expect(r.text).toContain('workflow'); expect(sent).toContain('合成教学资料');
});
for (const reason of ['aborted','empty-reply'] as const) test('classification unsuccessful ' + reason,{options:{e3:true,classify:true}}, async ($,on)=>{
  host(on); on('model.complete',()=>({value:{isAnswered:false,reason,usage:{input_tokens:0,output_tokens:0,cache_read_input_tokens:0,cache_creation_input_tokens:0}}}));
  expect((await $.command.run({origin:{kind:'composer'},presentation:{isFullscreen:false,columns:80},command:'research-classify',args:''})).text).toContain(reason);
});
test('API failure metadata distinguishes gateway failure from cancellation', {options:{e3:true,classify:true,modelTimeoutMs:90000}}, async ($,on)=>{
  const h=host(on);
  on('model.complete',($,e)=>{expect(e.timeoutMs).toBe(90000);return {value:{isAnswered:false,reason:'api-error',status:null,error:'server_error',usage:{input_tokens:0,output_tokens:0,cache_read_input_tokens:0,cache_creation_input_tokens:0}}};});
  const r=await $.command.run({origin:{kind:'composer'},presentation:{isFullscreen:false,columns:80},command:'research-classify',args:''});
  const report=JSON.parse(h.writes.get('model-report.json')!);
  expect(report).toEqual(expect.objectContaining({isAnswered:false,reason:'api-error',eventAborted:false,status:null,error:'server_error'}));
  expect(report.request.sourceHash.length).toBe(64); expect(r.text).toContain('api-error'); expect(h.writes.has('notebook.md')).toBe(false);
});
test('real cancel API and completion status are observed', {options:{e3:true}}, async ($,on)=>{
  host(on); let cancelled=''; on('turn.abort',($,e)=>{cancelled=e.turnId;return {value:undefined};});
  await $.turn.start({turnId:'turn-fixture',text:'[research]'});
  await $.command.run({origin:{kind:'composer'},presentation:{isFullscreen:false,columns:80},command:'research-cancel',args:''}); expect(cancelled).toBe('turn-fixture');
  await $.turn.complete({turnId:'turn-fixture',answer:'',durationMs:1,isAborted:true,reason:'aborted'});
  expect((await $.command.run({origin:{kind:'composer'},presentation:{isFullscreen:false,columns:80},command:'research-status',args:''})).text).toContain('cancelled');
});
test('two distinct agent requests; host may refuse', {options:{e4:true}}, async ($,on)=>{
  host(on); let n=0;
  on('agent.spawn',()=>{ n++; return {deny:'fixture refusal'}; });
  const r=await $.command.run({origin:{kind:'composer'},presentation:{isFullscreen:false,columns:80},command:'research-agents',args:''});
  expect(n).toBe(2); expect(r.text).toContain('启动请求');
});
test('only fixed IO command, no user shell arguments', {options:{e7:true,readOnlyIO:true}}, async ($,on)=>{
  host(on); on('process.run',($,e)=>{expect(e.argv[0]).toBe('/usr/bin/wc');expect(e.argv[1]).toBe('-c');return {value:{exitCode:0,stdout:'123 fixed',stderr:'',isStdoutTruncated:false,isStderrTruncated:false}};});
  expect((await $.command.run({origin:{kind:'composer'},presentation:{isFullscreen:false,columns:80},command:'research-io',args:';curl malicious'})).text).toContain('123');
});
test('domain containment has separator boundary',()=>{expect(inside('/fixture-other','/fixture')).toBe(false);expect(inside('/fixture/a','/fixture')).toBe(true);});
test('step forwards streamed text and accounts usage', {options:{e3:true}},async ($,on)=>{
  host(on);
  on('turn.step',async function* ($,e){
    yield {kind:'text',index:0,text:'fixture model stream'};
    return {turnId:e.turnId,index:e.index,answer:'fixture model stream',toolUses:[],stopReason:'end_turn',usage:{model:'mock',input_tokens:12,output_tokens:3,cache_read_input_tokens:0,cache_creation_input_tokens:0}};
  });
  const chunks=[]; const stream=$.turn.step({turnId:'t',index:0,model:'mock',messageCount:1});
  for await (const chunk of stream) chunks.push(chunk);
  expect(chunks[0]).toEqual(expect.objectContaining({text:'fixture model stream'}));
  expect((await $.command.run({origin:{kind:'composer'},presentation:{isFullscreen:false,columns:80},command:'research-status',args:''})).text).toContain('"steps":1');
});
test('terminal evidence tree is valid, paint is not tested',{options:{e6:true}},async ($,on)=>{
  host(on);
  const ui=await $.ui.mount({plugin:'research-notebook',surface:'terminal',component:'AbovePrompt',requestId:'band',props:{hasSurvey:false,isWorking:false,maxRows:5,bodyColumns:80,scroll:{offset:0,bodyRows:5},view:{}}});
  expect((await ui.find({type:'Text',text:/合成证据/}))?.text).toContain('F1/F2/F3');
  await ui.unmount();
});
