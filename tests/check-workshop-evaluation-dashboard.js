const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('dist/index.html','utf8');
const nodes=new Map(),selectors=new Map(),lists=new Map(),events=new Map(),timers=new Map();
let clockMs=Date.parse('2026-11-04T04:00:00Z'),serial=0;
class TestDate extends Date{constructor(...args){super(...(args.length?args:[clockMs]));}static now(){return clockMs;}}
const node=key=>{
  if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',value:'',hidden:false,disabled:false,dataset:{},style:{},scrollTop:0,scrollHeight:100,isConnected:true,
    focus(){},remove(){},click(){},setAttribute(){},removeAttribute(){},scrollIntoView(){},closest(){return null;},contains(){return true;},
    getBoundingClientRect(){return{left:700,top:60,right:1440,bottom:1000,width:740,height:940};},classList:{add(){},remove(){},toggle(){}},
    querySelector:selector=>selectors.get(key+' '+selector)||null,querySelectorAll:selector=>lists.get(key+' '+selector)||[]});
  return nodes.get(key);
};
class FormDataMock{
  constructor(form){this.values=form.values||{};}
  get(key){const v=this.values[key];return Array.isArray(v)?v[0]??null:v??null;}
  getAll(key){const v=this.values[key];return v===undefined?[]:Array.isArray(v)?v:[v];}
  *[Symbol.iterator](){for(const key of Object.keys(this.values))for(const v of this.getAll(key))yield[key,v];}
}
const context={console,Date:TestDate,JSON,URL,URLSearchParams,Blob,FormData:FormDataMock,innerWidth:1440,innerHeight:1000,
  addEventListener(type,handler){if(!events.has(type))events.set(type,[]);events.get(type).push(handler);},
  setTimeout(fn,delay=0){const id=++serial;timers.set(id,{id,fn,due:clockMs+Number(delay)});return id;},clearTimeout:id=>timers.delete(id),
  document:{body:node('body'),activeElement:node('active'),getElementById:node,querySelector:s=>selectors.get(s)||null,querySelectorAll:s=>lists.get(s)||[],createElement:t=>node('created-'+t),addEventListener(type,handler){if(!events.has(type))events.set(type,[]);events.get(type).push(handler);}}};
context.window=context;vm.createContext(context);
for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(match[1],context);
const modules=[...html.matchAll(/<script\b[^>]*\bsrc="(workshop-evaluation[^"?]+)(?:\?[^"]*)?"[^>]*>/g)].map(match=>match[1]);
assert(modules.includes('workshop-evaluation-dashboard.js'),'real entry point loads evaluation dashboards');
for(const file of modules)vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),context,{filename:file});
const run=code=>vm.runInContext(code,context),snapshot=code=>JSON.parse(run('JSON.stringify('+code+')')),clone=value=>JSON.parse(JSON.stringify(value));
const advance=()=>{const next=[...timers.values()].sort((a,b)=>a.due-b.due||a.id-b.id)[0];if(!next)return false;timers.delete(next.id);clockMs=Math.max(clockMs,next.due);next.fn();return true;};
const until=(predicate,limit=3000)=>{let count=0;while(!predicate())assert(++count<=limit&&advance(),'expected run progress must occur');};
const handlers=markup=>{for(const match of markup.matchAll(/(?:onclick|onchange|onsubmit|oninput|onkeydown)="([^"]*)"/g)){const code=match[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');assert.doesNotThrow(()=>new Function('event',code),code);}};
run("currentSection='studio';studio.scene='sales';workbenchOpen('评测');evData()");

// Each of the four surfaces owns its range; Shanghai dates do not depend on host TZ.
const scopes=['experiment-list','experiment:SAL-EXP-DASH','suite-list','suite:SAL-ES-DASH'];
for(const scope of scopes)assert.equal(run('evDashboardRange('+JSON.stringify(scope)+')'),'all');
context.calendarScope='experiment-list';
const range=value=>run('evDashboardSetRange(calendarScope,'+JSON.stringify(value)+')');
const matches=value=>{context.calendarValue=value;return run('evDashboardMatch(calendarValue,calendarScope)');};
range('today');
assert.equal(matches('2026-11-03T15:59:59.999Z'),false);
assert.equal(matches('2026-11-03T16:00:00.000Z'),true,'today begins at Shanghai midnight, not UTC midnight');
assert.equal(matches('2026-11-04 00:00:00'),true,'legacy local timestamp strings mean Shanghai time');
assert.equal(matches('2026-11-04T23:59:59.999+08:00'),true);
assert.equal(matches('2026-11-05T00:00:00+08:00'),false);
assert.equal(matches('not-a-date'),false,'dated ranges exclude unknown timestamps');
range('yesterday');
assert.equal(matches('2026-11-03T00:00:00+08:00'),true);
assert.equal(matches('2026-11-03T23:59:59.999+08:00'),true);
assert.equal(matches('2026-11-02T23:59:59.999+08:00'),false);
assert.equal(matches('2026-11-04T00:00:00+08:00'),false);
range('7d');
assert.equal(matches('2026-10-29T00:00:00+08:00'),true,'last seven days includes today and six prior Shanghai calendar days');
assert.equal(matches('2026-10-28T23:59:59.999+08:00'),false);
assert.equal(matches('2026-11-05T00:00:00+08:00'),false);
range('all');assert.equal(matches('2000-01-01T00:00:00+08:00'),true);
range('today');
for(const scope of scopes.slice(1))assert.equal(run('evDashboardRange('+JSON.stringify(scope)+')'),'all','changing one surface leaves the other three untouched');
run("studio.scene='procurement';evData()");assert.equal(run('evDashboardRange("experiment-list")'),'all','a different scene starts with its own ranges');
run("evDashboardSetRange('suite-list','yesterday');studio.scene='sales';evData()");
assert.equal(run('evDashboardRange("experiment-list")'),'today');assert.equal(run('evDashboardRange("suite-list")'),'all');
clockMs=Date.parse('2026-11-04T16:00:00Z');
assert.equal(matches('2026-11-04T08:00:00+08:00'),false,'a still-open today filter updates its day boundary after midnight');
range('yesterday');assert.equal(matches('2026-11-04T08:00:00+08:00'),true);
clockMs=Date.parse('2026-11-04T04:00:00Z');range('all');

// Result timestamps are retained for evidence, while dashboard ranges bind to whole runs.
assert.equal(run('evExperimentTimestamp("2026-11-04 00:00:00")'),Date.parse('2026-11-03T16:00:00Z'));
assert.equal(run('evExperimentTimestamp("2026-11-04T00:00:00+08:00")'),Date.parse('2026-11-03T16:00:00Z'));

const experimentTemplate=snapshot('evExperimentStore().experiments[0]');
const stamp=value=>Date.parse(value);
function resultFixture(id,status,durationMs,tokens,endedAt,caseIndex=0){
  const source=experimentTemplate.snapshot.cases[caseIndex],end=stamp(endedAt);
  return {id,caseId:source.id,name:source.name,version:source.version,input:source.input,expected:source.expected,tags:[],enabled:true,
    attempt:1,suiteIds:[experimentTemplate.suiteId],status,actual:'fixture output',reason:'',dimensions:[],evaluations:[],durationMs,tokens,
    startedAtMs:end-durationMs,endedAtMs:end,startedAt:new Date(end-durationMs).toISOString(),endedAt:new Date(end).toISOString()};
}
function runFixture(experiment,id,startedAt,results,issues=[]){
  const start=stamp(startedAt),end=Math.max(start,...results.map(result=>result.endedAtMs||start));
  return {id,experimentId:experiment.id,experimentName:experiment.name,configurationRevision:experiment.configurationRevision,snapshot:clone(experiment.snapshot),
    sequence:experiment.runs.length+1,status:'已完成',startedAtMs:start,endedAtMs:end,startedAt:new Date(start).toISOString(),endedAt:new Date(end).toISOString(),
    elapsedMs:results.reduce((sum,result)=>sum+result.durationMs,0),results,issues,mock:true};
}
function experimentFixture(id,createdAt){
  return {...clone(experimentTemplate),id,name:id,createdAt,createdAtMs:stamp(createdAt),status:'未运行',runs:[],sequence:0,issueLedger:[],issueLedgerSequence:0,configurationRevision:1};
}
const oldExperiment=experimentFixture('SAL-EXP-DASH-OLD','2026-10-20T08:00:00+08:00');
oldExperiment.runs.push(runFixture(oldExperiment,'DASH-OLD-R1','2026-11-04T09:00:00+08:00',[
  resultFixture('DASH-P','通过',100,10,'2026-11-04T09:00:00.100+08:00'),
  resultFixture('DASH-F','未通过',300,30,'2026-11-04T09:00:00.300+08:00'),
  resultFixture('DASH-E','运行失败',500,0,'2026-11-04T09:00:00.500+08:00'),
  resultFixture('DASH-S','已跳过',0,0,'2026-11-04T09:00:00.500+08:00'),
  resultFixture('DASH-W','待运行',0,0,'2026-11-04T09:00:00.500+08:00')
]));
const repeatedRun=runFixture(oldExperiment,'DASH-OLD-R2','2026-11-04T10:00:00+08:00',[
  resultFixture('DASH-RP','通过',200,20,'2026-11-04T10:00:00.200+08:00')
]);
oldExperiment.runs.unshift(repeatedRun);
const yesterdayRun=runFixture(oldExperiment,'DASH-OLD-R0','2026-11-03T08:00:00+08:00',[
  resultFixture('DASH-YP','未通过',900,90,'2026-11-03T08:00:00.900+08:00',1)
]);
oldExperiment.runs.push(yesterdayRun);
const newExperiment=experimentFixture('SAL-EXP-DASH-NEW','2026-11-04T08:00:00+08:00');
const idleOldExperiment=experimentFixture('SAL-EXP-DASH-IDLE','2026-10-20T08:00:00+08:00');
context.dashboardExperiments=[oldExperiment,newExperiment,idleOldExperiment];
run('evExperimentStore().experiments=dashboardExperiments');
for(const experiment of context.dashboardExperiments)for(const record of experiment.runs)run('evExperimentIssueAnalyzeComplete(evExperimentGet('+JSON.stringify(experiment.id)+'),evExperimentGet('+JSON.stringify(experiment.id)+').runs.find(r=>r.id==='+JSON.stringify(record.id)+'))');
const failureRun=oldExperiment.runs.find(record=>record.id==='DASH-OLD-R1');
assert.equal(failureRun.issues.length,2);
context.oldExperiment=oldExperiment;
const ledger=run('evExperimentIssueLedgerSync(oldExperiment)');
const runtimeIssue=ledger.find(issue=>issue.type==='运行异常');runtimeIssue.status='待验证';
assert(failureRun.issues.every(issue=>issue.status==='待修复'),'derived raw discoveries remain distinct from ledger handling state');
const values=metrics=>metrics.map(metric=>metric.value);
const experimentMetrics=()=>snapshot('evDashboardExperimentMetrics(dashboardExperiments,"experiment-list")');
range('all');assert.deepEqual(values(experimentMetrics()),[3,1,2,3]);
range('today');assert.deepEqual(values(experimentMetrics()),[2,1,1,2],'old experiments run today appear; multiple runs count one executed experiment');
assert.deepEqual(snapshot('evExperimentVisible().map(e=>e.id)'),[oldExperiment.id,newExperiment.id],'list and its cards share the same time-scoped object collection');
assert(values(experimentMetrics())[1]<=values(experimentMetrics())[0]);
range('yesterday');assert.deepEqual(values(experimentMetrics()),[1,1,1,1]);
context.rangeListExperiment=clone(oldExperiment);context.rangeListExperiment.runs.find(record=>record.id==='DASH-OLD-R0').results[0].status='未通过';
const yesterdayTable=run('evExperimentListTable([rangeListExperiment])');
assert(yesterdayTable.includes('<td>0.0%</td>'),'a yesterday list row uses the yesterday run, not the successful latest run from today');
assert(yesterdayTable.includes("'DASH-OLD-R0','实验报告'"),'the date-filtered report link opens the same yesterday evidence as the row rate');
assert(!yesterdayTable.includes("'DASH-OLD-R2','实验报告'"));
range('7d');assert.deepEqual(values(experimentMetrics()),[2,1,2,3]);
range('all');
context.duplicateExperiments=[oldExperiment,newExperiment,idleOldExperiment,oldExperiment];
assert.deepEqual(values(snapshot('evDashboardExperimentMetrics(duplicateExperiments,"experiment-list")')),[3,1,2,3],'duplicate resource references cannot inflate cards');
context.duplicateRuns=clone(oldExperiment);context.duplicateRuns.runs.push(context.duplicateRuns.runs[0]);
assert.deepEqual(values(snapshot('evDashboardExperimentMetrics([duplicateRuns],"experiment-list")')),[1,1,2,3],'duplicate run IDs count once');

// A supplement belongs to its own start day without creating another full record.
const supplementScopeExperiment=experimentFixture('SAL-EXP-DASH-SUPPLEMENT','2026-10-20T08:00:00+08:00');
const previousDayRoot=runFixture(supplementScopeExperiment,'DASH-SUP-ROOT','2026-11-03T08:00:00+08:00',[
  resultFixture('DASH-SUP-ROOT-P','通过',100,10,'2026-11-03T08:00:00.100+08:00'),
  resultFixture('DASH-SUP-ROOT-P2','通过',100,10,'2026-11-03T08:00:00.200+08:00',1)
]);
Object.assign(previousDayRoot,{kind:'full',parentRunId:null,supplements:[]});
supplementScopeExperiment.runs.push(previousDayRoot);
const todaySupplement=runFixture(supplementScopeExperiment,'DASH-SUP-TODAY','2026-11-04T10:00:00+08:00',[
  resultFixture('DASH-SUP-TODAY-F','未通过',300,30,'2026-11-04T10:00:00.300+08:00',1)
]);
Object.assign(todaySupplement,{kind:'supplement',parentRunId:previousDayRoot.id,sourceRunId:previousDayRoot.id,sequence:previousDayRoot.sequence,supplementSequence:1,supplementKind:'case',retryCaseId:todaySupplement.results[0].caseId});
previousDayRoot.supplements.push(todaySupplement);context.supplementScopeExperiment=supplementScopeExperiment;run('evExperimentIssueAnalyzeComplete(supplementScopeExperiment,supplementScopeExperiment.runs[0].supplements[0])');
range('today');
assert.equal(run('evDashboardExperimentMatches(supplementScopeExperiment,"experiment-list")'),true,'today includes an old experiment whose only new execution is a supplement');
assert.deepEqual(snapshot('evDashboardExperimentRuns(supplementScopeExperiment,"experiment-list").map(run=>run.id)'),[],'today has no newly started full records');
assert.deepEqual(snapshot('evDashboardExperimentExecutions(supplementScopeExperiment,"experiment-list").map(run=>run.id)'),[todaySupplement.id]);
assert.deepEqual(values(snapshot('evDashboardExperimentMetrics([supplementScopeExperiment],"experiment-list")')),[1,1,1,0],'today counts the executed experiment and its new pending issue, but no extra full record');
context.supplementList=supplementScopeExperiment;
const todaySupplementRow=run('evExperimentListTable([supplementList])');
assert(todaySupplementRow.includes("'DASH-SUP-TODAY','实验报告'"),'a time-filtered list report opens the supplement started in that range');
range('yesterday');
assert.deepEqual(values(snapshot('evDashboardExperimentMetrics([supplementScopeExperiment],"experiment-list")')),[1,1,0,1],'a matching full record does not pull its out-of-range supplement issues into yesterday');
range('all');
assert.deepEqual(values(snapshot('evDashboardExperimentMetrics([supplementScopeExperiment],"experiment-list")')),[1,1,1,1],'all-time totals preserve one full record and deduplicate its supplement issue');
context.failureRun=failureRun;context.oldExperiment=oldExperiment;
let detailMetrics=snapshot('evDashboardRunMetrics(oldExperiment,failureRun)');
assert.equal(detailMetrics.length,4);assert.deepEqual(values(detailMetrics).slice(0,1),[3]);
assert(Math.abs(detailMetrics[1].value-100/3)<1e-10,'technical failures stay in the executed denominator');
assert.equal(detailMetrics[2].value,300,'single execution duration is the arithmetic mean of all executed rows');
assert(Math.abs(detailMetrics[3].value-40/3)<1e-10,'a recorded zero-token error is a real zero, not a missing sample');
assert.deepEqual(values(snapshot('evDashboardRunMetrics(oldExperiment,null)')),[0,null,null,null],'zero samples yield dash values rather than false 0% or 0 ms');
context.missingUsageRun=clone(failureRun);context.missingUsageRun.results[0].tokens=null;
assert.equal(snapshot('evDashboardRunMetrics(oldExperiment,missingUsageRun)')[3].value,null,'unknown usage cannot silently become zero');

// Selected history, all four nested tabs, and empty date ranges use the same run evidence.
run('evExperimentOpen(oldExperiment.id,failureRun.id,"用例结果")');
assert.equal(run('evExperimentSelectedRun(oldExperiment).id'),failureRun.id);
for(const tab of ['用例结果','问题优化','实验报告','实验配置']){
  run('evExperimentState.tab='+JSON.stringify(tab));const markup=run('evExperimentDetail(oldExperiment)');handlers(markup);
  const metrics=[...markup.matchAll(/data-ev-metric="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(metrics,tab==='用例结果'?['case-executions','case-pass-rate','case-duration','case-tokens']:tab==='问题优化'?['issue-pending','issue-verifying','issue-verified','issue-closed']:[],'each detail tab shows only its relevant statistics');
  assert.equal((markup.match(/id="ev-experiment-history"/g)||[]).length,['用例结果','实验报告'].includes(tab)?1:0,'record evidence selector appears only on result and report tabs in '+tab);
  if(tab==='问题优化')assert(markup.includes('ev-issue-scope')&&markup.includes('全部评测记录'),'problem triage has its own all-batch scope');
  assert(!markup.includes('ev-experiment-run-summary')&&!markup.includes('ev-run-summary'),'detail tabs do not duplicate status or processed counts beside the record selector');
  assert(!markup.includes('aria-label="结果范围"')&&!markup.includes('ev-record-source-note'),'full-record results need neither a scope dropdown nor an explanatory note');
  assert(!markup.includes('role="progressbar"'),'detail pages no longer render a progress bar');
  if(tab==='实验报告')assert(markup.includes('计算口径'),'report narrative and metric details remain despite removing top cards');
  if(tab==='问题优化')assert(!markup.includes('ev-issue-metrics')&&!markup.includes('<h3>问题优化</h3>'),'issue statistics have one four-card summary without duplicate legacy cards/headings');
}

// Each issue-status card counts its own independent lifecycle stage.
assert.deepEqual(values(snapshot('evDashboardIssueMetrics(oldExperiment,failureRun)')),[2,1,0,0]);
assert.deepEqual(values(snapshot('evDashboardIssueMetrics(oldExperiment,null)')),[2,1,0,0],'case-result selection does not control issue scope');
run('evExperimentIssueSetScope(oldExperiment.id,failureRun.id)');assert.deepEqual(values(snapshot('evDashboardIssueMetrics(oldExperiment,failureRun)')),[1,1,0,0]);
run('evExperimentState.tab="问题优化"');
const pendingIssue=ledger.find(issue=>issue.status==='待修复'&&issue.occurrences.some(occurrence=>occurrence.runId===failureRun.id));context.pendingIssue=pendingIssue;
context.issueForm={values:{scene:'sales',status:'待验证',note:'已调整，等待验证'}};
assert.equal(run('evSaveExperimentIssue(issueForm,oldExperiment.id,"all",pendingIssue.id)'),true);
assert.deepEqual(values(snapshot('evDashboardIssueMetrics(oldExperiment,failureRun)')),[0,2,0,0]);
run('evExperimentIssueState.search="不会匹配的问题";evListFilters.experimentIssue={status:["已关闭"]};evExperimentIssuesRefresh()');
assert.deepEqual(values(snapshot('evDashboardIssueMetrics(oldExperiment,failureRun)')),[0,2,0,0],'status/search filters do not change card scope');
const issueTable=run('evExperimentIssuesTable(oldExperiment,failureRun)');assert(issueTable.includes('暂无匹配的问题')&&!issueTable.includes('负责人')&&!issueTable.includes('全部类型'));
context.issueForm.values.status='已关闭';assert.equal(run('evSaveExperimentIssue(issueForm,oldExperiment.id,"all",pendingIssue.id)'),true);
assert.deepEqual(values(snapshot('evDashboardIssueMetrics(oldExperiment,failureRun)')),[0,1,0,1]);
run('evExperimentIssueState.search="";evClearFilters("experimentIssue");evExperimentState.tab="用例结果"');
run('evDashboardSetRange("experiment:"+oldExperiment.id,"yesterday")');
assert.equal(run('evExperimentSelectedRun(oldExperiment).id'),failureRun.id,'detail evidence has no date filter');
assert(!run('evExperimentDetail(oldExperiment)').includes('aria-label="统计时间范围"'));
run('evExperimentSelectRun('+JSON.stringify(yesterdayRun.id)+')');
assert.equal(run('evExperimentSelectedRun(oldExperiment).id'),yesterdayRun.id);
assert.deepEqual(values(snapshot('evDashboardRunMetrics(oldExperiment,evExperimentSelectedRun(oldExperiment))')),[1,0,900,90]);
run('evExperimentState.tab="问题优化"');
assert.deepEqual(values(snapshot('evDashboardIssueMetrics(oldExperiment,evExperimentSelectedRun(oldExperiment))')),[0,1,0,1],'switching result batches preserves the independent problem scope');
run('evExperimentIssueSetScope(oldExperiment.id,"DASH-OLD-R0")');assert.deepEqual(values(snapshot('evDashboardIssueMetrics(oldExperiment,null)')),[1,0,0,0]);
run('evExperimentState.runId=""');assert.equal(run('evExperimentSelectedRun(oldExperiment).id'),oldExperiment.runs[0].id,'default selects latest execution');
oldExperiment.configurationRevision=2;
assert.equal(run('evExperimentSelectedRun(oldExperiment).id'),oldExperiment.runs[0].id,'editing configuration keeps latest evidence visible');
oldExperiment.configurationRevision=1;run('evExperimentState.id=null;evExperimentState.runId=""');

// Suite coverage uses explicit case links, independent of creation dates.
const seededData=snapshot('evData()'),cases=seededData.cases.slice(0,4),tasks=seededData.tasks.slice(0,3),suites=seededData.suites.slice(0,2);
cases[1].enabled=false;cases[3].archived=true;
Object.assign(suites[0],{caseIds:[cases[0].id,cases[1].id,cases[3].id,'missing-case'],taskIds:[tasks[0].id,tasks[1].id],taskSnapshots:tasks.slice(0,2),caseBindings:{[cases[0].id]:[{taskId:tasks[0].id,dimensionNames:[tasks[0].dimensions[0].name]}],[cases[1].id]:[{taskId:tasks[1].id,dimensionNames:[tasks[1].dimensions[0].name]}]}});
Object.assign(suites[1],{caseIds:[cases[1].id,cases[2].id],taskIds:[tasks[1].id,tasks[2].id],taskSnapshots:tasks.slice(1),caseBindings:{[cases[1].id]:[{taskId:tasks[1].id,dimensionNames:[tasks[1].dimensions[0].name]}],[cases[2].id]:[{taskId:tasks[2].id,dimensionNames:[tasks[2].dimensions[0].name]}]}});
context.suiteFixtures={cases,tasks,suites};
run('evData().cases=suiteFixtures.cases;evData().tasks=suiteFixtures.tasks;evData().suites=suiteFixtures.suites;evState.agentIds=[];evState.objectIds=[];evAssetState.suiteSearch=""');
const suiteListMetrics=()=>snapshot('evDashboardSuiteMetrics(evVisibleSuites(),evVisibleSuites().flatMap(evSuiteCases),[])');
assert.deepEqual(values(suiteListMetrics()),[2,3,3],'covered tasks deduplicate across cases and suites');
run('evDashboardSetRange("suite-list","yesterday")');assert.deepEqual(values(suiteListMetrics()),[2,3,3],'suite dates no longer filter membership');
context.testSuite=run('evData().suites[0]');run('evOpenSuite(testSuite.id)');
let suiteMarkup=run('evSuiteView(testSuite)');handlers(suiteMarkup);
assert(!suiteMarkup.includes('统计时间范围')&&!suiteMarkup.includes('创建时间统计'));
assert(suiteMarkup.includes('业务任务覆盖率')&&suiteMarkup.includes('评估维度覆盖率'));
run('evSuiteSelectTab("评测集配置")');suiteMarkup=run('evSuiteView(testSuite)');assert(!suiteMarkup.includes('data-ev-metric'));assert(suiteMarkup.includes(tasks[0].id));
run('evVersionPrepare(testSuite)');context.historicalSuiteVersion=run('testSuite.version');
const frozenBindings=snapshot('testSuite.caseBindings');
run('testSuite.caseIds=[evData().cases[2].id];testSuite.taskIds=[evData().tasks[2].id];testSuite.taskSnapshots=[evData().tasks[2]];testSuite.caseBindings={};evVersionSave(testSuite);evVersionPublish(testSuite)');
assert.deepEqual(snapshot('evVersionResolve(testSuite,historicalSuiteVersion).caseBindings'),frozenBindings);
assert.equal(run('evSuiteCoveredTasks(testSuite).length'),0,'a configured task without an associated case remains uncovered');
assert.equal(run('evSuiteCoveredTasks(evVersionResolve(testSuite,historicalSuiteVersion)).length'),2,'historical coverage retains its own associations');
assert(!run('evTasksView()').includes('统计时间范围'));

// Running batches retain committed cards; a midnight crossing belongs wholly to the run's start day.
run('evCatalog.sales=evSeedScene("sales");delete evExperimentStores.sales;evState.agentIds=[];evState.objectIds=[];evState.suiteId=null;evExperimentState.id=null;evExperimentState.runId="";evAssetState.suiteSearch=""');
clockMs=Date.parse('2026-11-04T15:59:59.900Z');
context.liveFields={name:'跨午夜实时统计',agentId:run('evData().suites[0].agentId'),version:run('evAgentVersions(evData().suites[0].agentId)[0].id'),suiteIds:[run('evData().suites[0].id')],evaluatorIds:run('evEvaluatorDefaultIds()'),execution:{concurrency:1,caseRuns:2,fullRuns:2,modelId:'mock-eval-balanced',mcpIds:[]}};
context.liveExperiment=run('evCreateExperiment(liveFields)');
run('evExperimentOpen(liveExperiment.id,"","用例结果")');
context.liveRun=run('evRunExperiment(liveExperiment.id)');
assert.deepEqual(values(snapshot('evDashboardRunMetrics(liveExperiment,liveRun)')),[0,null,null,null]);
assert.equal(context.liveRun.startedAtMs,Date.parse('2026-11-04T15:59:59.900Z'));
assert.deepEqual(values(snapshot('evDashboardExperimentMetrics([liveExperiment],"experiment-list")')),[1,0,0,0],'starting fullRuns=2 preserves committed list metrics until the operation finishes');
until(()=>run('liveRun.results.some(result=>result.status==="通过")'));
const completed=context.liveRun.results.filter(result=>['通过','未通过','运行失败'].includes(result.status));
assert.equal(completed.length,1);assert(completed[0].endedAtMs>Date.parse('2026-11-04T16:00:00Z'));
let liveMetrics=snapshot('evDashboardRunMetrics(liveExperiment,liveRun)');
assert.deepEqual(values(liveMetrics),[0,null,null,null],'the first completed case does not publish partial metrics');
const liveCard=node('ev-experiment-dashboard').innerHTML;
assert(liveCard.includes('data-ev-metric="case-executions"')&&liveCard.includes('用例执行次数：0次'),'intermediate engine completion retains the rendered metric baseline');
assert(!liveCard.includes('ev-run-summary')&&!liveCard.includes('ev-experiment-run-summary'),'live statistics refresh without a status/processed summary');
run('evDashboardSetRange("experiment:"+liveExperiment.id,"today")');
assert.equal(run('evExperimentSelectedRun(liveExperiment).id'),context.liveRun.id,'detail evidence is not filtered by date');
run('evDashboardSetRange("experiment:"+liveExperiment.id,"yesterday")');
assert.equal(run('evExperimentSelectedRun(liveExperiment).id'),context.liveRun.id);
assert.equal(snapshot('evDashboardRunMetrics(liveExperiment,evExperimentSelectedRun(liveExperiment))')[0].value,0,'changing date range does not publish uncommitted partial results');
run('evStopExperiment(liveExperiment.id)');
assert.equal(context.liveRun.status,'已停止');
assert.deepEqual(values(snapshot('evDashboardRunMetrics(liveExperiment,liveRun)')),[1,100,completed[0].durationMs,completed[0].tokens],'stopping keeps finished evidence and excludes skipped/in-flight attempts');
assert(context.liveRun.results.some(result=>result.status==='已跳过'&&result.startedAtMs&&!result.endedAtMs),'a stopped in-flight attempt is not mislabelled as completed');
const stoppedDashboard=run('evExperimentDashboard(liveExperiment,liveRun)');
assert(!stoppedDashboard.includes('ev-run-summary')&&!stoppedDashboard.includes('ev-experiment-run-summary'),'stopping does not restore the removed status summary');
assert(stoppedDashboard.includes('用例执行次数：1次'),'completed metrics remain visible after stopping');

// Execution does not discover issues; an explicit completed analysis refreshes issue cards.
context.problemFields={...context.liveFields,name:'运行中问题统计',execution:{...context.liveFields.execution,caseRuns:1,fullRuns:1}};
context.problemExperiment=run('evCreateExperiment(problemFields)');context.problemRun=run('evRunExperiment(problemExperiment.id)');
run('evExperimentOpen(problemExperiment.id,problemRun.id,"问题优化")');
assert.deepEqual(values(snapshot('evDashboardIssueMetrics(problemExperiment,problemRun)')),[0,0,0,0]);
until(()=>['已完成','部分失败'].includes(context.problemRun.status));
assert.equal(context.problemRun.issues?.length||0,0,'execution alone leaves the issue ledger empty');
run('evExperimentIssueAnalyzeComplete(problemExperiment,problemRun);evExperimentIssuesRefresh()');
const discovered=snapshot('evDashboardIssueMetrics(problemExperiment,problemRun)');
assert(discovered[0].value>0);assert.equal(discovered[1].value,0);
const liveIssueDashboard=node('ev-experiment-dashboard').innerHTML;
assert(liveIssueDashboard.includes('待修复问题数：'+discovered[0].value+'个'),'completed analysis refreshes the rendered issue summary without switching tabs');
assert(!liveIssueDashboard.includes('data-ev-metric="case-executions"')&&!liveIssueDashboard.includes('ev-experiment-run-summary'));
run('evStopExperiment(problemExperiment.id)');

for(const scope of ['experiment-list','experiment:'+context.liveExperiment.id,'suite-list','suite:'+context.testSuite.id])handlers(run('evDashboardTimeControl('+JSON.stringify(scope)+')'));
console.log('Passed: independent scene/page time ranges and Shanghai calendar boundaries; experiment/run/issue deduplication; real executed denominators and means; selected-history and suite-membership isolation; tab-specific execution/issue cards without duplicate status summaries; issue-state/live refresh, midnight run grouping and stop cancellation.');
