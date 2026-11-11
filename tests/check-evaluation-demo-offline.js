const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const clone=value=>JSON.parse(JSON.stringify(value));
const nodes=new Map(),timers=new Map(),values=new Map();let serial=0,now=Date.parse('2026-11-10T02:00:00Z');
const node=id=>{if(!nodes.has(id))nodes.set(id,{id,innerHTML:'',outerHTML:'',textContent:'',value:'',dataset:{},hidden:false,disabled:false,style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){},toggle(){}},childNodes:[],focus(){},setAttribute(){},removeAttribute(){},getAttribute(){return null;},querySelector(){return null;},querySelectorAll(){return[];},appendChild(){},replaceChildren(){},contains(){return false;},closest(){return null;},scrollIntoView(){},addEventListener(){}});return nodes.get(id);};
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
class Form{constructor(form){this.values=form.values||{};}get(key){const value=this.values[key];return Array.isArray(value)?value[0]??null:value??null;}getAll(key){const value=this.values[key];return value===undefined?[]:Array.isArray(value)?value:[value];}}
const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
const context={console,Date:Clock,JSON,URL,URLSearchParams,Blob,FormData:Form,localStorage:storage,innerWidth:1440,innerHeight:1000,
 document:{body:node('body'),activeElement:node('active'),getElementById:node,querySelector(){return null;},querySelectorAll(){return[];},createElement:node,addEventListener(){}},
 setTimeout(fn,delay=0){const id=++serial;timers.set(id,{id,fn,at:now+Number(delay)});return id;},clearTimeout(id){timers.delete(id);},setInterval(){return ++serial;},clearInterval(){},addEventListener(){},
 AIOpsApp:{page(){return'评测实验';},refresh(){},navigate(){},toast(){}},
 AIOpsResources:{sceneId(){return'all';},scopeCatalog(){return[{id:'sales'},{id:'procurement'}];}},AIOpsWorkspaces:{registerEvaluationScenes(){}}
};context.window=context;vm.createContext(context);
const run=code=>vm.runInContext(code,context),snapshot=code=>clone(run(code));
const modules=['aiops/evaluation-foundation.js','workshop-evaluation-seed.js','workshop-evaluation.js','workshop-evaluation-versions.js','workshop-evaluation-dashboard.js','workshop-evaluation-tasks.js','workshop-evaluation-assets.js','workshop-evaluation-evaluators.js','workshop-evaluation-experiment-engine.js','workshop-evaluation-reports.js','workshop-evaluation-experiments.js','workshop-evaluation-issues.js','workshop-evaluation-copilot.js','workshop-evaluation-optimization.js','aiops/evaluation-demo-catalog.js','aiops/evaluation-demo-runtime.js','aiops/evaluation.js','aiops/evaluation-details.js','aiops/unified-evaluation-data.js','aiops/unified-evaluation-bridge.js','aiops/evaluation-demo-online.js'];
for(const file of modules)vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),context,{filename:file});
const D=context.AIOpsUnifiedData,B=context.AIOpsUnifiedBridge,R=context.AIOpsEvaluationDemoRuntime,O=context.AIOpsEvaluationDemoOnline,C=context.AIOpsEvaluationDemoCatalog;
const oldSeed=snapshot('evSeedScene("sales")'),oldBackups=snapshot('evEvaluatorStore("sales").evaluators');
R.installCatalog();
const factoryRecords=run('["sales","procurement"].flatMap(scene=>evExperimentStore(scene).experiments)'),factorySnapshots=clone(factoryRecords);assert.equal(factoryRecords.length,6,'the unchanged shared factory still produces its original six experiments');
const notices=[];
D.configure({...O.evaluationDataOptions(),storage,now:()=>now,sessions:()=>O.sessions?O.sessions():[],businessTasks:()=>run('AIOpsEvaluation.taskCatalog()'),legacyEvaluators:()=>[],onRun:run=>notices.push(run)});
const initialized=D.initialize();assert(initialized.ok,JSON.stringify(initialized));B.configure({storage}).initialize();const onlineInit=O.initialize(D);assert(onlineInit.ok,JSON.stringify(onlineInit));const offlineInit=R.initializeExperiments();assert(offlineInit.ok,JSON.stringify(offlineInit));
function drain(){let count=0;while(timers.size){assert(++count<3000,'bounded Mock execution timers');const timer=[...timers.values()].sort((a,b)=>a.at-b.at)[0];timers.delete(timer.id);now=timer.at;timer.fn();}}
function choose(experiment){context.experiment=experiment;run('studio.scene=experiment.scene;evData();evState.tab="评测实验";currentSection="studio";wtState.open=true;Object.assign(evExperimentState,{scene:experiment.scene,id:experiment.id,tab:"问题优化",runId:experiment.runs[0]?.id||"",supplementId:""})');}
const experiments=run('Object.values(evExperimentStores).flatMap(store=>store.experiments).filter(item=>item.demoCatalogVersion)');
assert.equal(experiments.length,8);assert.equal(notices.length,0,'initialization never runs user callbacks');
assert.deepEqual([...offlineInit.retired].sort(),['PUR-EXP-001','PUR-EXP-002','PUR-EXP-003','SAL-EXP-001','SAL-EXP-002','SAL-EXP-003']);
assert.equal(run('Object.values(evExperimentStores).flatMap(store=>store.experiments).length'),8,'the new host lists only the eight current default demonstrations');
assert.deepEqual(clone(factoryRecords),factorySnapshots,'superseding default instances never rewrites their original shared snapshots or results');
for(const scene of ['sales','procurement'])assert.equal(run('evExperimentStore('+JSON.stringify(scene)+').experiments.length'),4);
for(const experiment of experiments){
 const currentMode=experiment.snapshot.execution.evaluatorSummary.mode;assert(['weighted_score','custom_prompt'].includes(currentMode));assert.equal(experiment.execution.evaluatorSummary.mode,currentMode);
 for(const record of [...experiment.runs,...(experiment.validationRuns||[])]){
  assert.equal(record.snapshot.execution.evaluatorSummary.mode,currentMode,'seeded run snapshots retain the actual current default policy');
  for(const result of record.results){
   if(result.evaluatorPolicyResult)assert.equal(result.evaluatorPolicyResult.mode,record.snapshot.execution.evaluatorSummary.mode,'final result mode comes from the actual frozen run');
   for(const assessment of result.assessments||[])if(assessment.policyResult)assert(['weighted_score','custom_prompt'].includes(assessment.policyResult.mode),'seeded evaluator results use only the two current policies');
  }
 }
 if(experiment.runs.length){choose(experiment);for(const result of experiment.runs[0].results){context.currentDemoResult=result;const markup=run('evExperimentScoringResults(currentDemoResult)');assert(!/历史判定|[0-9]+ \/ [0-9]+ 个评估器通过|至少 [0-9]+ 个参与判定的评估器通过/.test(markup),'default result details never relabel historical quantity results as current scoring');}}
}

run('studio.scene="sales";evData()');
assert.deepEqual(snapshot('evEvaluatorStore("sales").evaluators'),oldBackups,'the backup evaluator catalog stays untouched');
for(const kind of ['tasks','cases','suites'])assert.deepEqual(snapshot('evData()["'+kind+'"].filter(item=>!item.demoCatalogVersion)'),oldSeed[kind],'factory '+kind+' are preserved');
const allRows=experiments.flatMap(experiment=>experiment.runs.flatMap(record=>record.results));
assert(allRows.some(result=>result.status==='通过'));assert(allRows.some(result=>result.status==='未通过'));assert(allRows.some(result=>result.status==='待确认'));assert(allRows.some(result=>result.status==='运行失败'));assert(experiments.some(experiment=>!experiment.runs.length));
for(const prefix of ['SAL','PUR']){
 const core=experiments.find(experiment=>experiment.id===prefix+'-DEMO-EXP-CORE');assert.equal(core.runs[0].results.find(result=>result.caseId===prefix+'-DEMO-EC-01').status,'通过','standard business input, including real attachments, is accepted');
 const review=experiments.find(experiment=>experiment.id===prefix+'-DEMO-EXP-REVIEW'),result=review.runs[0].results[0];assert.equal(result.status,'通过','clarified multi-turn business output passes real custom final judgment');
 assert.equal(result.messages.filter(message=>message.role==='user').length,2);assert.notEqual(result.firstResponse,result.finalResponse);
 const tools=result.trace.spans.filter(span=>span.type==='tool');assert.equal(tools.length,2);assert.equal(tools[0].output.evidenceState,'等待用户补充必要业务事实');assert.equal(tools[0].output.shortage,undefined,'first-turn tool evidence cannot reveal facts supplied in the later turn');assert(Number.isFinite(tools[1].output.shortage));
}
assert.deepEqual([...new Set(experiments.map(experiment=>experiment.snapshot.execution.evaluatorSummary.mode))].sort(),['custom_prompt','weighted_score']);
assert(experiments.every(experiment=>experiment.snapshot.unifiedEvaluation.bindings.every(binding=>binding.evaluatorRef.version==='V2')));
const seededIssues=experiments.flatMap(experiment=>experiment.issueLedger||[]);for(const status of ['待修复','待验证','验证完成','已关闭'])assert(seededIssues.some(issue=>issue.status===status),'initial examples cover '+status);
assert(seededIssues.some(issue=>issue.latestVerification?.status==='验证未通过'));assert(seededIssues.some(issue=>issue.latestVerification?.status==='验证未完成'));
for(const experiment of experiments){for(const record of experiment.runs){assert(experiment.createdAtMs<=record.startedAtMs,'demo run starts after experiment creation');for(const sample of record.snapshot.cases)if(sample.demoScenario)assert(Date.parse(sample.createdAt)<=record.startedAtMs,'case existed before its demonstration run');}}
const initializedBytes=Array.from(values.values()).reduce((sum,value)=>sum+Buffer.byteLength(value,'utf8'),0);
console.log('Evaluation demo initial stored UTF8 bytes:',initializedBytes,'Data:',Buffer.byteLength(values.get(D.storageKey)||'','utf8'),'Bridge:',Buffer.byteLength(values.get(B.storageKey)||'','utf8'));
assert(initializedBytes<1600000,'curated demo sources and histories leave room for real user operations');
// A previous factory configuration upgrades without rewriting any completed run or suite snapshot.
const migrationExperiment=experiments.find(item=>item.id==='SAL-DEMO-EXP-CORE'),legacySpec=C.scene('sales',1).experiments[0],legacyBindings=clone(legacySpec.bindings),historicalRuns=clone(migrationExperiment.runs),historicalIssues=clone(migrationExperiment.issueLedger);
migrationExperiment.execution={...clone(legacySpec.execution),modelId:run('evEvaluationModels()[0].id')};migrationExperiment.evaluatorIds=legacyBindings.map(binding=>binding.evaluatorRef.id+'@V1');migrationExperiment.snapshot={...clone(migrationExperiment.snapshot),execution:clone(migrationExperiment.execution),unifiedEvaluation:{...clone(migrationExperiment.snapshot.unifiedEvaluation),bindings:legacyBindings}};migrationExperiment.demoSeedVersion=1;migrationExperiment.demoCatalogVersion=1;migrationExperiment.configurationRevision=1;
const sidecar=JSON.parse(values.get(B.storageKey)),taskKey='sales:SAL-DEMO-BT-ALLOCATE',oldTask=C.scene('sales',1).tasks[0];sidecar.tasks[taskKey].bindings=clone(oldTask.evaluationBindings);sidecar.tasks[taskKey].revision=2;sidecar.tasks[taskKey].specification={inputContract:'',outputContract:'',completionCriteria:''};values.set(B.storageKey,JSON.stringify(sidecar));
B.configure({storage}).initialize();const upgraded=R.initializeExperiments();assert(upgraded.ok);assert(upgraded.upgraded.includes(migrationExperiment.id),'only the untouched V1 default plan upgrades');assert.equal(migrationExperiment.snapshot.execution.evaluatorSummary.mode,'weighted_score');assert(migrationExperiment.snapshot.unifiedEvaluation.bindings.every(binding=>binding.evaluatorRef.version==='V2'));assert.deepEqual(clone(migrationExperiment.runs),historicalRuns);assert.deepEqual(clone(migrationExperiment.issueLedger),historicalIssues);assert(B.recommendedBindings(oldTask.id).every(binding=>binding.evaluatorRef.version==='V2'),'untouched task recommendations move to the new published standards');
// Editing the plan name is an explicit user change even if its original demo version is old.
const authoredExperiment=experiments.find(item=>item.id==='PUR-DEMO-EXP-PARTIAL');authoredExperiment.demoCatalogVersion=1;authoredExperiment.demoSeedVersion=1;authoredExperiment.name='用户维护的边界回归';const authoredBefore=clone(authoredExperiment);assert(R.initializeExperiments().preserved.includes(authoredExperiment.id));assert.deepEqual(clone(authoredExperiment),authoredBefore);
// The main story uses the same analysis, repair and verification controllers as the UI.
let resolved;
for(const experiment of experiments.filter(item=>/-CORE$/.test(item.id))){const source=experiment.runs[0];if(!source)continue;choose(experiment);const findings=run('evExperimentIssueAnalyzeComplete(experiment,experiment.runs[0])');const issue=(experiment.issueLedger||[]).find(issue=>C.scene(experiment.scene).cases.find(sample=>sample.id===issue.caseId)?.demoScenario?.repairBehavior==='resolved'&&issue.status==='待修复');if(issue){resolved={experiment,source,issue};break;}}
assert(resolved,'there is a fresh repairable failure for the live demonstration');
choose(resolved.experiment);context.issue=resolved.issue;const frozenSource=clone(resolved.source),frozenPlan=clone(resolved.source.snapshot);
assert(run('!!evExperimentIssueRepair(experiment.id,issue.id)'));drain();assert.equal(resolved.issue.status,'待验证',run('JSON.stringify(evExperimentAssistantState())'));
assert(resolved.experiment.demoRepairs[resolved.issue.caseId]);
const validation=run('evExperimentIssueVerify(experiment.id,issue.id)');assert(validation);drain();assert.equal(resolved.issue.verificationPassed,true);assert.equal(resolved.issue.status,'验证完成');assert(validation.demoRepairSnapshot[resolved.issue.caseId]);assert(Object.isFrozen(validation.demoRepairSnapshot));
assert.deepEqual(clone(resolved.source.results),frozenSource.results);assert.deepEqual(clone(resolved.source.snapshot),frozenPlan);
assert(run('evExperimentIssueSetStatus(experiment.id,issue.id,"已关闭")'));assert.equal(resolved.issue.status,'已关闭');
const newRun=run('evRunExperiment(experiment.id)');drain();assert.equal(newRun.results.find(result=>result.caseId===resolved.issue.caseId).status,'通过');assert.deepEqual(clone(resolved.source.results),frozenSource.results);
// A failure that needs another repair and a missing-evidence fixture do not turn green automatically.
for(const behavior of ['persists','missing']){
 let selected;
 for(const experiment of experiments){const source=experiment.runs[0];if(!source)continue;choose(experiment);run('evExperimentIssueAnalyzeComplete(experiment,experiment.runs[0])');const issue=(experiment.issueLedger||[]).find(issue=>C.scene(experiment.scene).cases.find(sample=>sample.id===issue.caseId)?.demoScenario?.repairBehavior===behavior&&(behavior!=='missing'||issue.evaluatorId===C.evaluatorIds.evidence));if(issue){selected={experiment,source,issue};break;}}
 assert(selected,'coverage includes '+behavior);choose(selected.experiment);context.issue=selected.issue;
 if(selected.issue.status==='已关闭')run('evExperimentIssueSetStatus(experiment.id,issue.id,"待修复")');
 assert(run('!!evExperimentIssueRepair(experiment.id,issue.id)'));drain();const verification=run('evExperimentIssueVerify(experiment.id,issue.id)');assert(verification);drain();
 assert.equal(selected.issue.verificationPassed,false);assert.equal(selected.issue.latestVerification.status,behavior==='missing'?'验证未完成':'验证未通过');
}
const beforeRepeat=experiments.length,beforeState=clone(B.state());assert(R.initializeExperiments().ok);assert.equal(run('Object.values(evExperimentStores).flatMap(store=>store.experiments).filter(item=>item.demoCatalogVersion).length'),beforeRepeat,'reinitializing never duplicates demo experiments');assert.deepEqual(clone(B.state()),beforeState,'reinitializing does not mutate recommendations, revisions, frozen suite pins or assessment ledgers');
run('studio.scene="sales";evData()');const bindingCount=B.recommendedBindings('SAL-DEMO-BT-ALLOCATE').length;B.editTaskBindings('SAL-DEMO-BT-ALLOCATE');for(let i=0;i<bindingCount;i++)B.removeTaskBinding(0);node('ub-task-inputContract').value='用户主动修改的输入契约';assert(B.saveTaskBindings());const customizedState=clone(B.state());assert(R.initializeExperiments().ok);assert.deepEqual(clone(B.state()),customizedState,'a user-cleared binding list and edited contract survive reinitialization');
// Editing a real published demo case must leave the catalog fixture and its old scores behind.
const oldCaseResult=clone(experiments.find(experiment=>experiment.id==='SAL-DEMO-EXP-CORE').runs.at(-1).results[0]);
run('const editedSample=evData().cases.find(item=>item.id==="SAL-DEMO-EC-01");editedSample.input+="\\n本轮库存改为500件。";editedSample.expected="按500件可供库存重新计算缺口。";editedSample.inputAttachments[0].name="edited-orders.csv";evVersionSave(editedSample);evVersionPublish(editedSample)');
B.repinSuite('SAL-DEMO-ES-CORE',{silent:true});const spec=C.scene('sales').experiments[0],edited=B.createExperiment({name:'用户修改数据后的新实验',agentId:spec.agentId,version:spec.version,suiteIds:spec.suiteIds,unifiedBindings:clone(spec.bindings),execution:{...clone(spec.execution),modelId:run('evEvaluationModels()[0].id')},agentRuntimeOverride:spec.agentRuntimeOverride,judgeRuntime:spec.judgeRuntime});choose(edited);const editedRun=run('evRunExperiment(experiment.id)');drain();const editedResult=editedRun.results.find(result=>result.caseId==='SAL-DEMO-EC-01');assert.equal(editedResult.status,'待确认');assert(editedResult.demoFixtureMismatch);assert(!editedResult.demoEvidence);assert.notEqual(editedResult.actual,C.fixture('SAL-DEMO-EC-01','initial').answer);assert(editedResult.assessments.every(assessment=>assessment.metricResults.every(metric=>metric.value===null)),'changed input, expected result, attachment and version never reuse trusted scores');assert.deepEqual(clone(experiments.find(experiment=>experiment.id==='SAL-DEMO-EXP-CORE').runs.at(-1).results[0]),oldCaseResult,'editing a case preserves historical execution evidence');
assert.equal(editedResult.actual,'');assert(editedResult.demoFixtureMismatchReason);assert(!editedResult.messages.some(message=>message.role==='assistant'),'an execution notice is never presented as an Agent answer');
const existsExperiment=B.createExperiment({name:'修改用例的输出存在性回归',agentId:spec.agentId,version:spec.version,suiteIds:spec.suiteIds,unifiedBindings:[{id:'EDITED-OUTPUT-EXISTS',evaluatorRef:{id:'UE-OUTPUT-EXISTS',version:'V1'},role:'gate',target:'first_response',targetType:'case_output'}],execution:{...clone(spec.execution),evaluatorSummary:{type:'composite_policy',policyVersion:1,mode:'weighted_score',missingEvidence:'inconclusive',passThreshold:100,weights:[{bindingId:'EDITED-OUTPUT-EXISTS',weight:1}]},modelId:run('evEvaluationModels()[0].id')},agentRuntimeOverride:spec.agentRuntimeOverride,judgeRuntime:spec.judgeRuntime});choose(existsExperiment);const existsRun=run('evRunExperiment(experiment.id)');drain();const existsResult=existsRun.results.find(result=>result.caseId==='SAL-DEMO-EC-01');assert.equal(existsResult.status,'待确认','legacy exists rules never treat an unexecuted system notice as business output');assert.equal(existsResult.actual,'');assert.notEqual(existsResult.assessments[0].decision,'passed');
// Deleted defaults stay deleted during subsequent initialization in the same workspace.
const deletedExperiment=experiments.find(item=>item.id==='PUR-DEMO-EXP-PARTIAL');context.deletedExperiment=deletedExperiment;run('evExperimentStore("procurement").experiments=evExperimentStore("procurement").experiments.filter(item=>item.id!==deletedExperiment.id)');assert(R.initializeExperiments().ok);assert(!run('evExperimentStore("procurement").experiments.some(item=>item.id===deletedExperiment.id)'));
// Provenance guards are independent of the ID: authored, imported and already-deleted instances survive unchanged.
function factoryProtectionProbe(){
 const context={console,Date,JSON,Map,WeakMap,studio:{scene:'sales'},evState:{},evExperimentState:{id:null},evCatalog:{},evExperimentStores:{},evExperimentMetricContexts:new Map(),evExperimentMetricSnapshots:new Map()};context.window=context;
 context.evSeedScene=()=>({tasks:[],cases:[],suites:[]});context.evData=()=>context.evCatalog[context.studio.scene]||(context.evCatalog[context.studio.scene]=context.evSeedScene());
 context.evExperimentStore=scene=>context.evExperimentStores[scene]||(context.evExperimentStores[scene]={experiments:[1,2,3].map(n=>({id:(scene==='sales'?'SAL':'PUR')+'-EXP-00'+n,mock:true,name:'原始默认'+n,snapshot:{execution:{evaluationPolicy:'all_selected'}},configurationRevision:1,runs:[{id:'FACTORY-'+scene+'-'+n,results:[{status:'通过',actual:'原始答复'}]}]}))});
 context.AIOpsEvaluationDemoCatalog={version:2,scene:()=>({tasks:[],cases:[],suites:[],experiments:[]})};context.AIOpsUnifiedData={hash:value=>JSON.stringify(value)};context.AIOpsUnifiedBridge={state:()=>({tasks:{},suiteCurrent:{}})};
 vm.createContext(context);vm.runInContext(fs.readFileSync('dist/aiops/evaluation-demo-runtime.js','utf8'),context);context.AIOpsEvaluationDemoRuntime.installCatalog();
 const store=context.evExperimentStore('sales'),renamed=store.experiments[0],rerun=store.experiments[1],deletedId=store.experiments[2].id;
 renamed.name='用户维护的实验';rerun.runs.push({id:'USER-RUN',results:[{status:'未通过',actual:'用户后续执行答复'}]});
 const imported=clone(store.experiments[2]);imported.name='明确导入的V1历史';store.experiments=store.experiments.filter(item=>item.id!==deletedId);store.experiments.push(imported,{...clone(imported),id:'USER-CREATED-EXPERIMENT',name:'用户新建实验'});
 const before=clone(store.experiments);assert(context.AIOpsEvaluationDemoRuntime.initializeExperiments().ok);assert.deepEqual(clone(context.evExperimentStores.sales.experiments),before,'renamed defaults, additional runs and copied imports are never inferred to be factory defaults');
 store.experiments=store.experiments.filter(item=>item!==imported);assert(context.AIOpsEvaluationDemoRuntime.initializeExperiments().ok);assert(!store.experiments.some(item=>item.id===deletedId),'a removed original or imported default ID is not recreated');
 const priorContext={...context,evExperimentStores:{sales:{experiments:clone(before)}}};priorContext.window=priorContext;priorContext.evExperimentStore=scene=>priorContext.evExperimentStores[scene]||(priorContext.evExperimentStores[scene]={experiments:[]});priorContext.evData=()=>({tasks:[],cases:[],suites:[]});
 vm.createContext(priorContext);vm.runInContext(fs.readFileSync('dist/aiops/evaluation-demo-runtime.js','utf8'),priorContext);priorContext.AIOpsEvaluationDemoRuntime.installCatalog();assert(priorContext.AIOpsEvaluationDemoRuntime.initializeExperiments().ok);assert.deepEqual(clone(priorContext.evExperimentStores.sales.experiments),before,'a store that already existed before the new host installation has no factory provenance');
}
factoryProtectionProbe();
// File-origin storage failures must not retire the only visible experiment instances.
function initializationFailureProbe(){
 const saved=new Map();let blocked='write';
 const storage={getItem(key){if(blocked==='read')throw Error('SecurityError');return saved.get(key)||null;},setItem(key,value){if(blocked==='write')throw Error('QuotaExceededError');saved.set(key,value);}};
 const probe={console,Date:Clock,JSON,URL,URLSearchParams,Blob,FormData:Form,localStorage:storage,innerWidth:1440,innerHeight:1000,document:context.document,setTimeout(){return 0;},clearTimeout(){},setInterval(){return 0;},clearInterval(){},addEventListener(){},AIOpsApp:context.AIOpsApp,AIOpsResources:context.AIOpsResources,AIOpsWorkspaces:context.AIOpsWorkspaces};probe.window=probe;vm.createContext(probe);
 for(const file of modules)vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),probe,{filename:file});
 const evaluate=code=>vm.runInContext(code,probe),D=probe.AIOpsUnifiedData,B=probe.AIOpsUnifiedBridge,R=probe.AIOpsEvaluationDemoRuntime,O=probe.AIOpsEvaluationDemoOnline,C=probe.AIOpsEvaluationDemoCatalog;
 R.installCatalog();evaluate('["sales","procurement"].forEach(scene=>evExperimentStore(scene))');const original=clone(evaluate('Object.values(evExperimentStores).flatMap(store=>store.experiments)'));
 D.configure({...O.evaluationDataOptions(),storage,now:()=>now,sessions:()=>O.sessions(),businessTasks:()=>evaluate('AIOpsEvaluation.taskCatalog()'),legacyEvaluators:()=>[]});
 function untouched(result,message){assert.equal(result.ok,false,message);assert.equal(result.retired.length,0);assert(result.error.includes('已保留现有实验'));assert.deepEqual(clone(evaluate('Object.values(evExperimentStores).flatMap(store=>store.experiments)')),original,message);}
 assert.equal(D.initialize().ok,false);B.configure({storage}).initialize();assert.equal(O.initialize(D).ok,false);untouched(R.initializeExperiments(),'blocked writes cannot produce an empty successful directory');
 blocked='read';assert.equal(D.initialize().ok,false);assert.equal(O.initialize(D).ok,false);untouched(R.initializeExperiments(),'blocked reads preserve factory snapshots and results');
 blocked='';assert(D.initialize().ok);assert(O.initialize(D).ok);
 const canonical=JSON.parse(saved.get(D.storageKey)),ref=C.scene('sales').experiments[0].bindings[0].evaluatorRef;
 const missing=clone(canonical),asset=missing.evaluators.find(record=>record.id===ref.id);asset.versions=asset.versions.filter(record=>record.version!==ref.version);saved.set(D.storageKey,JSON.stringify(missing));
 const noVersion=R.initializeExperiments();untouched(noVersion,'the latest exact published version is required before replacing defaults');assert(noVersion.missing.some(item=>item.id===ref.id&&item.version===ref.version));
 const disabled=clone(canonical);disabled.evaluators.find(record=>record.id===ref.id).enabled=false;saved.set(D.storageKey,JSON.stringify(disabled));const stopped=R.initializeExperiments();untouched(stopped,'an intentional disabled evaluator is not silently restored or bypassed');assert(stopped.missing.some(item=>item.reason==='评估器已停用'));assert.equal(D.evaluator(ref.id).enabled,false);
 saved.set(D.storageKey,JSON.stringify(canonical));const create=B.createExperiment;
 B.createExperiment=()=>({id:'INCOMPLETE-PLAN'});untouched(R.initializeExperiments(),'an incomplete replacement snapshot leaves all original instances intact');B.createExperiment=create;
 let calls=0;B.createExperiment=function(fields){if(++calls===5)throw Error('模拟第二场景创建失败');return create(fields);};
 const partial=R.initializeExperiments();assert.equal(partial.ok,false);assert.equal(partial.retired.length,0);assert.equal(evaluate('Object.values(evExperimentStores).flatMap(store=>store.experiments).filter(record=>/^(SAL|PUR)-EXP-00[123]$/.test(record.id)).length'),6,'a later-scene failure cannot retire the earlier scene defaults');
 B.createExperiment=create;const recovered=R.initializeExperiments();assert(recovered.ok,JSON.stringify(recovered));assert.equal(recovered.retired.length,6);assert.equal(evaluate('Object.values(evExperimentStores).flatMap(store=>store.experiments).length'),8,'successful recovery retires defaults only after all current plans exist');
 // A subsequent user deletion remains a deletion even when its evaluator version is unavailable.
 const removed=C.scene('procurement').experiments.find(spec=>spec.demoState==='unrun'||spec.demoState==='not_run'||spec.demoState==='draft'||spec.demoState==='ready')||C.scene('procurement').experiments[1];
 probe.removedId=removed.id;evaluate('evExperimentStore("procurement").experiments=evExperimentStore("procurement").experiments.filter(record=>record.id!==removedId)');
 const after=JSON.parse(saved.get(D.storageKey));after.evaluators=after.evaluators.filter(record=>record.id!==ref.id);saved.set(D.storageKey,JSON.stringify(after));
 const repeated=R.initializeExperiments();assert(repeated.ok,JSON.stringify(repeated));assert.equal(evaluate('Object.values(evExperimentStores).flatMap(store=>store.experiments).length'),7);assert(!evaluate('Object.values(evExperimentStores).flatMap(store=>store.experiments).some(record=>record.id===removedId||/^(SAL|PUR)-EXP-00[123]$/.test(record.id))'),'deleted current examples and retired factory examples are never resurrected');
}
initializationFailureProbe();
// The prototype does not consult browser storage, even when old cache access throws.
function pageMemoryProbe(){
 function openPage(){
  let browserStorageReads=0;
  const probe={console,Date:Clock,JSON,URL,URLSearchParams,Blob,FormData:Form,innerWidth:1440,innerHeight:1000,document:context.document,setTimeout(){return 0;},clearTimeout(){},setInterval(){return 0;},clearInterval(){},addEventListener(){},AIOpsApp:context.AIOpsApp,AIOpsResources:context.AIOpsResources,AIOpsWorkspaces:context.AIOpsWorkspaces};
  Object.defineProperty(probe,'localStorage',{get(){browserStorageReads++;throw Error('Old browser data must not be read');}});probe.window=probe;vm.createContext(probe);
  for(const file of modules)vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),probe,{filename:file});
  const evaluate=code=>vm.runInContext(code,probe),D=probe.AIOpsUnifiedData,B=probe.AIOpsUnifiedBridge,R=probe.AIOpsEvaluationDemoRuntime,O=probe.AIOpsEvaluationDemoOnline;
  R.installCatalog();D.configure({...O.evaluationDataOptions(),now:()=>now,sessions:()=>O.sessions(),businessTasks:()=>evaluate('AIOpsEvaluation.taskCatalog()'),legacyEvaluators:()=>[]});
  assert(D.initialize().ok);B.initialize();assert(O.initialize(D).ok);assert(R.initializeExperiments().ok);
  assert.equal(evaluate('Object.values(evExperimentStores).flatMap(store=>store.experiments).length'),8);
  assert.equal(D.listEvaluators().filter(item=>item.id.startsWith('UE-DEMO-V2-')).length,10);
  assert.equal(D.listJobs().filter(item=>item.id.startsWith('UJ-SHOWCASE-')).length,9);
  assert.equal(browserStorageReads,0,'initialization, sources and run snapshots never access localStorage');
  return {D,R,evaluate,reads:()=>browserStorageReads};
 }
 const first=openPage(),id='UJ-SHOWCASE-SALES-QUALITY';assert(first.D.job(id).enabled);assert(first.D.setJobEnabled(id,false).ok);assert.equal(first.D.job(id).enabled,false);assert(first.R.initializeExperiments().ok);assert.equal(first.D.job(id).enabled,false,'switching functions preserves only the current page state');assert.equal(first.reads(),0);
 const refreshed=openPage();assert.equal(refreshed.D.job(id).enabled,true,'a new page always reloads the fixed demo configuration');assert.equal(first.D.job(id).enabled,false,'separate pages do not share runtime edits');
 for(const file of ['unified-evaluation-data.js','unified-evaluation-bridge.js','evaluation-demo-online.js'])assert(!fs.readFileSync('dist/aiops/'+file,'utf8').includes('localStorage'),file+' has no browser persistence dependency');
 const app=fs.readFileSync('dist/aiops/aiops.js','utf8');assert(app.includes('var evaluationValues = Object.create(null)'));assert(app.includes('storage: evaluationStorage'));assert(!app.includes('storage: window.localStorage'));
}
pageMemoryProbe();
console.log('New AIOps demo offline: curated resources, real assessments, analysis/repair/verification/close, persistent and missing failures, frozen evidence and initialization budget passed.');
