const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const shared=['workshop-evaluation-seed.js','workshop-evaluation.js','workshop-evaluation-versions.js','workshop-evaluation-dashboard.js','workshop-evaluation-tasks.js','workshop-evaluation-assets.js','workshop-evaluation-evaluators.js','workshop-evaluation-experiment-engine.js','workshop-evaluation-reports.js','workshop-evaluation-experiments.js','workshop-evaluation-issues.js','workshop-evaluation-copilot.js','workshop-evaluation-optimization.js'];
function boot(native){
 const nodes=new Map(),timers=new Map();let now=Date.parse('2026-11-09T02:00:00Z'),serial=0;
 function node(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:'',dataset:{},isConnected:true,scrollTop:0,scrollHeight:100,style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},focus(){},remove(){},click(){},setAttribute(){},removeAttribute(){},contains(){return false;},querySelector(){return null;},querySelectorAll(){return [];},getBoundingClientRect(){return {left:256,top:60,right:1440,bottom:1000,width:1184,height:940};}});return nodes.get(id);}
 class ClockDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const context={console,JSON,URL,URLSearchParams,Blob,Date:ClockDate,innerWidth:1440,innerHeight:1000,
  setTimeout(fn,delay=0){const id=++serial;timers.set(id,{id,fn,at:now+Number(delay)});return id;},clearTimeout(id){timers.delete(id);},addEventListener(){},
  document:{body:node('body'),activeElement:node('active'),getElementById:node,querySelector(){return null;},querySelectorAll(){return [];},createElement:node,addEventListener(){}},
  AIOpsResources:{sceneId:()=> 'all',scopeCatalog:()=>[{id:'sales'},{id:'procurement'}]},AIOpsWorkspaces:{registerEvaluationScenes(){}},AIOpsApp:{page:()=> '评测实验',refresh(){},navigate(){}}};
 context.window=context;vm.createContext(context);
 for(const file of ['aiops/evaluation-foundation.js',...shared,...(native?['aiops/evaluation.js','aiops/evaluation-details.js']:[])])vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),context,{filename:file});
 const run=source=>vm.runInContext(source,context);
 function advance(ms){const end=now+ms;let count=0;while(true){const timer=[...timers.values()].filter(item=>item.at<=end).sort((a,b)=>a.at-b.at||a.id-b.id)[0];if(!timer)break;assert(++count<20000);timers.delete(timer.id);now=timer.at;timer.fn();}now=end;}
 return {context,run,advance,timers};
}
// Verify every target through the production Mock executor, including immutable
// evidence and the point at which the dashboard may publish new totals.
for(const native of [false,true]){
 const {context,run,advance,timers}=boot(native),label=native?'native':'workshop';
 run("currentSection='studio';wtState.open=true;evState.tab='评测实验';studio.scene='sales';evData();evExperimentStore()");if(native)run('AIOpsEvaluation.page("评测实验")');
 context.experiment=run('evExperimentStore().experiments[0]');context.record=context.experiment.runs[0];context.result=context.record.results.find(item=>item.actual);
 run('evExperimentOpen(experiment.id,record.id,"问题优化")');
 context.source={current:context.experiment,run:context.record,result:context.result};
 for(let index=0;index<12;index++){
  context.annotation={problemType:'其他',note:'批量验证验收 '+index,targetType:'output',turn:1};context.target='output:1:verification-'+index;
  run('evExperimentIssueFromAnnotation(source,annotation,target)');
 }
 context.annotation={problemType:'其他',note:'搜索范围之外的待验证问题',targetType:'output',turn:1};run('evExperimentIssueFromAnnotation(source,annotation,"output:outside-validation")');
 context.issues=run('evExperimentIssueLedgerSync(experiment)');for(const issue of context.issues)issue.status='待验证';
 context.historical=context.experiment.runs[1];context.historicalSource={current:context.experiment,run:context.historical,result:context.historical.results.find(item=>item.actual)};
 context.annotation={problemType:'其他',note:'历史记录中的其他问题',targetType:'output',turn:1};context.historicalIssue=run('evExperimentIssueFromAnnotation(historicalSource,annotation,"output:historical-validation")');context.historicalIssue.status='待验证';
 context.issues[8].status='已关闭';context.issues[9].status='验证完成';context.issues[10].status='待修复';context.issues[11].verifying=true;
 run('evExperimentIssuesUI(experiment).search="批量验证验收"');
 const originalResults=JSON.stringify(context.record.results),originalReport=JSON.stringify(context.record.report),originalSnapshot=JSON.stringify(context.record.snapshot),ordinaryExecutions=run('JSON.stringify(evExperimentExecutions(experiment))'),experimentStatus=context.experiment.status;
 const metrics=()=>run('JSON.stringify(evDashboardIssueMetrics(experiment,record))'),metricBefore=metrics();
 context.initialScope=run('evExperimentIssuesUI(experiment).scope');run('evExperimentIssuesUI(experiment).scope=record.id');const recordScopeBefore=metrics();run('evExperimentIssuesUI(experiment).scope=initialScope');
 assert(run('evExperimentIssueValidationControls(experiment)').includes('>问题验证</button>'),label+' exposes bulk verification');
 assert(run('evExperimentHeaderControls(experiment)').includes('问题验证'),label+' wires verification into the common top actions');
 // Alternating existing Mock outcomes must survive the batch; validation is
 // evidence generation rather than a blanket transition to a passing verdict.
 run('var validationOutcome=evExperimentOutcome;evExperimentOutcome=(experiment,execution)=>execution.validationSequence%2?"通过":"未通过"');
 context.batch=run('evExperimentIssueVerifyAll(experiment.id)');assert(context.batch,label+' starts verification');
 assert.equal(context.batch.items.length,8,label+' validates only pending filtered targets');
 const phaseCount=phase=>context.batch.items.filter(item=>item.phase===phase).length;
 assert.equal(phaseCount('running'),4);assert.equal(phaseCount('queued'),4);
 assert.equal(run('evExperimentIssueVerifyAll(experiment.id)'),context.batch,'a repeated click cannot duplicate a verification batch');
 let markup=run('evExperimentIssuesTable(experiment)');assert(markup.includes('ev-row-spinner')&&markup.includes('ev-row-waiting')&&markup.includes('验证中')&&markup.includes('等待验证'),label+' has running and waiting row feedback');
 assert(run('evExperimentIssueValidationControls(experiment)').includes('disabled'));
 context.inFlight=context.batch.items[0].issue;
 assert.equal(run('evExperimentIssueVerify(experiment.id,inFlight.id)'),false,'single verification cannot compete with a bulk operation');
 assert.equal(run('evExperimentIssueRepairAll(experiment.id)'),false,'repair cannot compete with verification');
 assert.equal(run('evExperimentIssueSetStatus(experiment.id,inFlight.id,"已关闭")'),false,'a validation target cannot be closed while queued or running');
 advance(1499);assert.equal(phaseCount('completed'),0,label+' first batch lasts a full 1.5s');assert.equal(metrics(),metricBefore);
 advance(1);assert.equal(phaseCount('completed'),4);assert.equal(phaseCount('running'),4);assert.equal(phaseCount('queued'),0);
 markup=run('evExperimentIssuesTable(experiment)');assert(markup.includes('ev-row-spinner')&&markup.includes('验证完成'),label+' completed rows and active second batch coexist');
 assert.equal(metrics(),metricBefore,label+' metrics remain frozen after the first four validations');
 run('evExperimentIssuesUI(experiment).scope=record.id');assert.equal(metrics(),recordScopeBefore,label+' changing scope re-renders its pre-batch totals');run('evExperimentIssuesUI(experiment).scope=initialScope');assert.equal(metrics(),metricBefore);
 advance(1499);assert.equal(context.batch.phase,'running');assert.equal(metrics(),metricBefore);advance(1);
 assert.equal(context.batch.phase,'completed');assert.equal(run('evExperimentIssueValidationBatch(experiment)'),null);
 assert.notEqual(metrics(),metricBefore,label+' metrics publish only after the final batch');
 const targets=context.batch.items.map(item=>item.issue);assert(targets.every(issue=>issue.status==='验证完成'&&!issue.verifying));
 assert(targets.some(issue=>issue.verificationPassed===true)&&targets.some(issue=>issue.verificationPassed===false),'batch verification preserves passing and failing evidence');
 assert.equal(context.experiment.validationRuns.length,8,'one independent validation run is stored per issue');
 const allResultIds=new Set();
 for(const issue of targets){
  const execution=context.experiment.validationRuns.find(item=>item.validationIssueId===issue.id);assert(execution);assert.equal(execution.kind,'validation');assert.equal(execution.sourceRecordId,context.record.id);
  assert.equal(JSON.stringify(execution.snapshot),originalSnapshot,'verification uses the original source snapshot');
  assert(Object.isFrozen(execution.snapshot));assert(issue.verifications.length>0&&issue.verifications.every(item=>item.kind==='validation'));
  assert.equal(issue.latestVerification.validationRunId,execution.id);
  for(const result of execution.results){assert(result.isValidation);assert.equal(result.sourceResultId,context.result.id);assert(!allResultIds.has(result.id));allResultIds.add(result.id);assert(result.messages.length>=2);assert(result.trace);assert.equal(result.durationMs,1500);}
 }
 assert.equal(context.issues[8].status,'已关闭');assert.equal(context.issues[9].status,'验证完成');assert.equal(context.issues[10].status,'待修复');assert.equal(context.issues[11].status,'待验证');assert.equal(context.issues[12].status,'待验证','search-excluded issue stays untouched');
 assert.equal(context.experiment.status,experimentStatus);assert.equal(run('JSON.stringify(evExperimentExecutions(experiment))'),ordinaryExecutions,'validations do not become full evaluations or supplements');
 assert.equal(JSON.stringify(context.record.results),originalResults);assert.equal(JSON.stringify(context.record.report),originalReport);assert.equal(JSON.stringify(context.record.snapshot),originalSnapshot,'original evidence and report remain unchanged');
 assert.equal(run('evExperimentIssueVerifyAll(experiment.id)'),false,'no completed target is silently revalidated');
 run('evExperimentOutcome=validationOutcome');
 // An unavailable historical source must fail before any validation record,
 // identifiers or busy state are registered.
 context.invalidTarget=targets.at(-1);context.invalidTarget.status='待验证';const beforeInvalid=JSON.stringify(context.experiment.validationRuns);
 run('var sourceExecution=evExperimentIssueExecution;evExperimentIssueExecution=(experiment,id)=>id===record.id?null:sourceExecution(experiment,id)');
 assert.equal(run('evExperimentIssueVerifyAll(experiment.id)'),false,'missing source is rejected without a partially created validation group');
 assert.equal(run('evExperimentIssueValidationBatch(experiment)'),null);assert.equal(JSON.stringify(context.experiment.validationRuns),beforeInvalid);assert.equal(context.invalidTarget.verifying,false);run('evExperimentIssueExecution=sourceExecution');
 // A stopped group publishes completed evidence, releases every remaining
 // target, and rejects timer callbacks captured before cancellation.
 for(const issue of targets)issue.status='待验证';context.stoppedBatch=run('evExperimentIssueVerifyAll(experiment.id)');advance(1500);
 const stale=[...timers.values()].map(timer=>timer.fn);assert.equal(context.stoppedBatch.items.filter(item=>item.phase==='completed').length,4);
 run('evStopExperiment(experiment.id)');assert.equal(run('evExperimentIssueValidationBatch(experiment)'),null);
 const stoppedTargets=context.stoppedBatch.items.filter(item=>item.phase!=='completed');assert.equal(stoppedTargets.length,4);assert(stoppedTargets.every(item=>item.issue.status==='待验证'&&!item.issue.verifying));
 const stoppedEvidence=JSON.stringify(context.experiment.validationRuns);for(const callback of stale)callback();advance(3000);assert.equal(JSON.stringify(context.experiment.validationRuns),stoppedEvidence,'stale callbacks cannot modify stopped validations');
 assert.equal(JSON.stringify(context.record.results),originalResults);assert.equal(JSON.stringify(context.record.report),originalReport);
 // Repeated case executions remain independent conversations, but bulk issue
 // validation completes all five attempts of each running issue in one batch.
 context.repeated=run('evCreateExperiment({name:"五次执行的问题验证",agentId:experiment.agentId,version:experiment.version,suiteIds:experiment.suiteIds,evaluatorIds:experiment.evaluatorIds,execution:{caseRuns:5,concurrency:4,fullRuns:1}})');
 context.repeatedRecord=run('evRunExperiment(repeated.id)');advance(15000);assert(!run('evExperimentActiveExecution(repeated)'));
 run('evExperimentOpen(repeated.id,repeatedRecord.id,"问题优化")');context.repeatedSource={current:context.repeated,run:context.repeatedRecord,result:context.repeatedRecord.results[0]};
 for(let index=0;index<3;index++){context.annotation={problemType:'其他',note:'五次执行验证 '+index,targetType:'output',turn:1};context.target='output:repeated-validation-'+index;context.repeatedIssue=run('evExperimentIssueFromAnnotation(repeatedSource,annotation,target)');context.repeatedIssue.status='待验证';}
 const repeatedEvidence=JSON.stringify(context.repeatedRecord);context.repeatedBatch=run('evExperimentIssueVerifyAll(repeated.id)');assert.equal(context.repeatedBatch.items.length,3);assert(context.repeatedBatch.items.every(item=>item.run.results.length===5));
 advance(1499);assert.equal(context.repeatedBatch.phase,'running');advance(1);assert.equal(context.repeatedBatch.phase,'completed');
 assert(context.repeatedBatch.items.every(item=>item.issue.status==='验证完成'&&item.run.results.every(result=>result.durationMs===1500)),'five attempts finish within the 1.5s issue batch');assert.equal(JSON.stringify(context.repeatedRecord),repeatedEvidence);
}

console.log('PASS dual-host bulk verification: pending-only targets, 1.5s batches, queued/running feedback, final-only metrics, independent validation evidence, mixed verdicts and immutable evaluation history');
