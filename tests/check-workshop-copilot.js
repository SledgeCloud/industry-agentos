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

// Initialize independent catalogs before measuring draft creation side effects.
run("currentSection='studio';studio.scene='sales';evData();evEvaluatorStore();evExperimentStore();studio.scene='procurement';evData();evEvaluatorStore();evExperimentStore();studio.scene='sales';evData()");
const clone=value=>JSON.parse(JSON.stringify(value));
const storedState=()=>snapshot('({evaluators:evEvaluatorStores,experiments:evExperimentStores})');
const counts=()=>snapshot('({evaluatorCount:evEvaluatorStore().evaluators.length,evaluatorSequence:evEvaluatorStore().sequence,experimentCount:evExperimentStore().experiments.length,experimentSequence:evExperimentStore().sequence})');
const unchanged=(before,message)=>assert.deepEqual(storedState(),before,message);
const selection={name:'仅验证的实验',agentId:'sales-agent-1',version:run('evAgentVersions("sales-agent-1")[0].id'),suiteId:'SAL-ES-001',evaluatorIds:['SAL-EV-001','SAL-EV-002']};
context.copilotSelection={...selection,name:' 仅验证的实验 '};
const validationBefore=storedState(),inputBefore=clone(context.copilotSelection);
assert.deepEqual(clone(run('evValidateExperimentDraft(copilotSelection)')),{...selection,suiteIds:[selection.suiteId],execution:expectedSingleExecution({concurrency:4,caseRuns:1,fullRuns:1,modelId:'mock-eval-balanced',mcpIds:[]},selection.evaluatorIds)});
assert.deepEqual(clone(context.copilotSelection),inputBefore,'validation does not rewrite caller inputs');unchanged(validationBefore,'validation does not create records or consume sequence numbers');
for(const override of [{name:''},{version:'V999'},{suiteId:'SAL-ES-003'},{evaluatorIds:[]},{evaluatorIds:['PUR-EV-001']},{evaluatorIds:['SAL-EV-003']}]){
  context.invalid={...selection,...override};assert.throws(()=>run('evValidateExperimentDraft(invalid)'));unchanged(validationBefore,'invalid drafts have no persistence side effects');
}

// The two entry menus offer exactly the manual and Copilot paths.
for(const [kind,manual] of [['evaluator','evEditEvaluator()'],['experiment','evNewExperiment()']]){
  const menu=run('evCreateMenu('+JSON.stringify(kind)+')');handlers(menu);
  const options=[...menu.matchAll(/<button\b[^>]*role="menuitem"[^>]*>([\s\S]*?)<\/button>/g)].map(m=>m[1].replace(/<[^>]*>/g,'').trim());
  assert.deepEqual(options,['新建','通过 Copilot 新建']);assert(menu.includes('onclick="'+manual+'"'));
  assert(menu.includes("evCopilot('"+kind+"')"));
}
assert(run('evEvaluatorsView().includes("evCopilot(\x27evaluator\x27)" )'));
assert(run('evExperimentsView().includes("evCopilot(\x27experiment\x27)" )'));
run('evEditEvaluator()');assert(node('overlay').innerHTML.includes('新建离线评估器'));run('evCloseModal();evNewExperiment()');assert(node('overlay').innerHTML.includes('新建评测实验'));run('evCloseModal()');

const assertComposer=kind=>{
  const chat=run('studioChat()');handlers(chat);
  const skill=kind==='evaluator'?'offline-evaluator-authoring':'evaluation-experiment-builder';
  assert(chat.includes('/'+skill));assert.equal((chat.match(/<textarea\b/g)||[]).length,1);
  assert(!/<(?:input|select)\b/.test(chat),'direct Copilot creation does not repeat editor fields');
  assert(!chat.includes('id="ev-form"'));assert.equal(node('overlay').innerHTML,'','Copilot uses the center conversation');
  return chat;
};

// Default natural-language requests are sendable and remain drafts until explicit confirmation.
for(const kind of ['evaluator','experiment']){
  const before=storedState();run('evCopilot('+JSON.stringify(kind)+')');assertComposer(kind);
  const request=run('evState.copilot.input');assert(request&&request.includes('「'));
  run('evCopilotSend('+JSON.stringify(request)+')');assert.equal(run('evState.copilot.phase'),'review');
  const chat=assertComposer(kind);assert(chat.includes('evCopilotConfirm()'));
  assert(!chat.includes('evCopilotReview()'),'new kinds confirm from the conversation without a second editor');
  assert.equal(run('evState.copilot.request'),request);unchanged(before,'sending a request neither creates records nor consumes IDs');
  run('evCopilotRevise()');assert.equal(run('evState.copilot.input'),request);assert.equal(run('evState.copilot.phase'),'input');
  assert.equal(run('evCopilotConfirm()'),false);unchanged(before,'a request returned to editing cannot confirm the previous draft');
  run('evState.copilot=null;evRender()');unchanged(before,'abandoning a draft creates nothing');
}

const evaluatorFields={name:'自然对话评分',description:'按正确性与完整性检查业务结果。',criteria:[
  {name:'正确性',description:'0分错误，100分正确。',weight:0.6,passScore:80},{name:'完整性',description:'0分缺失，100分完整。',weight:0.4,passScore:85}
]};
context.evaluatorContext={fields:clone(evaluatorFields)};
const beforeEvaluator=storedState(),evaluatorCountBefore=counts();
run('evCopilot("evaluator",evaluatorContext)');
const originalEvaluatorRequest=run('evState.copilot.input');
for(const value of [evaluatorFields.name,evaluatorFields.description,'通过阈值 80','权重 0.6','权重 0.4','正确性','完整性'])assert(originalEvaluatorRequest.includes(value));
const evaluatorRequest=originalEvaluatorRequest.replace('自然对话评分','编辑后的自然评分').replace('通过阈值 80','通过阈值 83').replace('权重 0.6','权重 0.55').replace('权重 0.4','权重 0.45');
run('evCopilotRemember('+JSON.stringify(evaluatorRequest)+');evState.scopeOpen=true;evRender()');
assert.equal(run('evState.copilot.input'),evaluatorRequest);assertComposer('evaluator');
node('studio-message-input').value=evaluatorRequest;run('evCopilotSend()');
assert.equal(run('evState.copilot.phase'),'review');assert.equal(run('evState.copilot.draft.name'),'编辑后的自然评分');
assert.equal(run('evState.copilot.draft.description'),evaluatorFields.description);assert.equal(run('evState.copilot.draft.criteria[0].passScore'),83);
assert.deepEqual(snapshot('evState.copilot.draft.criteria.map(c=>c.weight)'),[0.55,0.45]);
assert.deepEqual(context.evaluatorContext,{fields:evaluatorFields},'parsing does not mutate provided context');
unchanged(beforeEvaluator,'normalized evaluator drafts have no writes');assertComposer('evaluator');
context.createdEvaluator=run('evCopilotConfirm()');
assert(context.createdEvaluator&&context.createdEvaluator.id);assert.equal(run('evState.copilot.phase'),'saved');
assert.equal(context.createdEvaluator.sourceRequest,evaluatorRequest);assert.equal(context.createdEvaluator.version,'V1');assert.equal(context.createdEvaluator.enabled,true);
assert.equal(counts().evaluatorCount,evaluatorCountBefore.evaluatorCount+1);assert.equal(counts().evaluatorSequence,evaluatorCountBefore.evaluatorSequence+1);
const afterEvaluator=storedState();assert.equal(run('evCopilotConfirm().id'),context.createdEvaluator.id);unchanged(afterEvaluator,'repeated confirmation cannot create another evaluator');
assert.equal(node('overlay').innerHTML,'','evaluator confirmation does not open another create form');
run('evCopilotOpenSaved()');assert.equal(run('evState.tab'),'离线评估器');assert(node('overlay').innerHTML.includes('查看离线评估器')&&node('overlay').innerHTML.includes(context.createdEvaluator.id));run('evCloseModal()');

const experimentFields={name:'应用协同实验',agentId:'sales-app-agent',version:'V1',suiteId:'SAL-ES-003',evaluatorIds:[context.createdEvaluator.id,'SAL-EV-002']};
context.experimentContext={fields:clone(experimentFields)};
const beforeExperiment=storedState(),experimentCountBefore=counts();
run('evCopilot("experiment",experimentContext)');
const originalExperimentRequest=run('evState.copilot.input');
for(const value of ['应用协同实验','销售管理应用 Agent','Agent版本「V1」','销售应用风险复核','编辑后的自然评分','销售分货异常与边界评分'])assert(originalExperimentRequest.includes(value));
const experimentRequest=originalExperimentRequest.replace('应用协同实验','自然语言修改后的实验').replace('Agent版本「V1」','Agent版本「V2」');
run('evCopilotSend('+JSON.stringify(experimentRequest)+')');
assert.equal(run('evState.copilot.phase'),'review');assert.equal(run('evState.copilot.draft.name'),'自然语言修改后的实验');
assert.equal(run('evState.copilot.draft.agentId'),'sales-app-agent');assert.equal(run('evState.copilot.draft.version'),'V2');
assert.equal(run('evState.copilot.draft.suiteId'),'SAL-ES-003');assert.deepEqual(snapshot('evState.copilot.draft.evaluatorIds'),experimentFields.evaluatorIds);
unchanged(beforeExperiment,'experiment validation and preview consume no record IDs');assertComposer('experiment');
context.createdExperiment=run('evCopilotConfirm()');
assert(context.createdExperiment&&context.createdExperiment.id);assert.equal(run('evState.copilot.phase'),'saved');
assert.equal(context.createdExperiment.sourceRequest,experimentRequest);assert.equal(context.createdExperiment.status,'未运行');assert.equal(context.createdExperiment.runs.length,0);
assert.equal(counts().experimentCount,experimentCountBefore.experimentCount+1);assert.equal(counts().experimentSequence,experimentCountBefore.experimentSequence+1);
assert.deepEqual(clone(context.createdExperiment.snapshot.evaluators.map(e=>e.id)),experimentFields.evaluatorIds);
assert(run('Object.isFrozen(createdExperiment.snapshot.evaluators[0].criteria[0])'));
const afterExperiment=storedState();assert.equal(run('evCopilotConfirm().id'),context.createdExperiment.id);unchanged(afterExperiment,'repeated confirmation cannot create another experiment');
assert.equal(node('overlay').innerHTML,'');run('evCopilotOpenSaved()');assert.equal(run('evState.tab'),'评测实验');assert.equal(run('evExperimentState.id'),context.createdExperiment.id);assert.equal(node('overlay').innerHTML,'');

// Multiple suites and execution resources survive both natural edits and direct confirmation.
const salesSuites=snapshot('evData().suites.filter(s=>s.agentId==="sales-agent-1")'),tools=snapshot('evExperimentMcps()');
assert(salesSuites.length>=2&&tools.length>=2);
context.multiContext={fields:{...selection,name:'多集合自然请求',suiteIds:[salesSuites[0].id],execution:{concurrency:2,caseRuns:1,fullRuns:1,modelId:'mock-eval-balanced',mcpIds:[tools[0].id]}}};
run('evCopilot("experiment",multiContext)');
const multiPrefill=run('evState.copilot.input'),multiBefore=storedState();
assert(multiPrefill.includes('并发数：2')&&multiPrefill.includes('每个用例执行次数：1')&&multiPrefill.includes('全量评测次数：1'));
assert(multiPrefill.includes(salesSuites[0].name)&&multiPrefill.includes(tools[0].name));
const multiRequest=multiPrefill+'\n增加评测集「'+salesSuites[1].name+'」\n并发数：3；每个用例执行次数：2；全量评测次数：2\n评测模型：mock-eval-fast\n增加MCP「'+tools[1].name+'」';
run('evCopilotSend('+JSON.stringify(multiRequest)+')');
assert.equal(run('evState.copilot.phase'),'review');assert.equal(run('evState.copilot.request'),multiRequest);
assert.deepEqual(snapshot('evState.copilot.draft.suiteIds'),salesSuites.slice(0,2).map(s=>s.id));
const multiExecution={concurrency:3,caseRuns:2,fullRuns:2,modelId:'mock-eval-fast',mcpIds:tools.slice(0,2).map(m=>m.id)};
assert.deepEqual(snapshot('evState.copilot.draft.execution'),expectedSingleExecution(multiExecution,selection.evaluatorIds));
const uniqueCases=new Set(salesSuites.slice(0,2).flatMap(s=>s.caseIds));
assert.equal(run('evState.copilot.draft.caseCount'),uniqueCases.size);assert.equal(run('evState.copilot.draft.resultCount'),uniqueCases.size*4);
assert.equal(run('evState.copilot.draft.recordCount'),2);assert.equal(run('evState.copilot.draft.recordResultCount'),uniqueCases.size*2,'Copilot distinguishes each record from all requested independent conversations');assert(!/NaN|undefined/.test(run('evCopilotDraftPreview(evState.copilot)')),'canonical execution fields render valid preview counts');
assertComposer('experiment');unchanged(multiBefore,'multi-suite/execution previews are still zero-write drafts');
context.multiExperiment=run('evCopilotConfirm()');assert(context.multiExperiment.id);
assert.deepEqual(clone(context.multiExperiment.execution),expectedSingleExecution(multiExecution,selection.evaluatorIds));assert.deepEqual(clone(context.multiExperiment.snapshot.suites.map(s=>s.id)),salesSuites.slice(0,2).map(s=>s.id));
assert.deepEqual(clone(context.multiExperiment.snapshot.mcps.map(m=>m.id)),multiExecution.mcpIds);assert.equal(context.multiExperiment.snapshot.model.id,'mock-eval-fast');
assert.equal(context.multiExperiment.sourceRequest,multiRequest);assert.equal(context.multiExperiment.runs.length,0);
const multiSaved=storedState();assert.equal(run('evCopilotConfirm().id'),context.multiExperiment.id);unchanged(multiSaved,'multi-suite direct confirmation remains idempotent');
const quotedEvaluators=selection.evaluatorIds.map(id=>run('evEvaluatorStore().evaluators.find(e=>e.id==='+JSON.stringify(id)+')'));
const quotedListRequest=multiPrefill.replace(/^使用评测集[^\n]*/m,'使用评测集「'+salesSuites[0].name+'」、「'+salesSuites[1].name+'」。')
  .replace(/^使用离线评估器[^\n]*/m,'使用离线评估器「'+quotedEvaluators[0].name+'」（版本「'+quotedEvaluators[0].version+'」）、「'+quotedEvaluators[1].name+'」（版本「'+quotedEvaluators[1].version+'」）。')
  .replace(/^(?:使用)?MCP[^\n]*/m,'MCP：「'+tools[0].name+'」、「'+tools[1].name+'」。');
assert(quotedListRequest.includes('」、「'));
run('evCopilot("experiment",multiContext)');const quotedBefore=storedState();run('evCopilotSend('+JSON.stringify(quotedListRequest)+')');
assert.equal(run('evState.copilot.phase'),'review');
assert.deepEqual(snapshot('evState.copilot.draft.suiteIds'),salesSuites.slice(0,2).map(s=>s.id),'one natural quoted list must retain every suite');
assert.deepEqual(snapshot('evState.copilot.draft.evaluatorIds'),selection.evaluatorIds,'each quoted evaluator retains its own resource/version');
assert.deepEqual(snapshot('evState.copilot.draft.execution.mcpIds'),tools.slice(0,2).map(m=>m.id),'one MCP list must retain every tool');
unchanged(quotedBefore,'common quoted-list requests generate a draft without writes');
for(const invalidListRequest of [quotedListRequest.replace('「'+salesSuites[1].name+'」','「不存在的第二个评测集」'),quotedListRequest.replace('「'+tools[1].name+'」','「不存在的第二个 MCP」'),quotedListRequest.replace('「'+quotedEvaluators[1].name+'」（版本「'+quotedEvaluators[1].version+'」）','「'+quotedEvaluators[1].name+'」（版本「V999」）')]){
  run('evCopilot("experiment",multiContext)');const before=storedState();run('evCopilotSend('+JSON.stringify(invalidListRequest)+')');
  assert.equal(run('evState.copilot.phase'),'input');assert(run('evState.copilot.error.length>0'));assert.equal(run('evState.copilot.input'),invalidListRequest);unchanged(before,'an invalid later list entry cannot be silently discarded');
}
run('evCopilot("experiment",multiContext)');
const replaceRequest=run('evState.copilot.input')+'\n评测集改为「'+salesSuites[1].name+'」\nMCP：无',replaceBefore=storedState();
run('evCopilotSend('+JSON.stringify(replaceRequest)+')');assert.equal(run('evState.copilot.phase'),'review');
assert.deepEqual(snapshot('evState.copilot.draft.suiteIds'),[salesSuites[1].id]);assert.deepEqual(snapshot('evState.copilot.draft.execution.mcpIds'),[]);
unchanged(replaceBefore,'resource replacement and clearing do not create records');
for(const instruction of ['并发数：7','每个用例执行次数：0','全量评测次数：1.5','并发数：若干','评测模型：missing-model','MCP：missing-mcp','增加评测集「销售应用风险复核」']){
  run('evCopilot("experiment",multiContext)');const request=run('evState.copilot.input')+'\n'+instruction,before=storedState();
  run('evCopilotSend('+JSON.stringify(request)+')');assert.equal(run('evState.copilot.phase'),'input',instruction);
  assert.equal(run('evState.copilot.draft'),null);assert(run('evState.copilot.error.length>0'));assert.equal(run('evState.copilot.input'),request);
  assert.equal(run('evCopilotConfirm()'),false);unchanged(before,'invalid execution configuration cannot silently retain prefilled defaults');
}

// A later explicit instruction overrides an earlier prefilled value, including version validation.
context.versionOverrideContext={fields:{...selection,name:'追加版本指令',version:'V3'}};
run('evCopilot("experiment",versionOverrideContext)');
const prefilledVersionRequest=run('evState.copilot.input');assert(prefilledVersionRequest.includes('Agent版本「V3」'));
const versionOverrideRequest=prefilledVersionRequest+'\n版本：V1',beforeVersionOverride=storedState();
run('evCopilotSend('+JSON.stringify(versionOverrideRequest)+')');
assert.equal(run('evState.copilot.phase'),'review');assert.equal(run('evState.copilot.draft.version'),'V1');
assert.equal(run('evState.copilot.request'),versionOverrideRequest);unchanged(beforeVersionOverride,'parsing an appended instruction remains a draft');
const unsentRequest=versionOverrideRequest+'\n名称：这段修改尚未发送';
run('evCopilotRemember('+JSON.stringify(unsentRequest)+')');assert.equal(run('evCopilotConfirm()'),false);
assert.equal(run('evState.copilot.input'),unsentRequest);assert.equal(run('evState.copilot.request'),versionOverrideRequest);
assert(run('evState.copilot.error.includes("尚未发送")'));unchanged(beforeVersionOverride,'unsent composer edits cannot confirm an older preview');
run('evCopilot("experiment",versionOverrideContext)');
const invalidVersionRequest=run('evState.copilot.input')+'\n版本：V999',beforeInvalidVersion=storedState();
run('evCopilotSend('+JSON.stringify(invalidVersionRequest)+')');
assert.equal(run('evState.copilot.phase'),'input');assert.equal(run('evState.copilot.draft'),null);
assert.equal(run('evState.copilot.input'),invalidVersionRequest);assert(run('evState.copilot.error.length>0'));
unchanged(beforeInvalidVersion,'an unavailable appended version cannot silently use the prefilled version');

// Invalid natural edits remain in the center conversation and do not silently fall back.
for(const change of [request=>request.replace('通过阈值 80','通过阈值 101'),request=>request.replace('通过阈值 80','通过阈值 -1'),request=>request.replace('权重 0.6','权重 0.7'),request=>request.replace('权重 0.6','权重 0'),request=>request+'\n通过阈值：90']){
  run('evCopilot("evaluator",evaluatorContext)');const request=change(run('evState.copilot.input')),before=storedState();
  run('evCopilotSend('+JSON.stringify(request)+')');
  assert.equal(run('evState.copilot.phase'),'input');assert.equal(run('evState.copilot.draft'),null);assert(run('evState.copilot.error.length>0'));
  assert.equal(run('evState.copilot.input'),request);assert.equal(run('evState.copilot.request'),request);unchanged(before,'invalid evaluator requests cannot consume IDs');
  assert.equal(run('evCopilotConfirm()'),false);assertComposer('evaluator');
}
const invalidExperimentEdits=[
  request=>request.replace('Agent版本「V1」','Agent版本「V999」'),
  request=>request.replace('Agent「销售管理应用 Agent」','Agent「采购协同助手」'),
  request=>request.replace('评测集「销售应用风险复核」','评测集「销售分货核心能力验收」'),
  request=>request.replace('离线评估器「编辑后的自然评分」','离线评估器「销售分货交付完整性评分」'),
  request=>request.replace('离线评估器「编辑后的自然评分」','离线评估器「采购寻源业务结果评分」'),
  request=>request.replace('离线评估器「编辑后的自然评分」（版本「V1」）','离线评估器「编辑后的自然评分」（版本「V999」）')
];
for(const change of invalidExperimentEdits){
  run('evCopilot("experiment",experimentContext)');const original=run('evState.copilot.input'),request=change(original),before=storedState();assert.notEqual(request,original);
  run('evCopilotSend('+JSON.stringify(request)+')');
  assert.equal(run('evState.copilot.phase'),'input');assert.equal(run('evState.copilot.draft'),null);assert(run('evState.copilot.error.length>0'));
  assert.equal(run('evState.copilot.input'),request);unchanged(before,'invalid resource references never create an experiment');assertComposer('experiment');
}

// Confirmation validates the exact reviewed resource versions again, not only their IDs.
const sourceData=snapshot('evData()'),sourceEvaluators=snapshot('evEvaluatorStore().evaluators');
context.staleContext={fields:{...selection,name:'陈旧资源确认校验',evaluatorIds:['SAL-EV-001']}};
const resourceChanges=[
  'evToggleEvaluator("SAL-EV-001")',
  'evConfirmDeleteEvaluator("SAL-EV-001","sales")',
  'evSaveEvaluatorDraft({...evEvaluatorStore().evaluators.find(e=>e.id==="SAL-EV-001"),description:"审阅后已变更的标准"},"SAL-EV-001")',
  'evData().suites.find(s=>s.id==="SAL-ES-001").caseIds.forEach(id=>evData().cases.find(c=>c.id===id).enabled=false)'
];
for(const change of resourceChanges){
  run('evCopilot("experiment",staleContext)');const request=run('evState.copilot.input');run('evCopilotSend('+JSON.stringify(request)+')');assert.equal(run('evState.copilot.phase'),'review');
  run(change);const beforeConfirm=storedState();assert.equal(run('evCopilotConfirm()'),false);
  assert.equal(run('evState.copilot.phase'),'review');assert.equal(run('evState.copilot.request'),request);assert.equal(run('evState.copilot.input'),request);assert(run('evState.copilot.error.length>0'));
  unchanged(beforeConfirm,'stale-resource confirmation cannot create an experiment or consume its ID');assertComposer('experiment');
  context.restoreData=clone(sourceData);context.restoreEvaluators=clone(sourceEvaluators);run('evCatalog.sales=restoreData;evEvaluatorStore().evaluators=restoreEvaluators;evState.copilot=null;evRender()');
}
const originalMcps=snapshot('assetMcps');
context.multiStaleContext={fields:{...selection,suiteIds:salesSuites.slice(0,2).map(s=>s.id),execution:{concurrency:3,caseRuns:2,fullRuns:2,modelId:'mock-eval-fast',mcpIds:[tools[0].id]}}};
for(const change of ['evData().suites.find(s=>s.id==="SAL-ES-002").target+="；审阅后改变"','assetMcps.find(m=>m.name===evExperimentMcps()[0].name).desc="审阅后改变的 MCP 配置"']){
  run('evCopilot("experiment",multiStaleContext)');const request=run('evState.copilot.input');run('evCopilotSend('+JSON.stringify(request)+')');assert.equal(run('evState.copilot.phase'),'review');
  run(change);const beforeConfirm=storedState();assert.equal(run('evCopilotConfirm()'),false);
  assert.equal(run('evState.copilot.request'),request);assert(run('evState.copilot.error.includes("已变更")'));unchanged(beforeConfirm,'every selected suite and MCP participates in confirmation freshness checks');
  context.restoreData=clone(sourceData);context.restoreMcps=clone(originalMcps);run('evCatalog.sales=restoreData;assetMcps.splice(0,assetMcps.length,...restoreMcps);evState.copilot=null');
}

// No enabled evaluator or cross-scene context must remain an actionable error, never a fallback save.
run('evEvaluatorStore().evaluators.forEach(e=>e.enabled=false);evCopilot("experiment")');const noEnabledRequest=run('evState.copilot.input'),beforeNoEnabled=storedState();
run('evCopilotSend('+JSON.stringify(noEnabledRequest)+')');assert(run('evState.copilot.error.length>0'));assert.equal(run('evCopilotConfirm()'),false);unchanged(beforeNoEnabled,'missing enabled evaluators cannot create experiments');
context.restoreEvaluators=clone(sourceEvaluators);run('evEvaluatorStore().evaluators=restoreEvaluators;evState.copilot=null;evRender()');
const procurementBefore=snapshot('({e:evEvaluatorStore("procurement"),x:evExperimentStore("procurement")})');
run('evCopilot("evaluator",evaluatorContext)');const interrupted=run('evState.copilot.input');run('evCopilotSend('+JSON.stringify(interrupted)+')');
run("studio.scene='procurement';evData()");assert.equal(run('evCopilotConfirm()'),false);
assert.deepEqual(snapshot('({e:evEvaluatorStore("procurement"),x:evExperimentStore("procurement")})'),procurementBefore);
run('evCopilot("experiment")');assert(run('evState.copilot.input.includes("采购")&&!evState.copilot.input.includes("销售管理应用 Agent")'));assertComposer('experiment');
handlers(run('evScreen()'));

console.log('Passed: exact manual/Copilot menus and one natural composer; fractional weights and per-item thresholds; multi-suite/model/MCP and repeated-execution parsing; zero-write previews and direct idempotent confirmation; request retention, immutable snapshots and saved routes; invalid and stale resource/configuration rejection; scene isolation and generated handler syntax.');
