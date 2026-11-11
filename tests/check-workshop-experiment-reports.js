const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('dist/index.html','utf8');
const nodes=new Map(),selectors=new Map(),lists=new Map(),events=new Map(),timers=new Map();
let clockMs=Date.parse('2026-11-01T12:00:00Z'),serial=0;
class TestDate extends Date { constructor(...args){super(...(args.length?args:[clockMs]));} static now(){return clockMs;} }
const node=key=>{
  if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',value:'',hidden:false,disabled:false,dataset:{},style:{},scrollTop:0,scrollHeight:100,isConnected:true,
    focus(){},remove(){},click(){},appendChild(){},setAttribute(){},removeAttribute(){},scrollIntoView(){},closest(){return null;},contains(){return true;},
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
run("currentSection='studio';studio.scene='sales';evData();evExperimentStore()");
run('evData().suites[0].caseIds=[evData().cases[0].id];evEvaluatorStore().evaluators[0].criteria.forEach(item=>item.passScore=100)');
context.fields={name:'自动基础报告',agentId:'sales-agent-1',version:run('evAgentVersions("sales-agent-1")[0].id'),suiteIds:['SAL-ES-001'],evaluatorIds:['SAL-EV-001'],execution:{concurrency:1,caseRuns:2,fullRuns:1,modelId:'mock-eval-balanced',mcpIds:[]}};
context.experiment=run('evCreateExperiment(fields)');context.batch=run('evRunExperiment(experiment.id)');
const experiment=context.experiment,batch=context.batch;
assert(batch.report,'engine start creates a base report without opening its tab');
const reportId=batch.report.id;
assert.equal(batch.report.runId,batch.id);assert.equal(batch.report.state,'preview');assert.equal(batch.report.analyses.length,0);
assert(Object.isFrozen(batch.report.evidence)&&Object.isFrozen(batch.report.evidence.results));
assert.equal(run('evExperimentGenerateReportAnalysis(experiment.id,batch.id)'),false,'an unfinished preview cannot generate an AI analysis');
let reportView=run('evExperimentReportView(experiment,batch)');handlers(reportView);
assert(reportView.includes('基础报告')&&reportView.includes('生成 AI 分析'));assert.equal(batch.report.analyses.length,0,'viewing the report does not invoke AI');
until(()=>batch.results.filter(result=>['通过','未通过','运行失败'].includes(result.status)).length===1);
const previewRevision=batch.report.revision;
run('evPauseExperiment(experiment.id)');
assert.equal(batch.status,'已暂停');assert.equal(batch.report.id,reportId);assert.equal(batch.report.state,'preview');assert.equal(experiment.runs.length,1);
assert.equal(batch.initialFullResult,undefined,'a paused partial execution is not a completed full result');
const pausedEvidence=clone(batch.report.evidence.results);
run('evResumeExperiment(experiment.id)');
assert.equal(batch.report.id,reportId);assert.equal(experiment.runs.length,1,'resume continues the same execution batch and report');
assert.deepEqual(clone(batch.report.evidence.results.filter(result=>['通过','未通过','运行失败'].includes(result.status))),pausedEvidence.filter(result=>['通过','未通过','运行失败'].includes(result.status)));
drain();
assert.equal(batch.status,'部分失败');assert(batch.results.every(result=>result.status==='未通过'),'the fixture has quality failures, not missing executions');
assert.equal(batch.report.state,'complete','quality failures do not make a fully recorded report incomplete');assert.equal(batch.report.id,reportId);
assert(batch.report.revision>=previewRevision);assert.equal(batch.report.scope.kind,'full');assert.equal(batch.report.scope.expectedAttempts,2);
assert.equal(batch.report.coverage.executedAttempts,2);assert.equal(batch.report.coverage.fullBaseline,true);assert.equal(batch.report.analyses.length,0);
assert(batch.initialFullResult,'a completely executed full record retains its first result despite quality failures');
assert(Object.isFrozen(batch.initialFullResult)&&Object.isFrozen(batch.initialFullResult.results[0])&&Object.isFrozen(batch.initialFullResult.report.evidence));
assert.deepEqual(clone(batch.initialFullResult.results),clone(batch.report.evidence.results));
const initialFullResult=clone(batch.initialFullResult);
const finalRevision=batch.report.revision,finalSignature=batch.report.signature,evidenceBefore=clone(batch.report.evidence);
for(let i=0;i<3;i++)run('evExperimentReportSync(experiment,batch);evExperimentReportView(experiment,batch)');
assert.equal(batch.report.revision,finalRevision);assert.equal(batch.report.signature,finalSignature);assert.deepEqual(clone(batch.report.evidence),evidenceBefore);
context.firstAnalysis=run('evExperimentGenerateReportAnalysis(experiment.id,batch.id)');
assert.equal(context.firstAnalysis.kind,'mock');assert.equal(context.firstAnalysis.reportId,reportId);assert.equal(context.firstAnalysis.evidenceSignature,finalSignature);
assert.equal(context.firstAnalysis.version,1);assert.equal(batch.report.analyses.length,1);assert(Object.isFrozen(context.firstAnalysis));
assert(context.firstAnalysis.findings.some(finding=>finding.references.some(reference=>batch.report.evidence.results.some(result=>result.id===reference.resultId))));
const firstAnalysis=clone(context.firstAnalysis);
context.secondAnalysis=run('evExperimentGenerateReportAnalysis(experiment.id,batch.id)');
assert.equal(context.secondAnalysis.version,2);assert.equal(batch.report.selectedAnalysisVersion,2);assert.deepEqual(clone(batch.report.analyses[0]),firstAnalysis);
assert.equal(run('evExperimentSelectReportAnalysis(experiment.id,batch.id,1)'),true);assert.equal(batch.report.selectedAnalysisVersion,1);
assert.deepEqual(clone(batch.report.evidence),evidenceBefore,'manual AI versions never rewrite the base evidence');
assert.deepEqual(clone(batch.initialFullResult),initialFullResult,'manual AI versions preserve the original complete snapshot');

// Human triage changes only the experiment ledger, never a finalized batch report.
const reportBeforeTriage=clone(batch.report);
run('evExperimentIssueAnalyzeComplete(experiment,batch);evExperimentOpen(experiment.id,batch.id,"问题优化")');context.ledgerIssue=run('evExperimentIssueLedgerSync(experiment)[0]');
context.issueForm={values:{scene:'sales',status:'已关闭',owner:'复验人',note:'人工处理记录与执行证据分开'}};
assert.equal(run('evSaveExperimentIssue(issueForm,experiment.id,"all",ledgerIssue.id)'),true);
assert.equal(context.ledgerIssue.status,'已关闭');assert(batch.issues.every(issue=>issue.status==='待修复'));
run('evExperimentReportSync(experiment,batch)');assert.deepEqual(clone(batch.report),reportBeforeTriage,'manual ledger handling does not revise reports or AI versions');

// A new configuration, catalog edits, and later batches do not rewrite finalized report facts.
run('evData().cases[0].input="后来修改的输入";evEvaluatorStore().evaluators[0].criteria[0].description="后来修改的评分标准";evUpdateExperiment(experiment.id,{name:"后续配置",version:"V2"})');
assert.notEqual(experiment.configurationRevision,batch.report.sourceVersion);run('evExperimentReportSync(experiment,batch)');
assert.deepEqual(clone(batch.report.evidence),evidenceBefore);assert.equal(batch.report.signature,finalSignature);
const completeReportBefore=clone(batch.report);
run('evData().suites[0].caseIds=[evData().cases[0].id,evData().cases[1].id]');
context.caseExperiment=run('evCreateExperiment({...fields,name:"局部重跑范围"})');context.fullBatch=run('evRunExperiment(caseExperiment.id)');drain();
const fullBatch=context.fullBatch;assert.equal(fullBatch.report.state,'complete');assert.equal(fullBatch.report.coverage.baselineCases,2);
const fullReportBeforeSupplements=clone(fullBatch.report),fullResultsBeforeSupplements=clone(fullBatch.results),fullInitialBeforeSupplements=clone(fullBatch.initialFullResult);
context.caseId=fullBatch.snapshot.cases[0].id;
context.caseBatch=run('evRunExperiment(caseExperiment.id,fullBatch,caseId)');
assert(context.caseBatch.report);assert.equal(context.caseBatch.report.scope.kind,'case');assert.equal(context.caseBatch.report.scope.partial,true);
assert.equal(context.caseBatch.report.scope.sourceRunId,fullBatch.id);assert.equal(context.caseBatch.report.scope.caseId,context.caseId);drain();
assert.equal(context.caseBatch.report.state,'complete');assert.equal(context.caseBatch.report.coverage.executedCases,1);assert.equal(context.caseBatch.report.coverage.baselineCases,2);assert.equal(context.caseBatch.report.coverage.fullBaseline,false);
reportView=run('evExperimentReportView(caseExperiment,caseBatch)');handlers(reportView);
assert(reportView.includes('局部结果不代表全量结论'));assert.equal(context.caseBatch.report.analyses.length,0);
const caseEvidence=clone(context.caseBatch.report.evidence);context.caseAnalysis=run('evExperimentGenerateReportAnalysis(caseExperiment.id,caseBatch.id)');
assert(context.caseAnalysis.recommendations.some(item=>item.includes('局部补跑')));assert.deepEqual(clone(context.caseBatch.report.evidence),caseEvidence);
assert.equal(fullBatch.report.analyses.length,0,'AI analysis belongs only to the explicitly selected batch report');
context.failedBatch=run('evRunExperiment(caseExperiment.id,fullBatch)');drain();
assert.notEqual(context.failedBatch.id,fullBatch.id);assert.equal(context.failedBatch.parentRunId,fullBatch.id);assert.equal(context.failedBatch.report.scope.kind,'failed');assert.equal(context.failedBatch.report.scope.partial,true);assert.equal(fullBatch.supplements.length,2);assert.equal(context.caseExperiment.runs.length,1);assert(Object.isFrozen(fullBatch.initialFullResult.report.evidence));
assert.deepEqual(clone(fullBatch.report),fullReportBeforeSupplements,'supplements retain the original complete report and analyses');
assert.deepEqual(clone(fullBatch.results),fullResultsBeforeSupplements);assert.deepEqual(clone(fullBatch.initialFullResult),fullInitialBeforeSupplements);
assert.equal(context.caseBatch.initialFullResult,undefined);assert.equal(context.failedBatch.initialFullResult,undefined);
assert.equal(run('evExperimentReportEvidence(caseExperiment.id,caseBatch.id,caseBatch.report.evidence.results[0].id)'),true,'supplement report evidence resolves through its child execution ID');
const exported=run('evExperimentExportReport(caseExperiment.id,caseBatch.id)');
assert(exported.filename.includes('评测记录1-补跑1'));assert(exported.content.includes('评测记录 #1 · 补跑 #1'));assert(!/on(?:click|change)=/.test(exported.content),'standalone export has no interactive handlers');
assert.notEqual(context.failedBatch.report.id,context.caseBatch.report.id);assert.deepEqual(clone(batch.report),completeReportBefore,'other experiments and reruns cannot change this report or AI versions');
context.stoppedBatch=run('evRunExperiment(caseExperiment.id)');run('evStopExperiment(caseExperiment.id)');
assert.equal(context.stoppedBatch.report.state,'incomplete');assert.equal(context.stoppedBatch.report.analyses.length,0);assert(context.stoppedBatch.report.coverage.executedAttempts<context.stoppedBatch.report.coverage.expectedAttempts);
assert.equal(context.stoppedBatch.initialFullResult,undefined,'stopped incomplete execution cannot become a comparison baseline');

// A repeated whole set creates independent complete full records; fullRuns is not an inner result multiplier.
context.repeatedExperiment=run('evCreateExperiment({...fields,name:"全量记录独立报告",execution:{...fields.execution,caseRuns:2,fullRuns:2}})');
run('evRunExperiment(repeatedExperiment.id)');drain();
assert.equal(context.repeatedExperiment.runs.length,2);
for(const record of context.repeatedExperiment.runs){assert.equal(record.results.length,4);assert.equal(record.report.scope.expectedAttempts,4);assert.equal(record.report.state,'complete');assert(record.initialFullResult);}
assert.notEqual(context.repeatedExperiment.runs[0].report.id,context.repeatedExperiment.runs[1].report.id);

// Even a changed mutable row/triage record cannot replace a finalized report's pinned evidence.
batch.results[0].actual='后来变化的可变原始字段';if(batch.issues?.length)batch.issues[0].status='已关闭';
run('evExperimentReportSync(experiment,batch)');assert.deepEqual(clone(batch.report.evidence),evidenceBefore);
assert.equal(run('evExperimentReportEvidence(experiment.id,batch.id,batch.report.evidence.results[0].id)'),true);
assert(node('overlay').innerHTML.includes(evidenceBefore.results[0].actual));assert(!node('overlay').innerHTML.includes('后来变化的可变原始字段'));
const beforeForeign=clone(batch.report);run('studio.scene="procurement";evData()');
assert.equal(run('evExperimentGenerateReportAnalysis(experiment.id,batch.id)'),false);assert.deepEqual(clone(batch.report),beforeForeign);
console.log('PASS automatic per-batch base reports; preview/pause/resume identity, complete quality failures, pinned evidence/scope, local reruns and explicit versioned AI analysis isolation');
