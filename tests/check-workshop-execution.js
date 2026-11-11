const expectedSingleExecution=(fields,ids=[])=>({...fields,mode:'single_turn',scenarioPrompt:'',maxTurns:5,evaluationBindings:ids.map(evaluatorId=>({evaluatorId,target:'first_response',participation:'gate'}))});
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

run("currentSection='studio';studio.scene='sales';evData();evEvaluatorStore()");
const clone=value=>JSON.parse(JSON.stringify(value));
const defaultExecution={concurrency:4,caseRuns:1,fullRuns:1,modelId:'mock-eval-balanced',mcpIds:[]};
const base={name:'多集合多轮并发实验',agentId:'sales-agent-1',version:'V3',suiteIds:['SAL-ES-001','SAL-ES-002'],evaluatorIds:['SAL-EV-001']};
context.base=base;
const before=snapshot('({catalog:evData(),evaluators:evEvaluatorStore()})');
const normalized=run('evValidateExperimentDraft(base)');
assert.deepEqual(clone(normalized.execution),expectedSingleExecution(defaultExecution,base.evaluatorIds));assert.equal(normalized.suiteId,'SAL-ES-001');
assert.deepEqual(clone(normalized.suiteIds),base.suiteIds);assert.deepEqual(snapshot('({catalog:evData(),evaluators:evEvaluatorStore()})'),before);
assert.equal(run('Object.keys(evExperimentStores).length'),0,'validation must not initialize or reserve experiment records');
assert.deepEqual(clone(run('evValidateExperimentDraft({...base,suiteIds:undefined,suiteId:"SAL-ES-002"}).suiteIds')),['SAL-ES-002'],'single-suite legacy callers remain supported');
const modelIds=snapshot('evEvaluationModels().map(m=>m.id)'),mcpIds=snapshot('evExperimentMcps().map(m=>m.id)');
assert(modelIds.includes(defaultExecution.modelId)&&mcpIds.length>0);
assert.equal(new Set(modelIds).size,modelIds.length);assert.equal(new Set(mcpIds).size,mcpIds.length);
const foreignMcp=run('evExperimentMcps("procurement").find(m=>!evExperimentMcps("sales").some(s=>s.id===m.id))?.id');assert(foreignMcp);
const invalidOverrides=[{suiteIds:[]},{suiteIds:['SAL-ES-001','SAL-ES-003']},{suiteIds:['PUR-ES-001']},
  ...[0,7,1.5,'',true].map(concurrency=>({execution:{concurrency}})),
  ...[0,6,1.5,'',true].map(caseRuns=>({execution:{caseRuns}})),
  ...[0,6,1.5,'',true].map(fullRuns=>({execution:{fullRuns}})),
  {execution:{modelId:'missing-model'}},{execution:{mcpIds:['missing-mcp']}},{execution:{mcpIds:[foreignMcp]}}
];
for(const change of invalidOverrides){context.invalid={...base,...change};assert.throws(()=>run('evValidateExperimentDraft(invalid)'));}
context.stringConfig={concurrency:'3',caseRuns:'2',fullRuns:'2',modelId:modelIds[1],mcpIds:[mcpIds[0],mcpIds[0]]};
assert.deepEqual(clone(run('evValidateExperimentDraft({...base,execution:stringConfig}).execution')),expectedSingleExecution({concurrency:3,caseRuns:2,fullRuns:2,modelId:modelIds[1],mcpIds:[mcpIds[0]]},base.evaluatorIds));
// Expanded-result limits count the de-duplicated case set, not repeated suite membership.
context.tooMany=clone(run('evData()'));for(let i=0;i<14;i++){const c={...clone(context.tooMany.cases[0]),id:'EXTRA-'+i};context.tooMany.cases.push(c);context.tooMany.suites[0].caseIds.push(c.id);}
const originalCatalog=snapshot('evData()');run('evCatalog.sales=tooMany');
assert.throws(()=>run('evValidateExperimentDraft({...base,execution:{caseRuns:5,fullRuns:5}})'),/300/);
context.originalCatalog=clone(originalCatalog);run('evCatalog.sales=originalCatalog');
context.execution={concurrency:3,caseRuns:2,fullRuns:2,modelId:modelIds[1],mcpIds:mcpIds.slice(0,2)};
context.experiment=run('evCreateExperiment({...base,execution})');
const frozen=clone(context.experiment.snapshot);
assert.deepEqual(clone(context.experiment.suiteIds),base.suiteIds);assert.equal(context.experiment.suiteId,base.suiteIds[0]);
assert.equal(context.experiment.snapshot.cases.length,7,'shared case IDs are included only once across selected suites');
assert.deepEqual(clone(context.experiment.snapshot.cases.find(c=>c.id==='SAL-EC-002').suiteIds),base.suiteIds);
assert.deepEqual(clone(context.experiment.snapshot.cases.find(c=>c.id==='SAL-EC-006').suiteIds),['SAL-ES-002']);
assert.equal(context.experiment.snapshot.model.id,modelIds[1]);assert.deepEqual(clone(context.experiment.snapshot.mcps.map(m=>m.id)),context.execution.mcpIds);
assert(run('Object.isFrozen(experiment.snapshot.execution)&&Object.isFrozen(experiment.snapshot.model)&&Object.isFrozen(experiment.snapshot.mcps)&&Object.isFrozen(experiment.snapshot.suites[0].caseIds)'));
context.execution.concurrency=1;run('evData().suites[0].name="之后编辑的评测集";evData().cases[1].enabled=false');assert.deepEqual(clone(context.experiment.snapshot),frozen,'execution and all source resources are fixed at creation');
context.activeRun=run('evRunExperiment(experiment.id)');
assert.equal(context.experiment.runs.length,2,'one start creates the configured number of full evaluation records');
const requestedRecords=[...context.experiment.runs].sort((a,b)=>a.sequence-b.sequence),queuedRecord=requestedRecords[1];
assert.equal(context.activeRun.results.length,14);assert.equal(new Set(context.activeRun.results.map(r=>r.id)).size,14);
assert.equal(new Set(context.activeRun.results.map(r=>[r.caseId,r.attempt].join(':'))).size,14);
for(const result of context.activeRun.results){assert([1,2].includes(result.attempt));assert(!Object.hasOwn(result,'round'));assert(result.suiteIds.length);}
assert.equal(context.activeRun.results.filter(r=>r.status==='已跳过').length,2);
assert.equal(queuedRecord.status,'排队中');assert.equal(run('evRunExperiment(experiment.id).id'),context.activeRun.id);
let maxRunning=0,sawSecondRecord=false;
const checkScheduler=()=>{
  const running=requestedRecords.flatMap(record=>record.results.filter(r=>r.status==='运行中'));maxRunning=Math.max(maxRunning,running.length);assert(running.length<=3);
  const activeRecords=requestedRecords.filter(record=>record.results.some(r=>r.status==='运行中'));assert(activeRecords.length<=1,'full records never overlap');
  if(queuedRecord.status==='运行中'){sawSecondRecord=true;assert(['已完成','部分失败'].includes(context.activeRun.status),'the next full record starts only after the first finishes');}
};
checkScheduler();while(timers.size){advance();checkScheduler();}
assert.equal(maxRunning,3,'the configured concurrency is exercised, not merely displayed');assert(sawSecondRecord);assert.equal(context.activeRun.status,'部分失败');
const completed=clone(context.activeRun),summary=run('evExperimentSummary(activeRun)');
assert.equal(summary.total,14);assert.equal(summary.executed,12);assert.equal(summary.skipped,2);assert.equal(summary.pending+summary.running,0);
assert.equal(summary.tokens,context.activeRun.results.reduce((sum,r)=>sum+r.tokens,0));
assert.equal(summary.passRate,summary.passed/summary.executed*100);
context.nextRun=run('evRunExperiment(experiment.id)');
assert.notEqual(context.nextRun.id,context.activeRun.id);assert.equal(context.nextRun.results.length,14);
assert(!context.nextRun.results.some(r=>context.activeRun.results.some(old=>old.id===r.id)));
const callbacks=[...timers.values()].map(t=>t.fn);run('evStopExperiment(experiment.id)');const stopped=clone(context.nextRun);
for(const fn of callbacks)fn();drain();assert.deepEqual(clone(context.nextRun),stopped);
assert(context.nextRun.results.every(r=>r.status==='已跳过'&&r.evaluations.length===0));
assert.deepEqual(clone(context.activeRun),completed,'stop and rerun do not mutate historical evidence');
context.crossScene=run('evRunExperiment(experiment.id)');run("studio.scene='procurement';evData()");drain();assert.equal(context.crossScene.status,'部分失败');
assert.equal(run('evExperimentStore("procurement").experiments.length'),3);
run("studio.scene='sales';evData()");

// Each outer list shares search and column filters while keeping its own filter state.
context.freshCatalog=clone(originalCatalog);run('evCatalog.sales=freshCatalog;evState.search="";evState.agentIds=[];evState.objectIds=[];evAssetState.suiteSearch="";evAssetState.caseSearch="";evExperimentBack();evClearFilters()');
const tableIds=markup=>[...(markup.match(/<tbody>([\s\S]*?)<\/tbody>/)||['',''])[1].matchAll(/<tr><td\b[^>]*>([\s\S]*?)<\/td>/g)].map(m=>m[1].replace(/<[^>]*>/g,'').trim()).filter(id=>/^SAL-/.test(id));
const actionCells=markup=>[...(markup.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1]||'').matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].at(-1)?.[1]).filter(Boolean);
const buttonLabels=markup=>[...markup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(m=>m[1].replace(/<[^>]*>/g,'').trim());
const actionCode=(cell,label)=>[...cell.matchAll(/<button\b[^>]*onclick="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g)].find(m=>m[2].replace(/<[^>]*>/g,'').trim()===label)?.[1];
const listViews=[['task','evTasksView()','搜索业务任务','筛选所属 Agent'],['suite','evSuitesView()','搜索评测集','筛选所属 Agent'],['case','evCasesView()','搜索评测用例','筛选标签'],['experiment','evExperimentsView()','搜索评测实验','筛选Agent'],['evaluator','evEvaluatorsView()','搜索离线评估器','筛选状态']];
for(const [kind,call,searchLabel,filterLabel] of listViews){
  const markup=run(call);handlers(markup);
  assert(markup.includes('aria-label="'+searchLabel+'"')&&markup.includes('aria-label="'+filterLabel+'"'),kind);
  assert(markup.includes('<th>编号</th>')&&/class="[^"]*\bev-fixed-id\b/.test(markup),kind+' retains an ID-first table');
  assert(!/<select\b/.test(markup),kind+' uses column filters rather than a separate toolbar status selector');
  for(const cell of actionCells(markup)){
    const menu=cell.match(/<details\b[^>]*class="[^"]*\bev-more\b[^"]*"[^>]*>([\s\S]*?)<\/details>/);assert(menu,kind+' exposes additional actions in More');
    assert.deepEqual(buttonLabels(cell.replace(menu[0],'')),['查看'],kind+' has only View as its direct row button');
    assert(menu[1].includes('>更多</summary>'));const menuLabels=buttonLabels(menu[1]);
    const required={task:['编辑','测试','删除'],suite:['编辑','删除'],case:['编辑','归档'],evaluator:['编辑','删除']}[kind]||[];
    for(const label of required)assert(menuLabels.includes(label),kind+' retains '+label+' in More');
    if(['case','evaluator'].includes(kind))assert(menuLabels.some(label=>['启用','停用'].includes(label)),kind+' retains the enable/disable action');
    if(kind==='experiment'){assert(menuLabels.some(label=>['执行实验','全量执行','失败用例补跑','暂停','继续执行'].includes(label)));assert(/evExperiment(?:Start|Retry|Pause|Resume)\(/.test(menu[1]));}
    for(const button of menu[1].matchAll(/<button\b([^>]*)>/g))assert(button[1].includes('role="menuitem"'));
  }
}
assert(actionCells(run('evExperimentListTable([evExperimentGet("SAL-EXP-001")])'))[0].includes('>报告</button>'),'historical reports remain available in the row menu');
for(const [call,label] of [['evTasksView()','编辑'],['evSuitesView()','编辑'],['evCasesView()','编辑'],['evEvaluatorsView()','编辑']]){
  const code=actionCode(actionCells(run(call))[0],label);
  assert(code);run(code);assert(node('overlay').innerHTML.includes('编辑'),'menu edit actions still open the standard editor');handlers(node('overlay').innerHTML);run('evCloseModal()');
}
run(actionCode(actionCells(run('evTasksView()'))[0],'测试'));assert(run('evTaskTest!==null'));run('evCloseModal()');assert.equal(run('evTaskTest'),null);
const originalCaseVersion=run('evData().cases[0].version');run(actionCode(actionCells(run('evCasesView()'))[0],'停用'));
assert.equal(run('evData().cases[0].enabled'),false);assert.equal(run('evData().cases[0].version'),originalCaseVersion);
run(actionCode(actionCells(run('evCasesView()'))[0],'启用'));assert.equal(run('evData().cases[0].enabled'),true);
const startCode=actionCode(actionCells(run('evExperimentListTable([evExperimentGet("SAL-EXP-003")])'))[0],'执行实验');assert(startCode);run(startCode);
assert.equal(run('evExperimentGet("SAL-EXP-003").status'),'运行中');
const stopCode=actionCode(actionCells(run('evExperimentListTable([evExperimentGet("SAL-EXP-003")])'))[0],'暂停');assert(stopCode);run(stopCode);
assert.equal(run('evExperimentGet("SAL-EXP-003").status'),'已暂停');
const reportCode=actionCode(actionCells(run('evExperimentListTable([evExperimentGet("SAL-EXP-003")])'))[0],'报告');assert(reportCode);run(reportCode);
assert.equal(run('evExperimentState.tab'),'实验报告');assert.equal(run('evExperimentState.runId'),run('evExperimentActiveExecution(evExperimentGet("SAL-EXP-003")).id'));run('evExperimentBack()');
run('evOpenSuite("SAL-ES-001","评测用例")');
for(const cell of actionCells(run('evSuiteView(evData().suites[0])'))){
  const menu=cell.match(/<details\b[^>]*>([\s\S]*?)<\/details>/);assert(menu);assert.deepEqual(buttonLabels(cell.replace(menu[0],'')),['查看']);
  for(const label of ['编辑','从评测集移除','归档'])assert(buttonLabels(menu[1]).includes(label),'suite case menus retain '+label);
}
assert(run('evSuiteDetailActions(evData().suites[0])').includes('>编辑</button>'),'suite detail keeps its direct edit action');run('evSuiteBack()');
for(const open of ['evTaskDetail("SAL-BT-001")','evCaseDetail("SAL-EC-001")','evEvaluatorDetail("SAL-EV-001")']){
  run(open);assert(node('overlay').innerHTML.includes('>编辑</button>'),'resource details retain their edit action');run('evCloseModal()');
}
run('evFilterChange("task","agent","sales-app-agent",true)');
assert.deepEqual(tableIds(run('evTasksView()')),['SAL-BT-004']);
run('evFilterChange("task","agent","sales-agent-1",true);evFilterChange("task","agent","sales-agent-1",true)');
assert.equal(tableIds(run('evTasksView()')).length,4);assert.equal(snapshot('evListFilters.task.agent').length,2,'rechecking an option does not duplicate it');
run('evFilterChange("task","agent","sales-app-agent",false)');assert.equal(tableIds(run('evTasksView()')).length,3);
run('evState.agentIds=["sales-app-agent"]');assert.deepEqual(tableIds(run('evTasksView()')),[],'column filters intersect the workspace Agent scope');run('evState.agentIds=[]');
run('evFilterChange("suite","agent","sales-app-agent",true)');assert.deepEqual(snapshot('evVisibleSuites().map(s=>s.id)'),['SAL-ES-003']);
run('evClearFilters("suite");evAssetState.suiteSearch="sal-es-001"');assert.deepEqual(snapshot('evVisibleSuites().map(s=>s.id)'),['SAL-ES-001']);run('evAssetState.suiteSearch=""');
assert.deepEqual(snapshot('evListFilters.task.agent'),['sales-agent-1'],'clearing another list leaves task filtering intact');
const caseTag=originalCatalog.cases[0].tags[0];run('evFilterChange("case","tags",'+JSON.stringify(caseTag)+',true);evFilterChange("case","enabled","enabled",true)');
assert.deepEqual(snapshot('evVisibleCases().map(c=>c.id)'),originalCatalog.cases.filter(c=>!c.archived&&c.enabled&&c.tags.includes(caseTag)).map(c=>c.id));
run('evFilterChange("case","enabled","disabled",true)');assert.deepEqual(snapshot('evVisibleCases().map(c=>c.id)'),originalCatalog.cases.filter(c=>!c.archived&&c.tags.includes(caseTag)).map(c=>c.id));
run('evFilterChange("experiment","agent","sales-agent-1",true);evFilterChange("experiment","status","部分失败",true)');
assert(run('evExperimentVisible().length>0&&evExperimentVisible().every(e=>e.agentId==="sales-agent-1"&&e.status==="部分失败")'));
run('evFilterChange("evaluator","enabled","disabled",true)');assert.deepEqual(snapshot('evEvaluatorVisible().map(e=>e.id)'),['SAL-EV-003']);
assert(snapshot('evListFilters.case.tags').includes(caseTag));
const escapedHeader=run('evFilterHeader("标签","case","tags",[{id:"a\\\"b",name:"<script>alert(1)</script>"}])');handlers(escapedHeader);
assert(!escapedHeader.includes('<script>')&&escapedHeader.includes('&lt;script&gt;'));
run("studio.scene='procurement';evData()");assert.deepEqual(snapshot('evListFilters'),{},'scene changes discard all prior column-filter selections');
run("studio.scene='sales';evData()");

// All creation drawers use the shared anchored structure and configuration sections.
for(const open of ['evEditTask()','evEditSuite()','evEditCase()','evNewExperiment()','evEditEvaluator()']){
  run(open);const markup=node('overlay').innerHTML;handlers(markup);
  for(const cls of ['ev-backdrop','ev-modal','ev-form-nav'])assert(markup.includes(cls),open);
  assert.equal((markup.match(/\bid="ev-form"/g)||[]).length,1);assert(!/<h3>\s*(?:使用说明|运行说明)\s*<\/h3>/.test(markup));run('evCloseModal()');
}

console.log('Passed: multi-suite de-duplication and immutable execution/model/MCP snapshots; validation limits, unique repeated results, real concurrency and sequential full-record queues; stop/history/scene isolation; independent column filters/search and ID-first tables; View/More-only row actions retain working edit/test/status/run/report paths; detail edits and anchored drawers.');
