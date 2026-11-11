const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('dist/index.html','utf8');
const nodes=new Map(),selectors=new Map(),lists=new Map(),events=new Map(),timers=new Map();
let clockMs=Date.parse('2026-11-01T12:00:00Z'),serial=0;
class TestDate extends Date { constructor(...args){super(...(args.length?args:[clockMs]));} static now(){return clockMs;} }
const node=key=>{
  if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',value:'',hidden:false,disabled:false,dataset:{},style:{},scrollTop:0,scrollHeight:100,isConnected:true,
    focus(){},remove(){},click(){},setAttribute(){},removeAttribute(){},scrollIntoView(){},closest(){return null;},contains(){return true;},
    getBoundingClientRect(){return {left:700,top:60,right:1440,bottom:1000,width:740,height:940};},
    classList:{add(){},remove(){},toggle(){}},
    querySelector(selector){return selectors.get(key+' '+selector)||null;},querySelectorAll(selector){return lists.get(key+' '+selector)||[];}});
  return nodes.get(key);
};
class TestFormData {
  constructor(form){this.values=form.values||{};}
  get(key){const value=this.values[key];return Array.isArray(value)?value[0]??null:value??null;}
  getAll(key){const value=this.values[key];return value===undefined?[]:Array.isArray(value)?value:[value];}
  *[Symbol.iterator](){for(const key of Object.keys(this.values))for(const value of this.getAll(key))yield[key,value];}
}
const context={console,Date:TestDate,JSON,FormData:TestFormData,URL,URLSearchParams,Blob,
  addEventListener(type,handler){if(!events.has(type))events.set(type,[]);events.get(type).push(handler);},
  setTimeout(fn,delay=0){const id=++serial;timers.set(id,{id,fn,due:clockMs+Number(delay)});return id;},clearTimeout(id){timers.delete(id);},
  document:{body:node('body'),activeElement:node('active'),getElementById:node,
    querySelector:selector=>selectors.get(selector)||null,querySelectorAll:selector=>lists.get(selector)||[],createElement:tag=>node('created-'+tag),
    addEventListener(type,handler){if(!events.has(type))events.set(type,[]);events.get(type).push(handler);}},innerWidth:1440,innerHeight:1000};
context.window=context;
vm.createContext(context);
for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(match[1],context);
const modules=['workshop-evaluation-seed.js','workshop-evaluation.js','workshop-evaluation-versions.js','workshop-evaluation-dashboard.js','workshop-evaluation-tasks.js','workshop-evaluation-assets.js','workshop-evaluation-evaluators.js','workshop-evaluation-experiment-engine.js','workshop-evaluation-reports.js','workshop-evaluation-experiments.js','workshop-evaluation-issues.js','workshop-evaluation-copilot.js'];
const scriptTags=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)];
let previousScriptIndex=-1;
for(const file of modules){
  const script=scriptTags.find(match=>match[1].split('?')[0]===file);
  assert(script,file+' must be loaded by index.html');
  assert(script.index>previousScriptIndex,'evaluation modules load in dependency order');
  previousScriptIndex=script.index;
  vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),context,{filename:file});
}
const run=code=>vm.runInContext(code,context);
const snapshot=code=>JSON.parse(run('JSON.stringify('+code+')'));
const advance=()=>{
  const next=[...timers.values()].sort((a,b)=>a.due-b.due||a.id-b.id)[0];
  if(!next)return false;
  timers.delete(next.id);clockMs=Math.max(clockMs,next.due);next.fn();return true;
};
const drain=(limit=3000)=>{let count=0;while(timers.size){assert(++count<=limit,'run timers must finish');advance();}};
const until=(predicate,limit=3000)=>{let count=0;while(!predicate()){assert(++count<=limit&&advance(),'expected run progress must occur');}};

const clone=value=>JSON.parse(JSON.stringify(value));
run("currentSection='studio';studio.scene='sales';evData();evExperimentStore();evExperimentRefresh=()=>{}");
context.template=run('evExperimentStore().experiments[0]');
context.experiment=run('evCreateExperiment({name:"独立评测记录回归",agentId:template.agentId,version:template.version,suiteIds:template.suiteIds,evaluatorIds:template.evaluatorIds,execution:{concurrency:2,caseRuns:3,fullRuns:3}})');
const experiment=context.experiment;
assert.deepEqual(Object.keys(experiment.execution).sort(),['caseRuns','concurrency','evaluationBindings','fullRuns','maxTurns','mcpIds','mode','modelId','scenarioPrompt']);
assert.deepEqual(clone(run('evExperimentExecution({times:2,rounds:4})')),{
  concurrency:4,caseRuns:2,fullRuns:4,modelId:'mock-eval-balanced',mcpIds:[],mode:'single_turn',scenarioPrompt:'',maxTurns:5,evaluationBindings:[]
},'legacy input aliases normalize into the canonical execution schema');
for(const invalid of [{caseRuns:0},{fullRuns:6},{caseRuns:1.5},{fullRuns:''}]){
  context.invalid=invalid;assert.throws(()=>run('evUpdateExperiment(experiment.id,{execution:invalid})'));
}
const initialConfig=clone(experiment.snapshot),caseCount=initialConfig.cases.length;
context.first=run('evRunExperiment(experiment.id)');
const first=context.first,records=[...experiment.runs].sort((a,b)=>a.sequence-b.sequence);
assert.equal(records.length,3);assert.equal(experiment.sequence,3);assert.equal(first,records[0]);
assert.deepEqual(records.map(record=>record.status),['运行中','排队中','排队中']);
assert(records.every(record=>record.kind==='full'&&record.parentRunId===null&&record.supplements.length===0));
assert(records.every(record=>record.snapshot.execution.fullRuns===3&&record.results.length===caseCount*3));
assert(records.every(record=>Object.isFrozen(record.snapshot)&&Object.isFrozen(record.snapshot.cases)));
assert.notEqual(records[0].snapshot,records[1].snapshot);
assert(records.slice(1).every(record=>!record.startedAt&&record.startedAtMs===null));
const allResults=records.flatMap(record=>record.results);
assert.equal(allResults.length,caseCount*3*3);
assert.equal(new Set(allResults.map(result=>result.id)).size,allResults.length);
assert.equal(new Set(allResults.map(result=>result.conversationId)).size,allResults.length);
assert.equal(new Set(allResults.map(result=>result.messages)).size,allResults.length);
for(const record of records)for(const c of record.snapshot.cases){
  const attempts=record.results.filter(result=>result.caseId===c.id);
  assert.deepEqual(clone(attempts.map(result=>result.attempt)),[1,2,3]);
  assert(attempts.every(result=>result.input===c.input&&result.messages.length===1&&result.messages[0].role==='user'&&result.messages[0].content===String(c.input||'')));
}
assert(allResults.every(result=>result.contextPolicy==='isolated'&&!Object.hasOwn(result,'round')&&!Object.hasOwn(result,'iteration')));
assert.equal(run('evRunExperiment(experiment.id)'),first,'duplicate full launch returns the active execution');
assert.equal(experiment.runs.length,3);
assert.throws(()=>run('evUpdateExperiment(experiment.id,{name:"运行中不能编辑"})'));
advance();
run('evPauseExperiment(experiment.id)');
assert.equal(first.status,'已暂停');assert.equal(run('evExperimentActiveExecution(experiment)'),first);
assert.equal(timers.size,0,'pause cancels active conversation timers');
assert(records.slice(1).every(record=>record.status==='排队中'&&!record.startedAt));
assert.throws(()=>run('evUpdateExperiment(experiment.id,{execution:{fullRuns:1}})'));
run('evResumeExperiment(experiment.id)');
let completedTimerCount=0;
while(timers.size){
  assert.equal(records.filter(record=>record.status==='运行中').length,1,'full records are scheduled sequentially');
  assert(records.every(record=>record.results.filter(result=>result.status==='运行中').length<=2),'concurrency limits independent conversations');
  assert(++completedTimerCount<1000);advance();
}
assert(records.every(record=>['已完成','部分失败'].includes(record.status)));
assert.equal(run('evExperimentActiveExecution(experiment)'),null);
for(let index=1;index<records.length;index++)assert(records[index].startedAtMs>=records[index-1].endedAtMs);
for(const result of allResults.filter(result=>result.enabled!==false)){
  assert.equal(result.messages[0].content,String(result.input||''));
  assert.equal(result.messages.length,result.status==='运行失败'?1:2);
  if(result.messages.length===2){assert.equal(result.messages[1].content,result.actual);assert.equal(result.messages[1].tokens,result.tokens);assert.equal(result.messages[1].durationMs,result.durationMs);}
  assert(result.trace.spans.every(span=>span.conversationId===result.conversationId&&span.turn===1&&!Object.hasOwn(span,'executionRound')));
}
assert(records.every(record=>record.initialFullResult&&Object.isFrozen(record.initialFullResult)&&Object.isFrozen(record.initialFullResult.results)));
assert(records.every(record=>record.report.coverage.expectedAttempts===record.snapshot.cases.filter(c=>c.enabled!==false).length*3));
const baseline=clone({...first,supplements:[]}),sequence=experiment.sequence,rootCount=experiment.runs.length;
const failed=first.results.filter(result=>['未通过','运行失败'].includes(result.status));
assert(failed.length);
context.supplement=run('evRunExperiment(experiment.id,first)');
const supplement=context.supplement;
assert.notEqual(supplement,first);assert.equal(first.supplements[0],supplement);
assert.equal(supplement.kind,'supplement');assert.equal(supplement.parentRunId,first.id);assert.equal(supplement.sourceRunId,first.id);
assert.equal(supplement.sequence,first.sequence);assert.equal(supplement.supplementSequence,1);
assert.equal(supplement.results.length,failed.length);assert.equal(experiment.runs.length,rootCount);assert.equal(experiment.sequence,sequence);
for(const result of supplement.results){
  const source=failed.find(row=>row.id===result.sourceResultId);assert(source);
  assert.equal(result.input,source.input);assert.equal(result.attempt,source.attempt);
  assert.notEqual(result.conversationId,source.conversationId);assert.notEqual(result.messages,source.messages);
  assert.equal(result.messages.length,1);assert(!result.actual&&!result.trace);
}
assert.equal(run('evExperimentRecordFor(experiment,supplement)'),first);
assert.equal(run('evExperimentExecutionGet(experiment,supplement.id)'),supplement);
assert(run('evExperimentExecutions(experiment)').includes(supplement));
assert.equal(run('evExperimentActiveExecution(experiment)'),supplement);
assert.throws(()=>run('evRunExperiment(experiment.id,first)'));
run('evPauseExperiment(experiment.id)');assert.equal(supplement.status,'已暂停');
assert.throws(()=>run('evUpdateExperiment(experiment.id,{name:"补跑中不能编辑"})'));
run('evResumeExperiment(experiment.id)');drain();
assert.deepEqual(clone({...first,supplements:[]}),baseline,'a failed supplement leaves the full results, report, state and initial comparison baseline unchanged');
assert.equal(supplement.report.scope.partial,true);assert(!supplement.initialFullResult);
context.caseId=supplement.results[0].caseId;
context.caseSupplement=run('evRunExperiment(experiment.id,supplement,caseId)');
const caseSupplement=context.caseSupplement;
assert.equal(caseSupplement.parentRunId,first.id);assert.equal(caseSupplement.sourceRunId,supplement.id);assert.equal(caseSupplement.supplementSequence,2);
assert(caseSupplement.results.every(result=>result.caseId===context.caseId&&supplement.results.some(source=>source.id===result.sourceResultId)));
drain();assert.deepEqual(clone({...first,supplements:[]}),baseline);
const newest=records.at(-1),newestBefore=clone(newest),configBefore=clone(experiment.snapshot);
run('evUpdateExperiment(experiment.id,{version:"V2"})');
assert.notDeepEqual(clone(experiment.snapshot),configBefore);
context.historical=run('evRunExperiment(experiment.id,first,first.results[0].caseId)');
assert.equal(context.historical.configurationRevision,first.configurationRevision);
assert.deepEqual(clone(context.historical.snapshot),baseline.snapshot);
run('evStopExperiment(experiment.id)');
assert.equal(context.historical.status,'已停止');assert.deepEqual(clone({...first,supplements:[]}),baseline);assert.deepEqual(clone(newest),newestBefore);
assert.equal(experiment.status,'未运行','stopping a historical supplement retains the current configuration status');
run('evUpdateExperiment(experiment.id,{execution:{fullRuns:3,caseRuns:2}})');
context.stoppedFirst=run('evRunExperiment(experiment.id)');
const stoppedGroup=experiment.runs.filter(record=>record.executionGroupId===context.stoppedFirst.executionGroupId);
advance();run('evPauseExperiment(experiment.id)');run('evStopExperiment(experiment.id)');
assert(stoppedGroup.every(record=>record.status==='已停止'));
assert(stoppedGroup.every(record=>!record.results.some(result=>['运行中','待运行'].includes(result.status))));
assert.equal(timers.size,0);assert.equal(run('evExperimentActiveExecution(experiment)'),null);
assert(stoppedGroup.filter(record=>!record.startedAt).length===2);
assert(stoppedGroup.every(record=>!record.initialFullResult),'stopped or unstarted records cannot become comparison baselines');
run('evUpdateExperiment(experiment.id,{name:"停止后可编辑"})');
context.toDelete=run('evRunExperiment(experiment.id)');assert(timers.size);
assert.equal(run('evDeleteExperiment(experiment.id)'),true);assert.equal(timers.size,0);
assert.equal(run('evExperimentGet(experiment.id)'),null);
console.log('PASS canonical execution settings, independent full records and conversations, sequential queue pause/stop, immutable initial full evidence and historical supplements');
