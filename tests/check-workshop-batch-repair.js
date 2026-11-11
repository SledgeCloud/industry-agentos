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
 return {context,run,advance};
}
for(const native of [false,true]){
 const {context,run,advance}=boot(native),label=native?'native':'workshop';
 run("currentSection='studio';wtState.open=true;evState.tab='评测实验';studio.scene='sales';evData();evExperimentStore()");if(native)run('AIOpsEvaluation.page("评测实验")');
 context.experiment=run('evExperimentStore().experiments[0]');context.record=context.experiment.runs[0];context.result=context.record.results.find(item=>item.actual);
 run('evExperimentOpen(experiment.id,record.id,"问题优化")');
 context.source={current:context.experiment,run:context.record,result:context.result};
 for(let i=0;i<10;i++){
  context.annotation={problemType:'其他',note:'批量修复验收 '+i,targetType:'output',turn:1};context.target='output:1:batch-'+i;
  run('evExperimentIssueFromAnnotation(source,annotation,target)');
 }
 context.annotation={problemType:'其他',note:'当前搜索之外的问题',targetType:'output',turn:1};run('evExperimentIssueFromAnnotation(source,annotation,"output:outside")');
 context.issues=run('evExperimentIssueLedgerSync(experiment)');context.issues[8].status='已关闭';context.issues[9].verifying=true;
 run('evExperimentIssuesUI(experiment).search="批量修复验收"');
 const originalResults=JSON.stringify(context.record.results),originalReport=JSON.stringify(context.record.report),recordCount=context.experiment.runs.length;
 const metricBefore=run('JSON.stringify(evDashboardIssueMetrics(experiment,record))');
 assert(run('evExperimentIssueRepairControls(experiment)').includes('>问题修复</button>'),label+' has a top bulk-repair action');
 context.batch=run('evExperimentIssueRepairAll(experiment.id)');assert.equal(context.batch.items.length,8,label+' uses the visible list and excludes closed/verifying issues');
 assert.equal(context.batch.items.filter(item=>item.phase==='running').length,4);assert.equal(context.batch.items.filter(item=>item.phase==='queued').length,4);
 assert.equal(run('evExperimentIssueRepairAll(experiment.id)'),context.batch,'a repeated click cannot create competing repairs');
 let markup=run('evExperimentIssuesTable(experiment)');assert(markup.includes('ev-row-spinner')&&markup.includes('ev-row-waiting')&&markup.includes('等待修复')&&markup.includes('修复中'));
 assert(run('evExperimentIssueRepairControls(experiment)').includes('disabled'));
 assert.equal(run('evExperimentIssueSetStatus(experiment.id,batch.items[0].id,"已关闭")'),false,'in-flight rows cannot be closed under the batch');
 advance(1499);assert(context.batch.items.every(item=>item.phase!=='completed'),'first batch remains active for 1.5s');
 assert.equal(run('JSON.stringify(evDashboardIssueMetrics(experiment,record))'),metricBefore);
 advance(1);assert.equal(context.batch.items.filter(item=>item.phase==='completed').length,4);assert.equal(context.batch.items.filter(item=>item.phase==='running').length,4);
 assert(context.batch.items.every(item=>item.issue.status==='待修复'),'batch completion is staged until all rows finish');
 markup=run('evExperimentIssuesTable(experiment)');assert(markup.includes('data-repair-phase="completed"')&&markup.includes('data-repair-phase="running"'));
 assert.equal(run('JSON.stringify(evDashboardIssueMetrics(experiment,record))'),metricBefore,'metrics remain frozen while second batch runs');
 advance(1499);assert.equal(context.batch.phase,'running');advance(1);
 assert.equal(context.batch.phase,'completed');assert(context.batch.items.every(item=>item.issue.status==='待验证'&&item.issue.repair?.mode==='mock'));
 assert.notEqual(run('JSON.stringify(evDashboardIssueMetrics(experiment,record))'),metricBefore,'all metrics update after the final batch');
 assert.equal(context.issues[8].status,'已关闭');assert.equal(context.issues[9].status,'待修复');assert.equal(context.issues[10].status,'待修复','search-excluded issue stays unchanged');
 assert.equal(run('evExperimentIssueRepairBatch(experiment)'),null);assert.equal(context.experiment.runs.length,recordCount);
 assert.equal(JSON.stringify(context.record.results),originalResults);assert.equal(JSON.stringify(context.record.report),originalReport,'repair preserves evaluation evidence');
 // Single-issue repair uses the same row loading feedback and 1.5s timing.
 context.single=context.batch.items[0].issue;context.single.status='待修复';
 context.singleRepair=run('evExperimentIssueRepair(experiment.id,single.id)');assert.equal(context.singleRepair.phase,'running');
 assert(run('evExperimentIssueRepairStatus(experiment,single)').includes('ev-row-spinner'));
 advance(1499);assert.equal(context.single.status,'待修复');advance(1);assert.equal(context.single.status,'待验证');assert.equal(context.singleRepair.phase,'completed');
}
console.log('PASS dual-host bulk repair, queued/running row feedback, 1.5s batches, atomic metrics, filtered targets, duplicate guards and immutable evidence');
