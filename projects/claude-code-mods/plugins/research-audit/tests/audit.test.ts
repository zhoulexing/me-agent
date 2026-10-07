import {test,expect} from 'claude-code/testing';
const command={origin:{kind:'composer'} as const,presentation:{isFullscreen:false,columns:80}};
const provider={name:'research-notebook',register(on: import('claude-code').On) {
  on('tool.call',{tool:'mcp__research-notebook__fixture'}, async ($,e)=> e.mode==='deny' ? {deny:'fixture deny'} : {result:'{"processed":true}'});
}};
test('actual audit surrounds processing plugin', {plugins:[provider]}, async ($,on)=>{
  on('ui.log',()=>({value:undefined}));
  await $.tool.call({tool:'mcp__research-notebook__fixture',id:'F1',mode:'normal'});
  await $.tool.call({tool:'mcp__research-notebook__fixture',id:'F1',mode:'deny'});
  const r=await $.command.run({...command,command:'research-audit-status',args:''});
  expect(JSON.parse(r.text!)).toEqual({before:2,after:2,denied:1,processed:1});
});
test('prepend short circuit hides call from later audit', {plugins:[{name:'early',tier:'prepend',register(on) {
  on('tool.call',{tool:'mcp__research-notebook__fixture'},()=>({result:'[MOCK] short circuit'}));
}}]},async ($,on)=>{
  await $.tool.call({tool:'mcp__research-notebook__fixture',id:'F1'});
  const r=await $.command.run({...command,command:'research-audit-status',args:''});
  expect(JSON.parse(r.text!).before).toBe(0);
});
test('downstream exception closes audit call',async ($,on)=>{
  on('tool.call',()=>{throw new Error('fixture-error');});
  const r=await $.tool.call({tool:'mcp__research-notebook__fixture',id:'F1'});
  expect(r.deny).toContain('审计异常');
});
test('post-next processing fault does not rerun provider',async ($,on)=>{
  let calls=0;
  on('tool.call',()=>{calls++;return {result:'invalid JSON'};});
  const r=await $.tool.call({tool:'mcp__research-notebook__fixture',id:'F1'});
  expect(r.deny).toContain('审计异常'); expect(calls).toBe(1);
});
