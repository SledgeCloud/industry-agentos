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
const modules=['workshop-evaluation-seed.js','workshop-evaluation.js','workshop-evaluation-versions.js','workshop-evaluation-dashboard.js','workshop-evaluation-tasks.js','workshop-evaluation-assets.js','workshop-evaluation-evaluators.js','workshop-evaluation-experiment-engine.js','workshop-evaluation-reports.js','workshop-evaluation-experiments.js','workshop-evaluation-issues.js','workshop-evaluation-copilot.js','workshop-evaluation-optimization.js'];
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
run("currentSection='studio';studio.scene='sales';evData();evExperimentStore()");
context.experiment=run('evExperimentStore().experiments[0]');
context.batch=context.experiment.runs[0];
const experiment=context.experiment,batch=context.batch;
run('evExperimentOpen(experiment.id,batch.id)');
const header=()=>run('evExperimentHeaderControls(experiment)');
assert(header().includes('重新执行')&&header().includes('失败用例')&&header().includes('全量')&&header().includes('结果分析'));assert(!header().includes('>编辑</button>'));
run('evExperimentSelectTab("实验配置")');assert(header().includes('>编辑</button>'));assert(!header().includes('重新执行')&&!header().includes('>导出</button>'));
run('evExperimentSelectTab("实验报告")');assert(header().includes('>导出</button>'));assert(!header().includes('>编辑</button>')&&!header().includes('重新执行'));
run('evExperimentSelectTab("问题优化")');assert(header().includes('问题修复')&&header().includes('evExperimentIssueRepairAll('));
run('evExperimentSelectTab("用例结果")');
assert.equal(run('evExperimentIssueLedgerSync(experiment).length'),0,'completed evaluation does not create issues before result analysis');
run('evExperimentIssueAnalyzeComplete(experiment,batch)');context.beforeLedger=run('evExperimentIssueLedgerSync(experiment)');assert(context.beforeLedger.length>0);
context.analysis=run('evExperimentGenerateReportAnalysis(experiment.id,batch.id)');
// Runtime transcripts belong to their original execution. A retry must wait
// for new output rather than display copied messages or trace spans.
const runtimeEvidence={messages:[{role:'assistant',content:'上一执行的消息'}],conversation:[{input:'旧输入',output:'旧输出'}],turns:[{output:'旧轮次输出'}],trace:{spans:[{name:'旧工具调用'}]}};
for(const result of batch.results.filter(item=>['未通过','运行失败'].includes(item.status)))Object.assign(result,clone(runtimeEvidence));
const oldReport=clone(batch.report),oldResults=clone(batch.results),runCount=experiment.runs.length,sequence=experiment.sequence;
const passedRows=batch.results.filter(item=>item.status==='通过');
const baseline=JSON.stringify(batch.initialFullResult);
// Exercise successful supplementary verification independently of the demo's preset outcome order.
run('globalThis.originalOutcome=evExperimentOutcome;evExperimentOutcome=()=>"通过"');
context.retried=run('evExperimentRetry(experiment.id,batch.id)');const supplement=context.retried;
assert.notEqual(supplement,batch);assert.equal(supplement.kind,'supplement');assert.equal(supplement.parentRunId,batch.id);assert.equal(experiment.runs.length,runCount);assert.equal(experiment.sequence,sequence);assert.equal(supplement.sequence,batch.sequence);
assert.equal(supplement.supplementSequence,1);assert.equal(batch.supplements.length,1);assert.equal(batch.supplements[0],supplement);
assert.deepEqual(clone(batch.report),oldReport);assert.deepEqual(clone(batch.results),oldResults);assert.equal(JSON.stringify(batch.initialFullResult),baseline);
assert(passedRows.every(row=>batch.results.includes(row)),'passed full-result rows remain intact');
assert.equal(supplement.results.length,oldResults.filter(row=>['未通过','运行失败'].includes(row.status)).length);
for(const attempt of supplement.results){assert(attempt.sourceResultId&&attempt.conversationId);assert.equal(attempt.messages.length,1);assert.equal(attempt.messages[0].role,'user');assert.equal(attempt.messages[0].content,attempt.input);for(const key of ['conversation','turns','trace'])assert(!Object.hasOwn(attempt,key),'fresh supplementary retries discard old '+key);}
for(const original of batch.results.filter(row=>['未通过','运行失败'].includes(row.status)))for(const key of Object.keys(runtimeEvidence))assert.deepEqual(clone(original[key]),runtimeEvidence[key],'original evidence retains '+key);
assert(header().includes('>暂停</button>')&&!header().includes('>编辑</button>'));
run('evPauseExperiment(experiment.id)');assert(header().includes('继续执行'));assert.equal(experiment.runs.length,runCount);
run('evResumeExperiment(experiment.id)');drain();run('evExperimentOutcome=originalOutcome');
assert(['已完成','部分失败'].includes(supplement.status));assert.notEqual(supplement.report.id,oldReport.id);assert.equal(supplement.report.analyses.length,0);
assert.equal(supplement.report.scope.kind,'failed');assert(!supplement.report.coverage.fullBaseline);assert.equal(supplement.report.evidence.results.length,supplement.results.length);
assert.deepEqual(clone(batch.report),oldReport,'original report and its AI analysis stay pinned');assert.deepEqual(clone(batch.results),oldResults);assert.equal(JSON.stringify(batch.initialFullResult),baseline);
context.ledger=run('evExperimentIssueLedgerSync(experiment)');assert(!context.ledger.some(issue=>issue.verifications.some(verification=>verification.runId===supplement.id)),'execution alone does not import validation coverage');run('evExperimentIssueAnalyzeComplete(experiment,retried)');context.ledger=run('evExperimentIssueLedgerSync(experiment)');
assert(!context.ledger.some(issue=>issue.verifications.some(verification=>verification.runId===supplement.id)),'case supplements never become problem validation records, including after analysis');
const oldFailure=oldResults.find(row=>row.status==='未通过');context.oldResultId=oldFailure.id;
assert.deepEqual(clone(run('evExperimentIssueResult(batch,oldResultId)')),oldFailure,'issue evidence can still find the original full-result attempt');
assert.equal(run('evExperimentIssueOpenEvidence(experiment.id,batch.id,oldResultId)'),true);
assert.equal(run('evExperimentReportEvidence(experiment.id,batch.id,oldResultId)'),true);assert(node('overlay').innerHTML.includes(oldFailure.actual),'an archived AI analysis reference opens its pinned original evidence');
const beforeReject=clone(experiment);assert.equal(run('evExperimentRetry(experiment.id,retried.id)'),false);assert.deepEqual(clone(experiment),beforeReject,'a completed supplement with no failed rows rejects another failed-case supplement atomically');assert.equal(run('evExperimentRetry(experiment.id,"missing-record")'),false);assert.deepEqual(clone(experiment),beforeReject,'retry with an invalid source rejects atomically');
context.next=run('evExperimentStart(experiment.id)');assert.notEqual(context.next.id,batch.id);assert.equal(context.next.sequence,sequence+1);assert.equal(experiment.runs.length,runCount+1);drain();
assert.deepEqual(clone(batch.report),oldReport);
// A selected historical batch can retry its failures with its own resources,
// while the current experiment configuration and newer batches stay intact.
context.historical=context.next;const historicalSnapshot=clone(context.historical.snapshot),historicalId=context.historical.id;
run('evUpdateExperiment(experiment.id,{version:"V2"})');const currentSnapshot=clone(experiment.snapshot),currentRevision=experiment.configurationRevision;
context.newer=run('evRunExperiment(experiment.id)');drain();run('evExperimentIssueAnalyzeComplete(experiment,newer)');const newerBefore=clone(context.newer),countBeforeHistory=experiment.runs.length;
run('evExperimentOpen(experiment.id,newer.id)');context.closedRuntime=run('evExperimentIssueLedgerSync(experiment).find(issue=>issue.type==="运行异常"&&issue.caseId===newer.results[0].caseId)');assert(context.closedRuntime);
context.closeForm={values:{scene:'sales',status:'已关闭',owner:'复核人',note:'等待后续实际证据'}};
assert.equal(run('evSaveExperimentIssue(closeForm,experiment.id,"all",closedRuntime.id)'),true);assert.equal(context.closedRuntime.status,'已关闭');
run('evExperimentOpen(experiment.id,historical.id)');context.historicalRetry=run('evExperimentRetry(experiment.id,historical.id)');
assert.notEqual(context.historicalRetry.id,historicalId);assert.equal(context.historicalRetry.parentRunId,historicalId);assert.equal(context.historicalRetry.kind,'supplement');assert.equal(experiment.runs.length,countBeforeHistory);assert.equal(experiment.configurationRevision,currentRevision);assert.deepEqual(clone(experiment.snapshot),currentSnapshot);assert.deepEqual(clone(context.historical.snapshot),historicalSnapshot);assert.deepEqual(clone(context.newer),newerBefore);
assert(run('evExperimentListTable([experiment])').includes('执行中'),'historical retries expose their active execution in the experiment list');drain();
assert.deepEqual(clone(context.newer),newerBefore);assert.deepEqual(clone(experiment.snapshot),currentSnapshot);run('evExperimentIssueLedgerSync(experiment)');assert.equal(context.closedRuntime.status,'已关闭','supplement execution alone does not reopen an issue');run('evExperimentIssueAnalyzeComplete(experiment,historicalRetry)');run('evExperimentIssueLedgerSync(experiment)');assert.equal(context.closedRuntime.status,'待修复','a later retry in an older batch reopens a previously closed matching issue');
run('evExperimentSelectTab("实验报告")');handlers(header());
let exportedBlob,downloaded=false;
context.URL={createObjectURL(blob){exportedBlob=blob;return 'blob:test-report';},revokeObjectURL(){}};
node('body').appendChild=()=>{};node('created-a').click=()=>{downloaded=true;};
context.exported=run('evExperimentExportReport(experiment.id,batch.id)');
assert(downloaded&&exportedBlob instanceof Blob);assert(context.exported.filename.endsWith('实验报告.html'));
assert(context.exported.content.includes('<!doctype html>')&&context.exported.content.includes('补跑记录'));assert(!/\son[a-z]+="/.test(context.exported.content));assert(context.exported.content.includes(batch.report.id));
run('evExperimentOpen(evExperimentStore().experiments[2].id)');assert(header().includes('重新执行'),'calling a view helper for the previous experiment remains safe');
context.fresh=run('evExperimentCurrent()');assert(run('evExperimentHeaderControls(fresh)').includes('>执行</button>'));assert(/disabled[^>]*>[^<]*结果分析|disabled/.test(run('evExperimentHeaderControls(fresh)')),'analysis is unavailable before any completed full evaluation');run('evExperimentSelectTab("实验报告")');assert(/disabled/.test(run('evExperimentHeaderControls(fresh)')));
console.log('PASS tab-specific experiment functions, attached supplementary failed retries, preserved reports and issue evidence, independent full evaluation records, and standalone report export');
