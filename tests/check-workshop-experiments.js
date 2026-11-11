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
const primaryExperimentCount=markup=>{
  const nav=markup.match(/<nav\b[^>]*aria-label="评测页签"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||'';
  return Number(nav.match(/>评测实验\s*<span\b[^>]*>(\d+)<\/span>/)?.[1]??NaN);
};
const detailTabNames=markup=>[...markup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(m=>m[1].replace(/<span\b[^>]*>[\s\S]*?<\/span>/g,'').replace(/<[^>]*>/g,'').trim());
const resultRows=markup=>[...(markup.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1]||'').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>m[1]).filter(row=>row.includes('evExperimentCaseDetail(')&&!row.includes('evExperimentToggleAttempts('));
const resultIds=markup=>resultRows(markup).map(row=>row.match(/evExperimentCaseDetail\('([^']+)'\)/)?.[1]);

// Seeded historical experiments are independent from mutable authoring catalogs.
run("currentSection='studio';studio.scene='sales';evData()");
const pristineSales=snapshot('evData()');
run('evData().tasks=[];evData().suites=[];evData().cases=[]');
const seededIds=new Set();
for(const scene of ['sales','procurement']){
  const store=snapshot('evExperimentStore('+JSON.stringify(scene)+')');
  assert.equal(store.scene,scene);assert.equal(store.experiments.length,3);assert.equal(store.sequence,3);
  for(const experiment of store.experiments){
    assert(!seededIds.has(experiment.id));seededIds.add(experiment.id);
    assert.equal(experiment.scene,scene);assert(experiment.snapshot.tasks.length&&experiment.snapshot.cases.length);
    assert(experiment.snapshot.tasks.every(t=>t.agentId===experiment.agentId));
    for(const trial of experiment.runs)assert.equal(trial.results.length,experiment.snapshot.cases.length);
  }
}
assert.equal(seededIds.size,6);
const originalSales=pristineSales;
const untouchedProcurement=snapshot('evExperimentStore("procurement")');
run('evData().tasks=[];evData().suites=[];evData().cases=[]');
assert.equal(run('evExperimentStore("sales").experiments.length'),3);
context.restoreCatalog=JSON.parse(JSON.stringify(originalSales));run('evCatalog.sales=restoreCatalog');

// Creation validates every dependency and captures the selected immutable version/data snapshot.
assert(run('evAgentVersions("sales-agent-1").length>0'));
assert.equal(run('evAgentVersions("procurement-agent-1").length'),0);
assert.equal(run('evAgentVersions("missing-agent").length'),0);
assert(run('new Set(evAgentVersions("sales-agent-1").map(v=>v.id)).size===evAgentVersions("sales-agent-1").length'));
const version=run('evAgentVersions("sales-agent-1")[0].id');
const params={name:'快照隔离与完整运行',agentId:'sales-agent-1',version,suiteId:'SAL-ES-002',suiteIds:['SAL-ES-002'],evaluatorIds:run('evEvaluatorDefaultIds("sales")'),execution:{concurrency:1,caseRuns:1,fullRuns:1,modelId:'mock-eval-balanced',mcpIds:[]}};
context.params=params;
for(const override of [{name:''},{agentId:'procurement-agent-1'},{version:'V999'},{suiteIds:['PUR-ES-001']},{suiteIds:['SAL-ES-003']}]){
  context.invalid={...params,...override};
  assert.throws(()=>run('evCreateExperiment(invalid)'));
}
run('evData().suites.find(s=>s.id==="SAL-ES-002").caseIds.forEach(id=>evData().cases.find(c=>c.id===id).enabled=false)');
assert.throws(()=>run('evCreateExperiment(params)'),/启用/);
context.restoreCatalog=JSON.parse(JSON.stringify(originalSales));run('evCatalog.sales=restoreCatalog');
run('evData().suites.find(s=>s.id==="SAL-ES-002").taskIds.push("SAL-BT-004")');
assert.throws(()=>run('evCreateExperiment(params)'),/所属|属于/);
context.restoreCatalog=JSON.parse(JSON.stringify(originalSales));run('evCatalog.sales=restoreCatalog');
context.testExp=run('evCreateExperiment(params)');
assert.equal(context.testExp.status,'未运行');assert.equal(context.testExp.runs.length,0);
assert(!seededIds.has(context.testExp.id));
assert.equal(context.testExp.version,version);assert.equal(context.testExp.snapshot.agent.version,version);
assert.deepEqual(JSON.parse(JSON.stringify(context.testExp.snapshot.cases.map(c=>c.id))),['SAL-EC-002','SAL-EC-006','SAL-EC-007']);
assert(run('Object.isFrozen(testExp.snapshot)&&Object.isFrozen(testExp.snapshot.tasks)&&Object.isFrozen(testExp.snapshot.tasks[0])&&Object.isFrozen(testExp.snapshot.cases[0].tags)'));
const immutableSnapshot=snapshot('testExp.snapshot');
run('evData().tasks[1].name="后续编辑后的任务";evData().tasks[1].dimensions[0].values.push("后来增加的枚举");evData().cases[1].input="后续编辑后的输入";evData().cases[1].archived=true;evData().tasks=[];evData().suites=[];evData().cases=[]');
assert.deepEqual(snapshot('testExp.snapshot'),immutableSnapshot);

const assertSummary=trial=>{
  context.trial=trial;
  const summary=snapshot('evExperimentSummary(trial)'),rows=trial?.results||[];
  const count=status=>rows.filter(r=>r.status===status).length;
  const passed=count('通过'),failed=count('未通过'),errors=count('运行失败'),skipped=count('已跳过'),executed=passed+failed+errors;
  const durationMs=rows.reduce((n,row)=>n+(Number(row.durationMs)||0),0),tokens=rows.reduce((n,row)=>n+(Number(row.tokens)||0),0);
  assert.deepEqual(summary,{total:rows.length,finished:executed+skipped,passed,failed,errors,observed:0,skipped,pending:count('待运行'),running:count('运行中'),executed,
    passRate:executed?passed/executed*100:null,avgDurationMs:executed?durationMs/executed:0,durationMs,tokens});
  return summary;
};
// A mixed report must exclude skipped, pending, and running cases from the denominator.
const crafted={results:[['通过',100,20],['未通过',200,40],['运行失败',50,6],['已跳过',0,0],['待运行',0,0],['运行中',0,0]].map(([status,durationMs,tokens])=>({status,durationMs,tokens}))};
assert.equal(assertSummary(crafted).executed,3);
assert.equal(assertSummary({results:[{status:'已跳过',durationMs:0,tokens:0},{status:'待运行'}]}).passRate,null);
assert.equal(assertSummary(null).passRate,null);

// Execution uses the snapshot even after all live source assets have been deleted.
context.firstRun=run('evRunExperiment(testExp.id)');
assert.equal(context.firstRun.status,'运行中');
assert.equal(context.testExp.runs.length,1);
assert.equal(run('evRunExperiment(testExp.id).id'),context.firstRun.id);
assert.equal(context.testExp.runs.length,1,'duplicate run clicks cannot start overlapping runs');
assert(context.firstRun.results.some(r=>r.status==='运行中'));
assert(context.firstRun.results.some(r=>r.status==='待运行'));
assert.equal(assertSummary(context.firstRun).skipped,1);
until(()=>context.firstRun.results.some(r=>r.status==='通过'||r.status==='未通过'||r.status==='运行失败'));
assert.equal(context.firstRun.status,'运行中','intermediate results are observable before all cases finish');
assertSummary(context.firstRun);drain();
assert.equal(context.firstRun.status,'已完成');assert.equal(context.testExp.status,'已完成');
assert(context.firstRun.startedAt&&context.firstRun.endedAt);
assert.equal(assertSummary(context.firstRun).pending+assertSummary(context.firstRun).running,0);
assert.equal(context.firstRun.elapsedMs,assertSummary(context.firstRun).durationMs);
assert.deepEqual(JSON.parse(JSON.stringify(context.firstRun.results.map(r=>r.input))),immutableSnapshot.cases.map(c=>c.input));
assert.deepEqual(JSON.parse(JSON.stringify(context.firstRun.results.map(r=>r.expected))),immutableSnapshot.cases.map(c=>c.expected));
for(const result of context.firstRun.results){
  if(result.status==='已跳过'){assert.equal(result.actual,'');assert.equal(result.tokens,0);assert.equal(result.durationMs,0);continue;}
  assert(result.reason);assert(result.durationMs>0);
  if(result.status==='运行失败')assert.equal(result.actual,'');else assert(result.actual.includes('Mock'));
  assert(result.dimensions.every(d=>immutableSnapshot.tasks.some(t=>t.id===d.taskId)&&typeof d.passed==='boolean'&&d.reason));
}
const historicRun=JSON.parse(JSON.stringify(context.firstRun));
context.secondRun=run('evRunExperiment(testExp.id)');
assert.notEqual(context.secondRun.id,context.firstRun.id);assert.equal(context.testExp.runs.length,2);
assert.equal(context.testExp.runs[0].id,context.secondRun.id);
drain();assert.equal(context.secondRun.status,'部分失败');
assert.deepEqual(JSON.parse(JSON.stringify(context.firstRun)),historicRun,'reruns do not overwrite earlier evidence');

// Stopping cancels scheduled work and stale callbacks cannot change the stopped result.
context.stoppedRun=run('evRunExperiment(testExp.id)');
until(()=>context.stoppedRun.results.some(r=>['通过','未通过','运行失败'].includes(r.status)));
const staleCallbacks=[...timers.values()].map(t=>t.fn);
assert.equal(run('evStopExperiment(testExp.id).id'),context.stoppedRun.id);
assert.equal(context.stoppedRun.status,'已停止');assert.equal(context.testExp.status,'已停止');
assert(!context.stoppedRun.results.some(r=>r.status==='待运行'||r.status==='运行中'));
const stoppedEvidence=JSON.parse(JSON.stringify(context.stoppedRun));
for(const callback of staleCallbacks)callback();drain();
assert.deepEqual(JSON.parse(JSON.stringify(context.stoppedRun)),stoppedEvidence);
assertSummary(context.stoppedRun);

// Navigation to another scene cannot redirect callbacks or cancel the owning experiment.
context.sceneRun=run('evRunExperiment(testExp.id)');
run("studio.scene='procurement';evData()");drain();
assert.equal(context.sceneRun.status,'部分失败');
assert.deepEqual(snapshot('evExperimentStore("procurement")'),untouchedProcurement);
run("studio.scene='sales';evData()");
context.restoreCatalog=JSON.parse(JSON.stringify(originalSales));run('evCatalog.sales=restoreCatalog');
assert.deepEqual(snapshot('testExp.snapshot'),immutableSnapshot);

// The evaluation route now renders experiment controls rather than the planned placeholder.
run("workbenchOpen('评测');evTab('评测实验');evExperimentBack()");
assert.equal(primaryExperimentCount(run('evScreen()')),run('evExperimentStore().experiments.length'));
assert(run('evScreen().includes("evNewExperiment()")'));
assert(!run('evExperimentsView().includes("待细化")'));
assert(run('evExperimentsView().includes("本地 Mock")||evExperimentsView().includes("查看")'));
handlers(run('evScreen()'));
const salesVisible=snapshot('evExperimentVisible().map(e=>e.id)');
assert(salesVisible.includes(context.testExp.id));
run("evState.agentIds=['sales-app-agent']");
assert(run('evExperimentVisible().length>0&&evExperimentVisible().every(e=>e.agentId==="sales-app-agent")'));
run("evState.agentIds=[];evExperimentState.search='快照隔离'");
assert.deepEqual(snapshot('evExperimentVisible().map(e=>e.id)'),[context.testExp.id]);
run("evExperimentState.search='';evFilterChange('experiment','status','未运行',true)");
assert(run('evExperimentVisible().every(e=>e.status==="未运行")'));
run("evClearFilters('experiment');evNewExperiment()");
let markup=node('overlay').innerHTML;
for(const label of ['评测实验名称','实验所属 Agent','实验 Agent 版本','请先选择 Agent'])assert(markup.includes('aria-label="'+label+'"'));
for(const label of ['执行并发数','每个用例执行次数','全量评测次数','评测模型','选择评估器','选择 MCP'])assert(markup.includes('aria-label="'+label+'"'));
assert(markup.includes('独立评测记录')&&markup.includes('独立对话')&&!markup.includes('每轮重复'),'the form distinguishes full records, independent conversations and dialogue turns');
for(const field of ['concurrency','caseRuns','fullRuns','modelId','evaluatorIds','mcpIds'])assert(markup.includes('name="'+field+'"'));
assert(!markup.includes('<h3>运行说明</h3>'),'creation presents configuration rather than a separate usage section');
assert.equal((markup.match(/\bid="ev-form"/g)||[]).length,1);
assert(/<button\b(?=[^>]*form="ev-form")(?=[^>]*type="submit")/.test(markup),'header create action remains associated with its native form');
assert(markup.includes('evSubmitExperiment(this)'));handlers(markup);
node('ev-experiment-name').value='保留的实验名称';run('evExperimentEditor.name="保留的实验名称"');
run('evExperimentAgentChange("sales-agent-1")');
assert.equal(node('ev-experiment-name').value,'保留的实验名称');
assert.equal(run('evExperimentEditor.name'),'保留的实验名称');
assert.equal(run('evExperimentEditor.version'), '');assert.equal(run('evExperimentEditor.suiteId'),'');
assert.equal(node('ev-experiment-version').disabled,false);assert(node('ev-experiment-suite').innerHTML.includes('请先选择 Agent 版本'));
run('evExperimentVersionChange('+JSON.stringify(version)+');evExperimentSuiteChange("SAL-ES-002")');
assert.equal(run('evExperimentEditor.suiteId'),'SAL-ES-002');
assert(node('ev-experiment-suite').innerHTML.includes('name="suiteIds"')&&node('ev-experiment-suite').innerHTML.includes('aria-label="选择评测集"'));
run('evExperimentSuiteChange(["SAL-ES-001","SAL-ES-002","SAL-ES-001"])');
assert.deepEqual(snapshot('evExperimentEditor.suiteIds'),['SAL-ES-001','SAL-ES-002']);assert.equal(run('evExperimentEditor.suiteId'),'SAL-ES-001');
assert(!node('ev-experiment-suite').innerHTML.includes('SAL-ES-003'),'scene Agent options cannot include application-Agent suites');
run('evExperimentAgentChange("sales-app-agent")');
assert.equal(run('evExperimentEditor.version'),'');assert.equal(run('evExperimentEditor.suiteId'),'');
assert.equal(node('ev-experiment-version').value,'');assert.deepEqual(snapshot('evExperimentEditor.suiteIds'),[]);
assert.equal(node('ev-experiment-name').value,'保留的实验名称');
const appVersion=run('evAgentVersions("sales-app-agent")[0].id');
run('evExperimentVersionChange('+JSON.stringify(appVersion)+')');
assert(node('ev-experiment-suite').innerHTML.includes('SAL-ES-003'));
assert(!node('ev-experiment-suite').innerHTML.includes('SAL-ES-001'));
run('evExperimentSuiteChange("SAL-ES-002")');assert.equal(run('evExperimentEditor.suiteId'),'');
run('evExperimentSuiteChange("SAL-ES-003")');assert.equal(run('evExperimentEditor.suiteId'),'SAL-ES-003');
const alternateVersion=run('evAgentVersions("sales-app-agent")[1].id');
run('evExperimentVersionChange('+JSON.stringify(alternateVersion)+')');
assert.equal(run('evExperimentEditor.suiteId'),'','changing version resets the selected suite');
run('evExperimentVersionChange("V999")');
assert.equal(run('evExperimentEditor.version'),'');assert(node('ev-experiment-suite').innerHTML.includes('请先选择 Agent 版本'));
const beforeInvalid=run('evExperimentStore().experiments.length');
context.form={values:{name:'无效依赖实验',agentId:'sales-agent-1',version:'V999',suiteId:'SAL-ES-002',scene:'sales'}};
assert.equal(run('evSubmitExperiment(form)'),false);
assert.equal(run('evExperimentStore().experiments.length'),beforeInvalid);
assert(node('ev-experiment-form-error').textContent.length>0);
assert(node('overlay').innerHTML.includes('新建评测实验'),'validation leaves the concrete editor available for correction');
const uiExecution={concurrency:3,caseRuns:2,fullRuns:2,modelId:run('evEvaluationModels()[1].id'),mcpIds:snapshot('evExperimentMcps().slice(0,1).map(m=>m.id)')};
context.form={values:{...params,...uiExecution,name:'通过标准编辑器创建实验',scene:'sales'}};
context.uiExperiment=run('evSubmitExperiment(form)');
assert.equal(run('evExperimentStore().experiments.length'),beforeInvalid+1);
assert.equal(run('evExperimentState.id'),context.uiExperiment.id);assert.equal(context.uiExperiment.runs.length,0);
assert.deepEqual(JSON.parse(JSON.stringify(context.uiExperiment.execution)),expectedSingleExecution({...uiExecution,evaluationPolicy:'all_selected'},context.uiExperiment.evaluatorIds),'native form fields reach the validated execution snapshot');
const firstListCells=markup=>[...((markup.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1]||'').match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/)?.[1]||'').matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(match=>match[1].replace(/<[^>]+>/g,'').trim());
const unrunList=run('evExperimentListTable([uiExperiment])'),unrunListCells=firstListCells(unrunList);
assert(unrunList.includes('<th>用例数</th>')&&unrunList.includes('<th>耗时</th>')&&unrunList.includes('<th>Token消耗</th>'));
assert(!unrunList.includes('用例 / 独立对话'));
assert.equal(unrunListCells[5],String(context.uiExperiment.snapshot.cases.length),'the experiment list counts unique cases, regardless of planned repeated conversations');
assert.deepEqual(unrunListCells.slice(6,8),['—','—'],'unrun experiments do not invent duration or Token consumption');
assert.equal(node('overlay').innerHTML,'');
assert.equal(run('evExperimentState.tab'),'用例结果','a newly created experiment opens case results');
let detailScreen=run('evScreen()');handlers(detailScreen);
assert(!detailScreen.includes('aria-label="评测页签"')&&!detailScreen.includes('<h2>评测</h2>'));
assert.equal((detailScreen.match(/<h2\b/g)||[]).length,1);assert.equal(detailScreen.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)?.[1],context.uiExperiment.name);
assert(detailScreen.indexOf('ont-crumb')<detailScreen.indexOf('<h2'));assert(detailScreen.includes('>执行</button>')&&detailScreen.includes('用例结果'));
assert.deepEqual(detailTabNames(run('evExperimentDetailTabs(uiExperiment)')),['用例结果','问题优化','实验报告','实验配置']);
assert(run('evExperimentDetailTabs(uiExperiment)').includes('id="ev-experiment-result-count">'+context.uiExperiment.snapshot.cases.length*context.uiExperiment.execution.caseRuns+'</span>'),'unrun experiments expose all planned case executions');
assert(detailScreen.includes('选择评测记录')&&detailScreen.includes('尚未执行'));
run('evExperimentSelectTab("用例结果")');assert(run('evExperimentsView().includes("尚未执行")'));
assert(run('evExperimentsView()').includes('id="ev-experiment-history"'),'the shared run selector is available across detail tabs');
const previewBefore=snapshot('uiExperiment'),preview=run('evExperimentResultTable(uiExperiment,null)');
assert(preview.includes('SAL-EC-002')&&preview.includes(context.uiExperiment.snapshot.cases[0].input),'unrun cases expose the fixed inputs and expected outputs');
assert(!preview.includes('<th>评估器评分</th>')&&!preview.includes('分</span>'),'results do not flatten multiple evaluator scores into a column');
handlers(preview);
context.previewCase=run('evExperimentDisplayResults(uiExperiment,null)[0]');
run('evExperimentCaseDetail(previewCase.id)');
assert(node('overlay').innerHTML.includes('查看待运行用例')&&node('overlay').innerHTML.includes(context.previewCase.expected));
assert(node('overlay').innerHTML.includes('尚未产生评估器分数')&&!node('overlay').innerHTML.includes('ev-result-annotate'),'unrun review explains that no score exists and offers no annotation');
run('evCloseModal();evExperimentState.resultSearch="SAL-EC-002"');
const filteredPreview=run('evExperimentResultTable(uiExperiment,null)');
assert(filteredPreview.includes('SAL-EC-002')&&!filteredPreview.includes('SAL-EC-001'));
assert.deepEqual(snapshot('uiExperiment'),previewBefore,'previewing cases never creates a run or mutates the snapshot');
run('evExperimentState.resultSearch="";evExperimentSelectTab("问题优化")');
assert(run('evExperimentsView()').includes('暂无问题'));
run('evExperimentSelectTab("实验配置")');

// Result rows, details, and report metrics all come from the selected immutable run.
context.uiRun=run('evExperimentStart(uiExperiment.id)');
assert.equal(context.uiRun.status,'运行中');
assert.equal(run('evExperimentState.runId'),context.uiRun.id);
assert.equal(run('evExperimentState.tab'),'用例结果','running an experiment opens execution results');
assert(run('evExperimentDetailTabs(uiExperiment)').includes('id="ev-experiment-result-count">'+context.uiRun.results.length+'</span>'));
assert(run('evExperimentsView()').includes('id="ev-experiment-history"'));
const runningDashboard=run('evExperimentDashboard(uiExperiment,uiRun)');
assert(!runningDashboard.includes('ev-run-summary')&&!runningDashboard.includes('ev-experiment-run-summary')&&!runningDashboard.includes('role="progressbar"'),'execution statistics remain without a duplicate status/processed summary');
assert(!run('evExperimentRunSelector(uiExperiment,uiRun)').replace(/title="[^"]*"/g,'').includes(context.uiRun.id+' · '),'history option labels use the short run sequence and minute timestamp');
handlers(run('evExperimentsView()'));drain();
assert.equal(context.uiRun.status,'部分失败');
const measuredListCells=firstListCells(run('evExperimentListTable([uiExperiment])'));
const listRun=context.uiExperiment.runs[0],measuredRows=listRun.results.filter(row=>['通过','未通过','运行失败'].includes(row.status));
assert.equal(measuredListCells[5],String(new Set(listRun.results.map(row=>row.caseId)).size),'repeated conversations count as one case in the experiment list');
context.listDuration=measuredRows.reduce((total,row)=>total+row.durationMs,0);
assert.equal(measuredListCells[6],run('evExperimentDuration(listDuration)'),'duration belongs to the latest listed full evaluation record');
assert.equal(measuredListCells[7],measuredRows.reduce((total,row)=>total+row.tokens,0).toLocaleString('zh-CN'),'Token usage is the total for the listed record, including failed executions');
const completedDashboard=run('evExperimentDashboard(uiExperiment,uiRun)');
assert(!completedDashboard.includes('ev-run-summary')&&!completedDashboard.includes('ev-experiment-run-summary'),'completed records do not add a status/processed summary');
assert(!run('evExperimentResults(uiExperiment,uiRun)').includes('ev-record-source-note'),'full results do not add a frozen-result explanation');
run('evExperimentSelectTab("问题优化")');
assert(run('evExperimentsView()').includes('筛选状态')&&run('evExperimentsView()').includes('待修复'));
assert.equal(run('evExperimentIssuesSync(uiExperiment,uiRun).length'),0,'finished execution does not create issues before analysis');
run('evExperimentIssueAnalyzeComplete(uiExperiment,uiRun)');assert(run('evExperimentIssuesSync(uiExperiment,uiRun).length')>0);
run('evExperimentSelectTab("用例结果")');
assertSummary(context.uiRun);
run('evExperimentSelectTab("实验报告")');
const report=run('evExperimentsView()');handlers(report);
assert(report.includes('id="ev-experiment-history"'),'the report shares the run selector and its selected evidence with the other detail tabs');
assert(report.includes('通过率不包含已跳过、待运行和运行中的用例'));
assert(report.includes('运行失败')&&report.includes('已跳过')&&report.includes('业务任务评估维度'));
const reportMetrics=Object.fromEntries([...run('evExperimentReport(uiExperiment,uiRun)').matchAll(/<tr><td>([^<]+)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)].map(m=>[m[1],m[2]]));
const summary=assertSummary(context.uiRun);
for(const [label,value] of [['执行总数',summary.total],['已处理',summary.finished],['通过',summary.passed],['未通过',summary.failed],['运行失败',summary.errors],['已跳过',summary.skipped]])assert.equal(reportMetrics[label],String(value));
assert.equal(reportMetrics['通过率'],run('evExperimentRate(evExperimentSummary(uiRun).passRate)'));
assert.equal(reportMetrics['总耗时'],run('evExperimentDuration(evExperimentSummary(uiRun).durationMs)'));
assert.equal(reportMetrics['平均耗时'],run('evExperimentDuration(evExperimentSummary(uiRun).avgDurationMs)'));
assert.equal(reportMetrics.Tokens,Number(summary.tokens).toLocaleString('zh-CN'));
const grouped=run('evExperimentDimensionRows(uiRun)');
for(const group of grouped){
  const values=context.uiRun.results.flatMap(r=>r.dimensions||[]).filter(d=>d.taskId===group.taskId&&d.name===group.name);
  assert.equal(group.total,values.length);assert.equal(group.passed,values.filter(d=>d.passed).length);
}
const result=context.uiRun.results.find(r=>r.status!=='已跳过');context.selectedResult=result;
run('evExperimentCaseDetail(selectedResult.id)');markup=node('overlay').innerHTML;handlers(markup);
for(const label of ['评测输入','Agent 输出','预期输出','评估结果','开始时间','结束时间','评分依据'])assert(markup.includes(label));
assert(markup.includes(run('esc(selectedResult.input)'))&&markup.includes(run('esc(selectedResult.expected)')));
assert(markup.includes(run('esc(selectedResult.reason)')));assert(markup.includes(context.uiRun.id));
for(const evaluation of result.evaluations)assert(markup.includes(evaluation.name)&&markup.includes(evaluation.reason));
run('evCloseModal();evExperimentCaseDetail(selectedResult.caseId)');
assert.equal(node('overlay').innerHTML,'','an ambiguous repeated case ID must not open another execution result');
context.repeatedResult=context.uiRun.results.filter(r=>r.caseId===result.caseId).at(-1);
run('evExperimentCaseDetail(repeatedResult.id)');markup=node('overlay').innerHTML;handlers(markup);
assert(markup.includes(context.repeatedResult.conversationId)&&markup.includes('用例执行'),'the chosen repeat identifies its independent conversation');
assert(run('evExperimentResultTable(uiExperiment,uiRun)').includes("evExperimentCaseDetail('"+context.repeatedResult.id+"')"));
run('evCloseModal();evExperimentSelectTab("用例结果")');
run('evFilterChange("experimentResult","status","已跳过",true)');
const skippedTable=run('evExperimentResultTable(uiExperiment,uiRun)');
assert(skippedTable.includes('SAL-EC-007'));assert(!skippedTable.includes('SAL-EC-002'));
run('evClearFilters("experimentResult")');
const oldUIRun=JSON.parse(JSON.stringify(context.uiRun));
context.uiRerun=run('evExperimentStart(uiExperiment.id)');
run('evExperimentSelectRun(uiRun.id);evExperimentSelectTab("实验报告")');
drain();
assert.equal(run('evExperimentState.runId'),context.uiRun.id,'background completion must not replace the selected historical run');
assert.deepEqual(JSON.parse(JSON.stringify(context.uiRun)),oldUIRun);
assert(run('evExperimentsView()').includes('id="ev-experiment-history"'),'the shared run selector is available across detail tabs');assert(run('evExperimentsView()').includes(context.uiRun.id));
run('evExperimentSelectTab("实验配置")');assert.equal(run('evExperimentState.runId'),context.uiRun.id);
assert(!run('evExperimentsView()').includes('id="ev-experiment-history"'),'current configuration is independent of the selected historical result scope');assert(run('evExperimentsView()').includes('当前实验配置'),'the configuration view clearly names its current scope');
run('evExperimentSelectTab("用例结果")');assert.equal(run('evExperimentState.runId'),context.uiRun.id);
assert.equal(run('evExperimentSelectedRun(uiExperiment).id'),context.uiRun.id);
assert(run('evExperimentsView()').includes("evExperimentSelectRun('"+context.uiRun.id+"')"));
context.uiStop=run('evExperimentStart(uiExperiment.id)');
run('evExperimentStop(uiExperiment.id)');drain();
assert.equal(context.uiStop.status,'已停止');assertSummary(context.uiStop);
assert(run('evExperimentsView().includes("已停止")'));
run('evExperimentSelectTab("实验报告")');
assert.equal(assertSummary(context.uiStop).passRate,null);
assert(run('evExperimentsView().includes("<td>通过率</td><td>—</td>")'),'a stopped run with no executed cases has no misleading pass percentage');
run('evExperimentSelectTab("用例结果");evExperimentSelectRun(uiRun.id);evExperimentSelectTab("实验报告")');
assert.equal(run('evExperimentState.runId'),context.uiRun.id);assert(run('evExperimentsView()').includes(context.uiRun.id));
assert(!run('evExperimentsView().includes("<td>通过率</td><td>—</td>")'),'switching history in results changes the subsequent report to that completed run');
// Failure and error drawers expose the original run evidence, and skipped cases do not invent output.
const seededExperiment=run('evExperimentGet("SAL-EXP-001")');
context.seededExperiment=seededExperiment;context.seededRun=seededExperiment.runs[0];
run('evExperimentOpen(seededExperiment.id,seededRun.id,"实验报告")');
assertSummary(context.seededRun);
for(const status of ['未通过','运行失败']){
  const failure=context.seededRun.results.find(r=>r.status===status);assert(failure);context.failure=failure;
  assert(run('evExperimentsView()').includes(failure.caseId));
  run('evExperimentCaseDetail(failure.id)');
  const evidence=node('overlay').innerHTML;handlers(evidence);
  assert(evidence.includes(run('esc(failure.reason)')));
  assert(evidence.includes(run('esc(failure.input)'))&&evidence.includes(run('esc(failure.expected)')));
  if(status==='运行失败')assert(evidence.includes('本次执行未产生输出'));
  run('evCloseModal()');
}
run('evExperimentOpen(uiExperiment.id,uiStop.id,"用例结果")');
const skipped=context.uiStop.results.find(r=>r.status==='已跳过');context.skippedResult=skipped;
run('evExperimentCaseDetail(skippedResult.id)');
assert(node('overlay').innerHTML.includes('用例未执行，无 Agent 输出')&&node('overlay').innerHTML.includes('已跳过'));
assert(!node('overlay').innerHTML.includes('Mock Agent 输出'),'skipped cases have no fabricated execution output');
run('evCloseModal()');
run('evExperimentBack()');assert.equal(run('evExperimentState.id'),null);assert.equal(run('evState.tab'),'评测实验');
assert.equal(primaryExperimentCount(run('evScreen()')),beforeInvalid+1,'returning to the list shows the new experiment in the primary count');
assert(run('evExperimentsView()').includes("evExperimentOpen('"+context.uiExperiment.id+"','"+context.uiExperiment.runs[0].id+"','实验报告')"),'explicit row report links retain their selected run');
run('evExperimentOpen(uiExperiment.id,uiRun.id,"实验报告")');assert.equal(run('evExperimentState.tab'),'实验报告');assert.equal(run('evExperimentState.runId'),context.uiRun.id);
run('evExperimentOpen(uiExperiment.id)');assert.equal(run('evExperimentState.tab'),'用例结果','ordinary view links open results');

// Search combines with a multi-status column filter, while repeated names remain row-addressable.
context.searchCatalog=JSON.parse(JSON.stringify(originalSales));
const duplicateName='重复业务结果 <img src=x onerror="boom()">';
for(const id of ['SAL-EC-002','SAL-EC-006'])context.searchCatalog.cases.find(c=>c.id===id).name=duplicateName;
run('evCatalog.sales=searchCatalog');
context.searchExperiment=run('evCreateExperiment({...params,name:"结果检索与同名用例",execution:{concurrency:2,caseRuns:2,fullRuns:2}})');
context.searchRun=run('evExperimentStart(searchExperiment.id)');drain();run("searchRun.results.forEach(r=>evExperimentExpanded.add(searchRun.id+':'+r.caseId))");
const searchTable=()=>run('evExperimentResultTable(searchExperiment,evExperimentRunGet(searchExperiment,evExperimentState.runId))');
markup=searchTable();handlers(markup);
assert(markup.includes('aria-label="搜索实验用例结果"')&&markup.includes('aria-label="筛选状态"'));
assert(!/<select\b/.test(markup),'result status selection lives in the column header');
assert(!markup.includes('<img src=x')&&markup.includes('&lt;img'),'result names are escaped in links and search output');
const searchInputHandler=markup.match(/<input\b[^>]*aria-label="搜索实验用例结果"[^>]*oninput="([^"]*)"/)?.[1];assert(searchInputHandler);
context.dispatchedSearch={value:'重复业务结果'};run('(function(){'+searchInputHandler+'}).call(dispatchedSearch)');assert.equal(run('evExperimentState.resultSearch'),'重复业务结果');
assert.equal(resultRows(searchTable()).length,4,'two equally named cases retain every independent attempt in the selected record');
const groupedOrder=rows=>rows.sort((a,b)=>a.caseId.localeCompare(b.caseId)||a.attempt-b.attempt);
const namedSource=groupedOrder(Array.from(context.searchRun.results)).filter(r=>r.name===duplicateName),namedPassCount=namedSource.filter(r=>r.status==='通过').length;
run('evFilterChange("experimentResult","status","通过",true)');
assert.deepEqual(resultIds(searchTable()),groupedOrder(Array.from(context.searchRun.results).filter(r=>r.status==='通过'&&r.name===duplicateName)).map(r=>r.id));
run('evFilterChange("experimentResult","status","未通过",true)');assert.deepEqual(resultIds(searchTable()),namedSource.filter(r=>['通过','未通过'].includes(r.status)).map(r=>r.id),'selected statuses combine with OR');
run('evFilterChange("experimentResult","status","通过",false)');assert.deepEqual(resultIds(searchTable()),namedSource.filter(r=>r.status==='未通过').map(r=>r.id));
run('evClearFilters("experimentResult");evFilterChange("experimentResult","status","已跳过",true)');
assert.equal(resultRows(searchTable()).length,0,'name search combines with status using AND');
run('evExperimentState.resultSearch=""');assert.equal(resultRows(searchTable()).length,2);
run('evClearFilters("experimentResult");evExperimentState.resultSearch="sal-ec-002"');
assert.deepEqual(resultIds(searchTable()),Array.from(context.searchRun.results.filter(r=>r.caseId==='SAL-EC-002'),r=>r.id),'case identifiers match case-insensitively');
context.exactResultId=context.searchRun.results[0].id;run('evExperimentState.resultSearch=exactResultId');assert.deepEqual(resultIds(searchTable()),[context.exactResultId],'a repeated execution can be located by its unique result identifier');
context.escapedSearch=duplicateName;run('evExperimentState.resultSearch=escapedSearch');markup=searchTable();assert(!markup.includes('<img src=x'));assert(markup.includes('value="'+run('esc(escapedSearch)')+'"'),'search field values remain escaped');
run('evExperimentState.resultSearch="[a+b].*"');assert.equal(resultRows(searchTable()).length,0,'search treats regular-expression punctuation as literal text');
run('evExperimentState.resultSearch="重复业务结果"');
const namedRows=resultRows(searchTable());assert.equal(new Set(resultIds(searchTable())).size,namedRows.length);
const resultHeaders=[...searchTable().matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map(m=>(m[1].match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/)?.[1]||m[1]).replace(/<[^>]*>/g,'').trim());
const resultNameColumn=resultHeaders.indexOf('名称');assert(resultNameColumn>=0,'result tables expose a named Name column');
for(const row of namedRows){
  const nameCell=[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)][resultNameColumn]?.[1]||'',open=nameCell.match(/onclick="([^"]*)"/);
  assert(open,'each result name opens its evidence drawer');const id=open[1].match(/evExperimentCaseDetail\('([^']+)'\)/)?.[1];
  assert(id&&context.searchRun.results.some(r=>r.id===id));run(open[1]);const evidence=node('overlay').innerHTML;handlers(evidence);
  const source=context.searchRun.results.find(r=>r.id===id),evidenceText=evidence.replace(/<[^>]*>/g,'').replace(/\s+/g,'');assert(evidenceText.includes('用例执行')&&evidence.includes(source.conversationId));
  assert(evidence.includes(source.caseId));for(const control of evidence.matchAll(/<textarea\b([^>]*)>/g))assert(/\breadonly\b/.test(control[1]));
  assert(!/onclick="evEdit/.test(evidence),'result evidence remains read-only');run('evCloseModal()');
}
run('evFilterChange("experimentResult","status","通过",true);evExperimentSelectTab("实验报告")');
assert.equal(run('evExperimentState.resultSearch'),'重复业务结果');assert.deepEqual(snapshot('evListFilters.experimentResult.status'),['通过']);
assert.equal(assertSummary(context.searchRun).total,6,'search does not alter the stored run or report denominator');
run('evExperimentSelectTab("实验配置");evExperimentSelectTab("用例结果")');assert.equal(resultRows(searchTable()).length,namedPassCount,'detail tab changes preserve the active search/filter');
context.searchRerun=run('evExperimentStart(searchExperiment.id)');drain();
assert.equal(run('evExperimentState.resultSearch'),'');assert.deepEqual(snapshot('evListFilters.experimentResult'),{});
const visibleSearch={value:'重复业务结果'},visibleStatusOptions=[{checked:true},{checked:false},{checked:true}];
selectors.set('#ev-experiment-results-table input[aria-label="搜索实验用例结果"]',visibleSearch);lists.set('#ev-experiment-results-table .ev-column-filter input',visibleStatusOptions);
run('evExperimentState.resultSearch="重复业务结果";evFilterChange("experimentResult","status","通过",true);evExperimentSelectRun(searchRun.id)');
assert.equal(run('evExperimentState.resultSearch'),'');assert.deepEqual(snapshot('evListFilters.experimentResult'),{});
assert.equal(visibleSearch.value,'');assert(visibleStatusOptions.every(input=>!input.checked),'retained history controls visibly reset with their underlying filter state');
selectors.delete('#ev-experiment-results-table input[aria-label="搜索实验用例结果"]');lists.delete('#ev-experiment-results-table .ev-column-filter input');
assert(resultIds(searchTable()).every(id=>id.startsWith(context.searchRun.id+'-')),'history names open results from the selected run');
run('evExperimentState.resultSearch="旧过滤";evFilterChange("experimentResult","status","通过",true);evExperimentBack()');
assert.equal(run('evExperimentState.resultSearch'),'');assert.deepEqual(snapshot('evListFilters.experimentResult'),{});
run('evExperimentState.resultSearch="旧过滤";evFilterChange("experimentResult","status","通过",true);evExperimentOpen(searchExperiment.id,searchRun.id,"用例结果")');
assert.equal(run('evExperimentState.resultSearch'),'');assert.deepEqual(snapshot('evListFilters.experimentResult'),{});
run('evExperimentState.resultSearch="主入口旧过滤";evFilterChange("experimentResult","status","通过",true);evTab("评测实验")');
assert.equal(run('evExperimentState.id'),null);assert.equal(run('evExperimentState.resultSearch'),'');assert.deepEqual(snapshot('evListFilters.experimentResult'),{});
run('evExperimentOpen(searchExperiment.id,searchRun.id,"用例结果")');
run('evExperimentState.resultSearch="旧场景搜索";evFilterChange("experimentResult","status","通过",true)');
run("studio.scene='procurement';evData();evExperimentUI()");
assert.equal(run('evExperimentState.resultSearch'),'');assert.deepEqual(snapshot('evListFilters.experimentResult||{}'),{});assert(run('Object.values(evListFilters).every(filters=>Object.values(filters).every(values=>!values.length))'));
assert.equal(run('evExperimentOpen(uiExperiment.id)'),false);
assert.equal(run('evExperimentState.id'),null);
assert(run('evExperimentVisible().every(e=>e.scene==="procurement")'));

console.log('Passed: scoped creation and immutable snapshots; progressive runs, history, stop/stale cancellation and exact reports; native forms and lifted detail navigation; result search AND multi-status filters, literal/XSS-safe queries and reset boundaries; same-name repeated results open unique read-only evidence; selected-history reports and generated handler syntax.');
