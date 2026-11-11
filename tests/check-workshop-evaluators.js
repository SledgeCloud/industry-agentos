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
const primaryEvaluatorCount=()=>{
  const nav=run('evScreen()').match(/<nav\b[^>]*aria-label="评测页签"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||'';
  return Number(nav.match(/>离线评估器\s*<span\b[^>]*>(\d+)<\/span>/)?.[1]??NaN);
};

// Fresh Rubric examples and mutable catalogs remain isolated by scene and by call.
run("currentSection='studio';studio.scene='sales';evData()");
const clone=value=>JSON.parse(JSON.stringify(value));
const seedA=run('evSeedEvaluators("sales")'),seedB=run('evSeedEvaluators("sales")');
const pristine=clone(seedB);seedA[0].criteria[0].description='仅修改此副本';seedA[0].history.push({version:'test'});
assert.deepEqual(clone(seedB),pristine);assert.deepEqual(snapshot('evSeedEvaluators("sales")'),pristine);
const ids=new Set();
for(const scene of ['sales','procurement']){
  const store=snapshot('evEvaluatorStore('+JSON.stringify(scene)+')');
  assert.equal(store.scene,scene);assert.equal(store.sequence,3);assert.equal(store.evaluators.length,3);
  assert.deepEqual(store.evaluators.map(e=>e.enabled),[true,true,false]);
  assert.deepEqual(snapshot('evEvaluatorDefaultIds('+JSON.stringify(scene)+')'),[store.evaluators[0].id]);
  for(const evaluator of store.evaluators){
    assert(!ids.has(evaluator.id));ids.add(evaluator.id);
    assert(evaluator.id.startsWith(scene==='sales'?'SAL-EV-':'PUR-EV-'));
    assert(evaluator.name&&evaluator.description&&evaluator.criteria.length&&evaluator.version);
    assert(Math.abs(evaluator.criteria.reduce((sum,c)=>sum+c.weight,0)-1)<1e-8);
    assert(evaluator.criteria.every(c=>c.name&&c.description&&c.weight>0&&c.weight<=1&&c.passScore>=0&&c.passScore<=100));
  }
}
assert.equal(ids.size,6);assert.throws(()=>run('evEvaluatorStore("unknown")'));
const originalProcurement=snapshot('evEvaluatorStore("procurement")');
context.savedRecords=snapshot('evEvaluatorStore().evaluators');
run('evEvaluatorStore().evaluators=[]');assert.equal(run('evEvaluatorStore().evaluators.length'),0,'deleting every evaluator must not recreate the seed');
run('evEvaluatorStore().evaluators=savedRecords');

const valid={name:'业务结果加权评分',description:'按正确性与完整性评分，明确 0/50/100 分口径。',criteria:[
  {name:'正确性',description:'0 分错误；50 分部分正确；100 分完整正确。',weight:0.5,passScore:80},
  {name:'完整性',description:'0 分缺失；50 分部分完整；100 分完整。',weight:0.5,passScore:80}
]};
const invalid=[
  {...valid,name:' '},{...valid,description:''},{...valid,criteria:[]},
  {...valid,criteria:[{name:'',description:'标准',weight:1,passScore:80}]},
  {...valid,criteria:[{name:'规则',description:' ',weight:1,passScore:80}]},
  ...[0,-1,1.1,NaN,Infinity,'0.5x',true].map(weight=>({...valid,criteria:[{name:'规则',description:'评分标准',weight,passScore:80}]})),
  {...valid,criteria:[{name:'A',description:'标准',weight:0.4,passScore:80},{name:'B',description:'标准',weight:0.5,passScore:80}]},
  ...[-1,101,NaN,Infinity,'','wrong',true].map(passScore=>({...valid,criteria:[{...valid.criteria[0],weight:1,passScore}]}))
];
const countBefore=run('evEvaluatorStore().evaluators.length'),sequenceBefore=run('evEvaluatorStore().sequence');
for(const fields of invalid){context.fields=fields;assert.throws(()=>run('evSaveEvaluatorDraft(fields)'));}
assert.equal(run('evEvaluatorStore().evaluators.length'),countBefore);assert.equal(run('evEvaluatorStore().sequence'),sequenceBefore);
context.fields={...clone(valid),criteria:valid.criteria.map(c=>({...c,weight:String(c.weight),passScore:String(c.passScore)})),version:'V99',enabled:false};
context.edited=run('evSaveEvaluatorDraft(fields)');
assert.equal(context.edited.id,'SAL-EV-004');assert.equal(context.edited.version,'V1');assert.equal(context.edited.enabled,true);
assert.equal(context.edited.passScore,80);assert.equal(context.edited.history.length,0);
context.unpublishedSelection=run('evEvaluatorSnapshot([edited.id],"sales")[0]');assert.equal(context.unpublishedSelection.version,'V1 未发布');assert.equal(context.unpublishedSelection.sourceVersion,'V1');
context.sameFields=clone(valid);run('evSaveEvaluatorDraft(sameFields,edited.id)');
assert.equal(context.edited.version,'V1');assert.equal(context.edited.history.length,0);
run('evPublishEvaluator(edited.id)');assert.equal(context.edited.version,'V1');assert.equal(context.edited.publicationStatus,'published');
const beforeEdit=clone(context.edited);clockMs+=1000;
context.changed={...clone(valid),description:'更新后的评分描述',criteria:valid.criteria.map((c,i)=>({...c,weight:i?0.6:0.4,passScore:i?90:85}))};
run('evSaveEvaluatorDraft(changed,edited.id)');
assert.equal(context.edited.version,'V1','saving content preserves the current version');assert.equal(context.edited.publicationStatus,'draft');assert.equal(context.edited.history.length,0);
context.savedDraftSelection=run('evEvaluatorSnapshot([edited.id],"sales")[0]');
assert.equal(context.savedDraftSelection.version,'V1 修改稿');assert.equal(context.savedDraftSelection.sourceVersion,'V1');
assert.equal(context.savedDraftSelection.description,context.changed.description);assert.deepEqual(clone(context.edited.publishedSnapshot.criteria),beforeEdit.criteria);
assert.equal(context.edited.publishedSnapshot.description,beforeEdit.description,'saving modified criteria leaves the published content unchanged');
context.draftSnapshotExperiment=run('evCreateExperiment({name:"保存修改稿快照",agentId:"sales-agent-1",version:evAgentVersions("sales-agent-1")[0].id,suiteIds:["SAL-ES-001"],evaluatorIds:[edited.id]})');
assert.equal(context.draftSnapshotExperiment.snapshot.evaluators[0].version,'V1 修改稿');assert.equal(context.draftSnapshotExperiment.snapshot.evaluators[0].sourceVersion,'V1');
assert(run('Object.isFrozen(draftSnapshotExperiment.snapshot.evaluators[0])&&Object.isFrozen(draftSnapshotExperiment.snapshot.evaluators[0].criteria[0])'));
run('evPublishEvaluator(edited.id)');
context.publishedSelection=run('evEvaluatorSnapshot([edited.id],"sales")[0]');
assert.equal(context.publishedSelection.version,'V2');assert.equal(context.publishedSelection.sourceVersion,'V2');
assert.equal(context.draftSnapshotExperiment.snapshot.evaluators[0].version,'V1 修改稿','publishing later preserves the experiment draft label and content');
assert.deepEqual(clone(context.draftSnapshotExperiment.snapshot.evaluators[0].criteria),context.changed.criteria);
assert.equal(context.edited.version,'V2');assert.equal(context.edited.history.length,1);
assert.deepEqual(clone(context.edited.history[0].criteria),beforeEdit.criteria);assert.equal(context.edited.history[0].passScore,80);
assert(run('Object.isFrozen(edited.history[0])&&Object.isFrozen(edited.history[0].criteria[0])'),'published history is deeply immutable');
const frozenSnapshot=clone(context.edited.publishedSnapshot);run('evSaveEvaluatorDraft(changed,edited.id)');assert.equal(context.edited.version,'V2');assert.deepEqual(clone(context.edited.publishedSnapshot),frozenSnapshot,'saving does not replace the published snapshot');
context.statusOnly={...clone(context.changed),enabled:false};run('evSaveEvaluatorDraft(statusOnly,edited.id)');
assert.equal(context.edited.enabled,false);assert.equal(context.edited.version,'V2');assert.equal(context.edited.history.length,1);
run('evToggleEvaluator(edited.id)');assert.equal(context.edited.enabled,true);assert.equal(context.edited.version,'V2');
assert.deepEqual(snapshot('evEvaluatorStore("procurement")'),originalProcurement);
context.xss={...clone(valid),name:'<img src=x onerror="boom()">',description:'</textarea><script>boom()</script>',criteria:[{name:'<script>规则</script>',description:'<img src=x onerror="boom()">',weight:1,passScore:80}]};
context.escapedEvaluator=run('evSaveEvaluatorDraft(xss)');
let markup=run('evEvaluatorsView()');handlers(markup);
assert(markup.includes('&lt;img')&&!markup.includes('<img src=x'),'evaluator names are rendered as text');
run('evEditEvaluator(escapedEvaluator.id)');markup=node('overlay').innerHTML;handlers(markup);
assert(markup.includes('&lt;/textarea&gt;')&&!markup.includes('<script>boom()'),'descriptions cannot escape form controls');
run('evCloseModal()');

// Selection rejects unavailable Rubrics and returns copies that cannot mutate the catalog.
for(const expression of ['[]','["missing"]','["PUR-EV-001"]','["SAL-EV-003"]'])assert.throws(()=>run('evEvaluatorSnapshot('+expression+',"sales")'));
const copied=run('evEvaluatorSnapshot(["SAL-EV-001"],"sales")');copied[0].criteria[0].weight=1;
assert.equal(run('evEvaluatorStore().evaluators.find(e=>e.id==="SAL-EV-001").criteria[0].weight'),0.5);
const params={name:'评分配置快照',agentId:'sales-agent-1',version:run('evAgentVersions("sales-agent-1")[0].id'),suiteId:'SAL-ES-001',suiteIds:['SAL-ES-001']};
context.params=params;
assert.throws(()=>run('evCreateExperiment({...params,evaluatorIds:[]})'));
assert.throws(()=>run('evCreateExperiment({...params,evaluatorIds:["SAL-EV-003"]})'));
assert.throws(()=>run('evCreateExperiment({...params,evaluatorIds:["PUR-EV-001"]})'));
context.liveSeedFields={...clone(pristine[0]),description:'实时目录中已经修改的评分标准'};
run('evSaveEvaluatorDraft(liveSeedFields,"SAL-EV-001")');
context.compat=run('evCreateExperiment(params)');
assert.deepEqual(clone(context.compat.evaluatorIds),snapshot('evEvaluatorDefaultIds("sales")'),'undefined selection preserves the default evaluator API');
assert(context.compat.snapshot.evaluators.length);
const historicalSeed=run('evExperimentGet("SAL-EXP-001").snapshot.evaluators[0]');
assert.equal(historicalSeed.version,pristine[0].version);assert.equal(historicalSeed.description,pristine[0].description,'historical experiment seeds use their own original scoring standards');

// Weight changes and thresholds drive case judgments, using the selected immutable versions.
context.weightedFields={...clone(valid),name:'权重与阈值回归',criteria:valid.criteria.map((c,i)=>({...c,weight:i?0.1:0.9,passScore:i?80:90}))};
context.weighted=run('evSaveEvaluatorDraft(weightedFields)');run('evPublishEvaluator(weighted.id)');
context.lowWeighted=run('evCreateExperiment({...params,name:"旧权重实验",evaluatorIds:[weighted.id]})');
context.weightedFields.criteria[0].weight=0.1;context.weightedFields.criteria[1].weight=0.9;
run('evSaveEvaluatorDraft(weightedFields,weighted.id)');run('evPublishEvaluator(weighted.id)');
context.highWeighted=run('evCreateExperiment({...params,name:"新权重实验",evaluatorIds:[weighted.id]})');
context.weightedFields.criteria[0].passScore=88;context.weightedFields.criteria[1].passScore=93;run('evSaveEvaluatorDraft(weightedFields,weighted.id)');run('evPublishEvaluator(weighted.id)');
context.criteriaPass=run('evCreateExperiment({...params,name:"逐项阈值达标实验",evaluatorIds:[weighted.id]})');
context.weightedFields.criteria.forEach(c=>c.passScore=100);run('evSaveEvaluatorDraft(weightedFields,weighted.id)');run('evPublishEvaluator(weighted.id)');
context.strict=run('evCreateExperiment({...params,name:"严格阈值实验",evaluatorIds:[weighted.id]})');
context.lenientFields={...clone(valid),name:'零阈值评分',criteria:valid.criteria.map(c=>({...c,passScore:0}))};context.lenient=run('evSaveEvaluatorDraft(lenientFields)');
context.easy=run('evCreateExperiment({...params,name:"零阈值实验",evaluatorIds:[lenient.id]})');
context.multi=run('evCreateExperiment({...params,name:"多评估器实验",evaluatorIds:[lenient.id,weighted.id]})');
context.boundaryFields={...clone(valid),name:'等于阈值校验',criteria:valid.criteria.map((c,i)=>({...c,weight:i?0.1:0.9,passScore:i?93:88}))};
context.boundary=run('evSaveEvaluatorDraft(boundaryFields)');context.equalThreshold=run('evCreateExperiment({...params,name:"阈值等号实验",evaluatorIds:[boundary.id]})');
assert.equal(context.lowWeighted.snapshot.evaluators[0].version,'V1');assert.equal(context.highWeighted.snapshot.evaluators[0].version,'V2');
assert.equal(context.criteriaPass.snapshot.evaluators[0].version,'V3');assert.equal(context.strict.snapshot.evaluators[0].version,'V4');
assert(run('Object.isFrozen(lowWeighted.snapshot.evaluators)&&Object.isFrozen(lowWeighted.snapshot.evaluators[0].criteria[0])'));
const lowSnapshot=clone(context.lowWeighted.snapshot.evaluators);
run('evToggleEvaluator(weighted.id);evConfirmDeleteEvaluator(weighted.id,"sales")');
assert(!run('evEvaluatorStore().evaluators.some(e=>e.id===weighted.id)'));
assert.deepEqual(clone(context.lowWeighted.snapshot.evaluators),lowSnapshot);
for(const name of ['lowWeighted','highWeighted','criteriaPass','strict','easy','multi','equalThreshold']){context.active=run('evRunExperiment('+name+'.id)');drain();assert.equal(context.active.status,context.active.results.some(r=>['未通过','运行失败'].includes(r.status))?'部分失败':'已完成');}
assert.equal(context.lowWeighted.runs[0].results[0].evaluations[0].score,88.5);
assert.equal(context.highWeighted.runs[0].results[0].evaluations[0].score,92.5);
assert.equal(context.lowWeighted.runs[0].results[0].status,'未通过');assert.equal(context.highWeighted.runs[0].results[0].status,'未通过','a high weighted total cannot hide a failing criterion');
assert(context.highWeighted.runs[0].results[0].evaluations[0].score>90);assert.equal(context.criteriaPass.runs[0].results[0].status,'通过');
assert.equal(context.equalThreshold.runs[0].results[0].evaluations[0].score,88.5);assert.equal(context.equalThreshold.runs[0].results[0].status,'通过','meeting the configured threshold exactly is a pass');
assert(context.strict.runs[0].results.filter(r=>r.status!=='运行失败').every(r=>r.status==='未通过'));
assert(context.easy.runs[0].results.filter(r=>r.status!=='运行失败').every(r=>r.status==='通过'));
assert(context.multi.runs[0].results.filter(r=>r.status!=='运行失败').every(r=>r.status==='未通过'));
const checkScores=experiment=>{
  for(const trial of experiment.runs)for(const result of trial.results){
    if(['运行失败','已跳过','待运行','运行中'].includes(result.status)){assert.deepEqual(clone(result.evaluations),[]);continue;}
    assert.equal(result.evaluations.length,experiment.snapshot.evaluators.length);
    for(const evaluation of result.evaluations){
      const rubric=experiment.snapshot.evaluators.find(e=>e.id===evaluation.evaluatorId);assert(rubric);
      assert.equal(evaluation.version,rubric.version);assert.equal(evaluation.passScore,rubric.passScore);assert(evaluation.reason);
      assert.equal(evaluation.criteria.length,rubric.criteria.length);
      const score=Number(evaluation.criteria.reduce((sum,c)=>sum+c.score*c.weight,0).toFixed(1));
      assert.equal(evaluation.score,score);assert.equal(evaluation.passed,evaluation.criteria.every(c=>c.passed));
      assert(evaluation.criteria.every((c,i)=>c.name===rubric.criteria[i].name&&c.description===rubric.criteria[i].description&&c.weight===rubric.criteria[i].weight&&c.passScore===rubric.criteria[i].passScore&&c.passed===(c.score>=c.passScore)&&c.score>=0&&c.score<=100&&c.reason));
    }
    assert.equal(result.status,result.evaluations.every(e=>e.passed)?'通过':'未通过');
  }
};
for(const experiment of [context.lowWeighted,context.highWeighted,context.criteriaPass,context.strict,context.easy,context.multi,context.equalThreshold])checkScores(experiment);
context.historical=clone(context.lowWeighted.runs[0]);run('evRunExperiment(lowWeighted.id)');drain();
assert.deepEqual(clone(context.lowWeighted.runs[1]),context.historical);checkScores(context.lowWeighted);
context.skipping=run('evCreateExperiment({...params,name:"跳过与停止不评分",suiteId:"SAL-ES-002",suiteIds:["SAL-ES-002"],evaluatorIds:[lenient.id]})');
context.partial=run('evRunExperiment(skipping.id)');run('evStopExperiment(skipping.id)');drain();
assert(context.partial.results.every(r=>r.status==='已跳过'&&r.evaluations.length===0));
context.partialCompleted=run('evRunExperiment(skipping.id)');until(()=>context.partialCompleted.results.some(r=>r.evaluations.length));
const completedScores=clone(context.partialCompleted.results[0].evaluations),late=[...timers.values()].map(t=>t.fn);
run('evStopExperiment(skipping.id)');const stopped=clone(context.partialCompleted);
for(const callback of late)callback();drain();assert.deepEqual(clone(context.partialCompleted),stopped);
assert.deepEqual(clone(context.partialCompleted.results[0].evaluations),completedScores,'stopping retains already produced score evidence');
assert(context.partialCompleted.results.filter(r=>r.status==='已跳过').every(r=>r.evaluations.length===0),'stopped pending cases cannot acquire scores from stale callbacks');

// Empty enabled catalogs prevent both implicit and explicit new experiment selection.
context.enabledStates=run('evEvaluatorStore().evaluators.map(e=>[e.id,e.enabled])');
run('evEvaluatorStore().evaluators.forEach(e=>e.enabled=false)');
assert.deepEqual(snapshot('evEvaluatorDefaultIds()'),[]);assert.throws(()=>run('evCreateExperiment(params)'));
assert.throws(()=>run('evCreateExperiment({...params,evaluatorIds:[lenient.id]})'));
run('for(const [id,enabled] of enabledStates)evEvaluatorStore().evaluators.find(e=>e.id===id).enabled=enabled');

// The offline tab provides the standard native editor, validated repeated criteria, and history.
run("workbenchOpen('评测');evTab('离线评估器')");
assert(run('evScreen().includes("evEditEvaluator()")'));assert(!run('evEvaluatorsView().includes("待细化")'));handlers(run('evScreen()'));
assert.equal(primaryEvaluatorCount(),run('evEvaluatorStore().evaluators.length'),'the primary tab counts all evaluators, including disabled records');
run('evEditEvaluator()');markup=node('overlay').innerHTML;handlers(markup);
for(const label of ['评估器名称','评估器简介','评分项 1 名称','评分项 1 标准','评分项 1 权重','评分项 1 通过阈值'])assert(markup.includes('aria-label="'+label+'"'));
assert(!markup.includes('name="passScore"'),'there is no editable global threshold');
assert(/<button\b(?=[^>]*form="ev-form")(?=[^>]*type="submit")/.test(markup));assert(markup.includes('evSubmitEvaluator(this,'));
run('evEvaluatorEditor.fields.name="保留的编辑器名称";evEvaluatorCriterionChange(0,"name","第一项");evEvaluatorCriterionChange(0,"description","第一项评分标准");evEvaluatorCriterionChange(0,"weight","0.5");evEvaluatorAddCriterion()');
assert.equal(run('evEvaluatorEditor.criteria.length'),2);assert.equal(run('evEvaluatorEditor.criteria[0].name'),'第一项');
assert.equal(run('evEvaluatorEditor.fields.name'),'保留的编辑器名称');
run('evEvaluatorCriterionChange(1,"name","第二项");evEvaluatorCriterionChange(1,"description","第二项评分标准");evEvaluatorCriterionChange(1,"weight","0.5")');
assert(node('ev-evaluator-weight-total').textContent.includes('合计：1'));
run('evEvaluatorRemoveCriterion(1);evEvaluatorRemoveCriterion(0)');assert.equal(run('evEvaluatorEditor.criteria.length'),1,'the editor retains at least one criterion');
const uiBefore=run('evEvaluatorStore().evaluators.length');
context.form={values:{scene:'sales',name:'标准表单评分',description:'从标准表单创建并校验权重。',criterionName:['正确性','完整性'],criterionDescription:['正确性评分标准','完整性评分标准'],criterionWeight:['0.4','0.5'],criterionPassScore:['80','85']}};
assert.equal(run('evSubmitEvaluator(form)'),false);assert.equal(run('evEvaluatorStore().evaluators.length'),uiBefore);
assert(node('ev-evaluator-error').textContent.includes('1'));assert(node('overlay').innerHTML.includes('新建离线评估器'));
context.form.values.criterionWeight=['0.4','0.6'];context.uiSaved=run('evSubmitEvaluator(form,"",true)');
assert.equal(context.uiSaved.version,'V1');assert.equal(context.uiSaved.enabled,true);assert.equal(node('overlay').innerHTML,'');
assert.equal(primaryEvaluatorCount(),uiBefore+1,'successful evaluator creation updates its primary count');
run('evEditEvaluator(uiSaved.id)');context.form.values.description='通过表单更新评分描述';run('evSubmitEvaluator(form,uiSaved.id)');
assert.equal(context.uiSaved.version,'V1');assert.equal(context.uiSaved.publicationStatus,'draft');run('evPublishEvaluator(uiSaved.id)');
assert.equal(context.uiSaved.version,'V2');assert.equal(context.uiSaved.history.length,1);
run('evEvaluatorDetail(uiSaved.id)');markup=node('overlay').innerHTML;handlers(markup);
assert(markup.includes('评分标准')&&!markup.includes('版本记录')&&markup.includes('V1')&&markup.includes('V2'));assert(markup.includes('发布新版本'));assert(!markup.includes('保存保留当前版本'),'published-version instructions are removed from the form');
run('evEditEvaluator(uiSaved.id)');markup=node('overlay').innerHTML;handlers(markup);assert(markup.includes('value="save"')&&markup.includes('value="publish"'),'editor offers separate save and publish actions');
const priorPublished=clone(context.uiSaved.publishedSnapshot);context.form.values.description='编辑表单直接发布的新标准';
run('evSubmitEvaluator(form,uiSaved.id,true)');assert.equal(context.uiSaved.version,'V3');assert.equal(context.uiSaved.publicationStatus,'published');
assert.deepEqual(clone(context.uiSaved.history.at(-1)),priorPublished,'publishing current form preserves the prior published content');
assert.equal(context.uiSaved.description,'编辑表单直接发布的新标准');
assert.equal(run('evPublishEvaluator("PUR-EV-001")'),false);assert.equal(run('evPublishEvaluator(uiSaved.id,"procurement")'),false);
const versionBeforeToggle=context.uiSaved.version;run('evToggleEvaluator(uiSaved.id);evToggleEvaluator(uiSaved.id)');assert.equal(context.uiSaved.version,versionBeforeToggle);
assert.equal(primaryEvaluatorCount(),uiBefore+1,'enable/disable does not change the total evaluator count');
assert.equal(run('evToggleEvaluator("PUR-EV-001")'),false);assert.deepEqual(snapshot('evEvaluatorStore("procurement")'),originalProcurement);
run('evEditEvaluator(uiSaved.id)');context.staleForm={values:{...context.form.values,scene:'sales'}};
run("studio.scene='procurement';evData();evEvaluatorUI()");assert.equal(run('evSubmitEvaluator(staleForm,uiSaved.id)'),false);
assert.equal(run('evEvaluatorState.search'),'');assert(run('evEvaluatorVisible().every(e=>e.id.startsWith("PUR-"))'));
run("studio.scene='sales';evData();evEvaluatorUI();evCloseModal()");

// Experiment creation requires an explicit UI selection and exposes unavailable choices read-only.
run('evNewExperiment()');markup=node('overlay').innerHTML;handlers(markup);
assert(markup.includes('aria-label="选择评估器"')&&markup.includes('name="evaluatorIds"'));
const disabledInput=[...markup.matchAll(/<input\b[^>]*name="evaluatorIds"[^>]*>/g)].find(m=>m[0].includes('value="SAL-EV-003"'));
assert(disabledInput&&disabledInput[0].includes('disabled'));
const beforeEmptyChoice=run('evExperimentStore().experiments.length');context.experimentForm={values:{...params,scene:'sales'}};
assert.equal(run('evSubmitExperiment(experimentForm)'),false);assert.equal(run('evExperimentStore().experiments.length'),beforeEmptyChoice);
assert(node('ev-experiment-form-error').textContent.includes('选择'));
context.experimentForm.values.evaluatorIds=[context.lenient.id];context.uiExperiment=run('evSubmitExperiment(experimentForm)');
assert.deepEqual(clone(context.uiExperiment.evaluatorIds),[context.lenient.id]);

// The results list does not collapse multiple evaluators into a single score.
run('evExperimentOpen(multi.id,multi.runs[0].id,"用例结果")');
const resultList=run('evExperimentResultTable(multi,multi.runs[0])');handlers(resultList);
const resultHeaders=[...resultList.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map(m=>m[1].replace(/<[^>]*>/g,'').trim());
assert(!resultHeaders.some(label=>/评分|得分|评估器/.test(label)),'case result list has no evaluator score column');
assert(resultHeaders.some(label=>label.startsWith('状态'))&&resultHeaders.includes('实际结果'),'case result list retains verdict and execution evidence');

// Report cells and case scoring details derive exactly from stored criterion scores and thresholds.
run('evExperimentOpen(multi.id,multi.runs[0].id,"实验报告")');
const report=run('evExperimentEvaluatorReport(multi,multi.runs[0])');handlers(report);
const text=html=>html.replace(/<[^>]*>/g,'').trim();
const rows=[...report.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(c=>text(c[1]))).filter(row=>row.length===7);
for(const evaluator of context.multi.snapshot.evaluators){
  const values=context.multi.runs[0].results.flatMap(r=>r.evaluations).filter(e=>e.evaluatorId===evaluator.id),passed=values.filter(e=>e.passed).length;
  const expected=[evaluator.name,evaluator.version,String(values.length),(values.reduce((sum,e)=>sum+e.score,0)/values.length).toFixed(1),'全部评分项分别达标',String(passed),String(values.length-passed)];
  assert.deepEqual(rows.find(row=>row[0]===evaluator.name),expected);
}
context.scoredResult=context.multi.runs[0].results.find(r=>r.evaluations.length);
markup=run('evExperimentScoringResults(scoredResult)');handlers(markup);
for(const evaluation of context.scoredResult.evaluations){
  assert(markup.includes(evaluation.name));assert(markup.includes(evaluation.score.toFixed(1)));
  for(const criterion of evaluation.criteria)assert(markup.includes(criterion.name)&&markup.includes('权重：'+criterion.weight)&&markup.includes('通过分数：'+criterion.passScore)&&markup.includes(criterion.description),'saved scoring standards are available on evaluator hover');
}
const failedExecution=context.multi.runs[0].results.find(r=>r.status==='运行失败');context.failedExecution=failedExecution;assert(failedExecution);
assert(run('evExperimentScoringResults(failedExecution).includes("无评估器分数")'));
context.skippedResult=context.partial.results[0];assert(run('evExperimentScoringResults(skippedResult).includes("无评估器分数")'));
run('evExperimentOpen(lowWeighted.id,lowWeighted.runs[0].id,"实验报告");evExperimentScoringSnapshot()');markup=node('overlay').innerHTML;handlers(markup);
assert(markup.includes(context.lowWeighted.runs[0].id)&&markup.includes('评分标准快照')&&markup.includes('V1')&&markup.includes('<td>0.9</td>')&&markup.includes('<td>0.1</td>'));
assert(!run('evEvaluatorStore().evaluators.some(e=>e.id===weighted.id)'),'the displayed score standard survives deletion of its live source');
assert.deepEqual(snapshot('evEvaluatorStore("procurement")'),originalProcurement);

console.log('Passed: fresh scene-scoped evaluator catalogs and no reseeding; strict Rubric/weight/threshold validation and escaped content; explicit save/publish versions, immutable history and status stability; native editor criteria/form validation; explicit enabled selections and immutable evaluator snapshots; weighted scores, threshold equality and all-evaluator case judgments; error/skipped no-score handling; scoring reports, original-standard drawers and prior evaluation regressions.');
