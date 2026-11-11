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


run("currentSection='studio';studio.scene='sales';evData()");
context.suite=run('evData().suites[0]');context.other=run('evData().suites[1]');const suite=context.suite,other=context.other;
run('suite.caseBindings={};other.caseBindings={}');
assert.equal(run('evSuiteCoveredTasks(suite).length'),0,'configured tasks alone do not count as coverage');
assert.deepEqual(snapshot('evSuiteCoverageMetrics(suite).map(m=>m.value)'),[5,0,0]);
context.task=run('evSuiteLinkedTasks(suite)[0]');const task=context.task;context.caseId=suite.caseIds[0];
context.form={values:{scene:'sales',coverageTaskIds:[context.task.id],coverageDimensions:[JSON.stringify([context.task.id,context.task.dimensions[0].name])]}};
assert.equal(run('evSaveCaseBinding(form,suite.id,caseId)'),true);
assert.equal(run('evSuiteCoveredTasks(suite).length'),1);
assert.equal(run('evSuiteCoveredTasks(other).length'),0,'shared library cases do not copy links into other suites');
const metrics=snapshot('evSuiteCoverageMetrics(suite)');
assert(Math.abs(metrics[1].value-100/3)<1e-10);assert(Math.abs(metrics[2].value-100/run('evSuiteLinkedTasks(suite).reduce((sum,t)=>sum+t.dimensions.length,0)'))<1e-10);
run('suite.caseBindings[suite.caseIds[1]]=evVersionClone(suite.caseBindings[caseId])');
assert.deepEqual(snapshot('evSuiteCoverageMetrics(suite).map(m=>m.value)'),metrics.map(m=>m.value),'duplicate associations count once');
context.invalid={values:{scene:'sales',coverageTaskIds:[task.id],coverageDimensions:[]}};
const before=JSON.stringify(suite);assert.equal(run('evSaveCaseBinding(invalid,suite.id,caseId)'),false);assert.equal(JSON.stringify(suite),before);
context.invalid.values.coverageTaskIds=['PUR-BT-001'];assert.equal(run('evSaveCaseBinding(invalid,suite.id,caseId)'),false);
context.invalid.values.coverageTaskIds=[task.id];context.invalid.values.coverageDimensions=[JSON.stringify([task.id,'不存在的维度'])];assert.equal(run('evSaveCaseBinding(invalid,suite.id,caseId)'),false);
run('evOpenSuite(suite.id)');assert.equal(run('evState.suiteTab'),'评测用例');
let markup=run('evSuiteView(suite)');handlers(markup);
for(const label of ['用例数量','业务任务覆盖率','评估维度覆盖率','业务任务','评估维度'])assert(markup.includes(label));
assert(!markup.includes('统计时间范围')&&!markup.includes('创建时间统计'));
assert.deepEqual(detailTabNames(run('evSuiteDetailTabs(suite)')),['评测用例','评测集配置']);
run('evSuiteSelectTab("评测集配置")');markup=run('evSuiteView(suite)');handlers(markup);
assert(markup.includes('相关业务任务')&&markup.includes(task.name));assert(!markup.includes('data-ev-metric'));
run('evTab("评测集")');assert(!run('evScreen()').includes('统计时间范围'));
run('evDashboardSetRange("suite-list","yesterday");evDashboardSetRange("suite:"+suite.id,"yesterday")');assert.equal(run('evVisibleSuites().length'),3);assert.equal(run('evSuiteCases(suite).length'),5);
assert(run('evSuitesView()').includes('覆盖业务任务数量'));assert(!run('evSuitesView()').includes('关联业务任务数量'));
run('evTab("业务任务")');assert(!run('evScreen()').includes('统计时间范围'));
// Both case creation and library selection require associations before mutating data.
run('evEditCase("",suite.id)');markup=node('overlay').innerHTML;handlers(markup);assert(markup.includes('coverageTaskIds')&&markup.includes('coverageDimensions'));
context.caseForm={values:{scene:'sales',name:'关联覆盖测试',input:'输入',expected:'预期',coverageTaskIds:[task.id],coverageDimensions:context.form.values.coverageDimensions}};
assert.equal(run('evSaveCase(caseForm,"",suite.id)'),true);context.created=run('evData().cases[0]');assert.equal(run('evCaseBindings(suite,created.id)[0].taskId'),task.id);
run('evOpenCasePicker(other.id)');handlers(node('overlay').innerHTML);assert(node('overlay').innerHTML.includes('coverageDimensions'));
run('evPickCase(created.id,true)');node('ev-form').values={};const members=JSON.stringify(other.caseIds);assert.equal(run('evApplyCasePicker()'),false);assert.equal(JSON.stringify(other.caseIds),members);
context.otherTask=run('evSuiteLinkedTasks(other)[0]');node('ev-form').values={coverageTaskIds:[context.otherTask.id],coverageDimensions:[JSON.stringify([context.otherTask.id,context.otherTask.dimensions[0].name])]};
run('evApplyCasePicker()');assert(other.caseIds.includes(context.created.id));assert.equal(run('evCaseBindings(other,created.id)[0].taskId'),context.otherTask.id);assert.equal(run('evCaseBindings(suite,created.id)[0].taskId'),task.id);
// Import uses the same mandatory association contract, before allocating any case IDs.
run('evImportCases(other.id)');assert(node('overlay').innerHTML.includes('coverageDimensions'));handlers(node('overlay').innerHTML);
run('evAssetState.import.rows=evValidateImportRows([{name:"导入覆盖用例",input:"输入",expected:"预期"}]).rows');
node('ev-form').values={};const countBeforeImport=run('evData().cases.length'),sequenceBeforeImport=run('evData().sequence.case');
assert.equal(run('evImportApply()'),false);assert.equal(run('evData().cases.length'),countBeforeImport);assert.equal(run('evData().sequence.case'),sequenceBeforeImport);
node('ev-form').values={coverageTaskIds:[context.otherTask.id],coverageDimensions:[JSON.stringify([context.otherTask.id,context.otherTask.dimensions[0].name])]};
run('evImportApply()');assert.equal(run('evData().cases.length'),countBeforeImport+1);assert.equal(run('evCaseBindings(other,evData().cases[0].id)[0].taskId'),context.otherTask.id);
// Disabled cases remain part of design coverage; archiving excludes their links.
context.imported=run('evData().cases[0]');const coveredBefore=run('evSuiteCoveredTasks(other).length');
run('imported.enabled=false');assert.equal(run('evSuiteCoveredTasks(other).length'),coveredBefore);
run('imported.archived=true;created.archived=true');assert.equal(run('evSuiteCoveredTasks(other).length'),0);
run('imported.archived=false;created.archived=false');
context.emptyDimensions={...snapshot('suite'),taskIds:[task.id],taskSnapshots:[{...snapshot('task'),dimensions:[]}],caseIds:[context.created.id],caseBindings:{[context.created.id]:[{taskId:task.id,dimensionNames:[]}]}};
assert.equal(run('evSuiteCoverageMetrics(emptyDimensions)[2].value'),null,'zero dimensions have no percentage denominator');
assert.equal(run('evSuiteCoverageMetrics(emptyDimensions)[1].value'),100,'tasks without dimensions still support task coverage');
// Publishing freezes explicit coverage and task definitions.
run('evVersionPublish(suite)');const version=suite.version;context.publishedVersion=version;
const historical=snapshot('evVersionResolve(suite)');
run('evVersionPrepare(suite);suite.caseBindings={};evVersionSave(suite);evVersionPublish(suite)');
assert.deepEqual(snapshot('evVersionResolve(suite,publishedVersion).caseBindings'),historical.caseBindings);
assert.equal(run('evSuiteCoveredTasks(suite).length'),0);
// Experiment snapshots grade only associated dimensions and preserve their links.
context.experiment=run('evCreateExperiment({name:"覆盖评分",agentId:other.agentId,version:"V3",suiteIds:[other.id]})');
context.execution=run('evRunExperiment(experiment.id)');drain();
for(const result of context.execution.results){const c=context.execution.snapshot.cases.find(c=>c.id===result.caseId);for(const d of result.dimensions)assert(c.taskBindings.some(b=>b.taskId===d.taskId&&b.dimensionNames.includes(d.name)));}
console.log('PASS suite-specific associations, strict validation, deduplicated coverage, picker/manual flows, version snapshots, two tabs and no time filters');
