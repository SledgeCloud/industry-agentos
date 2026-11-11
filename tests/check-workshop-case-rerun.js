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
const handlers=markup=>{
  for(const match of markup.matchAll(/(?:onclick|onchange|onsubmit|oninput|onkeydown)="([^"]*)"/g)){
    const code=match[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    assert.doesNotThrow(()=>new Function('event',code),code);
  }
};
const primaryExperimentCount=markup=>{
  const nav=markup.match(/<nav\b[^>]*aria-label="评测页签"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||'';
  return Number(nav.match(/>评测实验\s*<span\b[^>]*>(\d+)<\/span>/)?.[1]??NaN);
};
const detailTabNames=markup=>[...markup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(m=>m[1].replace(/<span\b[^>]*>[\s\S]*?<\/span>/g,'').replace(/<[^>]*>/g,'').trim());
const resultRows=markup=>[...(markup.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1]||'').matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m=>m[1]).filter(row=>row.includes('evExperimentCaseDetail('));
const resultIds=markup=>resultRows(markup).map(row=>row.match(/evExperimentCaseDetail\('([^']+)'\)/)?.[1]);


const clone=value=>JSON.parse(JSON.stringify(value));
const decode=value=>value.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const rowRecords=markup=>[...(markup.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1]||'').matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g)].map(match=>({attributes:match[1],html:match[2],cells:[...match[2].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(cell=>cell[1])}));
const buttonTag=(markup,label)=>[...markup.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find(match=>match[2].replace(/<[^>]*>/g,'').trim()===label)?.[0]||'';
const directMarkup=markup=>markup.replace(/<details\b[\s\S]*?<\/details>/g,'');
const engineRetry=()=>run('evRunExperiment(experiment.id,sourceRun,caseId)');
run("currentSection='studio';studio.scene='sales';evData();evExperimentStore()");
context.fields={name:'单用例重跑隔离',agentId:'sales-agent-1',version:run('evAgentVersions("sales-agent-1")[0].id'),suiteIds:['SAL-ES-001','SAL-ES-002'],evaluatorIds:run('evEvaluatorDefaultIds()'),execution:{concurrency:2,caseRuns:2,fullRuns:2,modelId:'mock-eval-balanced',mcpIds:[]}};
context.experiment=run('evCreateExperiment(fields)');
const experiment=context.experiment;
let header=run('evExperimentHeaderControls(experiment)');handlers(header);
assert(!buttonTag(directMarkup(header),'编辑'),'case results expose execution controls');run('evExperimentState.tab="实验配置"');assert(buttonTag(run('evExperimentHeaderControls(experiment)'),'编辑'));run('evExperimentState.tab="用例结果"');
assert(!header.includes('ev-more')&&!header.includes('全量重跑')&&!header.includes('失败用例重跑'));
assert(buttonTag(directMarkup(header),'执行'));
run('evExperimentOpen(experiment.id)');
const preview=run('evExperimentResultTable(experiment,null)');handlers(preview);
for(const row of rowRecords(preview).filter(row=>!row.attributes.includes('ev-attempt-row'))){
  const cell=row.cells.at(-1),retry=buttonTag(cell,'补跑');
  assert(buttonTag(directMarkup(cell),'查看结果详情')&&!buttonTag(directMarkup(cell),'补跑'),'unrun rows expose result details while rerun remains in More');
  assert(retry&&/\bdisabled\b/.test(retry)&&/\btitle=/.test(retry),'an unexecuted case explains why rerun is unavailable');
  assert(cell.includes('ev-more'),'each case owns its More menu');
}
context.sourceRun=run('evRunExperiment(experiment.id)');drain();
const sourceRun=context.sourceRun;
assert(['已完成','部分失败'].includes(sourceRun.status));
context.caseId=sourceRun.snapshot.cases.find(record=>record.enabled!==false).id;
const sourceCase=sourceRun.snapshot.cases.find(record=>record.id===context.caseId);
const sourceAttempts=sourceRun.results.filter(result=>result.caseId===context.caseId&&['通过','未通过','运行失败'].includes(result.status));
assert.equal(sourceAttempts.length,2,'the fixture exercises all independent attempts of one case within the selected full record');
assert(sourceAttempts.every(result=>result.status==='通过'),'a successfully executed case can also be rerun');
run('evExperimentOpen(experiment.id,sourceRun.id)');
let table=run('evExperimentResultTable(experiment,sourceRun)');handlers(table);
const topRows=rowRecords(table).filter(row=>!row.attributes.includes('ev-attempt-row'));
assert.equal(topRows.length,new Set(sourceRun.results.map(result=>result.caseId)).size);
for(const row of topRows){
  const caseId=row.cells[0].replace(/<[^>]*>/g,'').trim(),cell=row.cells.at(-1),retry=buttonTag(cell,'补跑');
  assert(retry&&cell.includes('ev-more'),'case rows have rerun in their own More menu');assert(buttonTag(directMarkup(cell),'查看结果详情'),'result details are the direct case action');assert(!buttonTag(directMarkup(cell),'补跑'),'rerun stays inside More');
  if(!/\bdisabled\b/.test(retry))assert(/evExperimentRetryCase\(/.test(decode(retry))&&cell.includes(sourceRun.id),'eligible row actions retain the selected source run');
  const snapshotCase=sourceRun.snapshot.cases.find(record=>record.id===caseId);
  assert.equal(/\bdisabled\b/.test(retry),snapshotCase.enabled===false,'only enabled, previously executed cases are eligible');
}
context.groupKey=sourceRun.id+':'+context.caseId;
run('evExperimentToggleAttempts(groupKey)');table=run('evExperimentResultTable(experiment,sourceRun)');handlers(table);
const attemptRows=rowRecords(table).filter(row=>row.attributes.includes('ev-attempt-row'));
assert.equal(attemptRows.length,sourceAttempts.length);
for(const row of attemptRows){assert(buttonTag(row.cells.at(-1),'查看结果详情'));assert(!buttonTag(row.cells.at(-1),'补跑'),'expanded execution evidence does not repeat the case-level rerun action');}
header=run('evExperimentHeaderControls(experiment)');
assert(!buttonTag(directMarkup(header),'编辑'));assert(header.includes('重新执行')&&header.includes('失败用例')&&header.includes('全量'));

// Invalid selections reject before consuming a sequence number or appending a run.
const assertAtomicReject=code=>{const before=clone(experiment);assert.throws(()=>run(code));assert.deepEqual(clone(experiment),before);};
const disabledCase=sourceRun.snapshot.cases.find(record=>record.enabled===false);assert(disabledCase);
assertAtomicReject('evRunExperiment(experiment.id,sourceRun,"missing-case")');
context.disabledCaseId=disabledCase.id;assertAtomicReject('evRunExperiment(experiment.id,sourceRun,disabledCaseId)');
context.nonterminalSource={...clone(sourceRun),id:sourceRun.id+'-NONTERMINAL',status:'未运行'};
experiment.runs.push(context.nonterminalSource);assertAtomicReject('evRunExperiment(experiment.id,nonterminalSource,caseId)');experiment.runs.pop();
context.emptySource={...clone(sourceRun),id:sourceRun.id+'-EMPTY',results:sourceRun.results.map(result=>({...clone(result),status:'已跳过'}))};
experiment.runs.push(context.emptySource);assertAtomicReject('evRunExperiment(experiment.id,emptySource,caseId)');experiment.runs.pop();
for(const invalidCaseId of ['', '   ', null, undefined]){
  context.invalidCaseId=invalidCaseId;const before=clone(experiment);
  assert.equal(run('evExperimentRetryCase(experiment.id,sourceRun.id,invalidCaseId)'),false,'a case-specific UI action cannot fall back to whole-run retry when its case ID is missing');
  assert.deepEqual(clone(experiment),before);
}
const runtimeEvidence={messages:[{role:'assistant',content:'上次消息'}],conversation:[{input:'上次输入',output:'上次回答'}],turns:[{output:'上次轮次输出'}],trace:{spans:[{name:'上次调用'}]}};
sourceAttempts.forEach(result=>{result.timingEstimated=true;Object.assign(result,clone(runtimeEvidence));});
const oldReport=run('evExperimentReport(experiment,sourceRun)'),oldIssues=clone(run('evExperimentIssuesSync(experiment,sourceRun)')),sourceBefore=clone({...sourceRun,supplements:[]});

// Editing live catalogs and the next experiment config must not change the rerun's source snapshot.
run('evUpdateExperiment(experiment.id,{name:"下一配置",suiteIds:["SAL-ES-002"],execution:{concurrency:1,caseRuns:1,fullRuns:1,modelId:"mock-eval-fast",mcpIds:[]}})');
run('const changedCase=evData().cases.find(item=>item.id===caseId);changedCase.input="后续修改的输入";changedCase.expected="后续预期";changedCase.enabled=false;changedCase.archived=true;evEvaluatorStore().evaluators[0].criteria[0].description="后续评分标准"');
const currentSnapshot=clone(experiment.snapshot),revision=experiment.configurationRevision;
assert(!currentSnapshot.cases.some(record=>record.id===context.caseId),'current config no longer contains the historical selected case');
context.retry=run('evExperimentRetryCase(experiment.id,sourceRun.id,caseId)');
const retry=context.retry;assert(retry&&retry.id!==sourceRun.id);assert.equal(retry.retryOf,sourceRun.id);assert.equal(retry.retryCaseId,context.caseId);
assert.equal(retry.configurationRevision,sourceRun.configurationRevision);assert.notEqual(retry.configurationRevision,revision);
assert.deepEqual(clone(retry.snapshot),clone(sourceRun.snapshot));assert(Object.isFrozen(retry.snapshot)&&Object.isFrozen(retry.snapshot.cases));
assert.deepEqual(clone(experiment.snapshot),currentSnapshot,'starting a historical case rerun leaves the current configuration intact');
assert.equal(retry.results.length,sourceAttempts.length);assert(retry.results.every(result=>result.caseId===context.caseId));
assert.deepEqual(retry.results.map(result=>result.attempt),sourceAttempts.map(result=>result.attempt));assert(retry.results.every(result=>!Object.hasOwn(result,'round')&&result.sourceResultId&&result.conversationId&&!sourceAttempts.some(old=>old.conversationId===result.conversationId)));
assert.equal(retry.kind,'supplement');assert.equal(retry.parentRunId,sourceRun.id);assert(sourceRun.supplements.includes(retry));
assert.equal(new Set(retry.results.map(result=>result.id)).size,retry.results.length);assert(retry.results.every(result=>!sourceRun.results.some(old=>old.id===result.id)));
assert(retry.results.every(result=>result.input===sourceCase.input&&result.expected===sourceCase.expected&&result.actual===''&&!result.evaluations.length&&!result.dimensions.length&&result.durationMs===0&&result.tokens===0));
assert(retry.results.every(result=>!Object.hasOwn(result,'timingEstimated')),'new attempts do not inherit estimated legacy timing flags');
for(const attempt of retry.results){assert.equal(attempt.messages.length,1);assert.equal(attempt.messages[0].role,'user');assert.equal(attempt.messages[0].content,sourceCase.input);for(const key of ['conversation','turns','trace'])assert(!Object.hasOwn(attempt,key),'new case retries discard previous '+key);}
for(const original of sourceAttempts)for(const key of Object.keys(runtimeEvidence))assert.deepEqual(clone(original[key]),runtimeEvidence[key],'the original case execution retains '+key);
assert.equal(run('evExperimentState.runId'),sourceRun.id);assert.equal(run('evExperimentState.supplementId'),retry.id);assert.equal(run('evExperimentState.tab'),'用例结果');
assert.deepEqual(clone({...sourceRun,supplements:[]}),sourceBefore);

// Active/paused work blocks another rerun, and completed evidence remains byte-for-byte stable.
assertAtomicReject('evRunExperiment(experiment.id,sourceRun,caseId)');
let activeCell=run('evExperimentCaseActions(experiment,sourceRun,sourceRun.results.find(result=>result.caseId===caseId))');
assert(/\bdisabled\b/.test(buttonTag(activeCell,'补跑')));
header=run('evExperimentHeaderControls(experiment)');assert(!buttonTag(directMarkup(header),'编辑'));assert(buttonTag(directMarkup(header),'暂停'));run('evExperimentState.tab="实验配置"');assert(/\bdisabled\b/.test(buttonTag(run('evExperimentHeaderControls(experiment)'),'编辑')));run('evExperimentState.tab="用例结果"');
run('evPauseExperiment(experiment.id)');assert.equal(retry.status,'已暂停');
assertAtomicReject('evRunExperiment(experiment.id,sourceRun,caseId)');assert.equal(run('evRunExperiment(experiment.id).id'),retry.id);
header=run('evExperimentHeaderControls(experiment)');assert(buttonTag(directMarkup(header),'继续执行'));assert(!header.includes('ev-more'));
run('evResumeExperiment(experiment.id)');drain();
assert(['已完成','部分失败'].includes(retry.status));assert.deepEqual(clone({...sourceRun,supplements:[]}),sourceBefore);
const reportEvidence=markup=>markup.replace(/历史运行 · /g,'');
assert.deepEqual(clone(sourceRun.issues),oldIssues);assert.deepEqual(clone(sourceRun.report),sourceBefore.report,'the source report stays unchanged when a supplementary report is created');const sourceReport=reportEvidence(run('evExperimentReport(experiment,sourceRun)'));assert.equal(sourceReport,reportEvidence(oldReport),'the original full report is byte-for-byte stable after supplementary execution');
assert.deepEqual(clone(experiment.snapshot),currentSnapshot);
const retryReport=run('evExperimentReport(experiment,retry)');handlers(retryReport);
assert(/单用例|指定用例/.test(retryReport));assert(!retryReport.includes('本次失败用例补跑的执行条目数'));
run('studio.scene="procurement";evData()');
const beforeForeign=clone(experiment);assert.equal(run('evExperimentRetryCase(experiment.id,sourceRun.id,caseId)'),false);assert.deepEqual(clone(experiment),beforeForeign,'a foreign-scene UI action cannot append a run');
console.log('PASS fixed experiment edit; per-case result details and More/rerun eligibility; exact case attempts, immutable source snapshots, atomic guards, active/pause exclusivity and historical report/issue isolation');
