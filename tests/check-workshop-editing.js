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
  constructor(form){
    this.values=form.values||{};
    if(form.elements){
      this.values={};
      // Hidden ancestors do not exclude successful native form controls.
      for(const control of form.elements){
        if(!control.name||control.disabled||control.type==='checkbox'&&!control.checked)continue;
        (this.values[control.name]||(this.values[control.name]=[])).push(control.value);
      }
    }
  }
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

run("currentSection='studio';studio.scene='sales';workbenchOpen('评测');evData();evEvaluatorStore()");
const clone=value=>JSON.parse(JSON.stringify(value));
const decode=value=>value.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const attribute=(markup,name)=>decode(markup.match(new RegExp('\\b'+name+'="([^"]*)"'))?.[1]||'');
const checkboxRecords=markup=>[...markup.matchAll(/<label\b[^>]*data-ev-option[^>]*data-ev-search-text="([^"]*)"[^>]*>([\s\S]*?)<\/label>/g)].map(m=>{
  const control=m[2].match(/<input\b([^>]*)>/)?.[1]||'',name=decode(m[2].match(/<span>([\s\S]*?)(?:<small>|<\/span>)/)?.[1]||'');
  const flags=control.replace(/"[^"]*"/g,'""');
  return {searchText:decode(m[1]),name,id:attribute(control,'value'),field:attribute(control,'name'),checked:/\bchecked\b/.test(flags),disabled:/\bdisabled\b/.test(flags),change:attribute(control,'onchange')};
});
function dropdownFixture(markup){
  const selectedLabel={textContent:''},empty={hidden:true},records=checkboxRecords(markup),options=[];
  const menu={querySelectorAll(selector){if(selector==='[data-ev-option]')return options;if(selector==='input:checked')return options.map(option=>option.checkbox).filter(input=>input.checked);return [];},querySelector(selector){if(selector==='[data-ev-selected-label]')return selectedLabel;if(selector==='[data-ev-search-empty]')return empty;if(selector==='summary')return {getAttribute:()=> '选择业务任务'};return null;}};
  for(const record of records){
    const label={hidden:false,getAttribute:name=>name==='data-ev-search-text'?record.searchText:null,querySelector:()=>({firstChild:{textContent:record.name}})};
    label.checkbox={type:'checkbox',name:record.field,value:record.id,checked:record.checked,disabled:record.disabled,parentElement:label,closest:()=>menu,change:record.change};options.push(label);
  }
  const input={type:'search',name:'',value:'',closest:()=>menu};
  return {menu,options,input,empty,selectedLabel,records};
}
const setSearch=(fixture,value)=>{fixture.input.value=value;context.searchControl=fixture.input;run('evMultiSelectSearch(searchControl)');};
const choose=(fixture,id,checked)=>{const input=fixture.options.find(option=>option.checkbox.value===id)?.checkbox;assert(input);input.checked=checked;context.optionControl=input;run('(function(){'+input.change+'}).call(optionControl)');};

// Search changes only option visibility; selected controls retain their name/value/checked state.
run('evEditSuite();evSuiteAgentChange("sales-agent-1")');
let markup=node('ev-suite-task-options').innerHTML;handlers(markup);
assert(markup.includes('aria-label="搜索业务任务"')&&markup.includes('搜索业务任务名称或编号'));
const searchControlTag=markup.match(/<input\b[^>]*aria-label="搜索业务任务"[^>]*>/)?.[0]||'';
assert(searchControlTag&&!/\bname=/.test(searchControlTag),'the search query is not a business field');
const tasks=snapshot('evSuiteTasks("sales-agent-1")'),fixture=dropdownFixture(markup);assert.equal(fixture.options.length,tasks.length);assert(tasks.length>=2);
assert(fixture.records.every(record=>tasks.some(task=>task.id===record.id)&&record.field==='taskIds'));
setSearch(fixture,tasks[0].version.toLowerCase());assert.deepEqual(fixture.options.filter(option=>!option.hidden).map(option=>option.checkbox.value),tasks.filter(task=>[task.id,task.name,task.version].join(' ').toLowerCase().includes(tasks[0].version.toLowerCase())).map(task=>task.id));
setSearch(fixture,'  '+tasks[0].id.toLowerCase()+'  ');assert.deepEqual(fixture.options.filter(option=>!option.hidden).map(option=>option.checkbox.value),[tasks[0].id]);
choose(fixture,tasks[0].id,true);assert.deepEqual(snapshot('evSuiteEditor.taskIds'),[tasks[0].id]);
setSearch(fixture,tasks[1].name);assert(fixture.options.find(option=>option.checkbox.value===tasks[0].id).hidden);choose(fixture,tasks[1].id,true);
assert.deepEqual(snapshot('evSuiteEditor.taskIds'),[tasks[0].id,tasks[1].id]);
assert(fixture.selectedLabel.textContent.includes(tasks[0].name)&&fixture.selectedLabel.textContent.includes(tasks[1].name),'the summary includes selected items hidden by the current keyword');
setSearch(fixture,'不存在 [a+b].* <img src=x>');assert(fixture.options.every(option=>option.hidden));assert.equal(fixture.empty.hidden,false);
assert(fixture.options.every(option=>option.checkbox.name==='taskIds'&&!option.checkbox.disabled),'no-match filtering never disables successful controls');
context.domForm={elements:[{name:'name',value:'跨关键词勾选的评测集'},{name:'target',value:'保留不可见的已选业务任务'},{name:'agentId',value:'sales-agent-1'},{name:'scene',value:'sales'},fixture.input,...fixture.options.map(option=>option.checkbox)]};
assert.deepEqual(Array.from(run('new FormData(domForm).getAll("taskIds")')),[tasks[0].id,tasks[1].id]);
assert.equal(run('evSaveSuite(domForm)'),true);const searchedSuite=snapshot('evData().suites[0]');assert.deepEqual(searchedSuite.taskIds,[tasks[0].id,tasks[1].id]);
setSearch(fixture,'');assert(fixture.options.every(option=>!option.hidden));assert.equal(fixture.empty.hidden,true);
run('evEditSuite('+JSON.stringify(searchedSuite.id)+')');markup=node('overlay').innerHTML;const selectedRecords=checkboxRecords(markup);
assert.deepEqual(selectedRecords.filter(record=>record.checked).map(record=>record.id),searchedSuite.taskIds,'editing reopens both persisted selections');
const editFixture=dropdownFixture(markup);choose(editFixture,tasks[0].id,false);assert(!editFixture.selectedLabel.textContent.includes(tasks[0].name));assert.deepEqual(snapshot('evSuiteEditor.taskIds'),[tasks[1].id]);
run('evSuiteAgentChange("sales-app-agent")');assert.deepEqual(snapshot('evSuiteEditor.taskIds'),[]);
const appMarkup=node('ev-suite-task-options').innerHTML;assert(!appMarkup.includes('不存在 [a+b]'));assert(checkboxRecords(appMarkup).every(record=>run('evSuiteTasks("sales-app-agent").some(task=>task.id==='+JSON.stringify(record.id)+')')));
assert(!/<input\b[^>]*type="search"[^>]*value="[^\"]+"/.test(appMarkup),'changing Agent rebuilds an empty search field');
assert(run('evSuiteTaskOptions("")').includes('disabled'));
context.originalTasks=run('evData().tasks');run('evData().tasks=evData().tasks.filter(task=>task.agentId!=="sales-app-agent")');assert(run('evSuiteTaskOptions("sales-app-agent")').includes('暂无业务任务'));run('evData().tasks=originalTasks;evCloseModal()');

// Editing an existing experiment changes its next configuration, preserving run-owned evidence.
const modelIds=snapshot('evEvaluationModels().map(model=>model.id)'),mcpIds=snapshot('evExperimentMcps().slice(0,2).map(mcp=>mcp.id)');assert.equal(mcpIds.length,2);
const initialFields={name:'实验编辑历史保留',agentId:'sales-agent-1',version:'V3',suiteIds:['SAL-ES-001','SAL-ES-002'],evaluatorIds:['SAL-EV-001','SAL-EV-002'],execution:{evaluationPolicy:'all_selected',concurrency:3,caseRuns:2,fullRuns:2,modelId:modelIds[2],mcpIds}};
context.initialFields=clone(initialFields);context.editExperiment=run('evCreateExperiment(initialFields)');
const experimentId=context.editExperiment.id,createdAt=context.editExperiment.createdAt,storeSequence=run('evExperimentStore().sequence'),storeCount=run('evExperimentStore().experiments.length');
const originalSnapshot=clone(context.editExperiment.snapshot);assert.equal(context.editExperiment.configurationRevision,1);
context.originalRun=run('evRunExperiment(editExperiment.id)');drain();assert.equal(context.originalRun.status,'部分失败');
assert.equal(context.originalRun.configurationRevision,1);assert.deepEqual(clone(context.originalRun.snapshot),originalSnapshot);
assert(run('Object.isFrozen(originalRun.snapshot)&&Object.isFrozen(originalRun.snapshot.suites[0])&&Object.isFrozen(originalRun.snapshot.evaluators[0].criteria)'));
const formValues=fields=>({scene:'sales',experimentId,name:fields.name,agentId:fields.agentId,version:fields.version,suiteIds:[...fields.suiteIds],evaluatorIds:[...fields.evaluatorIds],...clone(fields.execution)});
const buttonCode=(html,label)=>[...html.matchAll(/<button\b[^>]*onclick="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g)].find(match=>match[2].replace(/<[^>]*>/g,'').trim()===label)?.[1];
const assertNoNewExperiment=()=>{assert.equal(run('evExperimentStore().sequence'),storeSequence);assert.equal(run('evExperimentStore().experiments.length'),storeCount);assert.equal(context.editExperiment.id,experimentId);assert.equal(context.editExperiment.createdAt,createdAt);};
const menuEdit=buttonCode(run('evExperimentListTable([editExperiment])'),'编辑');assert(menuEdit&&menuEdit.includes('evEditExperiment('));run(decode(menuEdit));
markup=node('overlay').innerHTML;handlers(markup);assert(markup.includes('编辑评测实验')&&markup.includes('保存修改'));
assert.equal(attribute(markup.match(/<input\b[^>]*name="experimentId"[^>]*>/)?.[0]||'','value'),experimentId);
assert.deepEqual(snapshot('evExperimentEditor.suiteIds'),initialFields.suiteIds);
const choices=checkboxRecords(markup);
for(const [name,ids] of [['suiteIds',initialFields.suiteIds],['evaluatorIds',initialFields.evaluatorIds],['mcpIds',mcpIds]])assert.deepEqual(choices.filter(record=>record.field===name&&record.checked).map(record=>record.id),ids,'editing restores '+name);
for(const name of ['concurrency','caseRuns','fullRuns'])assert.equal(attribute(markup.match(new RegExp('<input\\b[^>]*name="'+name+'"[^>]*>'))?.[0]||'','value'),String(initialFields.execution[name]));
for(const [name,id] of [['agentId',initialFields.agentId],['version',initialFields.version],['modelId',initialFields.execution.modelId]]){
  const select=markup.match(new RegExp('<select\\b[^>]*name="'+name+'"[^>]*>([\\s\\S]*?)<\\/select>'))?.[1]||'';
  assert([...select.matchAll(/<option\b([^>]*)>/g)].some(option=>attribute(option[1],'value')===id&&/\bselected\b/.test(option[1])),name+' is prefilled');
}
run('evExperimentState.tab="实验配置"');assert(run('evExperimentDetailActions(editExperiment)').includes('evEditExperiment('),'configuration exposes the edit function');run('evExperimentState.tab="用例结果"');assert(!run('evExperimentDetailActions(editExperiment)').includes('evEditExperiment('),'results expose execution functions');
run('evExperimentIssueLedgerSync(editExperiment)');const beforeCancel=clone(context.editExperiment);run('evExperimentAgentChange("sales-app-agent")');assert.equal(run('evExperimentEditor.version'),'');assert.deepEqual(snapshot('evExperimentEditor.suiteIds'),[]);run('evCloseModal()');
assert.deepEqual(clone(context.editExperiment),beforeCancel,'cancelled editing has no data effect');assertNoNewExperiment();
context.sameForm={values:formValues(initialFields)};run('evEditExperiment(editExperiment.id)');assert.equal(run('evSubmitExperiment(sameForm).id'),experimentId);
assert.deepEqual(clone(context.editExperiment),beforeCancel,'saving the same valid values is a no-op');assertNoNewExperiment();
context.reordered={suiteIds:[...initialFields.suiteIds].reverse(),evaluatorIds:[...initialFields.evaluatorIds].reverse(),execution:{mcpIds:[...mcpIds].reverse()}};
run('evUpdateExperiment(editExperiment.id,reordered)');assert.deepEqual(clone(context.editExperiment),beforeCancel,'unordered multiselections do not create a spurious new configuration');
const invalidChanges=[{suiteIds:[]},{suiteIds:['SAL-ES-003']},{suiteIds:['PUR-ES-001']},{agentId:'procurement-agent-1'},{agentId:'sales-app-agent',version:'V2',suiteIds:['SAL-ES-001']},{version:'V999'},{evaluatorIds:[]},{evaluatorIds:['PUR-EV-001']},{execution:null},{execution:[]},{execution:{caseRuns:0}},{execution:{modelId:'missing-model'}}];
for(const fields of invalidChanges){context.invalidEdit=fields;const before=clone(context.editExperiment);assert.throws(()=>run('evUpdateExperiment(editExperiment.id,invalidEdit)'));assert.deepEqual(clone(context.editExperiment),before,'invalid edits are atomic');assertNoNewExperiment();}
assert.throws(()=>run('evUpdateExperiment("missing-id",{name:"无此实验"})'));
const beforeForeign=clone(context.editExperiment);run("studio.scene='procurement';evData()");assert.throws(()=>run('evUpdateExperiment(editExperiment.id,{name:"跨场景篡改"})'));
context.staleForm={values:formValues({...initialFields,name:'跨场景表单'})};assert.equal(run('evSubmitExperiment(staleForm)'),false);assert.deepEqual(clone(context.editExperiment),beforeForeign);
run("studio.scene='sales';evData();evExperimentUI();evCloseModal()");assertNoNewExperiment();

// An edit opened before a run starts cannot accidentally stop or replace that run.
run('evEditExperiment(editExperiment.id)');context.raceRun=run('evRunExperiment(editExperiment.id)');const runningBefore=clone(context.editExperiment);
assert.throws(()=>run('evUpdateExperiment(editExperiment.id,{suiteIds:["SAL-ES-002"]})'),/运行/);
context.raceForm={values:formValues({...initialFields,name:'运行中禁止保存'})};assert.equal(run('evSubmitExperiment(raceForm)'),false);
assert.equal(run('evEditExperiment(editExperiment.id)'),false);assert.equal(context.raceRun.status,'运行中');assert.deepEqual(clone(context.editExperiment),runningBefore);
assert(node('ev-experiment-form-error').textContent.includes('运行'));run('evCloseModal()');drain();assert.equal(context.raceRun.status,'部分失败','rejected edits let the active run finish normally');assertNoNewExperiment();

// Triage belongs to the experiment ledger and preserves each batch’s raw evidence after configuration changes.
run('evExperimentIssueAnalyzeComplete(editExperiment,originalRun);evExperimentOpen(editExperiment.id,originalRun.id,"问题优化")');
const oldIssue=context.originalRun.issues.find(issue=>issue.type==='评估未达标')||context.originalRun.issues[0];assert(oldIssue);
context.oldIssueId=oldIssue.id;context.issueForm={values:{scene:'sales',status:'待修复',owner:'历史负责人',note:'保留旧配置下的问题证据'}};
assert.equal(run('evSaveExperimentIssue(issueForm,editExperiment.id,originalRun.id,oldIssueId)'),true);
const stableMenuIds=markup=>markup.replace(/ev-more-menu-\d+/g,'ev-more-menu');
const originalRunWithTriage=clone(context.originalRun),oldReport=run('evExperimentReport(editExperiment,originalRun)'),oldResultTable=stableMenuIds(run('evExperimentResultTable(editExperiment,originalRun)')),oldIssues=run('evExperimentIssuesTable(editExperiment,originalRun)');
run('evExperimentScoringSnapshot()');const oldScoringDrawer=node('overlay').innerHTML;run('evCloseModal()');
const oldSnapshotReference=context.editExperiment.snapshot;
run('evUpdateExperiment(editExperiment.id,{name:"只修改实验名称"})');assert.equal(context.editExperiment.status,'部分失败');assert.equal(context.editExperiment.configurationRevision,1);assert.equal(context.editExperiment.snapshot,oldSnapshotReference);
assert.equal(context.originalRun.experimentName,initialFields.name,'a historical run retains the name used at execution');
context.changedCase=clone(run('evData().cases.find(item=>item.id==="SAL-EC-006")'));context.changedCase.input='修改配置后下一次运行使用的新输入';
context.caseForm={values:{...context.changedCase,tags:context.changedCase.tags.join('，'),scene:'sales'}};run('evSaveCase(caseForm,"SAL-EC-006");evPublishResource("case","SAL-EC-006")');
context.strictEvaluator=clone(run('evEvaluatorStore().evaluators.find(item=>item.id==="SAL-EV-002")'));context.strictEvaluator.criteria=context.strictEvaluator.criteria.map(criterion=>({...criterion,passScore:100}));
run('evSaveEvaluatorDraft(strictEvaluator,"SAL-EV-002","sales",true)');
const revisedFields={name:'替换评测集后的实验',agentId:'sales-agent-1',version:'V2',suiteIds:['SAL-ES-002'],evaluatorIds:['SAL-EV-002'],execution:{evaluationPolicy:'all_selected',concurrency:1,caseRuns:1,fullRuns:1,modelId:modelIds[1],mcpIds:[mcpIds[1]]}};
context.revisedForm={values:formValues(revisedFields)};run('evEditExperiment(editExperiment.id)');const saved=run('evSubmitExperiment(revisedForm)');assert(saved&&saved.id===experimentId);
assert.equal(context.editExperiment.configurationRevision,2);assert.equal(context.editExperiment.status,'未运行');assert.equal(context.editExperiment.sequence,4);assertNoNewExperiment();
assert.deepEqual(clone(context.editExperiment.suiteIds),revisedFields.suiteIds);assert.deepEqual(clone(context.editExperiment.execution),expectedSingleExecution(revisedFields.execution,revisedFields.evaluatorIds));
assert.equal(run('evExperimentRunGet(editExperiment)'),null,'old runs do not masquerade as execution of the new configuration');
assert.equal(run('evExperimentRunGet(editExperiment,originalRun.id).id'),context.originalRun.id);assert.equal(run('evExperimentRunContext(editExperiment,originalRun).isHistorical'),true);
assert.deepEqual(snapshot('evExperimentRunContext(editExperiment,originalRun).suiteIds'),initialFields.suiteIds);
assert.deepEqual(snapshot('evExperimentRunContext(editExperiment,originalRun).execution'),expectedSingleExecution(initialFields.execution,initialFields.evaluatorIds));
assert.deepEqual(clone(context.originalRun),originalRunWithTriage,'configuration edits leave old results, scores, snapshot and issue handling untouched');
assert(run('evExperimentsView()').includes('修改配置后下一次运行使用的新输入')===false,'overview shows configuration rather than fabricating a new result');
run('evExperimentSelectTab("实验配置")');const overview=run('evExperimentDetailTop(editExperiment,null)');assert(overview.includes(context.editExperiment.snapshot.suites[0].name));assert(overview.includes('执行配置'));
assert(!overview.includes(originalSnapshot.suites[0].name),'overview uses the newly selected suite rather than a historical run');
assert(overview.includes(context.editExperiment.agentName+' / '+revisedFields.version));assert(overview.includes(context.editExperiment.snapshot.model.name)&&!overview.includes(originalSnapshot.model.name));
run('evExperimentSelectTab("用例结果")');assert.equal(run('evExperimentSelectedRun(editExperiment).id'),context.editExperiment.runs[0].id,'default view keeps the latest full execution record after edits');
run('evExperimentOpen(editExperiment.id,originalRun.id,"实验报告")');assert.equal(run('evExperimentReport(editExperiment,originalRun)'),oldReport);assert.equal(stableMenuIds(run('evExperimentResultTable(editExperiment,originalRun)')),oldResultTable);
assert.equal(run('evExperimentIssuesTable(editExperiment,originalRun)'),oldIssues);run('evExperimentScoringSnapshot()');assert.equal(node('overlay').innerHTML,oldScoringDrawer);run('evCloseModal()');
context.nextRun=run('evExperimentStart(editExperiment.id)');drain();assert.equal(context.nextRun.configurationRevision,2);assert.equal(context.nextRun.results.length,3);assert.equal(context.originalRun.results.length,14);
assert(!context.nextRun.results.some(result=>result.caseId==='SAL-EC-001'),'removed-suite-only cases are excluded from the next run');
assert(context.nextRun.results.some(result=>result.caseId==='SAL-EC-006'&&result.input===context.changedCase.input));
assert(context.originalRun.results.filter(result=>result.caseId==='SAL-EC-006').every(result=>result.input!==context.changedCase.input));
assert.deepEqual(clone(context.nextRun.snapshot),clone(context.editExperiment.snapshot));assert.deepEqual(clone(context.originalRun),originalRunWithTriage);
const newScores=Array.from(context.nextRun.results).flatMap(result=>result.evaluations);assert(newScores.length>0);
assert(newScores.every(score=>score.evaluatorId==='SAL-EV-002'&&score.version===context.nextRun.snapshot.evaluators[0].version));
assert.notEqual(context.nextRun.snapshot.evaluators[0].version,context.originalRun.snapshot.evaluators.find(evaluator=>evaluator.id==='SAL-EV-002').version);
run('evExperimentSelectRun(originalRun.id);evExperimentSelectTab("问题优化")');assert(run('evExperimentIssueLedgerSync(editExperiment).some(issue=>issue.occurrences.some(occurrence=>occurrence.rawIssueId===oldIssueId))'),'the historical discovery remains in the cross-batch ledger');
context.issueForm.values.status='已关闭';context.issueForm.values.note='旧配置问题仍可独立处理';assert.equal(run('evSaveExperimentIssue(issueForm,editExperiment.id,originalRun.id,oldIssueId)'),true);
assert.equal(run('evExperimentIssueContext(editExperiment.id,originalRun.id,oldIssueId).issue.status'),'已关闭');assert.equal(oldIssue.status,'待修复','human processing does not rewrite the raw issue evidence');assert.deepEqual(clone(context.originalRun.results),originalRunWithTriage.results);assertNoNewExperiment();

// Previously selected resources stay visible/removable if they become unavailable; saving remains strict.
const savedCatalog=snapshot('evData()'),savedEvaluators=snapshot('evEvaluatorStore().evaluators');
for(const invalidate of ['evData().suites=evData().suites.filter(suite=>suite.id!=="SAL-ES-002")','evData().suites.find(suite=>suite.id==="SAL-ES-002").caseIds.forEach(id=>evData().cases.find(item=>item.id===id).enabled=false)','evEvaluatorStore().evaluators.find(item=>item.id==="SAL-EV-002").enabled=false']){
  run(invalidate);const before=clone(context.editExperiment);assert.equal(run('evEditExperiment(editExperiment.id)'),true);markup=node('overlay').innerHTML;
  const retained=checkboxRecords(markup);for(const [field,id] of [['suiteIds','SAL-ES-002'],['evaluatorIds','SAL-EV-002']])assert(retained.some(record=>record.field===field&&record.id===id&&record.checked&&!record.disabled),'previous selections remain removable: '+field);
  assert.equal(run('evSubmitExperiment(revisedForm)'),false);assert.deepEqual(clone(context.editExperiment),before,'unavailable resources cannot silently create a partial replacement configuration');assert(node('overlay').innerHTML.includes('编辑评测实验'));assertNoNewExperiment();
  context.restoreCatalog=clone(savedCatalog);context.restoreEvaluators=clone(savedEvaluators);run('evCatalog.sales=restoreCatalog;evEvaluatorStore().evaluators=restoreEvaluators;evCloseModal()');
}

// Existing in-memory runs missing the new metadata are backfilled before replacing configuration.
context.legacyExperiment=run('evCreateExperiment(initialFields)');context.legacyRun=run('evRunExperiment(legacyExperiment.id)');drain();
const legacySnapshot=clone(context.legacyExperiment.snapshot);run('delete legacyExperiment.configurationRevision;delete legacyRun.snapshot;delete legacyRun.configurationRevision;delete legacyRun.experimentName');
run('evUpdateExperiment(legacyExperiment.id,{suiteId:"SAL-ES-002",execution:{caseRuns:1,fullRuns:1}})');
assert.equal(context.legacyExperiment.configurationRevision,2);assert.equal(context.legacyRun.configurationRevision,1);assert.deepEqual(clone(context.legacyRun.snapshot),legacySnapshot);
assert.equal(run('evExperimentRunGet(legacyExperiment)'),null);assert.deepEqual(snapshot('evExperimentRunContext(legacyExperiment,legacyRun).suiteIds'),initialFields.suiteIds);

console.log('Passed: task-dropdown search preserves hidden selections and FormData values; scoped matching, no-match/clear and edit/Agent reset; experiment edit entry/prefill/cancel/no-op and atomic validation; no new IDs or records; running edits rejected without stopping; configuration changes affect only the next run; immutable historical results/scoring/report/triage and legacy run backfill.');
