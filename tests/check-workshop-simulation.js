'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

// Exercise the production shared runtime; the browser checks cover both hosts.
const nodes = new Map(), timers = new Map();
let serial = 0, now = Date.parse('2026-11-08T08:00:00Z');
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
const node = id => {
  if (!nodes.has(id)) nodes.set(id, {id, innerHTML:'', textContent:'', value:'', hidden:false, disabled:false, dataset:{}, style:{}, isConnected:true,
    classList:{add(){},remove(){},toggle(){}}, focus(){},remove(){},click(){},setAttribute(){},removeAttribute(){},scrollIntoView(){},closest(){return null;},contains(){return false;},
    querySelector(){return null;},querySelectorAll(){return [];},getBoundingClientRect(){return {left:0,top:0,right:1440,bottom:1000,width:1440,height:1000};}});
  return nodes.get(id);
};
class FormDataShim {
  constructor(form) { this.values = form.values || {}; }
  get(key) { const value = this.values[key]; return Array.isArray(value) ? value[0] ?? null : value ?? null; }
  getAll(key) { const value = this.values[key]; return value === undefined ? [] : Array.isArray(value) ? value : [value]; }
  *[Symbol.iterator]() { for (const key of Object.keys(this.values)) for (const value of this.getAll(key)) yield [key,value]; }
}
const context = {console, Date:Clock, JSON, URL, URLSearchParams, Blob, FormData:FormDataShim, innerWidth:1440,innerHeight:1000,
  document:{body:node('body'),activeElement:node('active'),getElementById:node,querySelector(){return null;},querySelectorAll(){return [];},createElement:node,addEventListener(){}},
  setTimeout(fn, delay=0){const id=++serial;timers.set(id,{fn,at:now+Number(delay)});return id;},clearTimeout(id){timers.delete(id);},addEventListener(){}};
context.window = context;
vm.createContext(context);
for (const match of fs.readFileSync('dist/index.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(match[1],context);
for (const file of ['workshop-evaluation-seed.js','workshop-evaluation.js','workshop-evaluation-versions.js','workshop-evaluation-dashboard.js','workshop-evaluation-tasks.js','workshop-evaluation-assets.js','workshop-evaluation-evaluators.js','workshop-evaluation-experiment-engine.js','workshop-evaluation-reports.js','workshop-evaluation-experiments.js','workshop-evaluation-issues.js','workshop-evaluation-copilot.js']) vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),context,{filename:file});
const run = code => vm.runInContext(code,context);
const clone = value => JSON.parse(JSON.stringify(value));
const drain = () => { let count=0; while(timers.size){assert(++count<3000,'finite execution');const [id,timer]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];timers.delete(id);now=timer.at;timer.fn();} };
run("currentSection='studio';studio.scene='sales';evData();evExperimentStore();evExperimentRefresh=()=>{}");
run(`{
  const data=evData(), source=data.suites.find(s=>s.caseIds.some(id=>data.cases.some(c=>c.id===id&&c.enabled!==false&&!c.archived)));
  const caseId=source.caseIds.find(id=>data.cases.some(c=>c.id===id&&c.enabled!==false&&!c.archived));
  data.suites.push({...JSON.parse(JSON.stringify(source)),id:'SIMULATION-TEST-SUITE',name:'模拟专项评测集',caseIds:[caseId]});
  const evaluators=evEvaluatorStore().evaluators.filter(e=>e.enabled);
  evaluators[0].criteria.forEach(c=>c.passScore=0);evaluators[1].criteria.forEach(c=>c.passScore=100);
}`);
context.base = {name:'模拟专项',agentId:run('evData().suites.find(s=>s.id==="SIMULATION-TEST-SUITE").agentId'),version:'V3',suiteIds:['SIMULATION-TEST-SUITE'],evaluatorIds:run('evEvaluatorStore().evaluators.filter(e=>e.enabled).map(e=>e.id)')};
const definitionsBefore = clone(run('evData().cases'));
const bindings = [{evaluatorId:context.base.evaluatorIds[0],target:'first_response',participation:'gate'},{evaluatorId:context.base.evaluatorIds[1],target:'conversation',participation:'observe'}];
context.scenario = {mode:'scenario_simulation',scenarioPrompt:'当前场景：订单处理\n用户画像：谨慎、表达简短\n已知事实：用户预算为300元\n行为规则：只提供已知信息；不知道时明确表示不知道。',maxTurns:3,caseRuns:2,fullRuns:1,concurrency:2,evaluationBindings:bindings};
context.experiment = run('evCreateExperiment({...base,execution:scenario})');
context.first = run('evRunExperiment(experiment.id)');drain();
const experiment=context.experiment, first=context.first;
assert.equal(first.results.length,2,'repetitions are independent conversations');
assert.notEqual(first.results[0].conversationId,first.results[1].conversationId);
for(const result of first.results){
  assert.equal(result.executionMode,'scenario_simulation');assert.equal(result.actualTurns,3);
  assert.equal(result.messages.filter(m=>m.role==='user').length,3);assert.equal(result.messages.filter(m=>m.role==='assistant').length,3);
  assert.equal(result.messages[0].content,result.input,'the existing input remains the opening user message');
  assert.equal(result.firstResponse,result.messages.find(m=>m.role==='assistant').content);
  assert.equal(result.actual,result.firstResponse,'existing expected output keeps its first-response meaning');
  assert.equal(result.stopReason,'max_turns');assert.equal(result.status,'通过','a failing observe evaluator does not veto the gate');
  assert.equal(result.evaluations[0].target,'first_response');assert.equal(result.evaluations[1].target,'conversation');
  assert.equal(result.evaluations[1].participation,'observe');assert.equal(result.evaluations[1].passed,false);
  assert.equal(result.evaluations[0].inputMessages.length,2);assert.equal(result.evaluations[1].inputMessages.length,6);
  assert(result.trace.mock);assert(result.trace.spans.some(span=>span.turn===3),'trace can locate later turns');
}
const frozenFirst=clone(first), originalRevision=experiment.configurationRevision;
assert(Object.isFrozen(first.snapshot.execution));
run('evUpdateExperiment(experiment.id,{execution:{...scenario,maxTurns:1,scenarioPrompt:"当前场景：订单咨询\\n用户画像：急躁，只给短答案"}})');
assert.equal(experiment.configurationRevision,originalRevision+1);
context.second=run('evRunExperiment(experiment.id)');drain();
assert(context.second.results.every(result=>result.actualTurns===1&&result.messages.length===2));
assert.deepEqual(clone(first),frozenFirst,'editing only simulation settings preserves all old evidence');
assert.equal(first.snapshot.execution.maxTurns,3);
run('evUpdateExperiment(experiment.id,{execution:{...scenario,maxTurns:2,evaluationBindings:scenario.evaluationBindings.map(b=>({...b,participation:"gate"}))}})');
context.gated=run('evRunExperiment(experiment.id)');drain();
assert(context.gated.results.some(result=>result.status==='未通过'),'a conversation gate participates in quality judgment');
run('evUpdateExperiment(experiment.id,{execution:{...scenario,maxTurns:2,evaluationBindings:scenario.evaluationBindings.map(b=>({...b,participation:"observe"}))}})');
context.observed=run('evRunExperiment(experiment.id)');drain();
assert(context.observed.results.filter(r=>r.status!=='运行失败').every(r=>r.status==='仅观察'));
assert.equal(run('evExperimentSummary(observed).passRate'),null,'observe-only results have no quality pass denominator');
for(const invalid of [{...context.scenario,maxTurns:0},{...context.scenario,maxTurns:21},{...context.scenario,maxTurns:1.5},{...context.scenario,scenarioPrompt:' '},{...context.scenario,mode:'unknown'},{...context.scenario,evaluationBindings:[{evaluatorId:'not-selected',target:'conversation',participation:'gate'}]}]){
  context.invalid=invalid;assert.throws(()=>run('evCreateExperiment({...base,execution:invalid})'));
}
context.invalid={...context.scenario,mode:'single_turn'};assert.throws(()=>run('evCreateExperiment({...base,execution:invalid})'),'single-turn execution cannot silently score a complete conversation');
context.legacy=run('evCreateExperiment({...base,execution:{caseRuns:1,fullRuns:1}})');
context.legacyRun=run('evRunExperiment(legacy.id)');drain();
assert.equal(context.legacy.execution.mode,'single_turn');assert.equal(context.legacyRun.results[0].messages.length,2);
assert.deepEqual(clone(run('evData().cases')),definitionsBefore,'all operations leave the case schema and definitions unchanged');

// New experiment configuration has one fixed all-selected rule; old observe runs above remain unchanged.
context.allSelectedExecution={...context.scenario,evaluationPolicy:'all_selected',caseRuns:1};
context.allSelected=run('evCreateExperiment({...base,name:"全部所选必须通过",execution:allSelectedExecution})');
assert(context.allSelected.execution.evaluationBindings.every(binding=>binding.participation==='gate'),'a submitted legacy observe flag cannot bypass the new rule');
context.allSelectedRun=run('evRunExperiment(allSelected.id)');drain();
assert.equal(context.allSelectedRun.results[0].status,'未通过','one failed evaluator vetoes an otherwise passing case');
assert.equal(context.allSelectedRun.results[0].evaluations[0].passed,true);
assert.equal(context.allSelectedRun.results[0].evaluations[1].passed,false);
run('evExperimentForm(allSelected)');
assert(!node('overlay').innerHTML.includes('evaluationParticipation.')&&!node('overlay').innerHTML.includes('仅观察'),'the new form contains no result-role configuration');
assert(node('overlay').innerHTML.includes('ev-experiment-evaluator-row'));
run('evCloseModal()');
context.onlyPassing={...context.base,name:'所有所选均通过',evaluatorIds:[context.base.evaluatorIds[0]],execution:{...context.allSelectedExecution,evaluationBindings:context.allSelectedExecution.evaluationBindings.slice(0,1)}};
context.allPassing=run('evCreateExperiment(onlyPassing)');context.allPassingRun=run('evRunExperiment(allPassing.id)');drain();
assert.equal(context.allPassingRun.results[0].status,'通过');
assert.equal(context.allPassingRun.snapshot.execution.evaluationPolicy,'all_selected');
assert.equal(first.snapshot.execution.evaluationPolicy,undefined,'new configuration does not migrate historical execution contracts');

// Explicit evaluator versions resolve their actual published standards, not just a display label.
run('evVersionPrepare(evEvaluatorStore().evaluators[0])');
const publishedBefore=clone(run('evEvaluatorPublishedVersions(evEvaluatorStore().evaluators[0])[0]'));
context.versionFields={...clone(publishedBefore),name:publishedBefore.name+'新版',criteria:publishedBefore.criteria.map(item=>({...item,description:'NEW-PUBLISHED-STANDARD '+item.description}))};
run('evSaveEvaluatorDraft(versionFields,evEvaluatorStore().evaluators[0].id,"sales",true)');
const latestPublished=clone(run('evEvaluatorPublishedVersions(evEvaluatorStore().evaluators[0])[0]'));
assert.notEqual(latestPublished.version,publishedBefore.version);
context.oldVersionSelection={...context.base,name:'固定评分标准旧版本',evaluatorIds:[publishedBefore.id],evaluatorVersions:{[publishedBefore.id]:publishedBefore.version},execution:{}};
context.versionExperiment=run('evCreateExperiment(oldVersionSelection)');
assert.equal(context.versionExperiment.snapshot.evaluators[0].version,publishedBefore.version);
assert.deepEqual(clone(context.versionExperiment.snapshot.evaluators[0].criteria),publishedBefore.criteria);
context.versionRun=run('evRunExperiment(versionExperiment.id)');drain();
const versionEvidence=clone(context.versionRun),versionRevision=context.versionExperiment.configurationRevision;
context.newVersionMap={[publishedBefore.id]:latestPublished.version};
run('evUpdateExperiment(versionExperiment.id,{evaluatorVersions:newVersionMap})');
assert.equal(context.versionExperiment.configurationRevision,versionRevision+1);
assert.deepEqual(clone(context.versionExperiment.snapshot.evaluators[0].criteria),latestPublished.criteria);
assert.deepEqual(clone(context.versionRun),versionEvidence,'changing only evaluator version preserves the old run');
context.invalidVersionMap={[publishedBefore.id]:'V999'};
const beforeInvalidVersion=clone(context.versionExperiment);
assert.throws(()=>run('evUpdateExperiment(versionExperiment.id,{evaluatorVersions:invalidVersionMap})'));
assert.deepEqual(clone(context.versionExperiment),beforeInvalidVersion,'an unavailable version cannot partially mutate the experiment');
context.versionFields={...clone(latestPublished),criteria:latestPublished.criteria.map(item=>({...item,description:'UNPUBLISHED-DRAFT '+item.description}))};
run('evSaveEvaluatorDraft(versionFields,evEvaluatorStore().evaluators[0].id,"sales",false)');
context.latestVersionSelection={...context.oldVersionSelection,name:'已发布版本不读取待发布修改',evaluatorVersions:context.newVersionMap};
context.publishedExperiment=run('evCreateExperiment(latestVersionSelection)');
assert.deepEqual(clone(context.publishedExperiment.snapshot.evaluators[0].criteria),latestPublished.criteria,'selecting a published version excludes later unpublished edits');
console.log('PASS experiment-owned simulation, scoped scoring, gate/observe, limits, isolated repetitions, immutable history and unchanged cases');
