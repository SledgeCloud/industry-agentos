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
 const h=boot(native),{context,run,drain,node}=h,label=native?'native':'workshop';
 run("currentSection='studio';wtState.open=true;evState.tab='评测实验';studio.scene='sales';evData();evExperimentStore()");if(native)run('AIOpsEvaluation.page("评测实验")');
 context.experiment=run('evExperimentStore().experiments[0]');context.record=context.experiment.runs[0];run('evExperimentOpen(experiment.id,record.id)');
 assert.deepEqual(JSON.parse(run('JSON.stringify(evExperimentIssueStatuses)')),['待修复','待验证','验证完成','已关闭']);
 context.quality=context.record.results.find(result=>result.status==='未通过');context.error=context.record.results.find(result=>result.status==='运行失败');assert(context.quality&&context.error);
 const qualityActions=run('evExperimentResultActions(evExperimentCaseDetailContext(quality.id))'),errorActions=run('evExperimentResultActions(evExperimentCaseDetailContext(error.id))');
 assert(qualityActions.includes('结果分析')&&qualityActions.includes('重新执行'));assert(errorActions.includes('重新执行')&&!errorActions.includes('结果分析'));
 const baseline=JSON.stringify(context.record),experimentStatus=context.experiment.status,supplements=context.record.supplements.length;
 run('evExperimentAnalyzeResult(experiment.id,record.id,quality.id)');assert.equal((context.record.issues||[]).length,0);drain();
 assert(context.record.issues.length&&context.record.issues.every(issue=>issue.resultId===context.quality.id),'single-result analysis cannot analyze a different failure');
 context.issue=run('evExperimentIssueLedgerSync(experiment)[0]');assert.equal(context.issue.status,'待修复');assert(!Object.hasOwn(context.issue,'owner'));
 run('evExperimentAssistantOpenIssues()');
 let table=run('evExperimentIssuesTable(experiment)');assert(table.includes('aria-label="筛选状态"'));assert(!table.includes('负责人')&&!table.includes('未解决')&&!table.includes('全部类型')&&!table.includes('<select'));
 run('evListFilters.experimentIssue={status:["待验证"]}');assert(run('evExperimentIssuesTable(experiment)').includes('暂无匹配的问题'));run('evClearFilters("experimentIssue")');
 let actions=run('evExperimentIssueActions(experiment,issue,"all",true)');assert(actions.includes('问题修复')&&!actions.includes('>验证<'));assert(actions.includes('ont-button strong'));
 run('evExperimentIssueRepair(experiment.id,issue.id)');drain();assert.equal(context.issue.status,'待验证');
 actions=run('evExperimentIssueActions(experiment,issue,"all",true)');assert(actions.includes('>验证<')&&actions.includes('重新修复'));
 const originalResults=JSON.stringify(context.record.results),originalReport=JSON.stringify(context.record.report),ordinaryIds=run('JSON.stringify(evExperimentExecutions(experiment).map(item=>item.id))');
 run('var lifecycleOutcome=evExperimentOutcome;evExperimentOutcome=()=>"通过"');context.validation=run('evExperimentIssueVerify(experiment.id,issue.id)');assert(context.validation);
 assert.equal(context.validation.kind,'validation');assert.equal(context.validation.sourceRecordId,context.record.id);assert.equal(context.record.supplements.length,supplements);assert.equal(context.experiment.status,experimentStatus);assert.equal(run('evExperimentExecutionGet(experiment,validation.id)'),null);assert.equal(run('evExperimentReportSync(experiment,validation)'),null);
 assert.equal(context.issue.status,'待验证');assert.equal(context.issue.verifying,true);drain();
 assert.equal(context.issue.status,'验证完成');assert.equal(context.issue.verificationPassed,true);assert(context.issue.verifications.every(item=>item.kind==='validation'));
 assert.equal(run('JSON.stringify(evExperimentExecutions(experiment).map(item=>item.id))'),ordinaryIds);assert.equal(JSON.stringify(context.record.results),originalResults);assert.equal(JSON.stringify(context.record.report),originalReport);assert.equal(context.record.supplements.length,supplements);
 assert(!run('evExperimentResultTable(experiment,record)').includes(context.validation.id));const beforeTab=run('evExperimentState.tab');
 run('evExperimentIssueDetail(issue.id,"all",experiment.id);evExperimentIssueValidationDetail(experiment.id,validation.id,validation.results[0].id)');if(native)run('AIOpsEvaluation.afterRender("评测实验")');
 assert.equal(run('evExperimentState.tab'),beforeTab,'viewing validation never navigates to the case-results tab');
 const review=node('overlay').innerHTML;assert(review.includes('查看问题验证详情')&&review.includes('验证编号')&&review.includes('验证结果'));assert(!review.includes('用例执行 1 /')&&!review.includes('· 补跑 #')&&!review.includes('evExperimentRetryResult')&&!review.includes('evExperimentAnalyzeResult'));
 if(native)assert.equal(run('AIOpsEvaluationDetails.current().kind'),'validation');
 run('evExperimentIssueSetStatus(experiment.id,issue.id,"已关闭")');assert.equal(context.issue.status,'已关闭');actions=run('evExperimentIssueActions(experiment,issue,"all",true)');assert(actions.includes('重新打开')&&!actions.includes('问题修复')&&!actions.includes('>验证<'));
 run('evExperimentIssueSetStatus(experiment.id,issue.id,"待修复")');assert.equal(context.issue.status,'待修复');
 run('evCloseModal();evExperimentOpen(experiment.id,record.id)');const beforeRetry=context.record.supplements.length;context.retry=run('evExperimentRetryResult(experiment.id,record.id,quality.id)');assert(context.retry);assert.equal(context.retry.results.length,1);assert.equal(context.retry.results[0].sourceResultId,context.quality.id);drain();assert.equal(context.record.supplements.length,beforeRetry+1);assert.equal(JSON.stringify(context.record.results),originalResults);
 run('evExperimentOutcome=lifecycleOutcome');
}
console.log('PASS four-state issues, column status filters, scoped failed-result actions, separate verification storage/review and immutable evaluation records');
