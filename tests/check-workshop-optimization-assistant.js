const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const shared=['workshop-evaluation-seed.js','workshop-evaluation.js','workshop-evaluation-versions.js','workshop-evaluation-dashboard.js','workshop-evaluation-tasks.js','workshop-evaluation-assets.js','workshop-evaluation-evaluators.js','workshop-evaluation-experiment-engine.js','workshop-evaluation-reports.js','workshop-evaluation-experiments.js','workshop-evaluation-issues.js','workshop-evaluation-copilot.js','workshop-evaluation-optimization.js'];
function boot(native){
 const nodes=new Map(),timers=new Map();let now=Date.parse('2026-11-07T02:00:00Z'),serial=0;
 function node(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:'',dataset:{},isConnected:true,scrollTop:0,scrollHeight:100,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},focus(){},remove(){},click(){},setAttribute(){},removeAttribute(){},contains(){return false;},querySelector(){return null;},querySelectorAll(){return [];},getBoundingClientRect(){return {left:256,top:60,right:1440,bottom:1000,width:1184,height:940};}});return nodes.get(id);}
 class ClockDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const context={console,JSON,URL,URLSearchParams,Blob,Date:ClockDate,innerWidth:1440,innerHeight:1000,
  setTimeout(fn,delay=0){const id=++serial;timers.set(id,{id,fn,at:now+Number(delay)});return id;},clearTimeout(id){timers.delete(id);},addEventListener(){},
  document:{body:node('body'),activeElement:node('active'),getElementById:node,querySelector(){return null;},querySelectorAll(){return [];},createElement:node,addEventListener(){}},
  AIOpsResources:{sceneId:()=> 'all',scopeCatalog:()=>[{id:'sales'},{id:'procurement'}]},AIOpsWorkspaces:{registerEvaluationScenes(){}},AIOpsApp:{page:()=> '评测实验',refresh(){},navigate(){}}};
 context.window=context;vm.createContext(context);
 for(const file of ['aiops/evaluation-foundation.js',...shared,...(native?['aiops/evaluation.js','aiops/evaluation-details.js']:[])])vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),context,{filename:file});
 const run=source=>vm.runInContext(source,context);
 const drain=()=>{let count=0;while(timers.size){assert(++count<20000,'conversation and execution timers finish');const timer=[...timers.values()].sort((a,b)=>a.at-b.at||a.id-b.id)[0];timers.delete(timer.id);now=timer.at;timer.fn();}};
 return {context,run,drain,node,timers};
}
for(const native of [false,true]){
 const h=boot(native),{context,run,drain,node,timers}=h,label=native?'native':'workshop';
 run("currentSection='studio';wtState.open=true;evState.tab='评测实验';studio.scene='sales';evData();evExperimentStore()");
 if(native)run('AIOpsEvaluation.page("评测实验")');
 context.experiment=run('evExperimentStore().experiments[0]');context.record=context.experiment.runs[0];
 run('evExperimentOpen(experiment.id,record.id)');
 const beforeResults=JSON.stringify(context.record.results),beforeInitial=JSON.stringify(context.record.initialFullResult);
 assert.equal(run('evExperimentIssueLedgerSync(experiment).length'),0,label+' execution alone does not create issues');
 context.manualResult=context.record.results.find(result=>result.actual);context.manualContext={current:context.experiment,run:context.record,result:context.manualResult};context.annotation={problemType:'其他',note:'人工指出的独立问题',targetType:'output',turn:1};run('evExperimentIssueFromAnnotation(manualContext,annotation,"output:1")');assert.equal(run('evExperimentIssueLedgerSync(experiment).length'),1,'manual annotations become issues independently of AI analysis');
 context.analysis=run('evExperimentAnalyze(experiment.id)');assert(context.analysis);assert.equal(context.analysis.phase,'running');
 assert.equal(run('evExperimentIssueLedgerSync(experiment).length'),1,'AI issues wait for completion while manual annotations remain visible');
 const chat=run('evExperimentAssistantChat()');assert(chat.includes('正在分析评测结果')&&chat.includes('评测记录 #'),'analysis automatically sends the record-specific prompt');
 assert(chat.includes(context.experiment.name));
 if(native){const page=run('AIOpsEvaluation.page("评测实验")');assert(page.includes('aev-optimization-assistant')&&page.includes('aria-label="评测助手"'),'native renders the assistant in its right rail');}
 else assert(run('studioChat()').includes('正在分析评测结果'),'workshop renders analysis in its existing conversation pane');
 drain();assert.equal(context.analysis.phase,'completed');assert.equal(run('evExperimentIssueLedgerSync(experiment).length')>1,true);assert.equal(context.analysis.issueCount,run('evExperimentIssueLedgerSync(experiment).filter(issue=>issue.sourceKind==="ai"&&issue.occurrences.some(item=>item.runId===record.id)).length'),'AI analysis count excludes manual annotations');assert(run('evExperimentAssistantChat()').includes('查看问题'));
 assert.equal(JSON.stringify(context.record.results),beforeResults);assert.equal(JSON.stringify(context.record.initialFullResult),beforeInitial,'analysis preserves the comparison evidence');
 run('evExperimentAssistantOpenIssues()');assert.equal(run('evExperimentState.tab'),'问题优化');
 context.issue=run('evExperimentIssueLedgerSync(experiment)[0]');const roots=context.experiment.runs.length;
 context.otherSelected=context.experiment.runs.find(item=>item.id!==context.record.id);run('evExperimentSelectRun(otherSelected.id);evExperimentSelectTab("问题优化");evExperimentIssueDetail(issue.id,"all",experiment.id)');
 context.repair=run('evExperimentIssueRepair(experiment.id,issue.id)');assert(context.repair);assert.equal(context.repair.phase,'running');assert.equal(run('evExperimentSelectedRecord(experiment).id'),context.record.id,'repair restores its source record after closing a drawer from another selection');assert.equal(run('evExperimentAssistantState().token'),context.repair.token,'repair conversation remains visible after drawer navigation restores its parent');
 assert(context.repair.messages[0].text.includes(context.issue.code)&&context.repair.messages[0].text.includes('预期结果：'),'repair automatically sends issue-specific context');
 drain();assert.equal(context.issue.status,'待验证');assert.equal(context.repair.phase,'completed');assert(run('evExperimentAssistantChat()').includes('验证修复'));assert.equal(context.experiment.runs.length,roots,'mock repair does not create a full evaluation record');
 assert.equal(JSON.stringify(context.record.results),beforeResults);assert.equal(JSON.stringify(context.record.initialFullResult),beforeInitial);
 context.validation=run('evExperimentAssistantVerify()');assert(context.validation&&context.validation.kind==='validation','repair action starts explicit verification as an independent problem check');
 drain();run('evExperimentIssueLedgerSync(experiment)');assert(context.issue.verifications.length>0,'verification keeps an inspectable result');assert.equal(context.experiment.runs.length,roots);
 // Cancelling or changing scope before the analysis callback cannot import new issues.
 context.other=run('evExperimentStore().experiments[1]');context.otherRecord=context.other.runs[0];run('evExperimentOpen(other.id,otherRecord.id)');
 assert.equal(run('evExperimentIssueLedgerSync(other).length'),0);
 context.pending=run('evExperimentAnalyze(other.id)');assert(context.pending);run("studio.scene='procurement';evData()");drain();
 assert.equal(context.pending.phase,'cancelled');assert.equal(context.other.issueLedger.length,0,'a stale scene callback cannot publish issues');
 run("studio.scene='sales';evData();evExperimentOpen(other.id,otherRecord.id)");context.pendingAgain=run('evExperimentAnalyze(other.id)');assert(timers.size>0);run('evExperimentAssistantDismiss()');assert.equal(timers.size,0);drain();assert.equal(context.other.issueLedger.length,0,'closing an unfinished task cancels discovery');
 // Creation Copilot and optimization conversations are mutually exclusive.
 context.another=run('evExperimentAnalyze(other.id)');run('evCopilot("experiment")');assert.equal(run('evState.optimizationAssistant'),null);assert.equal(timers.size,0);
}
console.log('PASS explicit analysis chat, completion-gated issues, repair and verification flow, dual hosts and stale-task cancellation');
