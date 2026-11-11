const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=new Map(),timers=new Map(),values=new Map();let sequence=0,now=Date.parse('2026-11-08T02:00:00Z');
const node=id=>{if(!nodes.has(id))nodes.set(id,{id,innerHTML:'',outerHTML:'',textContent:'',value:'',dataset:{},hidden:false,disabled:false,style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){},toggle(){}},childNodes:[],focus(){},setAttribute(){},removeAttribute(){},getAttribute(){return null;},querySelector(){return null;},querySelectorAll(){return[];},appendChild(){},replaceChildren(){},contains(){return false;},closest(){return null;},scrollIntoView(){},addEventListener(){}});return nodes.get(id);};
class Form{constructor(form){this.values=form.values||{};}get(key){const value=this.values[key];return Array.isArray(value)?value[0]??null:value??null;}getAll(key){const value=this.values[key];return value===undefined?[]:Array.isArray(value)?value:[value];}}
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
const definitions=[
  {id:'UNIFIED-QUALITY',version:'V1',sceneId:'sales',name:'业务验收',description:'检查业务结果',method:{type:'rule'},metrics:[{id:'quality',name:'业务结果',valueType:'boolean'}],mockDecision:'passed',mockAggregate:{value:true}},
  {id:'UNIFIED-OBSERVE',version:'V1',sceneId:'sales',name:'观察指标',description:'只观察',method:{type:'rule'},metrics:[{id:'observation',name:'观察',valueType:'boolean'}],mockDecision:'failed'},
  {id:'UNIFIED-UNKNOWN',version:'V1',sceneId:'sales',name:'缺少证据',description:'证据不足',method:{type:'rule'},metrics:[{id:'quality',name:'业务结果',valueType:'boolean'}],mockDecision:'inconclusive'},
  {id:'UNIFIED-PROC-QUALITY',version:'V1',sceneId:'procurement',name:'采购复用判定',description:'统一库资产可跨场景复用',method:{type:'rule'},metrics:[{id:'quality',name:'业务结果',valueType:'boolean'}],mockDecision:'passed',mockAggregate:{value:91}}
];
for(const definition of definitions)definition.decision={type:'boolean_equals',metricId:definition.metrics[0].id,value:true,missingEvidence:'inconclusive'};
const evaluatorCatalogRequests=[];
const clone=value=>JSON.parse(JSON.stringify(value));
const context={console,Date:Clock,JSON,URL,URLSearchParams,Blob,FormData:Form,localStorage:storage,innerWidth:1440,innerHeight:1000,
  document:{body:node('body'),activeElement:node('active'),getElementById:node,querySelector(){return null;},querySelectorAll(){return[];},createElement:node,addEventListener(){}},
  setTimeout(fn,delay=0){const id=++sequence;timers.set(id,{id,fn,at:now+Number(delay)});return id;},clearTimeout(id){timers.delete(id);},addEventListener(){},
  AIOpsApp:{page(){return'评测实验';},refresh(){},navigate(){},toast(){}},
  AIOpsResources:{sceneId(){return'all';},scopeCatalog(){return[{id:'sales'},{id:'procurement'}];}},
  AIOpsWorkspaces:{registerEvaluationScenes(){}},
  AIOpsUnifiedData:{
    listEvaluators(requestedScene){evaluatorCatalogRequests.push(requestedScene);return definitions.filter(item=>!requestedScene||!item.sceneId||item.sceneId===requestedScene).map(item=>({id:item.id,versions:[{version:item.version}]}));},
    evaluator(id,version){return clone(definitions.find(item=>item.id===id&&(!version||item.version===version))||null);},
    validateBinding(binding){return definitions.some(item=>item.id===binding.evaluatorRef.id&&item.version===binding.evaluatorRef.version)?[]:['评估器版本不存在'];},
    assess(evaluator,input,binding){const decision=evaluator.mockDecision;return{id:input.runId+':'+binding.id+':'+input.target.id,runId:input.runId,bindingId:binding.id,targetRef:{type:input.target.type,id:input.target.id,snapshotId:input.target.snapshotId},evaluatorRef:{id:evaluator.id,version:evaluator.version},executionStatus:'succeeded',decision,metricResults:evaluator.metrics.map(metric=>({metricId:metric.id,value:decision==='passed',decision,reason:'判定来自统一 Assessment',evidenceRefs:[input.target.id]})),aggregate:evaluator.mockAggregate??null,usage:{tokens:0,cost:0,currency:'USD'},evaluatedAt:new Date(now).toISOString()};}
  }
};context.window=context;vm.createContext(context);
const modules=['aiops/evaluation-foundation.js','workshop-evaluation-seed.js','workshop-evaluation.js','workshop-evaluation-versions.js','workshop-evaluation-dashboard.js','workshop-evaluation-tasks.js','workshop-evaluation-assets.js','workshop-evaluation-evaluators.js','workshop-evaluation-experiment-engine.js','workshop-evaluation-reports.js','workshop-evaluation-experiments.js','workshop-evaluation-issues.js','workshop-evaluation-copilot.js','workshop-evaluation-optimization.js','aiops/evaluation.js','aiops/evaluation-details.js'];
for(const file of modules)vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),context,{filename:file});
const run=code=>vm.runInContext(code,context),snapshot=code=>JSON.parse(run('JSON.stringify('+code+')'));
run("studio.scene='sales';evData()");
const originalEvaluators=snapshot('evEvaluatorStore().evaluators'),legacySnapshot=snapshot('evEvaluatorSnapshot(evEvaluatorDefaultIds())');
vm.runInContext(fs.readFileSync('dist/aiops/unified-evaluation-bridge.js','utf8'),context,{filename:'unified-evaluation-bridge.js'});
const B=context.AIOpsUnifiedBridge;B.configure({storage}).initialize();
assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators,'unified bridge never migrates or rewrites backup assets');
assert.deepEqual(snapshot('evEvaluatorSnapshot(evEvaluatorDefaultIds())'),legacySnapshot,'legacy snapshots still use the original evaluator definitions');

// Sidecar IDs and structured task contracts do not mutate legacy tasks.
const taskId=run('evData().tasks[0].id'),task=B.taskDefinition(taskId),dimensionId=task.dimensions[0].id;
assert(dimensionId);assert.equal(run('evData().tasks[0].dimensions[0].id'),undefined);
assert.equal(task.specification.completionCriteria,'','free prompt is not silently converted into completion criteria');
B.setTaskSpecification(taskId,{inputContract:'已确认订单和库存',outputContract:'分货方案',completionCriteria:'已生成分货方案并取得业务确认'});
assert.equal(B.taskDefinition(taskId).completion,'已生成分货方案并取得业务确认');
run('evData().tasks[0].dimensions[0].name="更名后的业务维度"');
assert.equal(B.taskDefinition(taskId).dimensions[0].id,dimensionId,'renaming a dimension preserves its stable identity');
const procurement=run('evSeedScene("procurement").tasks[0]');
const enriched=B.enrichTask({...clone(procurement),scene:'procurement',agentId:'procurement:agents:0',sourceAgentId:procurement.agentId});
assert(enriched.dimensions.every(item=>item.id));assert.equal(enriched.agentId,'procurement:agents:0');assert.equal(enriched.sourceAgentId,procurement.agentId);
assert.equal(enriched.completion,'','cross-scene online tasks also avoid free-prompt completion inference');

// Build a small suite that covers two dimensions of one task, with explicit metric mappings.
context.taskId=taskId;
run(`evData().suites.push({id:'TEST-SUITE',name:'统一桥接验收集',agentId:evData().tasks[0].agentId,target:'验收关联',taskIds:[taskId],caseIds:[evData().cases[0].id],caseBindings:{[evData().cases[0].id]:[{taskId,dimensionNames:evData().tasks[0].dimensions.slice(0,2).map(item=>item.name)}]},version:'V1'});`);
const currentTask=B.taskDefinition(taskId),mappings=currentTask.dimensions.slice(0,2).map(dimension=>({dimensionId:dimension.id,metricId:'quality'}));
const gate={id:'gate-quality',evaluatorRef:{id:'UNIFIED-QUALITY',version:'V1'},taskRef:{id:taskId,version:currentTask.version},dimensionMappings:mappings,role:'gate',targetType:'case_output',inputMapping:{actual:'/target/output',reference:'/case/expected'}};
const observe={id:'observe-only',evaluatorRef:{id:'UNIFIED-OBSERVE',version:'V1'},dimensionMappings:[],role:'observe',targetType:'case_output',inputMapping:{actual:'/target/output'}};
B.setTaskBindings(taskId,[gate]);B.repinSuite('TEST-SUITE');
const suite=run('evData().suites.find(item=>item.id==="TEST-SUITE")'),coverage=B.suiteCoverage(suite);
assert.equal(coverage.caseCovered,2);assert.equal(coverage.bindingCovered,2);
const pinned=B.resolveSuite(suite),originalExpected=pinned.cases[0].expected;
run('evData().cases[0].expected="编辑后的预期，新实验不应静默采用"');
assert.equal(B.resolveSuite(suite).cases[0].expected,originalExpected,'suite keeps its fixed Case snapshot');
const plan={name:'统一绑定实验',agentId:run('evData().tasks[0].agentId'),version:'V3',suiteIds:['TEST-SUITE'],unifiedBindings:[gate,observe],execution:{concurrency:2,caseRuns:1,fullRuns:1,modelId:'mock-eval-balanced',mcpIds:[]}};
const experiment=B.createExperiment(plan);context.experiment=experiment;
assert(experiment.snapshot.unifiedEvaluation);assert(Object.isFrozen(experiment.snapshot));
assert.equal(experiment.snapshot.cases[0].expected,originalExpected);
assert(experiment.snapshot.unifiedEvaluation.taskRefs.every(ref=>ref.snapshotId));
assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators);
assert(B.references('UNIFIED-QUALITY').some(item=>item.id===experiment.id));
const sourceDefinition=clone(experiment.snapshot.unifiedEvaluation.evaluatorVersions[0]);
definitions[0].description='修改当前库内容';
assert.deepEqual(clone(experiment.snapshot.unifiedEvaluation.evaluatorVersions[0]),sourceDefinition,'experiment contains a frozen evaluator definition');

function execution(name,bindings){
  const e=B.createExperiment({...plan,name,unifiedBindings:bindings});context.e=e;
  const record=run('evExperimentNewExecution(e,e.id+"-TEST",1,e.snapshot,{kind:"full",status:"运行中",supplements:[]})');
  e.runs.unshift(record);context.record=record;
  record.results=run('evExperimentResultRows(e,record.id)');
  run('evExperimentCompleteResult(e,record,0,"通过")');
  return {e,record,result:record.results[0]};
}
const success=execution('gate与observe隔离',[gate,observe]);
assert.equal(success.result.acceptance,'passed');assert.equal(success.result.status,'通过');
assert.equal(success.result.assessments.length,2);assert.equal(success.result.dimensions.length,2);
assert.equal(success.result.evaluations[0].score,null,'boolean aggregates are never converted into a numeric total');
assert(success.result.dimensions.every(item=>item.assessmentId&&item.metricId==='quality'));
assert.equal(run('evExperimentDetectIssues(e,record).length'),0,'failed observe checks never create business quality issues');
assert(B.taskResults(taskId).some(item=>item.completion==='completed'&&item.acceptance==='passed'));
const numericSummary=execution('跨场景评估器数值总分',[{...gate,evaluatorRef:{id:'UNIFIED-PROC-QUALITY',version:'V1'}}]);
assert.equal(numericSummary.result.evaluations[0].score,91,'finite numeric aggregate values remain available to offline reports');

const unknown=execution('证据不足隔离',[{...gate,evaluatorRef:{id:'UNIFIED-UNKNOWN',version:'V1'}}]);
assert.equal(unknown.result.acceptance,'inconclusive');assert.equal(unknown.result.status,'待确认');
assert.equal(run('evExperimentSummary(record).passed'),0);assert.equal(run('evExperimentSummary(record).failed'),0);
assert.equal(run('evExperimentSummary(record).inconclusive'),1);assert.equal(run('evExperimentSummary(record).passRate'),null);
assert.equal(run('evExperimentDetectIssues(e,record).length'),0);assert(unknown.result.trace?.spans?.length,'completed inconclusive results retain trace evidence');
const unknownMetrics=run('evDashboardRunMetrics(e,record)');
assert.equal(unknownMetrics.find(item=>item.id==='case-executions').value,1);
assert.equal(unknownMetrics.find(item=>item.id==='case-pass-rate').value,null);
assert.equal(unknownMetrics.find(item=>item.id==='case-duration').value,unknown.result.durationMs);

const observed=execution('仅观察',[observe]);
assert.equal(observed.result.acceptance,'not_applicable');assert.equal(observed.result.status,'仅观察');
assert.equal(run('evExperimentSummary(record).observed'),1);assert.equal(run('evExperimentSummary(record).passed'),0);
assert.equal(run('evExperimentDetectIssues(e,record).length'),0);
context.mixedRun={snapshot:unknown.record.snapshot,results:[clone(unknown.result),clone(unknown.result),clone(observed.result),clone(observed.result),{...clone(unknown.result),status:'运行失败',completion:'failed',acceptance:'inconclusive',durationMs:500,tokens:0}]};
const mixedMetrics=run('evDashboardRunMetrics(e,mixedRun)');
assert.equal(mixedMetrics.find(item=>item.id==='case-executions').value,5,'all five completed executions count, including unknown and observe-only');
assert.equal(mixedMetrics.find(item=>item.id==='case-pass-rate').value,null,'no quality denominator exists for 2 unknown + 2 observe-only + 1 runtime error');
assert.equal(mixedMetrics.find(item=>item.id==='case-duration').value,context.mixedRun.results.reduce((sum,item)=>sum+item.durationMs,0)/5);
assert.equal(mixedMetrics.find(item=>item.id==='case-tokens').value,context.mixedRun.results.reduce((sum,item)=>sum+item.tokens,0)/5);
const unmapped=execution('缺少业务维度映射',[{...gate,dimensionMappings:[]}]);
assert.equal(unmapped.result.acceptance,'inconclusive');assert(unmapped.result.dimensions.every(item=>item.passed===null));
assert.throws(()=>B.createExperiment({...plan,unifiedBindings:[gate,{...gate,id:'duplicate-primary'}]}),/一个 gate 指标来源/);
assert.throws(()=>B.createExperiment({...plan,unifiedBindings:[{...gate,evaluatorRef:{id:'MISSING',version:'V1'}}]}),/不可用/);

// New terminal states finish normal execution and remain individually rerunnable.
const live=B.createExperiment({...plan,name:'真实调度管线',unifiedBindings:[observe]});context.live=live;
const running=run('evRunExperiment(live.id)');
let iterations=0;while(timers.size){assert(++iterations<3000);const timer=[...timers.values()].sort((a,b)=>a.at-b.at)[0];timers.delete(timer.id);now=timer.at;timer.fn();}
assert.equal(running.status,'已完成');assert.equal(running.results[0].status,'仅观察');
const prior=clone(running.results);context.running=running;
const rerun=run('evRunExperiment(live.id,running,running.results[0].caseId)');
assert.equal(rerun.kind,'supplement');assert.deepEqual(clone(running.results),prior,'rerun compatibility does not rewrite historical states');
run('evStopExperiment(live.id)');

// Task detail regeneration retains the original content without injected evaluation panels.
run('evTaskDetail(taskId)');
const markup=run('AIOpsEvaluationDetails.render("业务任务")');
assert(markup.includes('基本信息'));assert(markup.includes('提示词'));assert(markup.includes('评估维度'));
assert(!markup.includes('任务契约与推荐评估绑定'));assert(!markup.includes('实际评测结果'));assert(!markup.includes('配置任务契约与绑定'));
run('evExperimentForm(experiment)');
assert(node('overlay').innerHTML.includes('ub-experiment-evaluator-row'));
assert(!node('overlay').innerHTML.includes('关联业务任务')&&!node('overlay').innerHTML.includes('输入变量「'));
assert(!node('overlay').innerHTML.includes('选择离线评估器'));
assert(node('overlay').innerHTML.includes('采购复用判定'),'sales experiment picker includes published evaluators carrying procurement metadata');
assert(evaluatorCatalogRequests.every(value=>value===undefined),'business scenes must not scope the shared evaluator picker');
assert(B.state().assessments.length>0);assert(values.has(B.storageKey));

// The native bridge evaluates the same shared simulation at two distinct scopes.
definitions[0].supportedTargets=['case_output','session'];definitions[1].supportedTargets=['case_output','session'];
const scopeCalls=[],assessBeforeScopes=context.AIOpsUnifiedData.assess;
context.AIOpsUnifiedData.assess=(evaluator,input,binding)=>{scopeCalls.push(clone({input,binding}));return assessBeforeScopes(evaluator,input,binding);};
const conversationObserver={...observe,evaluationTarget:'conversation',targetType:'session'};
const scopeExecution={...plan.execution,mode:'scenario_simulation',scenarioPrompt:'当前场景：销售分货评审\n用户画像：谨慎的业务人员\n已知事实：用户只知道已提供的信息\n行为规则：持续追问直到轮次上限，不编造未知事实。',maxTurns:3};
const scopedExperiment=B.createExperiment({...plan,name:'首轮与整段评分隔离',unifiedBindings:[gate,conversationObserver],execution:scopeExecution});context.scopedExperiment=scopedExperiment;
const scopedRecord=run('evExperimentNewExecution(scopedExperiment,scopedExperiment.id+"-SCOPES",1,scopedExperiment.snapshot,{kind:"full",status:"运行中",supplements:[]})');context.scopedRecord=scopedRecord;
scopedExperiment.runs.unshift(scopedRecord);scopedRecord.results=run('evExperimentResultRows(scopedExperiment,scopedRecord.id)');
run('evExperimentCompleteResult(scopedExperiment,scopedRecord,0,"通过")');scopedRecord.status='已完成';
const scopedResult=scopedRecord.results[0],firstCall=scopeCalls.find(call=>call.binding.id===gate.id),conversationCall=scopeCalls.find(call=>call.binding.id===observe.id);
assert.equal(scopedResult.actualTurns,3);assert.equal(scopedResult.messages.length,6);assert.equal(scopedResult.status,'通过');
assert.equal(firstCall.input.target.type,'case_output');assert.equal(firstCall.input.target.messages.length,2);
assert.equal(firstCall.input.target.output,scopedResult.firstResponse);assert.equal(firstCall.input.case.expected,scopedResult.expected);
assert.equal(conversationCall.input.target.type,'session');assert.equal(conversationCall.input.target.messages.length,6);
assert.equal(conversationCall.input.target.output,scopedResult.finalResponse);assert.equal(conversationCall.input.case.expected,undefined,'the first-turn reference is never reused as a conversation answer');
assert(conversationCall.input.target.messages.every(message=>!Object.hasOwn(message,'expected')),'scoring evidence strips message reference sidecars');
assert(firstCall.input.target.trajectory.every(span=>span.turn===1),'first response scoring cannot inspect future turns');
assert(conversationCall.input.target.trajectory.some(span=>span.turn===3),'conversation scoring can inspect later execution evidence');
assert.deepEqual(clone(scopedResult.evaluations.map(item=>item.target)),['first_response','conversation']);
assert.equal(scopedResult.evaluations[1].participation,'observe');assert.equal(scopedResult.evaluations[1].passed,false);
const scopedReport=run('evExperimentReportBody(scopedExperiment,scopedRecord)');
assert(scopedReport.includes('多轮执行')&&scopedReport.includes('整段会话')&&scopedReport.includes('仅观察'));
const scopedSnapshot=clone(scopedRecord.snapshot),scopedRevision=scopedExperiment.configurationRevision;
B.updateExperiment(scopedExperiment.id,{execution:{...scopeExecution,maxTurns:2}});
assert.equal(scopedExperiment.configurationRevision,scopedRevision+1);assert.deepEqual(clone(scopedRecord.snapshot),scopedSnapshot,'native simulation edits preserve source run evidence');
assert.throws(()=>B.createExperiment({...plan,name:'单轮不兼容整段评分',unifiedBindings:[gate,conversationObserver]}),/多轮执行/);
context.AIOpsUnifiedData.assess=assessBeforeScopes;

// Integration with the real shared model: actual input-schema validation and assessments.
vm.runInContext(fs.readFileSync('dist/aiops/unified-evaluation-data.js','utf8'),context,{filename:'unified-evaluation-data.js'});
const D=context.AIOpsUnifiedData;
function saveFixtureJob(draft,id){return D.saveJob({...draft,passPolicy:D.defaultCompositePolicy('weighted_score',draft.bindings)},id);}
let realSessions=[];
D.configure({storage,now:()=>now,businessTasks:()=>run('AIOpsEvaluation.taskCatalog()').map(task=>B.enrichTask(task)),legacyEvaluators:()=>[],sessions:()=>realSessions});
assert(D.initialize().ok);
const realDefinition={name:'交付结果显式检查',description:'用于联调输入契约与业务维度映射',sceneId:'sales',supportedTargets:['case_output','task_execution'],method:{type:'rule',checks:[{metricId:'readable_output',inputPath:'/actual',operator:'exists',onTrue:true,onFalse:false}]},inputSchema:{type:'object',properties:{actual:{type:'string'}},required:['actual'],additionalProperties:false},metrics:[{id:'readable_output',name:'交付结果可读取',description:'只判定交付证据存在',valueType:'boolean',rubric:'输出非空为true'}],aggregation:{type:'none'},decision:{type:'boolean_equals',metricId:'readable_output',value:true,missingEvidence:'inconclusive'}};
const saved=D.saveEvaluator(realDefinition);assert(saved.ok,saved.error);assert(D.publishEvaluator(saved.record.id).ok);
const realBinding={id:'REAL-BIND',evaluatorRef:{id:saved.record.id,version:'V1'},taskRef:gate.taskRef,role:'gate',targetType:'case_output',dimensionMappings:mappings.map(item=>({...item,metricId:'readable_output'})),inputMapping:{actual:'/target/output'}};
B.setTaskBindings(taskId,[realBinding]);B.repinSuite('TEST-SUITE');
const realExperiment=B.createExperiment({...plan,name:'真实统一数据模块集成',unifiedBindings:[realBinding]});context.realExperiment=realExperiment;
const realRun=run('evExperimentNewExecution(realExperiment,realExperiment.id+"-REAL",1,realExperiment.snapshot,{kind:"full",status:"运行中",supplements:[]})');context.realRun=realRun;realExperiment.runs.unshift(realRun);realRun.results=run('evExperimentResultRows(realExperiment,realRun.id)');
run('evExperimentCompleteResult(realExperiment,realRun,0,"通过")');
assert.equal(realRun.results[0].assessments[0].executionStatus,'succeeded');assert.equal(realRun.results[0].acceptance,'passed');
assert(realRun.results[0].assessments[0].effectiveConfigHash.startsWith('sha256:'));
assert(realRun.results[0].dimensions.every(item=>item.passed===true&&item.assessmentId));
const beforeVersion=clone(realExperiment.snapshot.unifiedEvaluation.evaluatorVersions[0]);
assert(D.saveEvaluator({...realDefinition,name:'交付结果显式检查新版'},saved.record.id).ok);assert(D.publishEvaluator(saved.record.id).ok);
assert.deepEqual(clone(realExperiment.snapshot.unifiedEvaluation.evaluatorVersions[0]),beforeVersion);
run('evExperimentForm(realExperiment)');
assert(node('overlay').innerHTML.includes('aria-label="绑定 1 选择评估器"'));
assert(node('overlay').innerHTML.includes('aria-label="搜索绑定 1 评估器"'));
assert(node('overlay').innerHTML.includes('aria-label="绑定 1 评估器版本"'));
assert(!node('overlay').innerHTML.includes('统一评估器'));
const beforePickerChange=clone(realExperiment);
B.bindingChange(0,'version','V2');
assert.equal(run('evExperimentEditor.unifiedBindings[0].evaluatorRef.version'),'V2');
assert.equal(run('evExperimentEditor.unifiedBindings[0].inputMapping.actual'),'/target/output');
assert.deepEqual(clone(realExperiment),beforePickerChange,'editing the selected evaluator version is only a form draft until saved');
B.bindingChange(0,'evaluator',saved.record.id+'@V1');
assert.equal(run('evExperimentEditor.unifiedBindings[0].evaluatorRef.version'),'V1','legacy combined-ref callbacks remain compatible');
run('evCloseModal()');
assert.throws(()=>B.createExperiment({...plan,unifiedBindings:[{...realBinding,inputMapping:{actual:'/target/output',undeclared:'/target/input'}}]}),/输入映射/,'undeclared inputs are rejected by the real model');
// A fixed older task context is valid even after the live task publishes another version.
run('evData().tasks[0].version="V99"');
assert.doesNotThrow(()=>B.createExperiment({...plan,name:'固定业务任务旧版本',unifiedBindings:[realBinding]}));
assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators,'real model integration also leaves backup assets untouched');

// Exercise the actual task editor callbacks and the existing experiment form submit path.
assert(B.editTaskBindings(taskId));B.removeTaskBinding(0);B.addTaskBinding();
node('ub-task-inputContract').value='订单与库存';node('ub-task-outputContract').value='分货结果';node('ub-task-completionCriteria').value='业务确认完成';
assert.equal(B.saveTaskBindings(),true,'real-model Task form saves without undeclared taskDefinition mapping');
const formBindings=B.recommendedBindings(taskId);
assert.equal(formBindings.length,1);
const selectedDefinition=D.evaluator(formBindings[0].evaluatorRef.id,formBindings[0].evaluatorRef.version);
assert(Object.keys(formBindings[0].inputMapping).every(key=>Object.hasOwn(selectedDefinition.inputSchema.properties,key)));
B.repinSuite('TEST-SUITE');
run('evExperimentForm();evExperimentAgentChange("sales-agent-1");evExperimentVersionChange("V3");evExperimentSuiteChange(["TEST-SUITE"])');
B.useTaskRecommendations();
const realFormGates=run('evExperimentEditor.unifiedBindings.filter(binding=>binding.role==="gate")');for(const binding of realFormGates)B.evaluatorSummaryChange('weight:'+binding.id,1/realFormGates.length);
context.realForm={values:{scene:'sales',name:'表单创建统一实验',agentId:'sales-agent-1',version:'V3',suiteIds:['TEST-SUITE'],concurrency:2,caseRuns:1,fullRuns:1,modelId:'mock-eval-balanced',mcpIds:[],evaluatorSummaryMode:'weighted_score',evaluatorSummaryThreshold:'80',...Object.fromEntries(realFormGates.map(binding=>['evaluatorSummaryWeight.'+binding.id,String(1/realFormGates.length)]))}};
const formExperiment=run('evSubmitExperiment(realForm)');
assert(formExperiment&&formExperiment.snapshot.unifiedEvaluation,'existing form submit saves the new binding schema');
assert.equal(formExperiment.snapshot.unifiedEvaluation.bindings[0].evaluatorRef.id,formBindings[0].evaluatorRef.id);

const onlineTask=B.taskDefinition(taskId);
realSessions=[{id:'ONLINE-SESSION-1',sceneId:'sales',agentId:'sales:agents:0',status:'completed',conversation:{rounds:[{n:1,inputId:'online-user-1',outputId:'online-agent-1',input:'生成分货方案',output:'已输出方案并确认',hasOutput:true}],records:[]},taskExecutions:[{id:'ONLINE-TASK-EXECUTION-1',taskId,completion:'completed',startMessageId:'online-user-1',completionMessageId:'online-agent-1',output:'已输出方案并确认',evidence:['online-agent-1']}]}];
realSessions[0].taskExecutions[0].completedAt=new Date(now).toISOString();
const onlineJob=D.saveJob({name:'业务任务线上验收联调',description:'验证任务详情能读取统一线上台账',selector:{sceneId:'sales',agentId:'sales:agents:0',targetType:'task_execution',taskIds:[taskId],spanTypes:[],filter:{text:'',status:'all',lookbackHours:null}},sampling:{rate:100,limit:null},readiness:{mode:'any',idleMinutes:10},schedule:{repeat:'manual',timezone:'Asia/Shanghai'},passPolicy:{type:'composite_policy',policyVersion:1,mode:'weighted_score',passThreshold:80,weights:[{bindingId:'ONLINE-TASK-BINDING',weight:1}],missingEvidence:'inconclusive'},bindings:[{...realBinding,id:'ONLINE-TASK-BINDING',taskRef:{id:taskId,version:onlineTask.version},targetType:'task_execution'}]});
assert(onlineJob.ok,onlineJob.error);
const onlineRun=D.runJob(onlineJob.record.id);assert(onlineRun.ok,onlineRun.error);assert.equal(onlineRun.run.assessed,1);
const sidecarCount=B.state().assessments.length,onlineCount=D.assessments().length,taskActuals=B.taskResults(taskId);
const onlineActual=taskActuals.find(item=>item.jobId===onlineJob.record.id);
assert(onlineActual,'Task results combine the online shared-model ledger with offline sidecar results');
assert.equal(onlineActual.completion,'completed');assert.equal(onlineActual.acceptance,'passed');assert(onlineActual.sourceName.includes('业务任务线上验收联调'));
assert.equal(B.state().assessments.length,sidecarCount,'reading online results never duplicates them into sidecar');
assert.equal(D.assessments().length,onlineCount,'combined Task results are read-only');

run('studio.scene="procurement";evData()');
const otherTask=B.taskDefinition(procurement.id),otherBinding={...realBinding,id:'PROCUREMENT-RECOMMENDATION',taskRef:{id:otherTask.id,version:otherTask.version},dimensionMappings:[{dimensionId:otherTask.dimensions[0].id,metricId:'readable_output'}]};
B.setTaskBindings(otherTask.id,[otherBinding]);
const originalProcurementEvaluators=snapshot('evEvaluatorStore("procurement").evaluators');
context.procurementTaskId=otherTask.id;
run(`evData().suites.push({id:'GLOBAL-PROC-SUITE',name:'跨场景统一库复用',agentId:'procurement-agent-1',target:'采购任务引用通用评估器',taskIds:[procurementTaskId],caseIds:[evData().cases[0].id],caseBindings:{[evData().cases[0].id]:[{taskId:procurementTaskId,dimensionNames:[evData().tasks[0].dimensions[0].name]}]},version:'V1'})`);
B.repinSuite('GLOBAL-PROC-SUITE');
const crossSceneExperiment=B.createExperiment({...plan,name:'销售创建的评估器用于采购实验',agentId:'procurement-agent-1',version:'V3',suiteIds:['GLOBAL-PROC-SUITE'],unifiedBindings:[otherBinding]});
assert.equal(crossSceneExperiment.snapshot.unifiedEvaluation.bindings[0].evaluatorRef.id,saved.record.id);
assert(crossSceneExperiment.snapshot.cases[0].expected,'cross-scene reuse retains the offline reference answer');
assert.equal(crossSceneExperiment.snapshot.unifiedEvaluation.bindings[0].dimensionMappings[0].dimensionId,otherTask.dimensions[0].id);
assert(B.references(saved.record.id).some(item=>item.id===crossSceneExperiment.id));
run('evExperimentForm()');
assert(node('overlay').innerHTML.includes('交付结果显式检查'),'procurement experiment picker includes the evaluator authored from sales');
assert.deepEqual(snapshot('evEvaluatorStore("procurement").evaluators'),originalProcurementEvaluators,'cross-scene unified reuse leaves procurement backup evaluators unchanged');

const referenceDefinition={...realDefinition,name:'离线参考证据检查',sceneId:'',inputSchema:{type:'object',properties:{actual:{type:'string'},reference:{type:'string'}},required:['actual','reference'],additionalProperties:false},method:{type:'rule',checks:[{metricId:'reference_exists',inputPath:'/reference',operator:'exists',onTrue:true,onFalse:false}]},metrics:[{id:'reference_exists',name:'存在参考证据',valueType:'boolean',rubric:'离线参考结果非空为true'}],decision:{type:'boolean_equals',metricId:'reference_exists',value:true,missingEvidence:'inconclusive'}};
const referenceSaved=D.saveEvaluator(referenceDefinition);assert(referenceSaved.ok,referenceSaved.error);assert(D.publishEvaluator(referenceSaved.record.id).ok);
const referenceBinding={...otherBinding,id:'OFFLINE-REFERENCE-BINDING',evaluatorRef:{id:referenceSaved.record.id,version:'V1'},dimensionMappings:[{dimensionId:otherTask.dimensions[0].id,metricId:'reference_exists'}]};delete referenceBinding.inputMapping;
const referenceExperiment=B.createExperiment({...plan,name:'自动映射离线预期结果',agentId:'procurement-agent-1',version:'V3',suiteIds:['GLOBAL-PROC-SUITE'],unifiedBindings:[referenceBinding]});context.referenceExperiment=referenceExperiment;
assert.equal(referenceExperiment.snapshot.unifiedEvaluation.bindings[0].inputMapping.reference,'/case/expected');
const referenceRun=run('evExperimentNewExecution(referenceExperiment,referenceExperiment.id+"-REFERENCE",1,referenceExperiment.snapshot,{kind:"full",status:"运行中",supplements:[]})');context.referenceRun=referenceRun;referenceExperiment.runs.unshift(referenceRun);referenceRun.results=run('evExperimentResultRows(referenceExperiment,referenceRun.id)');
run('evExperimentCompleteResult(referenceExperiment,referenceRun,0,"通过")');
assert.equal(referenceRun.results[0].assessments[0].executionStatus,'succeeded');assert.equal(referenceRun.results[0].assessments[0].decision,'passed','offline automatic mapping supplies the real case expected output');
run('studio.scene="sales";evData()');
assert.equal(B.recommendedBindings(otherTask.id)[0].id,'PROCUREMENT-RECOMMENDATION','online recommendation lookup is independent of the current studio scene');

assert(D.setEvaluatorEnabled(saved.record.id,false).ok);
assert.throws(()=>B.createExperiment({...plan,name:'停用评估器不允许新绑定',unifiedBindings:[realBinding]}),/已停用/);
// Old runs retain and execute their published snapshot after the library asset is disabled.
run('evExperimentCompleteResult(realExperiment,realRun,0,"通过")');
assert.equal(realRun.results[0].assessments[0].executionStatus,'succeeded');assert.equal(realRun.results[0].acceptance,'passed');

// Agent generation and LLM judging have independent runtime configuration and immutable evidence.
const judgeModels=D.judgeModels(),agentModels=D.runtimeModels();
assert(judgeModels.length>=2&&agentModels.length>=2);
const realModelNames=['deepseek 4.1 flash','GPT-6.1 Sol','Claude 5.5 Opus'];
assert.deepEqual(clone(judgeModels.map(item=>item.id)),realModelNames);assert.deepEqual(clone(agentModels.map(item=>item.name)),realModelNames);
const historicalModelLabel=D.modelDisplayName('mock-agent-fast-v1');
assert(historicalModelLabel.includes('Mock'));assert(!realModelNames.includes(historicalModelLabel),'historical Mock model references never become claims about a real provider');
const layeredDraft={...realDefinition,name:'模型分层评估标准',method:{type:'llm_judge'},metrics:[{id:'readable_output',name:'交付结果可读取',valueType:'boolean',standard:'根据已冻结评分标准读取当前证据 {{actual}} 中的逐项结果。',boolean:{trueStandard:'存在明确可读取交付证据',falseStandard:'没有可读取交付证据',passValue:true}}],decision:{type:'item_summary',policyVersion:3,summary:{type:'all'},missingEvidence:'inconclusive'}};
const layeredSaved=D.saveEvaluator(layeredDraft,undefined,{historicalImport:true});assert(layeredSaved.ok,layeredSaved.error);assert(D.publishEvaluator(layeredSaved.record.id,{historicalImport:true}).ok);
const layeredVersion=D.evaluator(layeredSaved.record.id,'V1');
assert.equal(layeredVersion.method.modelRef,undefined,'new evaluator versions contain criteria, not a selected model');
const currentTaskForModel=B.taskDefinition(taskId),layeredBinding={...realBinding,id:'LAYERED-MODEL-BINDING',evaluatorRef:{id:layeredSaved.record.id,version:'V1'},taskRef:{id:taskId,version:currentTaskForModel.version}};
const judgeA={modelRef:judgeModels[0].id,parameters:{temperature:0.25,maxOutputTokens:700}};
const layeredPlan={...plan,name:'被测与评判模型分层实验',unifiedBindings:[layeredBinding],agentRuntimeOverride:{mode:'inherit'},judgeRuntime:judgeA,execution:{...plan.execution,caseRuns:2,fullRuns:2}};
const modelExperiment=B.createExperiment(layeredPlan);context.modelExperiment=modelExperiment;
assert.equal(modelExperiment.snapshot.agentRuntimeSnapshot.mode,'inherit');
assert.equal(modelExperiment.snapshot.agentRuntimeSnapshot.modelRef,null,'legacy Mock modelId never becomes an Agent model');
assert.equal(modelExperiment.snapshot.agentRuntimeSnapshot.resolution,'unknown');
assert.equal(modelExperiment.snapshot.agentRuntimeSnapshot.source,'agent_version');
assert.equal(modelExperiment.snapshot.agentRuntimeSnapshot.executionMode,'mock');
assert.deepEqual(clone(modelExperiment.snapshot.judgeRuntimeSnapshot),judgeA);
assert.equal(modelExperiment.snapshot.execution.modelId,'mock-eval-balanced','legacy hidden config remains only for shared-runtime compatibility');

function drainModelTimers(){let count=0;while(timers.size){assert(++count<3000);const timer=[...timers.values()].sort((a,b)=>a.at-b.at)[0];timers.delete(timer.id);now=timer.at;timer.fn();}}
const modelOldRun=run('evRunExperiment(modelExperiment.id)');context.modelOldRun=modelOldRun;drainModelTimers();
assert.equal(modelExperiment.runs.length,2,'all full runs keep separate records');
for(const record of modelExperiment.runs){
  assert.deepEqual(clone(record.judgeRuntimeSnapshot),judgeA);assert.equal(record.agentRuntimeSnapshot.modelRef,null);
  assert(Object.isFrozen(record.agentRuntimeSnapshot)&&Object.isFrozen(record.judgeRuntimeSnapshot));
  for(const result of record.results){assert.deepEqual(clone(result.judgeRuntimeSnapshot),judgeA);assert.equal(result.agentRuntimeSnapshot.resolution,'unknown');for(const assessment of result.assessments){assert.deepEqual(clone(assessment.judgeRuntimeSnapshot),judgeA);assert.equal(assessment.agentRuntimeSnapshot.modelRef,null);}}
}
const oldRuntimeSnapshot=clone(modelOldRun.snapshot),oldRuntimeKey=run('evExperimentConfigurationKey(modelExperiment)'),oldAssessmentHash=modelOldRun.results.find(result=>result.assessments.length).assessments[0].effectiveConfigHash;
let revision=modelExperiment.configurationRevision;
B.updateExperiment(modelExperiment.id,{judgeRuntime:{modelRef:judgeModels[1].id}});
assert.equal(modelExperiment.configurationRevision,revision+1,'changing only Judge runtime creates one new configuration revision');
assert.equal(modelExperiment.snapshot.judgeRuntimeSnapshot.modelRef,judgeModels[1].id);
assert.deepEqual(clone(modelExperiment.snapshot.judgeRuntimeSnapshot.parameters),judgeA.parameters,'model-only edits preserve existing runtime parameters');
assert.equal(modelExperiment.snapshot.agentRuntimeSnapshot.modelRef,null);
assert.notEqual(run('evExperimentConfigurationKey(modelExperiment)'),oldRuntimeKey);
assert.notEqual(modelExperiment.snapshot.runtimeConfigurationHash,modelOldRun.snapshot.runtimeConfigurationHash);
assert.deepEqual(clone(modelOldRun.snapshot),oldRuntimeSnapshot,'editing the experiment never rewrites an older runtime snapshot');
assert.equal(run('evExperimentRunContext(modelExperiment,modelOldRun).judgeRuntime.modelRef'),judgeModels[0].id,'historical context resolves its run, not the current experiment');
const oldModelReport=run('evExperimentReportBody(modelExperiment,modelOldRun)');
assert(oldModelReport.includes(judgeModels[0].name));assert(!oldModelReport.includes(judgeModels[1].name));assert(!oldModelReport.includes('<dt>评测模型</dt>'));

const modelJudgeRun=run('evRunExperiment(modelExperiment.id)');context.modelJudgeRun=modelJudgeRun;drainModelTimers();
const changedJudgeAssessment=modelJudgeRun.results.find(result=>result.assessments.length).assessments[0];
assert.equal(changedJudgeAssessment.judgeRuntimeSnapshot.modelRef,judgeModels[1].id);
assert.notEqual(changedJudgeAssessment.effectiveConfigHash,oldAssessmentHash,'effective assessment identity includes independent Judge runtime');

revision=modelExperiment.configurationRevision;
const beforeAgentModelKey=run('evExperimentConfigurationKey(modelExperiment)');
B.updateExperiment(modelExperiment.id,{agentRuntimeOverride:{mode:'override',modelRef:agentModels[1].id,parameters:{temperature:0.4}}});
assert.equal(modelExperiment.configurationRevision,revision+1);
assert.notEqual(run('evExperimentConfigurationKey(modelExperiment)'),beforeAgentModelKey,'the Agent override participates in configuration comparison');
assert.equal(modelExperiment.snapshot.agentRuntimeSnapshot.source,'experiment_override');assert.equal(modelExperiment.snapshot.agentRuntimeSnapshot.resolution,'resolved');
assert.equal(modelExperiment.snapshot.agentRuntimeSnapshot.modelRef,agentModels[1].id);
assert.equal(modelExperiment.snapshot.judgeRuntimeSnapshot.modelRef,judgeModels[1].id);
const overrideRun=run('evRunExperiment(modelExperiment.id)');context.overrideRun=overrideRun;
assert.equal(run('evPauseExperiment(modelExperiment.id).status'),'已暂停');
assert.throws(()=>B.updateExperiment(modelExperiment.id,{judgeRuntime:judgeA}),/正在运行/);
const configuredJudge=clone(modelExperiment.judgeRuntime);modelExperiment.judgeRuntime={modelRef:judgeModels[0].id,parameters:{temperature:1}};
run('evResumeExperiment(modelExperiment.id)');drainModelTimers();modelExperiment.judgeRuntime=configuredJudge;
assert.equal(overrideRun.agentRuntimeSnapshot.modelRef,agentModels[1].id);
for(const result of overrideRun.results)for(const assessment of result.assessments){assert.equal(assessment.judgeRuntimeSnapshot.modelRef,judgeModels[1].id);assert.equal(assessment.agentRuntimeSnapshot.modelRef,agentModels[1].id);}
const oldRunResults=clone(modelOldRun.results);
const historicalSupplement=run('evRunExperiment(modelExperiment.id,modelOldRun,modelOldRun.results[0].caseId)');drainModelTimers();
assert.equal(historicalSupplement.agentRuntimeSnapshot.mode,'inherit');assert.equal(historicalSupplement.agentRuntimeSnapshot.modelRef,null);
assert.equal(historicalSupplement.judgeRuntimeSnapshot.modelRef,judgeModels[0].id,'case reruns follow their source record runtime');
assert.deepEqual(clone(modelOldRun.results),oldRunResults);

// Failure results retain configured runtimes even when no Judge was invoked.
const failureExperiment=B.createExperiment({...layeredPlan,name:'运行失败仍保留模型快照',execution:plan.execution});context.failureExperiment=failureExperiment;
const failureRun=run('evExperimentNewExecution(failureExperiment,failureExperiment.id+"-FAIL",1,failureExperiment.snapshot,{kind:"full",status:"运行中",supplements:[]})');context.failureRun=failureRun;failureRun.results=run('evExperimentResultRows(failureExperiment,failureRun.id)');
run('evExperimentCompleteResult(failureExperiment,failureRun,0,"运行失败")');
assert.equal(failureRun.results[0].assessments.length,0);assert.deepEqual(clone(failureRun.results[0].judgeRuntimeSnapshot),judgeA);assert.equal(failureRun.results[0].agentRuntimeSnapshot.modelRef,null);

// Rule-only experiments explicitly need no Judge, both in evidence and the editor.
run('studio.scene="procurement";evData()');
const ruleLayered=B.createExperiment({...layeredPlan,name:'规则评估无需Judge',unifiedBindings:[referenceBinding],agentId:'procurement-agent-1',version:'V3',suiteIds:['GLOBAL-PROC-SUITE'],execution:plan.execution});context.ruleLayered=ruleLayered;
assert.equal(ruleLayered.snapshot.judgeRuntimeSnapshot,null);assert(B.runtimeRead(ruleLayered.snapshot).includes('无需评估模型'));
const ruleLayeredRun=run('evExperimentNewExecution(ruleLayered,ruleLayered.id+"-RULE",1,ruleLayered.snapshot,{kind:"full",status:"运行中",supplements:[]})');context.ruleLayeredRun=ruleLayeredRun;ruleLayeredRun.results=run('evExperimentResultRows(ruleLayered,ruleLayeredRun.id)');
run('evExperimentCompleteResult(ruleLayered,ruleLayeredRun,0,"通过")');
assert.equal(ruleLayeredRun.judgeRuntimeSnapshot,null);assert.equal(ruleLayeredRun.results[0].judgeRuntimeSnapshot,null);assert.equal(ruleLayeredRun.results[0].assessments[0].judgeRuntimeSnapshot,null);
run('studio.scene="sales";evData()');

// Modal sections are renamed by the original drawer. Stable data attributes preserve updates and navigation IDs.
run('evExperimentForm(modelExperiment)');
assert(node('overlay').innerHTML.includes('data-unified-runtime'));assert(!node('overlay').innerHTML.includes('aria-label="评测模型"'));
for(const name of realModelNames)assert(node('overlay').innerHTML.includes('>'+name+'</option>'),'model choices display the catalog name: '+name);
for(const note of ['同时执行的独立对话数','使用相同输入启动多段独立对话','每次生成独立评测记录和报告','可多选该 Agent 的评测集','仅可选择当前场景或共享 MCP','只选择固定的已发布版本','当前为本地 Mock，模型配置'])assert(!node('overlay').innerHTML.includes(note),'experiment forms omit explanatory copy: '+note);
assert(!/<p\b[^>]*class="[^"]*\bev-note\b/.test(node('overlay').innerHTML));
assert(node('overlay').innerHTML.includes('id="ev-experiment-form-error"'),'functional error feedback remains present');
for(const field of ['concurrency','fullRuns','caseRuns'])assert(node('overlay').innerHTML.includes('name="'+field+'"'),'execution controls remain functional');
const rewrittenRuntime=node('ev-section-3'),previousQuery=context.document.querySelector;
context.document.querySelector=selector=>selector==='[data-unified-runtime]'?rewrittenRuntime:previousQuery(selector);
B.runtimeChange('agentMode','inherit');
assert(!rewrittenRuntime.outerHTML.includes('name="agentModelRef"'),'inherited execution models do not render a hidden or disabled model picker');
assert(rewrittenRuntime.outerHTML.includes('沿用 Agent 配置模型'));assert(rewrittenRuntime.outerHTML.includes('更换模型'));
assert(rewrittenRuntime.outerHTML.includes('aria-label="评测执行模型"'));assert(rewrittenRuntime.outerHTML.includes('aria-label="评估模型"'));
B.runtimeChange('agentMode','override');
assert(rewrittenRuntime.outerHTML.includes('id="ev-section-3"'),'runtime redraw preserves the modal navigation anchor');
assert(!/\bdisabled\b/.test(rewrittenRuntime.outerHTML.match(/<select name="agentModelRef"[^>]*>/)[0]),'Agent override enables the model select after a modal ID rewrite');
B.runtimeChange('agentModel',agentModels[2].id);B.runtimeChange('judgeModel',judgeModels[2].id);
context.runtimeForm={values:{scene:'sales',experimentId:modelExperiment.id,name:modelExperiment.name,agentId:modelExperiment.agentId,version:modelExperiment.version,suiteIds:modelExperiment.suiteIds,concurrency:2,caseRuns:2,fullRuns:2,modelId:'mock-eval-balanced',mcpIds:[],agentRuntimeMode:'override',agentModelRef:agentModels[2].id,judgeModelRef:judgeModels[2].id}};
const submittedRuntime=run('evSubmitExperiment(runtimeForm)');assert(submittedRuntime);assert.equal(submittedRuntime.snapshot.agentRuntimeSnapshot.modelRef,agentModels[2].id);assert.equal(submittedRuntime.snapshot.judgeRuntimeSnapshot.modelRef,judgeModels[2].id);
run('evExperimentForm(ruleLayered)');
assert(!/\bdisabled\b/.test(node('overlay').innerHTML.match(/<select name="judgeModelRef"[^>]*>/)[0]),'editing the historical all-count policy proposes a custom final Judge, including for rule-only standards');assert.equal(run('evExperimentEditor.execution.evaluatorSummary.mode'),'custom_prompt');
B.bindingChange(0,'evaluator',layeredSaved.record.id+'@V1');
assert(!/\bdisabled\b/.test(rewrittenRuntime.outerHTML.match(/<select name="judgeModelRef"[^>]*>/)[0]),'switching rules to LLM judges updates the correct rewritten runtime section');
context.document.querySelector=previousQuery;

// Existing legacy examples show honest missing model metadata and can be explicitly edited into the new model.
const legacy=run('evExperimentStore().experiments.find(item=>!item.snapshot.unifiedEvaluation)');context.legacy=legacy;
const legacyHistory=clone(legacy.runs[0].snapshot);
assert(B.runtimeRead(legacy.runs[0].snapshot,true).includes('历史未记录评测执行模型配置'));assert(B.runtimeRead(legacy.runs[0].snapshot,true).includes('历史未记录评估模型配置'));
run('evExperimentForm(legacy)');assert(node('overlay').innerHTML.includes('评测执行模型'));assert(node('overlay').innerHTML.includes('评估模型'));assert(!node('overlay').innerHTML.includes('aria-label="评测模型"'));
const legacyReport=run('evExperimentReportBody(legacy,legacy.runs[0])');assert(legacyReport.includes('历史未记录'));assert(!legacyReport.includes('<dt>评测模型</dt>'));
B.updateExperiment(legacy.id,{unifiedBindings:[{...layeredBinding,taskRef:undefined,dimensionMappings:[]}],judgeRuntime:judgeA,agentRuntimeOverride:{mode:'inherit'}});
assert(legacy.snapshot.unifiedEvaluation);assert.equal(legacy.snapshot.agentRuntimeSnapshot.modelRef,null);assert.deepEqual(clone(legacy.runs[0].snapshot),legacyHistory);

run('evExperimentForm()');assert(!node('overlay').innerHTML.includes('name="agentModelRef"'),'new experiments default to inheriting the Agent configuration');B.runtimeChange('agentMode','override');B.runtimeChange('agentModel',agentModels[1].id);run('evCloseModal()');
const apiPlanAfterCancel={...layeredPlan,name:'取消表单不污染后续API创建'};delete apiPlanAfterCancel.agentRuntimeOverride;delete apiPlanAfterCancel.judgeRuntime;
const afterCancel=B.createExperiment(apiPlanAfterCancel);
assert.equal(afterCancel.agentRuntimeOverride.mode,'inherit','a cancelled editor does not leak its Agent model into API/Copilot creation');
assert.deepEqual(clone(afterCancel.judgeRuntime),clone(D.defaultJudgeRuntime()));
context.canonicalRuntimeA={...modelExperiment,judgeRuntime:{modelRef:judgeModels[0].id,parameters:{temperature:0.2,maxOutputTokens:500}}};
context.canonicalRuntimeB={...modelExperiment,judgeRuntime:{modelRef:judgeModels[0].id,parameters:{maxOutputTokens:500,temperature:0.2}}};
assert.equal(run('evExperimentConfigurationKey(canonicalRuntimeA)'),run('evExperimentConfigurationKey(canonicalRuntimeB)'),'parameter key order does not create a spurious runtime revision');
assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators,'runtime configuration does not alter backup evaluator assets');

// Ordinary offline experiments select standards, versions and scopes; all selected results count.
function policyTrial(name,bindings,execution={},status='通过'){
  const e=B.createExperiment({...plan,name,unifiedBindings:bindings,execution:{...plan.execution,evaluationPolicy:'all_selected',...execution}});context.policyExperiment=e;
  const record=run('evExperimentNewExecution(policyExperiment,policyExperiment.id+"-POLICY",1,policyExperiment.snapshot,{kind:"full",status:"运行中",supplements:[]})');context.policyRecord=record;
  e.runs.unshift(record);record.results=run('evExperimentResultRows(policyExperiment,policyRecord.id)');context.policyAgentStatus=status;
  run('evExperimentCompleteResult(policyExperiment,policyRecord,0,policyAgentStatus)');record.status='已完成';e.status='已完成';
  return {e,record,result:record.results[0]};
}
const passSaved=D.saveEvaluator({...realDefinition,name:'全部通过判定基准'});assert(passSaved.ok,passSaved.error);assert(D.publishEvaluator(passSaved.record.id).ok);
const automaticBinding={id:'AUTO-ALL',evaluatorRef:{id:passSaved.record.id,version:'V1'},role:'gate',targetType:'case_output',inputMapping:{actual:'/wrong/manual/path'},dimensionMappings:[]};
const automatic=policyTrial('自动输入与全部判定',[automaticBinding]);
assert.equal(automatic.result.status,'通过','unmapped business dimensions do not veto a passing generic evaluator');
assert(automatic.result.dimensions.some(item=>item.reason.includes('未评估')),'unmapped business dimensions remain explicitly unevaluated');
assert.equal(automatic.record.snapshot.unifiedEvaluation.bindings[0].role,'gate');
assert.equal(automatic.record.snapshot.unifiedEvaluation.bindings[0].inputMapping.actual,'/target/output','ordinary experiments derive inputs rather than accepting old manual mappings');
assert.equal(automatic.result.assessments.length,1);
const allCasesPolicy=policyTrial('选择的评估器不按任务静默跳过',[{...automaticBinding,taskRef:{id:'UNRELATED-TASK',version:'V1'}}]);
assert.equal(allCasesPolicy.result.assessments.length,1);assert.equal(allCasesPolicy.result.status,'通过');
assert.equal(allCasesPolicy.record.snapshot.unifiedEvaluation.bindings[0].taskRef,undefined);
context.policyExperiment=automatic.e;context.policyRecord=automatic.record;
const ordinaryReport=run('evExperimentReportBody(policyExperiment,policyRecord)');
assert(ordinaryReport.includes('全部参与判定的评估器通过，用例才通过'));
assert(!ordinaryReport.includes('<th>作用</th>')&&!ordinaryReport.includes('结果用途'),'new reports omit manual result roles while retaining actual observation outcomes');
run('evExperimentForm(policyExperiment)');
const ordinaryForm=node('overlay').innerHTML;
assert(ordinaryForm.includes('搜索绑定 1 评估器')&&ordinaryForm.includes('绑定 1 评估器版本')&&ordinaryForm.includes('绑定 1 评估对象'));
assert(!/输入变量「|关联业务任务|维度「|采用业务任务推荐绑定|unifiedEvaluationRole/.test(ordinaryForm),'the ordinary experiment binding rows retain evaluator, version and target while the experiment summary stays separate');
run('evCloseModal()');
const failDefinition={...realDefinition,name:'固定未通过标准',method:{type:'rule',checks:[{metricId:'readable_output',inputPath:'/actual',operator:'exists',onTrue:false,onFalse:false}]}};
const failSaved=D.saveEvaluator(failDefinition);assert(failSaved.ok,failSaved.error);assert(D.publishEvaluator(failSaved.record.id).ok);
const failingBinding={id:'FIXED-FAIL',evaluatorRef:{id:failSaved.record.id,version:'V1'},role:'gate',targetType:'case_output',dimensionMappings:[]};
const failedPolicy=policyTrial('一个未通过即未通过',[automaticBinding,failingBinding]);
assert.equal(failedPolicy.result.assessments.length,2);assert.equal(failedPolicy.result.status,'未通过');
assert.deepEqual(clone(failedPolicy.result.evaluations.map(item=>item.passed)),[true,false]);
const unknownSaved=D.saveEvaluator({...layeredDraft,name:'证据不足判定基准'},undefined,{historicalImport:true});assert(unknownSaved.ok,unknownSaved.error);assert(D.publishEvaluator(unknownSaved.record.id,{historicalImport:true}).ok);
const unknownBinding={id:'UNKNOWN-ALL',evaluatorRef:{id:unknownSaved.record.id,version:'V1'},role:'gate',targetType:'case_output',dimensionMappings:[]};
const unknownPolicy=policyTrial('评分证据不足',[unknownBinding]);
assert.equal(unknownPolicy.result.status,'待确认');assert.equal(unknownPolicy.result.assessments[0].decision,'inconclusive');
const mixedPolicy=policyTrial('未通过优先于证据不足',[unknownBinding,failingBinding]);assert.equal(mixedPolicy.result.status,'未通过');
const errorPolicy=policyTrial('Agent异常单独记录',[automaticBinding],{},'运行失败');assert.equal(errorPolicy.result.status,'运行失败');assert.equal(errorPolicy.result.assessments.length,0);
const textDefinition={...realDefinition,name:'只提供分析的评估器',method:{type:'llm_judge'},metrics:[{id:'analysis',name:'分析',valueType:'text',standard:'根据 {{actual}} 给出证据分析说明'}],decision:{type:'item_summary',policyVersion:3,summary:{type:'all'},missingEvidence:'inconclusive'}};
const textSaved=D.saveEvaluator(textDefinition,undefined,{historicalImport:true});assert(textSaved.ok,textSaved.error);assert(D.publishEvaluator(textSaved.record.id,{historicalImport:true}).ok);
const textOnlyPolicy=policyTrial('无通过条件只观察',[{id:'NO-DECISION',evaluatorRef:{id:textSaved.record.id,version:'V1'},role:'observe',targetType:'case_output',dimensionMappings:[]}]);assert.equal(textOnlyPolicy.result.status,'仅观察');assert.equal(textOnlyPolicy.result.acceptance,'not_applicable');
const policySnapshot=clone(automatic.record.snapshot),policyRevision=automatic.e.configurationRevision;
B.updateExperiment(automatic.e.id,{execution:{concurrency:1}});
assert.equal(automatic.e.execution.evaluationPolicy,'all_selected','partial execution edits retain the selected aggregation policy');
assert.equal(automatic.e.configurationRevision,policyRevision+1);assert.deepEqual(clone(automatic.record.snapshot),policySnapshot);
const policyTask=B.taskDefinition(taskId),recommendedMappings=policyTask.dimensions.slice(0,2).map(item=>({dimensionId:item.id,metricId:'readable_output'}));
B.setTaskBindings(taskId,[{...automaticBinding,role:'gate',taskRef:{id:taskId,version:policyTask.version},dimensionMappings:recommendedMappings,inputMapping:{actual:'/target/output'}}]);B.repinSuite('TEST-SUITE');
const inheritedPolicy=policyTrial('继承固定任务的评估指标映射',[automaticBinding]);
assert(inheritedPolicy.record.snapshot.unifiedEvaluation.bindings[0].businessMappings.some(item=>item.taskRef.id===taskId&&item.dimensionMappings.length===2));
assert.equal(inheritedPolicy.result.dimensions.filter(item=>item.assessmentId&&item.passed===true).length,2,'business attribution reuses task configuration without an experiment mapping form');

// Historical evaluator fixtures retain their derived contracts and count engines; new authoring is checked separately below.
function publishHistoricalEvidence(draft){
  const value=clone(draft);delete value.inputSchema;delete value.supportedTargets;
  const saved=D.saveEvaluator(value,undefined,{historicalImport:true});assert(saved.ok,saved.error);assert(D.publishEvaluator(saved.record.id,{historicalImport:true}).ok);
  return D.evaluator(saved.record.id,'V1');
}
const aliasEvaluator=publishHistoricalEvidence({...layeredDraft,name:'自动来源与变量别名',sceneId:'procurement',metrics:[{...clone(layeredDraft.metrics[0]),standard:'依据 {{output}}、{{input}}、{{expected}}、{{messages}}、{{trajectory}}、{{task}} 与 {{context}} 判断交付结果。'}]});
assert.deepEqual(clone(aliasEvaluator.supportedTargets),['case_output','session','trace','span','task_execution']);
assert.deepEqual(clone(aliasEvaluator.inputSchema.required),[]);
assert.deepEqual(clone(aliasEvaluator.inputSchema['x-aiops-evidence'].variables.map(variable=>variable.key)),['output','input','expected','messages','trajectory','task','context']);
assert.equal(aliasEvaluator.inputSchema['x-aiops-evidence'].source,'evaluation_policy');
assert.deepEqual(clone(aliasEvaluator.inputSchema['x-aiops-evidence'].contextScopes),{messages:'selected_target',trajectory:'selected_target'});
const sourceInput={order:{id:17},flags:['priority'],attachments:{source:'preserve this original property'}};
const sourceFiles=[{id:'SOURCE-ATTACHMENT',name:'订单.json',type:'application/json',dataUrl:'data:application/json;base64,eyJpZCI6MTd9'}];
context.evidenceCase={id:'AUTO-EVIDENCE-CASE',name:'结构化输入与真实附件',version:'V1',input:sourceInput,inputAttachments:sourceFiles,expected:'readable_output: true',context:{orderId:17,retrievedDocuments:[{id:'DOC-17',text:'已确认订单资料'}]},tags:[],enabled:true};
run(`evData().cases.push(evidenceCase);evData().suites.push({id:'AUTO-EVIDENCE-SUITE',name:'自动来源证据联调',version:'V1',agentId:'sales-agent-1',taskIds:[taskId],caseIds:[evidenceCase.id],caseBindings:{[evidenceCase.id]:[{taskId,dimensionNames:[evData().tasks[0].dimensions[0].name]}]}});evData().suites.push({id:'AUTO-TASKLESS-SUITE',name:'用例没有绑定业务任务',version:'V1',agentId:'sales-agent-1',taskIds:[taskId],caseIds:[evidenceCase.id],caseBindings:{[evidenceCase.id]:[]}})`);
B.repinSuite('AUTO-EVIDENCE-SUITE');B.repinSuite('AUTO-TASKLESS-SUITE');
const evidenceCalls=[],actualAssess=D.assess;
D.assess=(evaluator,input,binding)=>{evidenceCalls.push(clone({evaluator,input,binding}));return actualAssess(evaluator,input,binding);};
function evidenceTrial(name,evaluator,target='first_response',options={}){
  const binding={id:'EVIDENCE-'+target,evaluatorRef:{id:evaluator.id,version:evaluator.version},role:'gate',evaluationTarget:target,targetType:target==='conversation'?'session':'case_output',dimensionMappings:[]};
  const e=B.createExperiment({...plan,name,suiteIds:[options.suiteId||'AUTO-EVIDENCE-SUITE'],unifiedBindings:[binding],execution:{...scopeExecution,evaluationPolicy:'all_selected',...options.execution}});context.evidenceExperiment=e;
  const record=run('evExperimentNewExecution(evidenceExperiment,evidenceExperiment.id+"-EVIDENCE",1,evidenceExperiment.snapshot,{kind:"full",status:"运行中",supplements:[]})');context.evidenceRecord=record;
  e.runs.unshift(record);record.results=run('evExperimentResultRows(evidenceExperiment,evidenceRecord.id)');
  const before=evidenceCalls.length;run('evExperimentCompleteResult(evidenceExperiment,evidenceRecord,0,"通过")');record.status='已完成';
  assert.equal(evidenceCalls.length,before+1);return {e,record,result:record.results[0],call:evidenceCalls[before]};
}
const firstEvidence=evidenceTrial('首轮完整证据来自所选对象',aliasEvaluator);
assert.equal(firstEvidence.result.status,'通过');assert.equal(firstEvidence.result.assessments[0].executionStatus,'succeeded');
assert.equal(firstEvidence.call.input.target.type,'case_output');assert.equal(firstEvidence.call.input.target.messages.length,2);
assert.equal(firstEvidence.call.input.target.evidenceCompleteness.messages,'complete','complete first-turn evidence remains usable before later simulated turns');
assert.equal(firstEvidence.call.input.target.evidenceCompleteness.trajectory,'complete');assert.equal(firstEvidence.call.input.target.evidenceCompleteness.targetType,'case_output');
assert(firstEvidence.call.input.target.trajectory.every(span=>span.turn===1));
assert.deepEqual(firstEvidence.call.input.target.input,{value:sourceInput,attachments:sourceFiles},'structured input and its original attachment property survive the source envelope');
assert.deepEqual(firstEvidence.call.input.target.context,context.evidenceCase.context);assert.equal(firstEvidence.call.input.task.id,taskId);
assert.equal(firstEvidence.call.binding.inputMapping.output,'/target/output');assert.equal(firstEvidence.call.binding.inputMapping.expected,'/case/expected');assert.equal(firstEvidence.call.binding.inputMapping.task,'/task');
const conversationEvidence=evidenceTrial('新参考变量不限制整段评估对象',aliasEvaluator,'conversation');
assert.equal(conversationEvidence.result.status,'待确认');assert.equal(conversationEvidence.result.assessments[0].executionStatus,'succeeded');
assert.equal(conversationEvidence.result.assessments[0].metricResults[0].decision,'inconclusive');
assert.equal(conversationEvidence.call.input.target.type,'session');assert.equal(conversationEvidence.call.input.target.messages.length,6);
assert.deepEqual(conversationEvidence.call.input.target.evidenceCompleteness,{targetType:'session',messages:'complete',trajectory:'complete'});
assert.equal(conversationEvidence.call.input.case.expected,undefined);assert.equal(conversationEvidence.call.input.target.reference,undefined);
assert.equal(conversationEvidence.call.binding.inputMapping.expected,'/target/reference');
context.evidenceExperiment=conversationEvidence.e;context.evidenceRecord=conversationEvidence.record;
assert.equal(run('evExperimentDetectIssues(evidenceExperiment,evidenceRecord).length'),0,'missing independent conversation reference never becomes a quality issue');
run('evExperimentForm(evidenceExperiment)');
const autoTargetOptions=node('overlay').innerHTML.match(/<select name="unifiedEvaluationTarget[^>]*>([\s\S]*?)<\/select>/)[1];
assert(!/<option[^>]*value="conversation"[^>]*disabled/.test(autoTargetOptions),'new automatic reference dependencies allow choosing a full conversation');run('evCloseModal()');
for(const value of [['A',2],0,false,'实际输入文本']){
  context.evidenceCase.input=value;context.evidenceCase.version='V'+(++sequence);B.repinSuite('AUTO-EVIDENCE-SUITE');
  const trial=evidenceTrial('附件保持原始输入 '+JSON.stringify(value),aliasEvaluator);
  assert.deepEqual(trial.call.input.target.input,typeof value==='string'?{text:value,attachments:sourceFiles}:{value,attachments:sourceFiles});
  assert.equal(trial.result.assessments[0].executionStatus,'succeeded');
}
context.evidenceCase.input=sourceInput;context.evidenceCase.version='V'+(++sequence);B.repinSuite('AUTO-EVIDENCE-SUITE');

const selectedContextEvaluator=publishHistoricalEvidence({...realDefinition,name:'所选对象消息与轨迹',method:{type:'rule',checks:[{metricId:'messages_recorded',inputPath:'/messages/0/role',operator:'equals',expected:'user',onTrue:true,onFalse:false},{metricId:'trajectory_recorded',inputPath:'/trajectory/0/id',operator:'exists',onTrue:true,onFalse:false}]},metrics:[{id:'messages_recorded',name:'记录消息',valueType:'boolean',rubric:'首条消息来自用户'},{id:'trajectory_recorded',name:'记录执行轨迹',valueType:'boolean',rubric:'对象执行证据存在'}],decision:{type:'all_rules',rules:[{metricId:'messages_recorded',operator:'equals',value:true},{metricId:'trajectory_recorded',operator:'equals',value:true}],missingEvidence:'inconclusive'}});
assert.equal(selectedContextEvaluator.inputSchema['x-aiops-evidence'].source,'rule_paths');
assert.deepEqual(clone(selectedContextEvaluator.inputSchema.required),['messages','trajectory']);
assert.equal(evidenceTrial('首轮规则读取对象证据',selectedContextEvaluator).result.status,'通过');
assert.equal(evidenceTrial('整段规则读取对象证据',selectedContextEvaluator,'conversation').result.status,'通过');
assert.equal(evidenceTrial('单轮完整轨迹同样可用',selectedContextEvaluator,'first_response',{execution:{mode:'single_turn'}}).result.status,'通过');
const scenarioTrace=context.evExperimentScenarioTrace;
context.evExperimentScenarioTrace=(e,result)=>({...scenarioTrace(e,result),truncated:true});
const partialTrajectory=evidenceTrial('截断轨迹保留证据不足',selectedContextEvaluator);
assert.equal(partialTrajectory.call.input.target.evidenceCompleteness.trajectory,'partial');assert.equal(partialTrajectory.result.status,'待确认');assert.match(partialTrajectory.result.assessments[0].error.message,/完整证据/);
context.evExperimentScenarioTrace=(e,result)=>({...scenarioTrace(e,result),spans:scenarioTrace(e,result).spans.filter(span=>!span.parentId)});
const absentTrajectory=evidenceTrial('没有轨迹不可补空假定通过',selectedContextEvaluator);
assert.equal(absentTrajectory.call.input.target.trajectory.length,0);assert.equal(absentTrajectory.result.status,'待确认');assert.equal(absentTrajectory.result.assessments[0].executionStatus,'failed');
context.evExperimentScenarioTrace=scenarioTrace;
const conversationPreparation=context.evExperimentCompleteConversation;
context.evExperimentCompleteConversation=(result,execution)=>{conversationPreparation(result,execution);result.messages=result.messages.slice(0,2);result.messagesTruncated=true;};
const partialMessages=evidenceTrial('整段消息缺后续轮次不可当完整',selectedContextEvaluator,'conversation');
assert.equal(partialMessages.call.input.target.evidenceCompleteness.messages,'partial');assert.equal(partialMessages.result.status,'待确认');
context.evExperimentCompleteConversation=conversationPreparation;

const pathEvaluator=publishHistoricalEvidence({...realDefinition,name:'规则路径自动来源',method:{type:'rule',checks:[{metricId:'input_matches',inputPath:'/input/value/order/id',operator:'equals',expectedPath:'/context/orderId',onTrue:true,onFalse:false}]},metrics:[{id:'input_matches',name:'业务输入一致',valueType:'boolean',rubric:'原始订单与真实上下文一致'}],decision:{type:'boolean_equals',metricId:'input_matches',value:true,missingEvidence:'inconclusive'}});
assert.deepEqual(clone(pathEvaluator.inputSchema.required),['input','context']);assert.equal(evidenceTrial('规则双路径使用自动映射',pathEvaluator).result.status,'通过');
const missingPathEvaluator=publishHistoricalEvidence({...pathEvaluator,name:'缺少嵌套证据不伪判',method:{type:'rule',checks:[{metricId:'input_matches',inputPath:'/input/value/missing/orderId',operator:'equals',expectedPath:'/context/orderId',onTrue:true,onFalse:false}]}});
const missingPath=evidenceTrial('规则嵌套依赖缺失',missingPathEvaluator);
assert.equal(missingPath.result.status,'待确认');assert.equal(missingPath.result.assessments[0].decision,'inconclusive');assert.equal(missingPath.result.assessments[0].executionStatus,'succeeded');
const missingTask=evidenceTrial('无业务任务定义不填伪快照',aliasEvaluator,'first_response',{suiteId:'AUTO-TASKLESS-SUITE'});
assert.equal(missingTask.call.input.task,undefined);assert.equal(missingTask.result.status,'待确认');assert.equal(missingTask.result.assessments[0].executionStatus,'succeeded');
delete context.evidenceCase.context;delete context.evidenceCase.expected;context.evidenceCase.version='V'+(++sequence);B.repinSuite('AUTO-EVIDENCE-SUITE');
const missingSources=evidenceTrial('缺上下文和预期不得造来源',aliasEvaluator);
assert.equal(missingSources.call.input.target.context,undefined);assert.equal(missingSources.call.input.case.expected,undefined);assert.equal(missingSources.result.status,'待确认');assert.equal(missingSources.result.assessments[0].executionStatus,'succeeded');
D.assess=actualAssess;

// Historical published versions keep their original contract rather than being silently broadened.
const historicalStandard={...clone(D.evaluator(passSaved.record.id,'V1')),id:'HISTORICAL-SESSION-ONLY',name:'历史整段专用标准',supportedTargets:['session'],inputSchema:{type:'object',properties:{actual:{type:'string'}},required:['actual'],additionalProperties:false}};
const historicalReference={...clone(historicalStandard),id:'HISTORICAL-REFERENCE',name:'历史参考标准',supportedTargets:['case_output','session'],inputSchema:{type:'object',properties:{actual:{type:'string'},reference:{type:'string'}},required:['actual','reference'],additionalProperties:false}};
const historicalState=JSON.parse(storage.getItem(D.storageKey));historicalState.revision++;
for(const definition of [historicalStandard,historicalReference])historicalState.evaluators.push({...clone(definition),enabled:true,status:'active',versions:[clone(definition)]});
storage.setItem(D.storageKey,JSON.stringify(historicalState));
assert.throws(()=>evidenceTrial('历史专用契约不自动扩展',historicalStandard),/不支持该评估对象/);
assert.throws(()=>evidenceTrial('历史参考契约仍按旧限制',historicalReference,'conversation'),/不支持整段会话/);
assert.deepEqual(clone(D.evaluator(historicalStandard.id,'V1')),historicalStandard);assert.deepEqual(clone(D.evaluator(historicalReference.id,'V1')),historicalReference);
const taskBindingForEditor=evaluator=>({id:'TASK-EVIDENCE-EDITOR',evaluatorRef:{id:evaluator.id,version:evaluator.version},taskRef:{id:policyTask.id,version:policyTask.version},targetType:'case_output',role:'gate',dimensionMappings:[{dimensionId:policyTask.dimensions[0].id,metricId:evaluator.metrics[0].id}]});
B.setTaskBindings(taskId,[taskBindingForEditor(aliasEvaluator)]);assert(B.editTaskBindings(taskId));
assert(!node('overlay').innerHTML.includes('输入变量「'),'new automatic task recommendations have no manual source picker');
assert(node('overlay').innerHTML.includes('维度「')&&node('overlay').innerHTML.includes('unifiedEvaluationRole.'),'task attribution and acceptance roles remain editable');
assert.equal(B.recommendedBindings(taskId)[0].inputMapping.expected,'/case/expected','task recommendations retain system source mappings internally');run('evCloseModal()');
B.setTaskBindings(taskId,[taskBindingForEditor(historicalReference)]);assert(B.editTaskBindings(taskId));
assert(node('overlay').innerHTML.includes('输入变量「reference」'),'historical task contracts retain their existing source controls');run('evCloseModal()');
assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators,'derived evidence contracts leave both backup evaluator stores untouched');

// Experiment inspection exposes the frozen standards, even when output fields have no Rubric.
const standardsOnlyEvaluator=publishHistoricalEvidence({...layeredDraft,name:'唯一评估标准查看',metrics:[{...clone(layeredDraft.metrics[0]),standard:'根据 {{actual}} 的明确证据输出 readable_output；<唯一标准>禁止猜测。表示是否存在可读取的交付证据'}]});
const standardsOnlyExperiment=B.createExperiment({...plan,name:'冻结评估标准展示',suiteIds:['AUTO-EVIDENCE-SUITE'],execution:{...scopeExecution,evaluationPolicy:'all_selected'},unifiedBindings:[{id:'STANDARDS-VIEW',evaluatorRef:{id:standardsOnlyEvaluator.id,version:'V1'},role:'gate',targetType:'case_output',evaluationTarget:'first_response',dimensionMappings:[]}]});
context.standardsOnlyExperiment=standardsOnlyExperiment;
run("evExperimentUI().id=standardsOnlyExperiment.id;evExperimentScoringSnapshot('current')");
assert(node('overlay').innerHTML.includes('查看评估标准'));assert(node('overlay').innerHTML.includes('&lt;唯一标准&gt;禁止猜测。'),'standards are visible and escaped in the experiment inspector');
assert(node('overlay').innerHTML.includes('逐项评估标准'));assert(node('overlay').innerHTML.includes('表示是否存在可读取的交付证据'));assert(!node('overlay').innerHTML.includes('历史指标评分标准'),'new items carry one explicit source of standards');
const changedStandards=D.saveEvaluator({...clone(standardsOnlyEvaluator),metrics:[{...clone(standardsOnlyEvaluator.metrics[0]),standard:'只根据 {{actual}} 使用下一版评估标准。'}]},standardsOnlyEvaluator.id,{historicalImport:true});assert(changedStandards.ok,changedStandards.error);assert(D.publishEvaluator(standardsOnlyEvaluator.id,{historicalImport:true}).ok);
run("evExperimentScoringSnapshot('current')");assert(node('overlay').innerHTML.includes('&lt;唯一标准&gt;禁止猜测。'));assert(!node('overlay').innerHTML.includes('下一版评估标准'),'editing the library cannot rewrite a pinned experiment standard');run('evCloseModal()');

// Typed conditions evaluate only a selected subset; display aggregation never cancels a failed condition.
// These are already-published historical fixtures, rather than new saves through the V3 authoring API.
function publishLegacyFixture(draft,id){
  const state=JSON.parse(storage.getItem(D.storageKey)),prior=id&&state.evaluators.find(item=>item.id===id),version='V'+((prior?.versions?.length||0)+1),record={...clone(draft),id:id||'UE-HISTORICAL-'+(++sequence),version,schemaVersion:'1.0',versionStatus:'published',status:'active',supportedTargets:['case_output','session','trace','span','task_execution'],inputSchema:clone(draft.inputSchema||{type:'object',properties:{actual:{type:'string'}},required:['actual'],additionalProperties:false})};
  delete record.versions;delete record.enabled;
  if(record.decision?.type==='all_rules'&&!record.decision.rules?.length)record.decision={type:'none',policyVersion:2,missingEvidence:'inconclusive'};
  const head={...clone(record),enabled:true,versions:[...(prior?.versions||[]),clone(record)]};if(prior)state.evaluators[state.evaluators.indexOf(prior)]=head;else state.evaluators.push(head);state.revision++;storage.setItem(D.storageKey,JSON.stringify(state));return D.evaluator(record.id,version);
}
const typedDraft={name:'混合指标子集判定',description:'布尔、数值闭区间和分类共同判定，其他输出只观察',sceneId:'',method:{type:'llm_judge',prompt:'从 {{actual}} 读取明确的逐项指标结果。'},metrics:[{id:'safety',name:'安全检查',valueType:'boolean'},{id:'score',name:'质量分',valueType:'number',range:{min:0,max:200}},{id:'risk',name:'风险级别',valueType:'category',categories:[{code:'low',label:'低风险'},{code:'medium',label:'中风险'},{code:'high',label:'高风险'}]},{id:'note',name:'说明',valueType:'text'},{id:'observed',name:'观察数',valueType:'number',range:{min:0,max:100}}],aggregation:{type:'weighted_mean',weights:[{metricId:'score',weight:0.9},{metricId:'observed',weight:0.1}],precision:1},decision:{type:'all_rules',policyVersion:2,rules:[{metricId:'safety',operator:'equals',value:true},{metricId:'score',operator:'between',value:[60,100]},{metricId:'risk',operator:'in',value:['low','medium']}],missingEvidence:'inconclusive'}};
const typedEvaluator=publishLegacyFixture(typedDraft);
assert.equal(D.hasDecision(typedEvaluator),true);assert.equal(typedEvaluator.decision.policyVersion,2);assert.equal(D.hasDecision({decision:{type:'all_rules',rules:[]}}),false);
function typedTrial(name,evaluators,output){
  context.evidenceCase.expected=output;context.evidenceCase.version='V'+(++sequence);B.repinSuite('AUTO-EVIDENCE-SUITE');
  const bindings=evaluators.map((evaluator,index)=>({id:'TYPED-BINDING-'+index,evaluatorRef:{id:evaluator.id,version:evaluator.version},targetType:'case_output',role:'gate',dimensionMappings:[]}));
  const e=B.createExperiment({...plan,name,suiteIds:['AUTO-EVIDENCE-SUITE'],unifiedBindings:bindings,execution:{...plan.execution,evaluationPolicy:'all_selected'}});context.typedExperiment=e;
  const record=run('evExperimentNewExecution(typedExperiment,typedExperiment.id+"-TYPED",1,typedExperiment.snapshot,{kind:"full",status:"运行中",supplements:[]})');context.typedRecord=record;
  e.runs.unshift(record);record.results=run('evExperimentResultRows(typedExperiment,typedRecord.id)');run('evExperimentCompleteResult(typedExperiment,typedRecord,0,"通过")');record.status='已完成';
  return {e,record,result:record.results[0],assessment:record.results[0].assessments[0]};
}
const highAggregateFailure=typedTrial('关键条件失败且高汇总分',[typedEvaluator],'safety: false\nscore: 99\nrisk: low\nnote: 明确说明\nobserved: 99');
assert(Math.abs(highAggregateFailure.assessment.aggregate-99)<1e-9);assert.equal(highAggregateFailure.result.status,'未通过');assert.equal(highAggregateFailure.result.acceptance,'failed');
assert.equal(highAggregateFailure.result.evaluations[0].criteria.find(item=>item.id==='safety').passed,false);
for(const id of ['note','observed']){const metric=highAggregateFailure.result.evaluations[0].criteria.find(item=>item.id===id);assert.equal(metric.passed,null);assert.equal(metric.decision,'not_applicable');}
const observationMissing=typedTrial('未选输出缺失不改变合法条件',[typedEvaluator],'safety: true\nscore: 88\nrisk: low');
assert.equal(observationMissing.result.status,'通过');assert.equal(observationMissing.assessment.executionStatus,'succeeded');assert.equal(observationMissing.assessment.aggregate,null,'a missing display-only weighted metric leaves the total unavailable');
assert.equal(observationMissing.assessment.metricResults.find(item=>item.metricId==='observed').validationStatus,'missing');assert.equal(observationMissing.result.evaluations[0].criteria.find(item=>item.id==='observed').passed,null);
const observationInvalid=typedTrial('未选输出格式异常独立展示',[typedEvaluator],'safety: true\nscore: 88\nrisk: medium\nobserved: 999');
assert.equal(observationInvalid.result.status,'通过');assert.equal(observationInvalid.assessment.executionStatus,'succeeded');assert.equal(observationInvalid.assessment.metricResults.find(item=>item.metricId==='observed').validationStatus,'invalid');assert.equal(observationInvalid.assessment.metricResults.find(item=>item.metricId==='observed').rawValue,999);
const selectedMissing=typedTrial('参与条件缺值保留待确认',[typedEvaluator],'safety: true\nrisk: low\nobserved: 80');
assert.equal(selectedMissing.result.status,'待确认');assert.equal(selectedMissing.assessment.executionStatus,'succeeded');assert.equal(selectedMissing.result.evaluations[0].criteria.find(item=>item.id==='score').passed,null);
assert.equal(typedTrial('明确失败优先于其他未知',[typedEvaluator],'safety: false\nrisk: low').result.status,'未通过');
for(const boundary of [60,100])assert.equal(typedTrial('闭区间边界 '+boundary,[typedEvaluator],'safety: true\nscore: '+boundary+'\nrisk: low').result.status,'通过');
assert.equal(typedTrial('合法数值超出通过区间',[typedEvaluator],'safety: true\nscore: 100.1\nrisk: low').result.status,'未通过');assert.equal(typedTrial('分类未进入通过集合',[typedEvaluator],'safety: true\nscore: 95\nrisk: high').result.status,'未通过');

const noGateEvaluator=publishLegacyFixture({...typedDraft,name:'混合指标仅观察',decision:{type:'all_rules',rules:[],missingEvidence:'inconclusive'}});
assert.equal(D.hasDecision(noGateEvaluator),false);assert.equal(noGateEvaluator.decision.type,'none');
const noGate=typedTrial('所有输出均未配置通过条件',[noGateEvaluator],'safety: false\nscore: 10\nrisk: high\nobserved: 999');
assert.equal(noGate.result.status,'仅观察');assert.equal(noGate.result.acceptance,'not_applicable');assert.equal(noGate.record.snapshot.unifiedEvaluation.bindings[0].role,'observe');assert(noGate.result.evaluations[0].criteria.every(item=>item.passed===null));
context.typedRecord=noGate.record;assert.equal(run('evExperimentSummary(typedRecord).passRate'),null);assert.equal(run('evExperimentSummary(typedRecord).passed'),0);
const mixedGateObserve=typedTrial('有效gate与仅观察评估器混用',[typedEvaluator,noGateEvaluator],'safety: true\nscore: 95\nrisk: low');
assert.equal(mixedGateObserve.result.status,'通过');assert.deepEqual(clone(mixedGateObserve.record.snapshot.unifiedEvaluation.bindings.map(item=>item.role)),['gate','observe']);assert.deepEqual(clone(mixedGateObserve.record.snapshot.execution.evaluationBindings.map(item=>item.participation)),['gate','observe']);
context.typedExperiment=noGate.e;run('evExperimentForm(typedExperiment)');
const observerChoice=node('overlay').innerHTML.match(new RegExp('<button[^>]*data-search-text="[^"]*'+noGateEvaluator.id.toLowerCase()+'[^>]*>'))?.[0];
assert(observerChoice&&!observerChoice.includes('disabled'),'observation-only assets remain selectable without being relabelled as pass evaluators');assert(node('overlay').innerHTML.includes('V1 · 仅观察'));run('evCloseModal()');

// Business dimensions receive verdicts only from condition metrics, even if an older mapping points to an observed output.
const typedTask=B.taskDefinition(taskId),typedTaskBinding={id:'TYPED-TASK',evaluatorRef:{id:typedEvaluator.id,version:'V1'},taskRef:{id:typedTask.id,version:typedTask.version},targetType:'case_output',role:'gate',dimensionMappings:[{dimensionId:typedTask.dimensions[0].id,metricId:'safety'},{dimensionId:typedTask.dimensions[1].id,metricId:'observed'}]};
B.setTaskBindings(taskId,[typedTaskBinding]);B.repinSuite('TEST-SUITE');
const typedDimensionCase=run('evData().cases.find(item=>item.id===evData().suites.find(item=>item.id==="TEST-SUITE").caseIds[0])');typedDimensionCase.expected='safety: true\nscore: 95\nrisk: low\nobserved: 99';typedDimensionCase.version='V'+(++sequence);B.repinSuite('TEST-SUITE');
const dimensionPolicy=policyTrial('只有条件指标归因业务维度',[{...typedTaskBinding,taskRef:undefined}]);
assert.equal(dimensionPolicy.result.status,'通过');assert.equal(dimensionPolicy.result.dimensions.find(item=>item.dimensionId===typedTask.dimensions[0].id).passed,true);assert.equal(dimensionPolicy.result.dimensions.find(item=>item.dimensionId===typedTask.dimensions[1].id).passed,null);assert(!dimensionPolicy.result.dimensions.some(item=>item.metricId==='observed'&&item.assessmentId),'an unselected metric never becomes a dimension verdict source');
assert(B.editTaskBindings(taskId));assert(node('overlay').innerHTML.match(/<option value="observed"[^>]*>/)[0].includes('disabled'),'task metric mapping distinguishes observation outputs');run('evCloseModal()');

// Every downstream read uses the frozen typed conditions, not the newly published head.
const frozenTyped=clone(highAggregateFailure.record.snapshot),frozenAssessment=clone(highAggregateFailure.assessment.evaluatorSnapshot);assert.deepEqual(frozenAssessment.decision.rules,typedEvaluator.decision.rules);
const changedTyped=publishLegacyFixture({...typedEvaluator,name:'混合指标子集判定历史下一版',decision:{type:'all_rules',policyVersion:2,rules:[{metricId:'score',operator:'gte',value:150}],missingEvidence:'inconclusive'}},typedEvaluator.id);assert.equal(changedTyped.version,'V2');
assert.deepEqual(clone(highAggregateFailure.record.snapshot),frozenTyped);assert.deepEqual(clone(highAggregateFailure.assessment.evaluatorSnapshot),frozenAssessment);
context.typedExperiment=highAggregateFailure.e;context.typedRecord=highAggregateFailure.record;context.typedResult=highAggregateFailure.result;
const typedCards=run('evExperimentScoringResults(typedResult)'),typedReport=run('evExperimentReportBody(typedExperiment,typedRecord)'),typedConfig=run('evExperimentEvaluationConfigRead(typedExperiment)');
for(const markup of [typedReport,typedConfig]){assert(markup.includes('通过条件（全部满足）'));assert(markup.includes('[60, 100]（含边界）'));assert(markup.includes('低风险'));assert(markup.includes('汇总展示（独立于通过判定）'));assert(!markup.includes('≥ 150'));}
assert(typedCards.includes('汇总展示值：<b>99</b>'));assert(typedCards.includes('仅观察'));assert(visibleResultMarkup(typedCards).includes('评估完成'));
context.typedResult=observationInvalid.result;assert(run('evExperimentScoringResults(typedResult)').includes('仅观察 · 结果格式异常'));assert(run('evExperimentScoringResults(typedResult)').includes('999'));
highAggregateFailure.e.selectedRunId=highAggregateFailure.record.id;run('evExperimentUI().id=typedExperiment.id;evExperimentScoringSnapshot()');assert(node('overlay').innerHTML.includes('[60, 100]（含边界）'));assert(!node('overlay').innerHTML.includes('≥ 150'));run('evCloseModal()');
run('evTaskDetail(taskId)');const typedTaskMarkup=run('AIOpsEvaluationDetails.render("业务任务")');assert(!typedTaskMarkup.includes('固定标准与结果'));assert(!typedTaskMarkup.includes('[60, 100]（含边界）'));assert(!typedTaskMarkup.includes('汇总展示（独立于通过判定）'));

// A preexisting empty-gate run cannot become a quality pass by vacuous AND.
const emptyHistorical=clone(highAggregateFailure.e);emptyHistorical.id='HISTORICAL-EMPTY-GATE';emptyHistorical.snapshot=clone(highAggregateFailure.record.snapshot);emptyHistorical.snapshot.unifiedEvaluation.evaluatorVersions[0].decision={type:'all_rules',rules:[],missingEvidence:'inconclusive'};emptyHistorical.runs=[];context.emptyHistorical=emptyHistorical;
const emptyHistoricalRun=run('evExperimentNewExecution(emptyHistorical,"HISTORICAL-EMPTY-GATE-RUN",1,emptyHistorical.snapshot,{kind:"full",status:"运行中",supplements:[]})');context.emptyHistoricalRun=emptyHistoricalRun;emptyHistoricalRun.results=run('evExperimentResultRows(emptyHistorical,emptyHistoricalRun.id)');run('evExperimentCompleteResult(emptyHistorical,emptyHistoricalRun,0,"通过")');
assert.equal(emptyHistoricalRun.results[0].acceptance,'not_applicable');assert.equal(emptyHistoricalRun.results[0].status,'仅观察');assert.deepEqual(clone(highAggregateFailure.record.snapshot),frozenTyped,'compatibility handling leaves the original frozen typed run untouched');assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators,'typed subset conditions never write the backup evaluator store');

// Existing aggregate-threshold versions keep their actual historical behavior and weighting scope.
const oldAggregate={...clone(typedEvaluator),id:'HISTORICAL-AGGREGATE-STANDARD',name:'历史汇总阈值版本',decision:{type:'aggregate_threshold',operator:'gte',threshold:80,missingEvidence:'inconclusive'}};
const oldAggregateState=JSON.parse(storage.getItem(D.storageKey));oldAggregateState.revision++;oldAggregateState.evaluators.push({...clone(oldAggregate),enabled:true,status:'active',versions:[clone(oldAggregate)]});storage.setItem(D.storageKey,JSON.stringify(oldAggregateState));
const historicalAggregate=typedTrial('旧汇总阈值仍使用冻结规则',[oldAggregate],'safety: false\nscore: 95\nrisk: high\nnote: 历史说明\nobserved: 95');
assert.equal(historicalAggregate.result.status,'通过');assert(historicalAggregate.result.evaluations[0].criteria.filter(item=>item.participates).every(item=>['score','observed'].includes(item.id)),'only historically weighted metrics participate in an aggregate gate');
assert.equal(historicalAggregate.assessment.evaluatorSnapshot.decision.policyVersion,undefined);
const historicalOutputError=typedTrial('旧输出校验异常不被新子集策略覆盖',[oldAggregate],'score: 95\nobserved: 999');assert.equal(historicalOutputError.assessment.executionStatus,'failed');assert.equal(historicalOutputError.result.status,'待确认');assert.equal(historicalOutputError.result.evaluationExecutionStatus,'failed');
assert.deepEqual(clone(D.evaluator(oldAggregate.id,'V1')),oldAggregate,'reading and running a legacy published definition never migrates it');

// Online task execution writes frozen typed criteria which the business-task result view consumes directly.
realSessions=[{id:'TYPED-ONLINE-SESSION',sceneId:'sales',agentId:'sales:agents:0',status:'completed',conversation:{rounds:[{n:1,inputId:'typed-online-user',outputId:'typed-online-agent',input:'校验交付',output:'safety: false\nscore: 99\nrisk: low\nobserved: 99',hasOutput:true}],records:[]},taskExecutions:[{id:'TYPED-ONLINE-TASK',taskId,completion:'completed',completedAt:new Date(now).toISOString(),startMessageId:'typed-online-user',completionMessageId:'typed-online-agent',output:'safety: false\nscore: 99\nrisk: low\nobserved: 99',evidence:['typed-online-agent']}]}];
const typedOnlineJob=saveFixtureJob({...onlineJob.record,id:undefined,name:'在线混合指标冻结结果',bindings:[{...typedTaskBinding,id:'TYPED-ONLINE-BINDING',targetType:'task_execution'}]});assert(typedOnlineJob.ok,typedOnlineJob.error);
const typedOnlineRun=D.runJob(typedOnlineJob.record.id);assert(typedOnlineRun.ok,typedOnlineRun.error);assert.equal(typedOnlineRun.run.assessed,1);
const typedOnlineActual=B.taskResults(taskId).find(item=>item.jobId===typedOnlineJob.record.id);assert(typedOnlineActual);assert.equal(typedOnlineActual.acceptance,'failed');assert.equal(typedOnlineActual.executionStatus,'succeeded');assert.deepEqual(clone(typedOnlineActual.evaluatorSnapshot.decision.rules),typedEvaluator.decision.rules);assert(Math.abs(typedOnlineActual.aggregate-99)<1e-9);
run('evTaskDetail(taskId)');const onlineTypedTaskMarkup=run('AIOpsEvaluationDetails.render("业务任务")');assert(!onlineTypedTaskMarkup.includes('在线混合指标冻结结果'));assert(!onlineTypedTaskMarkup.includes('[60, 100]（含边界）'));assert(!onlineTypedTaskMarkup.includes('≥ 150'));assert(!onlineTypedTaskMarkup.includes('汇总展示值：<b>99</b>'));
assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators,'mixed online/offline typed evaluation leaves backup definitions unchanged');

// Already-published V3 fixtures retain their historical compiled standards and sub-score runner.
function publishV3Fixture(draft,id){
  const record={...clone(draft),authoringMode:'structured',aggregation:{type:'none'}};
  record.method={type:'llm_judge',prompt:'逐项依据以下评估项标准读取真实证据并输出类型化结果。缺少本项证据时仅本项待确认；评分项必须逐子项输出0–100分，不得用总分反推子分。整体通过由运行系统计算。\n\n'+record.metrics.map(item=>{const lines=['【评估项 '+item.id+'｜'+item.name+'｜'+item.valueType+'】'];if(item.standard?.trim())lines.push('共同说明：'+item.standard);if(item.valueType==='boolean')lines.push('True标准：'+item.boolean.trueStandard,'False标准：'+item.boolean.falseStandard);else if(item.valueType==='category')for(const category of item.categories)lines.push('类别 '+category.code+'｜'+category.label+'：'+category.standard);else if(item.valueType==='number')for(const part of item.scoring.items)lines.push('评分子项 '+item.id+'.'+part.id+'｜'+part.name+'：'+part.standard);return lines.join('\n');}).join('\n\n')};
  const derived=D.deriveEvidenceRequirements(record);assert(derived.ok,derived.error);record.inputSchema=derived.inputSchema;record.supportedTargets=derived.supportedTargets;return publishLegacyFixture(record,id);
}
const itemDraft={name:'逐项标准混合验收',description:'每个评估项各自记录标准、实际结果与判定',sceneId:'',method:{type:'llm_judge'},metrics:[{id:'negative_expected',name:'无需人工介入',valueType:'boolean',standard:'根据 {{actual}} 判断是否需要人工介入',boolean:{trueStandard:'需要人工介入才能继续',falseStandard:'已有明确自动处理证据',passValue:false}},{id:'item_risk',name:'分类验收',valueType:'category',standard:'根据 {{actual}} 识别实际风险',categories:[{code:'ok',label:'合规',standard:'已满足明确约束',pass:true},{code:'risk',label:'风险',standard:'存在明确风险',pass:false}]},{id:'quality_item',name:'交付质量评分',valueType:'number',standard:'根据 {{actual}} 的逐项分数评价交付质量',range:{min:0,max:100},scoring:{items:[{id:'relevance',name:'相关性',standard:'判断交付是否回应原始诉求',weight:0.2},{id:'accuracy',name:'准确性',standard:'判断事实和计算是否准确',weight:0.3},{id:'completeness',name:'完整性',standard:'判断交付是否包含所需内容',weight:0.5}],passThreshold:70}},{id:'item_note',name:'分析说明',valueType:'text',standard:'从 {{actual}} 提取有证据的分析说明'}],decision:{type:'item_summary',policyVersion:3,summary:{type:'all'},missingEvidence:'inconclusive'}};
const itemEvaluator=publishV3Fixture(itemDraft);
assert.equal(itemEvaluator.decision.policyVersion,3);assert(D.hasDecision(itemEvaluator));assert.equal(itemEvaluator.inputSchema['x-aiops-evidence'].source,'item_standards');
const completeItemOutput='negative_expected: false\nitem_risk: ok\nquality_item.relevance: 80\nquality_item.accuracy: 60\nquality_item.completeness: 80\nitem_note: 已记录逐项证据';
const itemPass=typedTrial('逐项标准和三个评分子项',[itemEvaluator],completeItemOutput),itemScore=itemPass.assessment.metricResults.find(result=>result.metricId==='quality_item');
assert.equal(itemPass.result.status,'通过');assert.equal(itemScore.value,74);assert.equal(itemScore.subResults.length,3);assert.deepEqual(clone(itemScore.subResults.map(result=>result.weightedValue)),[16,18,40]);
assert.equal(itemPass.assessment.metricResults.find(result=>result.metricId==='negative_expected').decision,'passed','a Boolean expectation of false is an explicit passing result');
assert.equal(itemPass.assessment.summaryResult.total,3,'three score sub-items count as one evaluation item');assert.equal(itemPass.assessment.summaryResult.required,3);assert.equal(itemPass.assessment.summaryResult.passed,3);assert.equal(itemPass.assessment.summaryResult.observed,1);assert.equal(itemPass.result.evaluations[0].score,null,'a V3 evaluator has no invented global aggregate score');
assert.equal(itemPass.result.evaluations[0].criteria.find(result=>result.id==='quality_item').subResults.length,3);
const missingSub=typedTrial('缺少评分子项不猜测总分',[itemEvaluator],'negative_expected: false\nitem_risk: ok\nquality_item.relevance: 80\nquality_item.accuracy: 60');
const missingSubScore=missingSub.assessment.metricResults.find(result=>result.metricId==='quality_item');assert.equal(missingSub.result.status,'待确认');assert.equal(missingSubScore.value,null);assert.equal(missingSubScore.subResults.find(result=>result.id==='completeness').validationStatus,'missing');assert.equal(missingSub.assessment.summaryResult.lowerBound,2);assert.equal(missingSub.assessment.summaryResult.upperBound,3);
const totalOnly=typedTrial('只有旧总分不反推子项',[itemEvaluator],'negative_expected: false\nitem_risk: ok\nquality_item: 99');assert.equal(totalOnly.result.status,'待确认');assert.equal(totalOnly.assessment.metricResults.find(result=>result.metricId==='quality_item').value,null);assert(totalOnly.assessment.metricResults.find(result=>result.metricId==='quality_item').subResults.every(result=>result.value===null));
const invalidSub=typedTrial('子分超范围不夹紧为100',[itemEvaluator],'negative_expected: false\nitem_risk: ok\nquality_item.relevance: 101\nquality_item.accuracy: 70\nquality_item.completeness: 70');assert.equal(invalidSub.result.status,'待确认');assert.equal(invalidSub.assessment.metricResults.find(result=>result.metricId==='quality_item').subResults.find(result=>result.id==='relevance').validationStatus,'invalid');
const thresholdScore=typedTrial('评分项阈值包含等于边界',[itemEvaluator],'negative_expected: false\nitem_risk: ok\nquality_item.relevance: 70\nquality_item.accuracy: 70\nquality_item.completeness: 70');assert.equal(thresholdScore.result.status,'通过');assert.equal(thresholdScore.assessment.metricResults.find(result=>result.metricId==='quality_item').value,70);
const scoringLow=typedTrial('评分项本身未通过',[itemEvaluator],'negative_expected: false\nitem_risk: ok\nquality_item.relevance: 0\nquality_item.accuracy: 0\nquality_item.completeness: 100');assert.equal(scoringLow.result.status,'未通过');assert.equal(scoringLow.assessment.metricResults.find(result=>result.metricId==='quality_item').value,50);
const partialItems=publishV3Fixture({...itemDraft,name:'三项中至少两项通过',decision:{type:'item_summary',policyVersion:3,summary:{type:'at_least',minPassed:2},missingEvidence:'inconclusive'}});
const textItemEvaluator=publishV3Fixture({...itemDraft,name:'只有文本项只观察',metrics:[clone(itemDraft.metrics[3])]});const textItemOnly=typedTrial('V3没有判定项不空集通过',[textItemEvaluator],'item_note: 只记录分析');assert.equal(textItemOnly.result.status,'仅观察');assert.equal(textItemOnly.result.acceptance,'not_applicable');assert.equal(textItemOnly.assessment.summaryResult.total,0);assert.equal(textItemOnly.record.snapshot.unifiedEvaluation.bindings[0].role,'observe');
const allowedFailure=typedTrial('汇总允许部分通过但保留单项失败',[partialItems],completeItemOutput.replace('item_risk: ok','item_risk: risk'));
assert.equal(allowedFailure.result.status,'通过');assert.equal(allowedFailure.assessment.metricResults.find(result=>result.metricId==='item_risk').decision,'failed');assert.equal(allowedFailure.result.evaluations[0].criteria.find(result=>result.id==='item_risk').passed,false);assert.equal(allowedFailure.assessment.summaryResult.failed,1);
context.typedExperiment=allowedFailure.e;context.typedRecord=allowedFailure.record;const allowedIssues=run('evExperimentDetectIssues(typedExperiment,typedRecord)');assert(allowedIssues.some(issue=>issue.rule==='分类验收'),'explicit analysis retains failing items even when the evaluator summary passes');

// At least 8 of 10 counts evaluation items, excludes text, and resolves uncertainty using reachable counts.
const tenItems={...itemDraft,name:'十项中至少八项',metrics:[...Array.from({length:8},(_,index)=>({id:'check_'+index,name:'检查项 '+index,valueType:'boolean',standard:'根据 {{actual}} 的明确事实判断本项',boolean:{trueStandard:'有明确满足证据',falseStandard:'有明确不满足证据',passValue:true}})),clone(itemDraft.metrics[1]),clone(itemDraft.metrics[2]),clone(itemDraft.metrics[3])],decision:{type:'item_summary',policyVersion:3,summary:{type:'at_least',minPassed:8},missingEvidence:'inconclusive'}};
const tenEvaluator=publishV3Fixture(tenItems),checks=passed=>Array.from({length:8},(_,index)=>'check_'+index+': '+(index<passed?'true':'false')).join('\n');
const eightWithUnknown=typedTrial('八项已通过其余含未知仍达标',[tenEvaluator],checks(8)+'\nitem_risk: risk');assert.equal(eightWithUnknown.result.status,'通过');assert.equal(eightWithUnknown.assessment.summaryResult.total,10);assert.equal(eightWithUnknown.assessment.summaryResult.passed,8);assert.equal(eightWithUnknown.assessment.summaryResult.inconclusive,1);assert.equal(eightWithUnknown.assessment.summaryResult.observed,1);assert.equal(eightWithUnknown.assessment.summaryResult.required,8);
const reachableEight=typedTrial('七项通过且上界可达八项',[tenEvaluator],checks(7)+'\nitem_risk: risk');assert.equal(reachableEight.result.status,'待确认');assert.equal(reachableEight.assessment.summaryResult.lowerBound,7);assert.equal(reachableEight.assessment.summaryResult.upperBound,8);
const unreachableEight=typedTrial('上界不足八项明确失败',[tenEvaluator],checks(6)+'\nitem_risk: risk');assert.equal(unreachableEight.result.status,'未通过');assert.equal(unreachableEight.assessment.summaryResult.upperBound,7);

// Item-local evidence requirements do not turn another item's missing reference into a global execution error.
const referenceItem=clone(itemDraft);referenceItem.name='单项参考缺证隔离';referenceItem.metrics[2].scoring.items[2].standard='对照 {{reference}} 判断交付完整性';referenceItem.decision={type:'item_summary',policyVersion:3,summary:{type:'at_least',minPassed:2},missingEvidence:'inconclusive'};
const referenceItemEvaluator=publishV3Fixture(referenceItem);
const itemRecordedConversation=context.evExperimentCompleteConversation;
D.assess=(evaluator,input,binding)=>{evidenceCalls.push(clone({evaluator,input,binding}));return actualAssess(evaluator,input,binding);};
context.evExperimentCompleteConversation=(result,execution)=>{itemRecordedConversation(result,execution);const recorded=result.messages?.findLast(message=>message.role==='assistant');if(recorded){recorded.content=completeItemOutput;result.finalResponse=recorded.content;}};
const itemReferenceConversation=evidenceTrial('整段参考缺失仅影响依赖子项',referenceItemEvaluator,'conversation');context.evExperimentCompleteConversation=itemRecordedConversation;D.assess=actualAssess;
assert.equal(itemReferenceConversation.result.status,'通过');assert.equal(itemReferenceConversation.result.assessments[0].executionStatus,'succeeded');assert.equal(itemReferenceConversation.call.input.target.reference,undefined);assert.equal(itemReferenceConversation.result.assessments[0].summaryResult.passed,2);assert.equal(itemReferenceConversation.result.assessments[0].summaryResult.inconclusive,1);assert.equal(itemReferenceConversation.result.assessments[0].metricResults.find(result=>result.metricId==='quality_item').value,null);
assert.deepEqual(clone(itemReferenceConversation.result.assessments[0].metricResults.find(result=>result.metricId==='quality_item').subResults.map(result=>result.value)),[80,60,null],'missing reference remains local to the one dependent score sub-item');

// Business attribution and every read retain the item policy and score sub-results from the frozen run.
const itemTask=B.taskDefinition(taskId),itemTaskBinding={id:'V3-ITEM-TASK',evaluatorRef:{id:partialItems.id,version:'V1'},taskRef:{id:itemTask.id,version:itemTask.version},targetType:'case_output',role:'gate',dimensionMappings:[{dimensionId:itemTask.dimensions[0].id,metricId:'item_risk'},{dimensionId:itemTask.dimensions[1].id,metricId:'quality_item'}]};
B.setTaskBindings(taskId,[itemTaskBinding]);typedDimensionCase.expected=completeItemOutput.replace('item_risk: ok','item_risk: risk');typedDimensionCase.version='V'+(++sequence);B.repinSuite('TEST-SUITE');
const itemDimensionPolicy=policyTrial('部分通过仍保留业务维度失败',[{...itemTaskBinding,taskRef:undefined}]);assert.equal(itemDimensionPolicy.result.status,'通过');assert.equal(itemDimensionPolicy.result.dimensions.find(result=>result.metricId==='item_risk').passed,false);assert.equal(itemDimensionPolicy.result.dimensions.find(result=>result.metricId==='quality_item').subResults.length,3);
context.typedExperiment=itemPass.e;context.typedRecord=itemPass.record;context.typedResult=itemPass.result;
const itemCards=run('evExperimentScoringResults(typedResult)'),itemReport=run('evExperimentReportBody(typedExperiment,typedRecord)'),itemConfig=run('evExperimentEvaluationConfigRead(typedExperiment)');
for(const markup of [itemReport,itemConfig]){assert(markup.includes('逐项评估标准'));assert(markup.includes('无需人工介入'));assert(markup.includes('已有明确自动处理证据'));assert(markup.includes('已满足明确约束'));assert(markup.includes('准确性'));assert(markup.includes('全部 3 个参与判定的评估项通过'));assert(!markup.includes('汇总展示值：'));}
assert(itemCards.includes('本项加权得分：<b>74</b>'));assert(itemCards.includes('历史评估结果'));assert.equal(itemPass.assessment.summaryResult.passed,3);context.typedResult=missingSub.result;const missingSubCards=run('evExperimentScoringResults(typedResult)');assert(missingSubCards.includes('缺少可核验结果，保留待确认'));assert(missingSubCards.includes('历史评分分项：'));assert(missingSubCards.includes('完整性 待确认'));
assert(itemCards.includes('data-value="ok" data-selected="true" data-pass="true"'),'category results show their business label and keep the selected source code inspectable');
context.typedExperiment=eightWithUnknown.e;context.typedRecord=eightWithUnknown.record;context.typedResult=eightWithUnknown.result;const eightCards=run('evExperimentScoringResults(typedResult)');assert(eightCards.includes('历史评估结果'));assert.equal(resultBlocks(eightCards,'article','ub-metric-result').length,11);assert.equal(eightWithUnknown.assessment.summaryResult.passed,8);assert.equal(eightWithUnknown.assessment.summaryResult.inconclusive,1);
const frozenItems=clone(itemPass.record.snapshot),frozenItemAssessment=clone(itemPass.assessment.evaluatorSnapshot);const itemUpdated=clone(itemEvaluator);itemUpdated.metrics[2].scoring.passThreshold=99;itemUpdated.metrics[2].scoring.items[0].standard='新版相关性标准';itemUpdated.decision.summary={type:'at_least',minPassed:1};
assert.equal(D.saveEvaluator(itemUpdated,itemEvaluator.id).ok,false,'editing a V3 score requires explicit review before V4 publication');const reviewedItem=D.prepareEvaluatorForAuthoring(itemUpdated);assert.equal(reviewedItem.decision.policyVersion,4);reviewedItem.metrics[2].standard='新版相关性标准：依据 {{actual}} 直接评分';reviewedItem.migrationState.acknowledged=true;const changedItem=D.saveEvaluator(reviewedItem,itemEvaluator.id);assert(changedItem.ok,changedItem.error);assert(D.publishEvaluator(itemEvaluator.id).ok);assert.deepEqual(clone(itemPass.record.snapshot),frozenItems);assert.deepEqual(clone(itemPass.assessment.evaluatorSnapshot),frozenItemAssessment);
context.typedExperiment=itemPass.e;context.typedResult=itemPass.result;const pinnedItemCards=run('evExperimentScoringResults(typedResult)');assert(pinnedItemCards.includes('通过阈值：70'));assert(!pinnedItemCards.includes('新版相关性标准'));run('evExperimentUI().id=typedExperiment.id;evExperimentScoringSnapshot("current")');assert(node('overlay').innerHTML.includes('全部 3 个参与判定的评估项通过'));assert(!node('overlay').innerHTML.includes('新版相关性标准'));run('evCloseModal()');
run('evTaskDetail(taskId)');const itemTaskMarkup=run('AIOpsEvaluationDetails.render("业务任务")');assert(!itemTaskMarkup.includes('至少 2 个评估项通过'));assert(!itemTaskMarkup.includes('本项加权得分：<b>74</b>'));
realSessions=[{id:'V3-ONLINE-SESSION',sceneId:'sales',agentId:'sales:agents:0',status:'completed',conversation:{rounds:[{n:1,inputId:'v3-user',outputId:'v3-agent',input:'逐项校验交付',output:completeItemOutput.replace('item_risk: ok','item_risk: risk'),hasOutput:true}],records:[]},taskExecutions:[{id:'V3-ONLINE-TASK',taskId,completion:'completed',completedAt:new Date(now).toISOString(),startMessageId:'v3-user',completionMessageId:'v3-agent',output:completeItemOutput.replace('item_risk: ok','item_risk: risk'),evidence:['v3-agent']}]}];
const itemOnlineJob=saveFixtureJob({...onlineJob.record,id:undefined,name:'在线逐项评分结果',bindings:[{...itemTaskBinding,id:'V3-ONLINE-BINDING',targetType:'task_execution'}]});assert(itemOnlineJob.ok,itemOnlineJob.error);const itemOnlineRun=D.runJob(itemOnlineJob.record.id);assert(itemOnlineRun.ok,itemOnlineRun.error);assert.equal(itemOnlineRun.run.assessed,1);
const itemOnlineActual=B.taskResults(taskId).find(result=>result.jobId===itemOnlineJob.record.id);assert(itemOnlineActual);assert.equal(itemOnlineActual.acceptance,'passed');assert.equal(itemOnlineActual.summaryResult.passed,2);assert.equal(itemOnlineActual.summaryResult.failed,1);assert.equal(itemOnlineActual.metricResults.find(result=>result.metricId==='item_risk').decision,'failed');assert.equal(itemOnlineActual.metricResults.find(result=>result.metricId==='quality_item').subResults.length,3);assert.equal(itemOnlineActual.evaluatorSnapshot.decision.policyVersion,3);
run('evTaskDetail(taskId)');const onlineItemTaskMarkup=run('AIOpsEvaluationDetails.render("业务任务")');assert(!onlineItemTaskMarkup.includes('在线逐项评分结果'));assert(!onlineItemTaskMarkup.includes('通过 2 · 未通过 1'));assert(!onlineItemTaskMarkup.includes('本项加权得分：<b>74</b>'));
assert.deepEqual(clone(highAggregateFailure.record.snapshot),frozenTyped,'V3 publication does not rewrite a V2 historical run');assert.deepEqual(clone(D.evaluator(oldAggregate.id,'V1')),oldAggregate,'V3 never rewrites an old aggregate-threshold version');assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators,'item-centric evaluation leaves backup assets unchanged');

// Experiment-level evaluator summaries are separate from each evaluator's item-level summary.
const summaryEvaluators=Array.from({length:10},(_,index)=>publishHistoricalEvidence({name:'实验汇总评估器 '+index,description:'单个独立评估器用于实验层阈值联验',sceneId:'',method:{type:'llm_judge'},metrics:[{id:'evaluator_check_'+index,name:'独立检查 '+index,valueType:'boolean',standard:'根据 {{actual}} 的明确结果记录本项',boolean:{trueStandard:'有明确满足证据',falseStandard:'有明确不满足证据',passValue:true}}],decision:{type:'item_summary',policyVersion:3,summary:{type:'all'},missingEvidence:'inconclusive'}}));
const summaryBindings=[...summaryEvaluators,textItemEvaluator].map((evaluator,index)=>({id:'SUMMARY-EVALUATOR-'+index,evaluatorRef:{id:evaluator.id,version:'V1'},targetType:'case_output',role:'gate',dimensionMappings:[]}));
const evaluatorOutput=(passed,failed)=>Array.from({length:passed+failed},(_,index)=>'evaluator_check_'+index+': '+(index<passed?'true':'false')).join('\n')+'\nitem_note: 观察记录不参与实验通过计数';
function evaluatorSummaryPlan(name,summary,bindings=summaryBindings,extraExecution={}){
  return {...plan,name,suiteIds:['AUTO-EVIDENCE-SUITE'],unifiedBindings:bindings,execution:{...plan.execution,evaluationPolicy:'all_selected',...(summary===undefined?{}:{evaluatorSummary:summary}),...extraExecution}};
}
function evaluatorSummaryTrial(name,summary,output,bindings=summaryBindings,extraExecution={}){
  context.evidenceCase.expected=output;context.evidenceCase.version='V'+(++sequence);B.repinSuite('AUTO-EVIDENCE-SUITE');
  const e=B.createExperiment(evaluatorSummaryPlan(name,summary,bindings,extraExecution));context.summaryExperiment=e;
  const record=run('evExperimentNewExecution(summaryExperiment,summaryExperiment.id+"-SUMMARY",1,summaryExperiment.snapshot,{kind:"full",status:"运行中",supplements:[]})');context.summaryRecord=record;e.runs.unshift(record);
  record.results=run('evExperimentResultRows(summaryExperiment,summaryRecord.id)');run('evExperimentCompleteResult(summaryExperiment,summaryRecord,0,"通过")');record.status='已完成';e.status='已完成';
  return {e,record,result:record.results[0]};
}
const defaultEvaluatorAll=evaluatorSummaryTrial('实验默认要求全部评估器通过',undefined,evaluatorOutput(8,2));
assert.deepEqual(clone(defaultEvaluatorAll.e.snapshot.execution.evaluatorSummary),{type:'all'});assert.equal(defaultEvaluatorAll.result.acceptance,'failed');assert.equal(defaultEvaluatorAll.result.evaluatorSummaryResult.required,10);assert.equal(defaultEvaluatorAll.result.evaluatorSummaryResult.total,10);assert.equal(defaultEvaluatorAll.result.evaluatorSummaryResult.observed,1);
const eightEvaluators=evaluatorSummaryTrial('至少八个独立评估器通过',{type:'at_least',minPassed:8},evaluatorOutput(8,2));
assert.equal(eightEvaluators.result.status,'通过');assert.deepEqual(clone(eightEvaluators.result.evaluatorSummaryResult),{mode:'at_least',required:8,total:10,passed:8,failed:2,inconclusive:0,observed:1,lowerBound:8,upperBound:8});
assert.equal(eightEvaluators.result.assessments.length,11);assert.equal(eightEvaluators.result.assessments.filter(result=>result.role==='gate').length,10);assert.equal(eightEvaluators.result.evaluations.filter(result=>result.decision==='failed').length,2);assert(eightEvaluators.result.evaluations.filter(result=>result.decision==='failed').every(result=>result.criteria[0].passed===false),'passing the experiment never rewrites a failed evaluator or item');
context.summaryExperiment=eightEvaluators.e;context.summaryRecord=eightEvaluators.record;assert.equal(run('evExperimentSummary(summaryRecord).passRate'),100);assert(run('evExperimentDetectIssues(summaryExperiment,summaryRecord)').some(issue=>issue.rule==='独立检查 8'),'explicit analysis can still inspect failed evaluators below the experiment threshold');
const eightAndUnknown=evaluatorSummaryTrial('八个已确认通过其余含未知',{type:'at_least',minPassed:8},evaluatorOutput(8,1));assert.equal(eightAndUnknown.result.acceptance,'passed');assert.equal(eightAndUnknown.result.evaluatorSummaryResult.inconclusive,1);assert.equal(eightAndUnknown.result.evaluatorSummaryResult.upperBound,9);
const sevenReachable=evaluatorSummaryTrial('七个通过但上界可达八个',{type:'at_least',minPassed:8},evaluatorOutput(7,2));assert.equal(sevenReachable.result.status,'待确认');assert.equal(sevenReachable.result.evaluatorSummaryResult.lowerBound,7);assert.equal(sevenReachable.result.evaluatorSummaryResult.upperBound,8);
const sevenUnreachable=evaluatorSummaryTrial('上界不足八个评估器',{type:'at_least',minPassed:8},evaluatorOutput(6,3));assert.equal(sevenUnreachable.result.status,'未通过');assert.equal(sevenUnreachable.result.evaluatorSummaryResult.upperBound,7);
const allTen=evaluatorSummaryTrial('十个通过且观察资产不计分母',{type:'all'},evaluatorOutput(10,0));assert.equal(allTen.result.acceptance,'passed');assert.equal(allTen.result.evaluatorSummaryResult.required,10);assert.equal(allTen.result.evaluatorSummaryResult.observed,1);
const observersOnly=evaluatorSummaryTrial('没有参与判定的评估器仍仅观察',{type:'all'},'item_note: 观察记录',summaryBindings.slice(-1));assert.equal(observersOnly.result.status,'仅观察');assert.equal(observersOnly.result.evaluatorSummaryResult.total,0);assert.equal(observersOnly.result.acceptance,'not_applicable');
const sourceConversationForSummary=context.evExperimentCompleteConversation;
context.evExperimentCompleteConversation=(result,execution)=>{sourceConversationForSummary(result,execution);const last=result.messages?.findLast(message=>message.role==='assistant');if(last){last.content=evaluatorOutput(7,3);result.finalResponse=last.content;}};
const conversationSummary=evaluatorSummaryTrial('整段汇总读取整段实际结果',{type:'at_least',minPassed:8},evaluatorOutput(8,2),summaryBindings.map(binding=>({...binding,targetType:'session',evaluationTarget:'conversation'})),scopeExecution);context.evExperimentCompleteConversation=sourceConversationForSummary;
assert.equal(conversationSummary.result.acceptance,'failed');assert.equal(conversationSummary.result.evaluatorSummaryResult.passed,7);assert(conversationSummary.result.assessments.every(result=>result.targetRef.type==='session'));assert(conversationSummary.result.firstResponse.includes('evaluator_check_7: true'));assert(conversationSummary.result.finalResponse.includes('evaluator_check_7: false'));
for(const invalid of [0,-1,1.5,11,NaN,Infinity,'',true])assert.throws(()=>B.createExperiment(evaluatorSummaryPlan('非法实验汇总门槛',{type:'at_least',minPassed:invalid})),/评估器|汇总|正整数|至少|通过数/);
assert.throws(()=>B.createExperiment(evaluatorSummaryPlan('缺少实验汇总门槛',{type:'at_least'})),/评估器|汇总|正整数|至少|通过数/);assert.throws(()=>B.createExperiment(evaluatorSummaryPlan('错误汇总方式',{type:'unsupported'})),/评估器|汇总|方式|规则/);assert.throws(()=>B.createExperiment(evaluatorSummaryPlan('观察资产不抬高合法门槛',{type:'at_least',minPassed:1},summaryBindings.slice(-1))),/评估器|汇总|至少|通过数/);

// A failed evaluator execution is unknown rather than a false quality result; confirmed N passes still suffice.
const assessForEvaluatorSummary=D.assess;D.assess=(evaluator,input,binding)=>{if(evaluator.id===summaryEvaluators[9].id)throw Error('fixture evaluator service unavailable');return assessForEvaluatorSummary(evaluator,input,binding);};
const summaryExecutionError=evaluatorSummaryTrial('已满足门槛同时保留评估异常',{type:'at_least',minPassed:8},evaluatorOutput(8,2));D.assess=assessForEvaluatorSummary;
assert.equal(summaryExecutionError.result.acceptance,'passed');assert.equal(summaryExecutionError.result.evaluationExecutionStatus,'failed');assert.equal(summaryExecutionError.result.evaluatorSummaryResult.inconclusive,1);assert.equal(summaryExecutionError.result.evaluatorSummaryResult.failed,1);

// Threshold validation is atomic when selection shrinks; no automatic lowering of N.
const reducedSnapshot=clone(eightEvaluators.e.snapshot),reducedRevision=eightEvaluators.e.configurationRevision;
assert.throws(()=>B.updateExperiment(eightEvaluators.e.id,{unifiedBindings:[...summaryBindings.slice(0,7),summaryBindings.at(-1)]}),/评估器|汇总|至少|通过数/);assert.deepEqual(clone(eightEvaluators.e.snapshot),reducedSnapshot);assert.equal(eightEvaluators.e.configurationRevision,reducedRevision);
const immutableSummary=clone(eightEvaluators.record.snapshot),immutableResults=clone(eightEvaluators.record.results);assert(Object.isFrozen(eightEvaluators.record.snapshot.execution.evaluatorSummary));
context.summaryExperiment=eightEvaluators.e;const keyBeforeSummary=run('evExperimentConfigurationKey(summaryExperiment)'),summaryRevision=eightEvaluators.e.configurationRevision;
B.updateExperiment(eightEvaluators.e.id,{execution:{evaluatorSummary:{type:'all'}}});assert.equal(eightEvaluators.e.configurationRevision,summaryRevision+1);assert.notEqual(run('evExperimentConfigurationKey(summaryExperiment)'),keyBeforeSummary);assert.deepEqual(clone(eightEvaluators.e.snapshot.execution.evaluatorSummary),{type:'all'});assert.deepEqual(clone(eightEvaluators.record.snapshot),immutableSummary);assert.deepEqual(clone(eightEvaluators.record.results),immutableResults);
B.updateExperiment(eightEvaluators.e.id,{execution:{concurrency:1}});assert.deepEqual(clone(eightEvaluators.e.snapshot.execution.evaluatorSummary),{type:'all'},'unrelated execution edits retain the configured summary');
const newAllRun=run('evRunExperiment(summaryExperiment.id)');drainModelTimers();assert.deepEqual(clone(newAllRun.snapshot.execution.evaluatorSummary),{type:'all'});assert.equal(newAllRun.results[0].acceptance,'failed');
context.historicalSummarySource=eightEvaluators.record;const oldSummaryRerun=run('evRunExperiment(summaryExperiment.id,historicalSummarySource,historicalSummarySource.results[0].caseId)');drainModelTimers();assert.deepEqual(clone(oldSummaryRerun.snapshot.execution.evaluatorSummary),{type:'at_least',minPassed:8});assert.equal(oldSummaryRerun.results[0].acceptance,'passed');assert.deepEqual(clone(eightEvaluators.record.results),immutableResults,'rerunning a historical threshold does not overwrite its source result');

// Pre-policy snapshots keep the original all requirement without rewriting historical evidence.
const legacyEvaluatorSummary=clone(defaultEvaluatorAll.e);legacyEvaluatorSummary.id='PRE-EVALUATOR-SUMMARY';legacyEvaluatorSummary.snapshot=clone(defaultEvaluatorAll.record.snapshot);delete legacyEvaluatorSummary.snapshot.execution.evaluatorSummary;legacyEvaluatorSummary.runs=[];context.legacyEvaluatorSummary=legacyEvaluatorSummary;
const legacyEvaluatorSummaryRun=run('evExperimentNewExecution(legacyEvaluatorSummary,"PRE-EVALUATOR-SUMMARY-RUN",1,legacyEvaluatorSummary.snapshot,{kind:"full",status:"运行中",supplements:[]})');context.legacyEvaluatorSummaryRun=legacyEvaluatorSummaryRun;legacyEvaluatorSummaryRun.results=run('evExperimentResultRows(legacyEvaluatorSummary,legacyEvaluatorSummaryRun.id)');run('evExperimentCompleteResult(legacyEvaluatorSummary,legacyEvaluatorSummaryRun,0,"通过")');assert.equal(legacyEvaluatorSummaryRun.results[0].status,'未通过');assert.equal(legacyEvaluatorSummaryRun.results[0].evaluatorSummaryResult.mode,'all');assert.equal(legacyEvaluatorSummaryRun.snapshot.execution.evaluatorSummary,undefined);

// Result cards, reports, dashboard hints and standards read the policy from the selected immutable run.
context.summaryExperiment=eightEvaluators.e;context.summaryRecord=eightEvaluators.record;context.summaryResult=eightEvaluators.result;
const evaluatorSummaryCards=run('evExperimentScoringResults(summaryResult)'),evaluatorSummaryReport=run('evExperimentReportBody(summaryExperiment,summaryRecord)'),evaluatorSummaryMetrics=run('evDashboardRunMetrics(summaryExperiment,summaryRecord)');
for(const markup of [evaluatorSummaryCards,evaluatorSummaryReport]){assert(markup.includes('至少 8')&&markup.includes('评估器'));assert(markup.includes('独立检查 8'));}
assert(evaluatorSummaryMetrics.find(metric=>metric.id==='case-pass-rate').hint.includes('至少 8'));assert.equal(evaluatorSummaryMetrics.find(metric=>metric.id==='case-pass-rate').value,100);
run('evExperimentUI().id=summaryExperiment.id;evExperimentSelectRun(summaryRecord.id);evExperimentScoringSnapshot()');assert(node('overlay').innerHTML.includes('至少 8')&&node('overlay').innerHTML.includes('评估器'));run('evCloseModal()');

// Editing a historical count policy proposes a custom draft, while obsolete count submissions are rejected atomically.
const editableSummary=evaluatorSummaryTrial('实验旧数量判定转自定义草稿',{type:'at_least',minPassed:8},evaluatorOutput(8,2));context.editableSummary=editableSummary.e;run('evExperimentPrepareRuns(editableSummary);evExperimentForm(editableSummary)');const editableHistoricalRun=clone(editableSummary.record);assert(node('overlay').innerHTML.includes('aria-label="实验通过判定方式"'));assert(!node('overlay').innerHTML.includes('name="evaluatorSummaryMinPassed"'));assert.equal(run('evExperimentEditor.execution.evaluatorSummary.mode'),'custom_prompt');assert(run('evExperimentEditor.execution.evaluatorSummary.customPrompt').includes('至少 8'));const convertedDraft=snapshot('evExperimentEditor.execution.evaluatorSummary');assert.equal(B.evaluatorSummaryChange('mode','item_count'),false);assert.equal(B.evaluatorSummaryChange('type','at_least'),false);assert.deepEqual(snapshot('evExperimentEditor.execution.evaluatorSummary'),convertedDraft);
B.removeBinding(0);B.removeBinding(0);B.removeBinding(0);assert(run('evExperimentEditor.execution.evaluatorSummary.customPrompt').includes('至少 8'),'removing an evaluator never rewrites the converted original rule');
context.evaluatorSummaryForm={values:{scene:'sales',experimentId:editableSummary.e.id,name:editableSummary.e.name,agentId:editableSummary.e.agentId,version:editableSummary.e.version,suiteIds:editableSummary.e.suiteIds,concurrency:2,caseRuns:1,fullRuns:1,modelId:'mock-eval-balanced',mcpIds:[],agentRuntimeMode:'inherit',judgeModelRef:D.defaultJudgeRuntime().modelRef,evaluatorSummaryType:'at_least',evaluatorSummaryMinPassed:'8'}};
node('ev-experiment-form-error').textContent='';const editableBefore=clone(editableSummary.e.snapshot);assert.equal(run('evSubmitExperiment(evaluatorSummaryForm)'),false);assert(node('ev-experiment-form-error').textContent.includes('只支持评分或自定义'));assert.deepEqual(clone(editableSummary.e.snapshot),editableBefore);
const revisedCountPrompt='依据 {{evaluatorResults}} 的真实结论，至少 7 个参与判定的评估器明确通过才通过；必要结果不足时待确认。';B.evaluatorSummaryChange('prompt',revisedCountPrompt);delete context.evaluatorSummaryForm.values.evaluatorSummaryType;delete context.evaluatorSummaryForm.values.evaluatorSummaryMinPassed;Object.assign(context.evaluatorSummaryForm.values,{evaluatorSummaryMode:'custom_prompt',evaluatorSummaryPrompt:revisedCountPrompt});const reducedSaved=run('evSubmitExperiment(evaluatorSummaryForm)');assert(reducedSaved);assert.equal(reducedSaved.snapshot.execution.evaluatorSummary.mode,'custom_prompt');assert.equal(reducedSaved.snapshot.execution.evaluatorSummary.customPrompt,revisedCountPrompt);assert.equal(reducedSaved.snapshot.unifiedEvaluation.bindings.filter(binding=>binding.role==='gate').length,7);assert.deepEqual(clone(editableSummary.record),editableHistoricalRun,'editing the converted draft preserves the original count engine and its results');
context.evidenceCase.expected=evaluatorOutput(8,2);context.evidenceCase.version='V'+(++sequence);
context.summarySecondCase={...clone(context.evidenceCase),id:'SUMMARY-SECOND-CASE',name:'另一条独立对话',version:'V1',expected:evaluatorOutput(7,3)};
run(`evData().cases.push(summarySecondCase);evData().suites.push({id:'EVALUATOR-SUMMARY-TWO-CASES',name:'逐条汇总而非批次计数',version:'V1',agentId:'sales-agent-1',taskIds:[taskId],caseIds:[evidenceCase.id,summarySecondCase.id],caseBindings:{[evidenceCase.id]:[{taskId,dimensionNames:[evData().tasks[0].dimensions[0].name]}],[summarySecondCase.id]:[{taskId,dimensionNames:[evData().tasks[0].dimensions[0].name]}]}})`);B.repinSuite('EVALUATOR-SUMMARY-TWO-CASES');
const perResultSummary=B.createExperiment({...evaluatorSummaryPlan('每条对话单独应用8/10策略',{type:'at_least',minPassed:8}),suiteIds:['EVALUATOR-SUMMARY-TWO-CASES']});context.perResultSummary=perResultSummary;const perResultRun=run('evExperimentNewExecution(perResultSummary,"PER-RESULT-SUMMARY-RUN",1,perResultSummary.snapshot,{kind:"full",status:"运行中",supplements:[]})');context.perResultRun=perResultRun;perResultRun.results=run('evExperimentResultRows(perResultSummary,perResultRun.id)');run('evExperimentCompleteResult(perResultSummary,perResultRun,0,"通过");evExperimentCompleteResult(perResultSummary,perResultRun,1,"通过")');
assert.deepEqual(clone(perResultRun.results.map(result=>result.acceptance)),['passed','failed']);assert.deepEqual(clone(perResultRun.results.map(result=>result.evaluatorSummaryResult.passed)),[8,7]);assert(perResultRun.results.every(result=>result.evaluatorSummaryResult.total===10));assert.equal(run('evExperimentSummary(perResultRun).passRate'),50,'an experiment report counts independently decided case/conversation results');

// A passing N-of-M case cannot falsely verify a problem belonging to an evaluator that still fails or lacks evidence.
const scopedIssue={id:'SCOPED-EVALUATOR-SUMMARY-ISSUE',caseId:eightEvaluators.result.caseId,status:'待验证',definition:{judgment:{kind:'evaluator',evaluatorId:summaryEvaluators[8].id,version:'V1'}},occurrences:[{runId:eightEvaluators.record.id,recordId:eightEvaluators.record.id,resultId:eightEvaluators.result.id}],verifications:[],history:[]};
eightEvaluators.e.issueLedger=[...(eightEvaluators.e.issueLedger||[]),scopedIssue];context.verificationSourceExperiment=eightEvaluators.e;
const missingOriginalEvaluator=evaluatorSummaryTrial('原问题评估器缺证但整体仍通过',{type:'at_least',minPassed:8},evaluatorOutput(8,0)+'\nevaluator_check_9: false'),passedOriginalEvaluator=evaluatorSummaryTrial('原问题评估器通过且整体通过',{type:'at_least',minPassed:8},evaluatorOutput(9,1));
assert.equal(missingOriginalEvaluator.result.status,'通过');assert.equal(missingOriginalEvaluator.result.assessments.find(result=>result.evaluatorRef.id===summaryEvaluators[8].id).decision,'inconclusive');assert.equal(passedOriginalEvaluator.result.status,'通过');
const scopedValidationRuns=[
  {source:eightEvaluators,expected:'验证未通过',issueStatus:'验证完成',passed:false},
  {source:missingOriginalEvaluator,expected:'验证未完成',issueStatus:'待验证',passed:false},
  {source:passedOriginalEvaluator,expected:'验证通过',issueStatus:'验证完成',passed:true}
];
for(const [index,entry] of scopedValidationRuns.entries()){
  const validation={...clone(entry.source.record),id:eightEvaluators.e.id+'-SCOPED-VALIDATION-'+index,experimentId:eightEvaluators.e.id,kind:'validation',status:'已完成',validationIssueId:scopedIssue.id,sourceRecordId:eightEvaluators.record.id,validationSequence:index+1,results:[{...clone(entry.source.result),id:eightEvaluators.e.id+'-SCOPED-VALIDATION-RESULT-'+index}]};
  (eightEvaluators.e.validationRuns||(eightEvaluators.e.validationRuns=[])).push(validation);context.scopedValidationRun=validation;scopedIssue.verifying=true;
  const frozenValidation=clone(validation),frozenOriginalCase=clone(eightEvaluators.result);run('evExperimentIssueSyncVerification(verificationSourceExperiment,scopedValidationRun)');
  assert.equal(scopedIssue.latestVerification.status,entry.expected);assert.equal(scopedIssue.status,entry.issueStatus);assert.equal(scopedIssue.verificationPassed,entry.passed);assert.deepEqual(clone(validation),frozenValidation,'scoped verification uses a status view and does not rewrite the original passing run');assert.deepEqual(clone(eightEvaluators.result),frozenOriginalCase);assert.equal(validation.results[0].status,'通过');
}
const beforeRoleDraft=clone(reducedSaved.snapshot);context.roleDraftExperiment=reducedSaved;run('evExperimentForm(roleDraftExperiment)');
assert.equal(run('evExperimentEditor.unifiedBindings.filter(binding=>binding.role==="gate").length'),7);assert.equal(run('evExperimentEditor.unifiedBindings[7].role'),'observe');
B.bindingChange(7,'evaluator',summaryEvaluators[0].id+'@V1');assert.equal(run('evExperimentEditor.unifiedBindings[7].role'),'observe');assert.equal(run('evExperimentEditor.unifiedBindings.filter(binding=>binding.role==="gate").length'),7,'changing an observe-only evaluator never silently promotes it to a gate');
B.bindingChange(7,'evaluator',textItemEvaluator.id+'@V1');assert.equal(run('evExperimentEditor.unifiedBindings[7].role'),'observe');assert.equal(run('evExperimentEditor.unifiedBindings.filter(binding=>binding.role==="gate").length'),7);run('evCloseModal()');assert.deepEqual(clone(reducedSaved.snapshot),beforeRoleDraft,'changing summary eligibility in a cancelled editor never rewrites the saved plan');
const beforeTaskObserver=clone(B.recommendedBindings(taskId));assert(B.editTaskBindings(taskId));B.taskBindingChange(0,'role','observe');B.taskBindingChange(0,'evaluator',summaryEvaluators[0].id+'@V1');assert(node('ub-bindings').outerHTML.includes('<option value="observe" selected>'),'task recommendations keep their explicit observe role when the evaluator changes');run('evCloseModal()');assert.deepEqual(clone(B.recommendedBindings(taskId)),beforeTaskObserver);
assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators,'experiment summary policies never mutate backup evaluator assets');

// Adding an evaluator must append an unused asset rather than overwrite a selected default during deduplication.
{
  const addCatalog=D.listEvaluators,addContainer=node('ub-bindings'),addQuery=addContainer.querySelector,addEvents=[],allowedAssets=[typedEvaluator.id,summaryEvaluators[0].id];
  D.listEvaluators=scene=>addCatalog(scene).filter(evaluator=>allowedAssets.includes(evaluator.id)).sort((left,right)=>allowedAssets.indexOf(left.id)-allowedAssets.indexOf(right.id));
  addContainer.querySelector=selector=>selector==='section.ont-execution:last-of-type'?{scrollIntoView:options=>addEvents.push({type:'scroll',options}),querySelector:child=>child==='.ub-evaluator-picker > summary'?{focus:options=>addEvents.push({type:'focus',options})}:null}:addQuery(selector);
  try{
    run('evExperimentForm()');assert.equal(run('evExperimentEditor.unifiedBindings.length'),1);assert.equal(run('evExperimentEditor.unifiedBindings[0].evaluatorRef.id'),typedEvaluator.id);assert.equal(run('evExperimentEditor.unifiedBindings[0].evaluatorRef.version'),'V2','the initial choice uses the latest published version');
    B.bindingChange(0,'version','V1');run('evExperimentEditor.execution.mode="scenario_simulation";evExperimentEditor.execution.scenarioPrompt="持续追问直到上限"');B.bindingChange(0,'target','conversation');B.bindingChange(0,'input:actual','/target/input');B.evaluatorSummaryChange('threshold','81');
    const firstAddDraft=snapshot('evExperimentEditor.unifiedBindings[0]'),beforeAddSnapshot=snapshot('evExperimentEditor.execution.evaluatorSummary');assert.equal(firstAddDraft.evaluatorRef.version,'V1');assert.equal(firstAddDraft.evaluationTarget,'conversation');assert.equal(firstAddDraft.inputMapping.actual,'/target/input');
    assert.equal(B.addBinding(),true);assert.equal(run('evExperimentEditor.unifiedBindings.length'),2);assert.deepEqual(snapshot('evExperimentEditor.unifiedBindings[0]'),firstAddDraft,'adding a row preserves the existing ID, pinned version, target and input-mapping draft');assert.deepEqual(snapshot('evExperimentEditor.execution.evaluatorSummary'),beforeAddSnapshot);
    assert.equal(run('evExperimentEditor.unifiedBindings[1].evaluatorRef.id'),summaryEvaluators[0].id,'another version of a selected asset is not treated as a new evaluator');assert.equal(run('evExperimentEditor.unifiedBindings[1].evaluatorRef.version'),'V1');assert.notEqual(run('evExperimentEditor.unifiedBindings[1].id'),firstAddDraft.id);
    assert.equal((addContainer.outerHTML.match(/ub-experiment-evaluator-row/g)||[]).length,2);assert.deepEqual(addEvents.map(event=>event.type),['scroll','focus']);assert.deepEqual(clone(addEvents[1].options),{preventScroll:true});assert(addContainer.outerHTML.includes('全部可用评估器已添加'));assert(/<button\b[^>]*\bdisabled\b[^>]*>全部可用评估器已添加<\/button>/.test(addContainer.outerHTML));
    const exhaustedAddDraft=snapshot('evExperimentEditor.unifiedBindings'),exhaustedAddEvents=addEvents.length;assert.equal(B.addBinding(),false);assert.deepEqual(snapshot('evExperimentEditor.unifiedBindings'),exhaustedAddDraft,'calling Add when exhausted never mutates the selected drafts');assert.equal(addEvents.length,exhaustedAddEvents);assert.equal(node('evaluation-toast').textContent,'全部可用评估器已添加');
    B.removeBinding(1);assert.equal(run('evExperimentEditor.unifiedBindings.length'),1);assert(!addContainer.outerHTML.includes('全部可用评估器已添加'));assert.equal(B.addBinding(),true);assert.equal(run('evExperimentEditor.unifiedBindings.length'),2);assert.deepEqual(snapshot('evExperimentEditor.unifiedBindings[0]'),firstAddDraft);assert.equal(run('evExperimentEditor.unifiedBindings[1].evaluatorRef.id'),summaryEvaluators[0].id,'removing an evaluator makes that asset available to add again');
    const secondAddId=run('evExperimentEditor.unifiedBindings[1].id');B.bindingChange(1,'evaluator',typedEvaluator.id+'@V1');assert.equal(run('evExperimentEditor.unifiedBindings.length'),2,'a duplicate reference selected while editing is retained for correction, not silently collapsed');assert.equal(run('evExperimentEditor.unifiedBindings[1].id'),secondAddId);assert.deepEqual(snapshot('evExperimentEditor.unifiedBindings[0]'),firstAddDraft);assert.equal((addContainer.outerHTML.match(/ub-experiment-evaluator-row/g)||[]).length,2);
    assert.throws(()=>B.createExperiment({...evaluatorSummaryPlan('重复评估器草稿需显式更正',{type:'all'}),unifiedBindings:snapshot('evExperimentEditor.unifiedBindings')}),/重复|一次/);run('evCloseModal()');

    const taskAddBefore=clone(B.recommendedBindings(taskId));assert(B.editTaskBindings(taskId));B.addTaskBinding();const taskRowsAfterOne=(addContainer.outerHTML.match(/class="ont-execution"/g)||[]).length;B.addTaskBinding();const taskRowsAfterTwo=(addContainer.outerHTML.match(/class="ont-execution"/g)||[]).length;assert.equal(taskRowsAfterTwo,taskRowsAfterOne+1,'business-task bindings may reuse one evaluator for distinct mappings');assert(!addContainer.outerHTML.includes('全部可用评估器已添加'));run('evCloseModal()');assert.deepEqual(clone(B.recommendedBindings(taskId)),taskAddBefore,'cancelling repeated task-binding drafts leaves the saved task intact');

    D.listEvaluators=()=>[];run('evExperimentForm()');assert.equal(run('evExperimentEditor.unifiedBindings.length'),0);assert(node('overlay').innerHTML.includes('暂无可用评估器'));assert(/<button\b[^>]*\bdisabled\b[^>]*>暂无可用评估器<\/button>/.test(node('overlay').innerHTML));assert.equal(B.addBinding(),false);assert.equal(run('evExperimentEditor.unifiedBindings.length'),0);assert.equal(node('evaluation-toast').textContent,'请先发布一个评估器');run('evCloseModal()');
  }finally{D.listEvaluators=addCatalog;addContainer.querySelector=addQuery;}
}
assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators,'adding evaluator drafts never mutates backup assets');

// Prompt authoring is one platform verdict, with no inferred user metrics or fabricated score configuration.
const originalPrompt='检查回答是否真正完成用户诉求，并核对准确性和完整性；证据不足时保留待确认。\n<原样提示词>不要猜测评分项。';
const promptEvaluator=publishHistoricalEvidence({name:'纯提示词整体验收',description:'验证纯提示词可以复用到离线与在线',sceneId:'',authoringMode:'prompt',method:{type:'llm_judge',prompt:originalPrompt}});
assert(D.isPromptEvaluator(promptEvaluator));assert.equal(D.isPromptEvaluator({method:{type:'llm_judge',prompt:'旧编译提示词'}}),false);assert.equal(promptEvaluator.method.prompt,originalPrompt);assert.deepEqual(clone(promptEvaluator.metrics.map(metric=>metric.id)),['overall_verdict']);assert.equal(promptEvaluator.metrics[0].name,'整体判定');assert.deepEqual(Object.keys(promptEvaluator.inputSchema.properties),['actual'],'a natural-language prompt uses the declared platform actual default without inferring more inputs');assert.equal(promptEvaluator.method.modelRef,undefined);
const promptOutput=(value,reason='可核验的整体判断说明',evidenceRefs=['PROMPT-EVIDENCE'])=>'```json\n'+JSON.stringify({metricValues:{overall_verdict:{value,reason,evidenceRefs}}})+'\n```';
const promptPass=typedTrial('提示词明确True协议',[promptEvaluator],promptOutput(true,'已取得完整交付证据',['PROMPT-PASS-EVIDENCE'])),promptFail=typedTrial('提示词明确False协议',[promptEvaluator],promptOutput(false,'发现明确违反条件的证据',['PROMPT-FAIL-EVIDENCE'])),promptUnknown=typedTrial('提示词明确null协议',[promptEvaluator],promptOutput(null,'尚缺必要证据'));
assert.equal(promptPass.result.status,'通过');assert.equal(promptFail.result.status,'未通过');assert.equal(promptUnknown.result.status,'待确认');assert.equal(promptPass.assessment.executionStatus,'succeeded');assert(promptPass.assessment.metricResults[0].reason.includes('已取得完整交付证据'));assert(promptPass.assessment.metricResults[0].evidenceRefs.includes('PROMPT-PASS-EVIDENCE'));assert.equal(promptPass.result.evaluations[0].criteria.length,0);assert.equal(promptPass.result.evaluations[0].score,null);assert.equal(promptPass.record.snapshot.evaluators[0].criteria.length,0,'the shared-runtime adapter does not invent an 80-point criterion');
for(const ordinary of ['这份回答应当通过。',JSON.stringify({passed:true,reason:'普通字段不是平台协议'}),JSON.stringify({overall_verdict:true})])assert.equal(typedTrial('普通内容不推断整体结论',[promptEvaluator],ordinary).result.status,'待确认');
const invalidPromptVerdict=typedTrial('提示词协议不把字符串强转Boolean',[promptEvaluator],promptOutput('true'));assert.equal(invalidPromptVerdict.result.status,'待确认');assert.equal(invalidPromptVerdict.assessment.metricResults[0].validationStatus,'invalid');
const referencePrompt=publishHistoricalEvidence({name:'纯提示词严格参考输入',description:'明确声明实际结果与参考答案',authoringMode:'prompt',method:{type:'llm_judge',prompt:'依据 {{actual}} 与 {{reference}} 核对结果；缺少参考答案时不能确认。'}});
const referencePromptOffline=typedTrial('提示词离线映射真实用例参考',[referencePrompt],promptOutput(true));assert.equal(referencePromptOffline.result.status,'通过');assert.equal(referencePromptOffline.record.snapshot.unifiedEvaluation.bindings[0].inputMapping.reference,'/case/expected');
const promptConversationSource=context.evExperimentCompleteConversation;D.assess=(evaluator,input,binding)=>{evidenceCalls.push(clone({evaluator,input,binding}));return actualAssess(evaluator,input,binding);};
context.evExperimentCompleteConversation=(result,execution)=>{promptConversationSource(result,execution);const last=result.messages?.findLast(message=>message.role==='assistant');if(last){last.content=promptOutput(true);result.finalResponse=last.content;}};
const missingPromptReference=evidenceTrial('整段提示词不偷用首轮参考答案',referencePrompt,'conversation');context.evExperimentCompleteConversation=promptConversationSource;D.assess=actualAssess;assert.equal(missingPromptReference.result.status,'待确认');assert.equal(missingPromptReference.result.assessments[0].executionStatus,'succeeded');assert.equal(missingPromptReference.call.input.target.reference,undefined);assert(missingPromptReference.result.assessments[0].metricResults[0].reason.includes('参考'));

context.promptReadExperiment=promptPass.e;context.promptReadRun=promptPass.record;context.promptReadResult=promptPass.result;
const purePromptCards=run('evExperimentScoringResults(promptReadResult)'),purePromptReport=run('evExperimentReportBody(promptReadExperiment,promptReadRun)'),purePromptConfig=run('evExperimentEvaluationConfigRead(promptReadExperiment)');
for(const markup of [purePromptReport,purePromptConfig]){assert(markup.includes('&lt;原样提示词&gt;不要猜测评分项。'));assert(markup.includes('原文提示词'));assert(!/逐项评估标准|评分子项|评估项汇总结果|通过项数 \/ 要求/.test(markup),'the hidden compatibility verdict is not presented as a user-configured item');}
assert(purePromptCards.includes('提示词配置 · 整体判断'));assert(purePromptCards.includes('判定记录'));assert(purePromptCards.includes('已取得完整交付证据'));assert(!purePromptCards.includes('PROMPT-PASS-EVIDENCE'));assert(purePromptReport.includes('整体判定结果'));
run('evExperimentUI().id=promptReadExperiment.id;evExperimentSelectRun(promptReadRun.id);evExperimentScoringSnapshot()');assert(node('overlay').innerHTML.includes('&lt;原样提示词&gt;'));assert(!node('overlay').innerHTML.includes('历史评估项'));run('evCloseModal()');
context.promptReadResult=promptPass.result;assert.equal(run('evExperimentResultEvaluator(promptReadResult.id,promptReadResult.evaluations[0].evaluatorId)'),true);assert(node('overlay').innerHTML.includes('原文提示词'));assert(!node('overlay').innerHTML.includes('通过分数'));run('evCloseModal()');

// Prompt verdicts participate in evaluator N-of-M, while analysis/verification stays at the original evaluator scope.
const promptMixBindings=[{id:'PROMPT-MIX',evaluatorRef:{id:promptEvaluator.id,version:'V1'},role:'gate',targetType:'case_output',dimensionMappings:[]},{id:'STRUCTURED-MIX',evaluatorRef:{id:summaryEvaluators[0].id,version:'V1'},role:'gate',targetType:'case_output',dimensionMappings:[]}];
const promptMixed=evaluatorSummaryTrial('整体通过仍保留提示词评估器失败',{type:'at_least',minPassed:1},promptOutput(false,'提示词标准明确未满足')+'\nevaluator_check_0: true',promptMixBindings);assert.equal(promptMixed.result.status,'通过');assert.equal(promptMixed.result.evaluatorSummaryResult.total,2);assert.equal(promptMixed.result.evaluatorSummaryResult.passed,1);assert.equal(promptMixed.result.evaluatorSummaryResult.failed,1);
context.promptMixExperiment=promptMixed.e;context.promptMixRun=promptMixed.record;context.promptMixResult=promptMixed.result;
const promptFinding=run('evExperimentDetectIssues(promptMixExperiment,promptMixRun)').find(issue=>issue.evaluatorId===promptEvaluator.id);assert(promptFinding);assert(!promptFinding.id.includes('-criterion-'));context.promptFinding=promptFinding;const promptIssueDefinition=run('evExperimentIssueIdentity(promptMixExperiment,promptMixRun,promptFinding,promptMixResult)');assert.equal(promptIssueDefinition.judgment.kind,'evaluator');assert.equal(promptIssueDefinition.judgment.passScore,null);
const promptVerificationIssue={id:'PROMPT-VERIFICATION-ISSUE',caseId:promptMixed.result.caseId,status:'待验证',definition:clone(promptIssueDefinition),occurrences:[{runId:promptMixed.record.id,resultId:promptMixed.result.id}],verifications:[],history:[]};promptMixed.e.issueLedger=[promptVerificationIssue];
const promptVerifyUnknown=evaluatorSummaryTrial('提示词待确认且其他评估器通过',{type:'at_least',minPassed:1},'普通回答通过\nevaluator_check_0: true',promptMixBindings),promptVerifyPassed=evaluatorSummaryTrial('提示词已确认通过',{type:'at_least',minPassed:1},promptOutput(true)+'\nevaluator_check_0: true',promptMixBindings);
for(const [index,entry] of [{source:promptMixed,status:'验证未通过'},{source:promptVerifyUnknown,status:'验证未完成'},{source:promptVerifyPassed,status:'验证通过'}].entries()){
  assert.equal(entry.source.result.status,'通过');const validation={...clone(entry.source.record),id:promptMixed.e.id+'-PROMPT-VALIDATION-'+index,experimentId:promptMixed.e.id,kind:'validation',status:'已完成',validationIssueId:promptVerificationIssue.id,sourceRecordId:promptMixed.record.id,results:[clone(entry.source.result)]};context.promptValidation=validation;const before=clone(validation);run('evExperimentIssueSyncVerification(promptMixExperiment,promptValidation)');assert.equal(promptVerificationIssue.latestVerification.status,entry.status);assert.deepEqual(clone(validation),before);
}

// Business dimensions opt in to the fixed verdict explicitly; no additional dimensions are inferred from the prompt.
const promptTask=B.taskDefinition(taskId),promptTaskBinding={id:'PROMPT-TASK-VERDICT',evaluatorRef:{id:promptEvaluator.id,version:'V1'},taskRef:{id:promptTask.id,version:promptTask.version},role:'gate',targetType:'case_output',dimensionMappings:[{dimensionId:promptTask.dimensions[0].id,metricId:'overall_verdict'}]};B.setTaskBindings(taskId,[promptTaskBinding]);typedDimensionCase.expected=promptOutput(false);typedDimensionCase.version='V'+(++sequence);B.repinSuite('TEST-SUITE');
const promptDimensionPolicy=policyTrial('明确映射整体判定到一个业务维度',[promptTaskBinding]);assert.equal(promptDimensionPolicy.result.dimensions.filter(result=>result.assessmentId).length,1);assert.equal(promptDimensionPolicy.result.dimensions.find(result=>result.metricId==='overall_verdict').passed,false);assert(promptDimensionPolicy.result.dimensions.filter(result=>result.dimensionId!==promptTask.dimensions[0].id).every(result=>result.passed===null));assert.equal(B.suiteCoverage(run('evData().suites.find(suite=>suite.id==="TEST-SUITE")')).bindingCovered,1);assert(B.editTaskBindings(taskId));assert(node('overlay').innerHTML.includes('>整体判定</option>'));assert(!node('overlay').innerHTML.includes('输入变量「'));run('evCloseModal()');
const promptOfflineActual=B.taskResults(taskId).find(result=>result.experimentId===promptDimensionPolicy.e.id);assert(promptOfflineActual);assert.equal(promptOfflineActual.evaluatorSnapshot.authoringMode,'prompt');assert.equal(promptOfflineActual.acceptance,'failed');
realSessions=[{id:'PROMPT-ONLINE-SESSION',sceneId:'sales',agentId:'sales:agents:0',status:'completed',conversation:{rounds:[{n:1,inputId:'prompt-user',outputId:'prompt-agent',input:'核对交付证据',output:promptOutput(false,'线上实际证据明确未满足',['prompt-agent']),hasOutput:true}],records:[]},taskExecutions:[{id:'PROMPT-ONLINE-TASK',taskId,completion:'completed',completedAt:new Date(now).toISOString(),startMessageId:'prompt-user',completionMessageId:'prompt-agent',output:promptOutput(false,'线上实际证据明确未满足',['prompt-agent']),evidence:['prompt-agent']}]}];
const promptOnlineJob=saveFixtureJob({...onlineJob.record,id:undefined,name:'纯提示词在线业务验收',bindings:[{...promptTaskBinding,id:'PROMPT-ONLINE-BIND',targetType:'task_execution'}]});assert(promptOnlineJob.ok,promptOnlineJob.error);const promptOnlineRun=D.runJob(promptOnlineJob.record.id);assert(promptOnlineRun.ok,promptOnlineRun.error);assert.equal(promptOnlineRun.run.assessed,1);const promptOnlineActual=B.taskResults(taskId).find(result=>result.jobId===promptOnlineJob.record.id);assert(promptOnlineActual);assert.equal(promptOnlineActual.completion,'completed');assert.equal(promptOnlineActual.acceptance,'failed');assert.equal(promptOnlineActual.evaluatorSnapshot.method.prompt,originalPrompt);assert(promptOnlineActual.metricResults[0].reason.includes('线上实际证据明确未满足'));assert(promptOnlineActual.metricResults[0].evidenceRefs.includes('prompt-agent'));
run('evTaskDetail(taskId)');const promptTaskMarkup=run('AIOpsEvaluationDetails.render("业务任务")');assert(!promptTaskMarkup.includes('纯提示词在线业务验收'));assert(!promptTaskMarkup.includes('线上实际证据明确未满足'));assert(!promptTaskMarkup.includes('原文提示词'));

// Published modes and raw prompts remain frozen across editing, switching mode and rerunning history.
const frozenPromptSnapshot=clone(promptPass.record.snapshot),frozenPromptAssessment=clone(promptPass.assessment),promptV2Saved=D.saveEvaluator({...clone(promptEvaluator),method:{type:'llm_judge',prompt:'新版提示词：只依据 {{actual}} 核验当前交付。'}},promptEvaluator.id);assert(promptV2Saved.ok,promptV2Saved.error);assert(D.publishEvaluator(promptEvaluator.id).ok);const promptV2=D.evaluator(promptEvaluator.id,'V2'),promptV2Trial=typedTrial('新版提示词独立快照',[promptV2],promptOutput(true));assert.notEqual(promptV2Trial.assessment.effectiveConfigHash,promptPass.assessment.effectiveConfigHash);assert.deepEqual(clone(promptPass.record.snapshot),frozenPromptSnapshot);assert.deepEqual(clone(promptPass.assessment),frozenPromptAssessment);
const promptToStructured=D.saveEvaluator({...clone(itemDraft),name:'同资产详细配置新版',authoringMode:'structured',metrics:itemDraft.metrics.map(metric=>metric.valueType==='number'?{...clone(metric),standard:'依据 {{actual}} 直接评分',scoring:{passThreshold:70}}:clone(metric)),decision:{type:'evaluation_policy',policyVersion:4,mode:'custom_prompt',customPrompt:'依据 {{itemResults}} 判断整体交付，明确违规未通过，必要证据不足待确认。',missingEvidence:'inconclusive'}},promptEvaluator.id);assert(promptToStructured.ok,promptToStructured.error);assert(D.publishEvaluator(promptEvaluator.id).ok);assert.equal(D.evaluator(promptEvaluator.id,'V3').authoringMode,'structured');assert.equal(D.evaluator(promptEvaluator.id,'V1').method.prompt,originalPrompt);assert(D.isPromptEvaluator(D.evaluator(promptEvaluator.id,'V1')));
context.promptReadExperiment=promptPass.e;context.promptHistory=promptPass.record;const promptHistoryRerun=run('evRunExperiment(promptReadExperiment.id,promptHistory,promptHistory.results[0].caseId)');drainModelTimers();assert.equal(promptHistoryRerun.results[0].status,'通过');assert.equal(promptHistoryRerun.snapshot.unifiedEvaluation.evaluatorVersions[0].authoringMode,'prompt');assert.equal(promptHistoryRerun.snapshot.unifiedEvaluation.evaluatorVersions[0].method.prompt,originalPrompt);assert.deepEqual(clone(promptPass.assessment),frozenPromptAssessment);
context.promptReadRun=promptPass.record;const frozenPromptReport=run('evExperimentReportBody(promptReadExperiment,promptReadRun)');assert(frozenPromptReport.includes('&lt;原样提示词&gt;'));assert(!frozenPromptReport.includes('新版提示词：'));assert(!frozenPromptReport.includes('逐项评估标准'));assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators,'prompt authoring never changes backup evaluator assets');

// V4 evaluates direct scores and three distinct overall policies without changing item verdicts.
const v4Draft={name:'V4直接评分与加权',description:'真实分数加权并保留各项自身判定',authoringMode:'structured',sceneId:'',additionalPrompt:'补充业务背景：<冻结补充>只依据回执，不补造缺失分。',method:{type:'llm_judge'},metrics:[{id:'v4_bool',name:'V4安全',valueType:'boolean',standard:'依据 {{actual}} 判断安全条件',boolean:{trueStandard:'已满足安全约束',falseStandard:'明确违反安全约束',passValue:true},weight:0.1},{id:'v4_category',name:'V4分类',valueType:'category',standard:'依据 {{actual}} 判断交付类别',categories:[{code:'ok',label:'合规交付',standard:'符合交付约束',pass:true},{code:'risk',label:'风险交付',standard:'违反交付约束',pass:false}],weight:0.1},{id:'v4_score',name:'V4直接质量',valueType:'number',standard:'依据 {{actual}} 直接给出0–100原始质量分',range:{min:0,max:100},scoring:{passThreshold:95},weight:0.8},{id:'v4_note',name:'V4观察说明',valueType:'text',standard:'依据 {{actual}} 提取说明'}],decision:{type:'evaluation_policy',policyVersion:4,mode:'weighted_score',passThreshold:80,missingEvidence:'inconclusive'}};
const v4Weighted=publishHistoricalEvidence(v4Draft);assert(D.isV4Evaluator(v4Weighted));assert.equal(v4Weighted.inputSchema['x-aiops-evidence'].version,3);assert.equal(v4Weighted.inputSchema['x-aiops-evidence'].source,'evaluation_policy');assert.equal(v4Weighted.metrics[2].scoring.items,undefined);
const v4Output=(flag=false,category='ok',...scores)=>{const score=scores.length?scores[0]:90;return 'v4_bool: '+flag+'\nv4_category: '+category+(score===undefined?'':'\nv4_score: '+score)+'\nv4_note: 保留观察事实';};
const v4WeightedPass=typedTrial('V4加权通过但单项仍失败',[v4Weighted],v4Output());assert.equal(v4WeightedPass.result.status,'通过');assert.equal(v4WeightedPass.assessment.aggregate,82);assert.equal(v4WeightedPass.assessment.policyResult.score,82);assert.equal(v4WeightedPass.assessment.policyResult.threshold,80);assert.deepEqual(clone(v4WeightedPass.assessment.policyResult.contributions.map(part=>[part.normalizedScore,part.weightedScore])),[[0,0],[100,10],[90,72]]);assert.equal(v4WeightedPass.assessment.metricResults.find(metric=>metric.metricId==='v4_score').decision,'failed');assert.equal(v4WeightedPass.assessment.metricResults.find(metric=>metric.metricId==='v4_score').subResults,undefined);assert.equal(v4WeightedPass.result.evaluations[0].score,82);assert.equal(v4WeightedPass.result.evaluations[0].criteria.find(metric=>metric.id==='v4_bool').passed,false);
const v4WeightedMissing=typedTrial('V4缺分不补0不重分权重',[v4Weighted],v4Output(true,'ok',undefined));assert.equal(v4WeightedMissing.result.status,'待确认');assert.equal(v4WeightedMissing.assessment.aggregate,null);assert.equal(v4WeightedMissing.assessment.policyResult.contributions[2].normalizedScore,null);assert.equal(v4WeightedMissing.assessment.policyResult.contributions[2].weightedScore,null);
const v4WeightedInvalid=typedTrial('V4非法原分不夹紧',[v4Weighted],v4Output(true,'ok',101));assert.equal(v4WeightedInvalid.result.status,'待确认');assert.equal(v4WeightedInvalid.assessment.metricResults[2].rawValue,101);assert.equal(v4WeightedInvalid.assessment.aggregate,null);
const v4WeightedFail=typedTrial('V4加权未达整体阈值',[v4Weighted],v4Output(false,'risk',40)),v4Zero=typedTrial('V4零分是真实有效分数',[v4Weighted],v4Output(true,'ok',0));assert.equal(v4WeightedFail.result.status,'未通过');assert.equal(v4WeightedFail.assessment.aggregate,32);assert.equal(v4Zero.assessment.metricResults[2].validationStatus,'valid');
const v4Count=publishHistoricalEvidence({...v4Draft,name:'V4通过项数策略',decision:{type:'evaluation_policy',policyVersion:4,mode:'item_count',summary:{type:'at_least',minPassed:2},missingEvidence:'inconclusive'}});
const v4CountPass=typedTrial('V4至少两项通过',[v4Count],v4Output(false,'ok',100));assert.equal(v4CountPass.result.status,'通过');assert.equal(v4CountPass.assessment.policyResult.mode,'item_count');assert.equal(v4CountPass.assessment.summaryResult.total,3);assert.equal(v4CountPass.assessment.summaryResult.passed,2);assert.equal(v4CountPass.assessment.aggregate,null);assert.equal(v4CountPass.assessment.metricResults[0].decision,'failed');
assert.equal(typedTrial('V4计数未知仍可达',[v4Count],v4Output(true,'risk',undefined)).result.status,'待确认');assert.equal(typedTrial('V4计数上界不可达',[v4Count],v4Output(false,'risk',undefined)).result.status,'未通过');
const v4Shared=publishHistoricalEvidence({...v4Draft,name:'V4补充背景依赖缺证',additionalPrompt:'共同依据 {{context}} 核对，未取得背景不能确认。',decision:{type:'evaluation_policy',policyVersion:4,mode:'item_count',summary:{type:'all'},missingEvidence:'inconclusive'}});const v4SharedMissing=typedTrial('补充prompt依赖真实来源',[v4Shared],v4Output(true,'ok',100));assert.equal(v4SharedMissing.result.status,'待确认');assert.equal(v4SharedMissing.assessment.summaryResult.inconclusive,3);

// A custom overall decision requires an independent, hash-matched final-judge response.
const v4Custom=publishHistoricalEvidence({...v4Draft,name:'V4自定义总体提示词',decision:{type:'evaluation_policy',policyVersion:4,mode:'custom_prompt',customPrompt:'依据 {{itemResults}} 独立判断整体交付；保留各项原始结论。',missingEvidence:'inconclusive'}});
const rawFinalClaim=v4Output(false,'risk',20)+'\n'+promptOutput(true,'原始Agent输出自行宣称通过');const v4CustomPending=typedTrial('原始整体verdict不能冒充最终judge',[v4Custom],rawFinalClaim);assert.equal(v4CustomPending.result.status,'待确认');assert.equal(v4CustomPending.assessment.finalJudgeResult.validationStatus,'missing');assert.equal(v4CustomPending.assessment.finalJudgeInputSnapshot.itemResults[2].value,20);assert.deepEqual(clone(v4CustomPending.assessment.finalJudgeInputSnapshot.inputs),{});assert.equal(v4CustomPending.assessment.finalJudgeInputSnapshot.additionalPrompt,v4Draft.additionalPrompt);
function trustedV4Trial(name,evaluator,output,value,options={}){
  const original=D.assess,firstStages=[];D.assess=(definition,input,binding)=>{evidenceCalls.push(clone({evaluator:definition,input,binding}));const first=original(definition,input,binding);if(definition.id!==evaluator.id)return first;firstStages.push(clone(first));return original(definition,{...input,finalJudgeOutput:{protocol:options.protocol??'aiops.final_verdict.v1',inputHash:options.inputHash??first.finalJudgeInputSnapshot.inputHash,value,reason:'独立最终评判服务返回的实际结果',evidenceRefs:['INDEPENDENT-FINAL-EVIDENCE']}},binding);};
  try{const trial=options.conversation?evidenceTrial(name,evaluator,'conversation'):typedTrial(name,[evaluator],output);trial.firstStage=firstStages[0];return trial;}finally{D.assess=original;}
}
const v4CustomPass=trustedV4Trial('独立最终judge通过',[v4Custom][0],rawFinalClaim,true);assert.equal(v4CustomPass.result.status,'通过');assert.equal(v4CustomPass.firstStage.decision,'inconclusive');assert.equal(v4CustomPass.assessment.finalJudgeResult.validationStatus,'valid');assert.equal(v4CustomPass.assessment.finalJudgeResult.inputHash,v4CustomPass.assessment.finalJudgeInputSnapshot.inputHash);assert(v4CustomPass.assessment.policyResult.evidenceRefs.includes('INDEPENDENT-FINAL-EVIDENCE'));assert.equal(v4CustomPass.assessment.metricResults[0].decision,'failed');assert.equal(v4CustomPass.assessment.metricResults[2].decision,'failed');assert.equal(v4CustomPass.result.evaluations[0].finalJudgeInputSnapshot.inputHash,v4CustomPass.assessment.finalJudgeInputSnapshot.inputHash);
assert.equal(trustedV4Trial('独立最终judge未通过',v4Custom,v4Output(true,'ok',100),false).result.status,'未通过');assert.equal(trustedV4Trial('独立最终judge证据不足',v4Custom,v4Output(true,'ok',100),null).result.status,'待确认');const v4StaleFinal=trustedV4Trial('拒绝其他输入的最终结论',v4Custom,v4Output(true,'ok',100),true,{inputHash:'sha256:stale'});assert.equal(v4StaleFinal.result.status,'待确认');assert.equal(v4StaleFinal.assessment.finalJudgeResult.validationStatus,'invalid');
const v4CustomReference=publishHistoricalEvidence({...v4Draft,name:'V4最终judge专属参考来源',decision:{type:'evaluation_policy',policyVersion:4,mode:'custom_prompt',customPrompt:'依据 {{itemResults}} 并对照 {{reference}} 判断。',missingEvidence:'inconclusive'}}),beforeV4Conversation=context.evExperimentCompleteConversation;
context.evExperimentCompleteConversation=(result,execution)=>{beforeV4Conversation(result,execution);const last=result.messages?.findLast(message=>message.role==='assistant');if(last){last.content=v4Output(true,'ok',100);result.finalResponse=last.content;}};
const v4MissingFinalReference=trustedV4Trial('最终judge缺专属来源不影响真实单项',v4CustomReference,'',true,{conversation:true});context.evExperimentCompleteConversation=beforeV4Conversation;assert.equal(v4MissingFinalReference.result.status,'待确认');assert(v4MissingFinalReference.firstStage.metricResults.filter(item=>item.metricId!=='v4_note').every(item=>item.validationStatus==='valid'));assert(v4MissingFinalReference.result.assessments[0].finalJudgeResult.reason.includes('参考'));

// Read-only views show direct scores, actual contribution data and final-judge evidence, never V3 sub-scores.
context.v4ReadExperiment=v4WeightedPass.e;context.v4ReadRun=v4WeightedPass.record;context.v4ReadResult=v4WeightedPass.result;
const v4Cards=run('evExperimentScoringResults(v4ReadResult)'),v4Report=run('evExperimentReportBody(v4ReadExperiment,v4ReadRun)'),v4Config=run('evExperimentEvaluationConfigRead(v4ReadExperiment)');for(const markup of [v4Report,v4Config]){assert(markup.includes('补充提示词'));assert(markup.includes('&lt;冻结补充&gt;'));assert(markup.includes('总体评估方式 · 加权评分'));assert(!markup.includes('评分子项'));}assert(v4Cards.includes('本项得分：<b>90</b>'));assert(v4Cards.includes('加权总分：<b>82</b>'));assert(v4Cards.includes('权重 0.8，计入 72 分'));assert(v4Cards.includes('加权总分为 82 分，通过阈值为 80 分'));
context.v4ReadResult=v4WeightedInvalid.result;const v4InvalidCards=run('evExperimentScoringResults(v4ReadResult)');assert(v4InvalidCards.includes('加权总分：<b>—</b>'));assert(v4InvalidCards.includes('101'));context.v4ReadResult=v4CustomPass.result;const v4CustomCards=run('evExperimentScoringResults(v4ReadResult)');assert(!v4CustomCards.includes('最终评判输入快照'));assert(!v4CustomCards.includes('最终评判返回'));assert(!v4CustomCards.includes(v4CustomPass.assessment.finalJudgeInputSnapshot.inputHash));assert(v4CustomCards.includes('自定义评估标准：'));assert(v4CustomCards.includes('独立最终评判服务返回的实际结果'));
run('evExperimentUI().id=v4ReadExperiment.id;evExperimentSelectRun(v4ReadRun.id);evExperimentScoringSnapshot()');assert(node('overlay').innerHTML.includes('总体评估方式 · 加权评分'));assert(!node('overlay').innerHTML.includes('历史评估项'));run('evCloseModal()');context.v4ReadResult=v4WeightedPass.result;assert.equal(run('evExperimentResultEvaluator(v4ReadResult.id,v4ReadResult.evaluations[0].evaluatorId)'),true);assert(node('overlay').innerHTML.includes('贡献分'));run('evCloseModal()');

// Weighted acceptance does not conceal failed mapped items; finding IDs preserve their original, non-contiguous positions.
const v4Task=B.taskDefinition(taskId),v4TaskBinding={id:'V4-TASK',evaluatorRef:{id:v4Weighted.id,version:'V1'},taskRef:{id:taskId,version:v4Task.version},role:'gate',targetType:'case_output',dimensionMappings:[{dimensionId:v4Task.dimensions[0].id,metricId:'v4_bool'},{dimensionId:v4Task.dimensions[1].id,metricId:'v4_score'}]};B.setTaskBindings(taskId,[v4TaskBinding]);typedDimensionCase.expected=v4Output();typedDimensionCase.version='V'+(++sequence);B.repinSuite('TEST-SUITE');const v4Mapped=policyTrial('V4整体加权通过但业务项失败',[v4TaskBinding]);assert.equal(v4Mapped.result.status,'通过');assert(v4Mapped.result.dimensions.filter(item=>item.assessmentId).every(item=>item.passed===false));
context.v4MappedExperiment=v4Mapped.e;context.v4MappedRun=v4Mapped.record;context.v4MappedResult=v4Mapped.result;const v4Findings=run('evExperimentDetectIssues(v4MappedExperiment,v4MappedRun)');context.v4ScoreFinding=v4Findings.find(issue=>issue.rule==='V4直接质量');assert(context.v4ScoreFinding);const v4ScoreIdentity=run('evExperimentIssueIdentity(v4MappedExperiment,v4MappedRun,v4ScoreFinding,v4MappedResult)');assert.equal(v4ScoreIdentity.judgment.criterion.id,'v4_score');assert.equal(v4ScoreIdentity.judgment.criterion.passScore,95);context.v4DimensionFinding=v4Findings.find(issue=>issue.type==='维度未达标'&&issue.rule===v4Task.dimensions[1].name);const v4DimensionIdentity=run('evExperimentIssueIdentity(v4MappedExperiment,v4MappedRun,v4DimensionFinding,v4MappedResult)');assert.equal(v4DimensionIdentity.judgment.id,v4Task.dimensions[1].id);
typedDimensionCase.expected=v4Output(true,'ok',undefined);typedDimensionCase.version='V'+(++sequence);B.repinSuite('TEST-SUITE');const v4MappedMissing=policyTrial('V4原评分缺证验证',[v4TaskBinding]);typedDimensionCase.expected=v4Output(true,'ok',100);typedDimensionCase.version='V'+(++sequence);B.repinSuite('TEST-SUITE');const v4MappedPassed=policyTrial('V4原评分通过验证',[v4TaskBinding]);
for(const [issueIndex,definition] of [v4ScoreIdentity,v4DimensionIdentity].entries()){
  const issue={id:'V4-SCOPED-ISSUE-'+issueIndex,caseId:v4Mapped.result.caseId,status:'待验证',definition:clone(definition),occurrences:[{runId:v4Mapped.record.id,resultId:v4Mapped.result.id}],verifications:[],history:[]};(v4Mapped.e.issueLedger||(v4Mapped.e.issueLedger=[])).push(issue);
  for(const [index,entry] of [{source:v4Mapped,status:'验证未通过'},{source:v4MappedMissing,status:'验证未完成'},{source:v4MappedPassed,status:'验证通过'}].entries()){const validation={...clone(entry.source.record),id:'V4-VALIDATION-'+issueIndex+'-'+index,experimentId:v4Mapped.e.id,kind:'validation',status:'已完成',validationIssueId:issue.id,sourceRecordId:v4Mapped.record.id,results:[clone(entry.source.result)]};context.v4Validation=validation;const before=clone(validation);run('evExperimentIssueSyncVerification(v4MappedExperiment,v4Validation)');assert.equal(issue.latestVerification.status,entry.status);assert.deepEqual(clone(validation),before);}
}
assert(B.editTaskBindings(taskId));assert(!node('overlay').innerHTML.includes('输入变量「'));run('evCloseModal()');

// Online task execution freezes the V4 policy, direct item results and actual score independently of completion.
realSessions=[{id:'V4-ONLINE-SESSION',sceneId:'sales',agentId:'sales:agents:0',status:'completed',conversation:{rounds:[{n:1,inputId:'v4-user',outputId:'v4-agent',input:'评估交付',output:v4Output(),hasOutput:true}],records:[]},taskExecutions:[{id:'V4-ONLINE-TASK',taskId,completion:'completed',completedAt:new Date(now).toISOString(),startMessageId:'v4-user',completionMessageId:'v4-agent',output:v4Output(),evidence:['v4-agent']}]}];const v4OnlineJob=saveFixtureJob({...onlineJob.record,id:undefined,name:'V4在线直接加权验收',bindings:[{...v4TaskBinding,id:'V4-ONLINE-BIND',targetType:'task_execution'}]});assert(v4OnlineJob.ok,v4OnlineJob.error);const v4OnlineRun=D.runJob(v4OnlineJob.record.id);assert(v4OnlineRun.ok,v4OnlineRun.error);assert.equal(v4OnlineRun.run.assessed,1);const v4OnlineActual=B.taskResults(taskId).find(item=>item.jobId===v4OnlineJob.record.id);assert(v4OnlineActual);assert.equal(v4OnlineActual.acceptance,'passed');assert.equal(v4OnlineActual.completion,'completed');assert.equal(v4OnlineActual.policyResult.score,82);assert.equal(v4OnlineActual.metricResults.find(item=>item.metricId==='v4_score').decision,'failed');assert.equal(v4OnlineActual.metricResults.find(item=>item.metricId==='v4_score').subResults,undefined);run('evTaskDetail(taskId)');const v4TaskMarkup=run('AIOpsEvaluationDetails.render("业务任务")');assert(!v4TaskMarkup.includes('V4在线直接加权验收'));assert(!v4TaskMarkup.includes('加权总分：<b>82</b>'));assert(!v4TaskMarkup.includes('本项得分：<b>90</b>'));

// Editing an overall policy or its supplemental context changes new versions, never historical results or runtime snapshots.
const frozenV4=clone(v4WeightedPass.record.snapshot),frozenV4Assessment=clone(v4WeightedPass.assessment),changedV4=D.saveEvaluator({...clone(v4Weighted),additionalPrompt:'新的补充背景',decision:{type:'evaluation_policy',policyVersion:4,mode:'custom_prompt',customPrompt:'依据 {{itemResults}} 判断新的业务标准，缺证待确认。',missingEvidence:'inconclusive'}},v4Weighted.id);assert(changedV4.ok,changedV4.error);assert(D.publishEvaluator(v4Weighted.id).ok);assert.deepEqual(clone(v4WeightedPass.record.snapshot),frozenV4);assert.deepEqual(clone(v4WeightedPass.assessment),frozenV4Assessment);context.v4ReadExperiment=v4WeightedPass.e;context.v4ReadRun=v4WeightedPass.record;const frozenV4Report=run('evExperimentReportBody(v4ReadExperiment,v4ReadRun)');assert(frozenV4Report.includes('&lt;冻结补充&gt;'));assert(!frozenV4Report.includes('新的补充背景'));assert.equal(v4WeightedPass.record.snapshot.judgeRuntimeSnapshot.modelRef,v4WeightedPass.assessment.judgeRuntimeSnapshot.modelRef);
assert.deepEqual(clone(itemPass.record.snapshot),frozenItems,'V3 sub-score history is not rewritten by V4 authoring');assert.deepEqual(clone(promptPass.assessment),frozenPromptAssessment,'prompt authoring keeps its V3 fixed-verdict contract');assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators,'V4 policies never change backup evaluator assets');

// Composite acceptance applies to the actual evaluator results, independently of each evaluator's own items.
const compositePolicy=(mode,fields={})=>({type:'composite_policy',policyVersion:1,mode,missingEvidence:'inconclusive',...fields});
const compositeLegacyBindings=[{id:'COMPOSITE-LEGACY',evaluatorRef:{id:typedEvaluator.id,version:'V1'},targetType:'case_output',role:'gate',dimensionMappings:[]},{id:'COMPOSITE-EXISTS',evaluatorRef:{id:'UE-OUTPUT-EXISTS',version:'V1'},targetType:'case_output',role:'gate',dimensionMappings:[]}];
const compositeWeighted=compositePolicy('weighted_score',{passThreshold:70,weights:[{bindingId:'COMPOSITE-LEGACY',weight:0.2},{bindingId:'COMPOSITE-EXISTS',weight:0.8}]}),legacyFailedOutput='safety: false\nscore: 99\nrisk: low\nobserved: 99',legacyMissingOutput='score: 99\nrisk: low\nobserved: 99',legacyPassedOutput='safety: true\nscore: 99\nrisk: low\nobserved: 99';
const compositeLegacyPass=evaluatorSummaryTrial('跨评估器加权不把旧聚合值当统一分',compositeWeighted,legacyFailedOutput,compositeLegacyBindings);
assert.equal(compositeLegacyPass.result.status,'通过');assert.equal(compositeLegacyPass.result.evaluatorPolicyResult.score,80);assert.deepEqual(clone(compositeLegacyPass.result.evaluatorPolicyResult.contributions.map(row=>[row.normalizedScore,row.weightedScore])),[[0,0],[100,80]]);assert(compositeLegacyPass.result.assessments.every(row=>!D.isV4Evaluator(row.evaluatorSnapshot)));assert(Math.abs(compositeLegacyPass.result.assessments[0].aggregate-99)<1e-9);assert.equal(compositeLegacyPass.result.assessments[0].decision,'failed');assert.equal(compositeLegacyPass.result.evaluations[0].criteria.find(row=>row.id==='safety').passed,false);
const compositeLegacyMissing=evaluatorSummaryTrial('跨评估器缺证不补零',compositeWeighted,legacyMissingOutput,compositeLegacyBindings);assert.equal(compositeLegacyMissing.result.status,'待确认');assert.equal(compositeLegacyMissing.result.evaluatorPolicyResult.score,null);assert.equal(compositeLegacyMissing.result.evaluatorPolicyResult.contributions[0].normalizedScore,null);
const compositeLegacyFixed=evaluatorSummaryTrial('对应旧评估项真实通过',compositeWeighted,legacyPassedOutput,compositeLegacyBindings);assert.equal(compositeLegacyFixed.result.status,'通过');assert.equal(compositeLegacyFixed.result.evaluatorPolicyResult.score,100);
const compositeCount=evaluatorSummaryTrial('新通过数量按评估器计数',compositePolicy('item_count',{summary:{type:'at_least',minPassed:1}}),legacyFailedOutput,compositeLegacyBindings);assert.equal(compositeCount.result.status,'通过');assert.equal(compositeCount.result.evaluatorSummaryResult.passed,1);assert.equal(compositeCount.result.evaluatorPolicyResult.mode,'item_count');
assert.equal(evaluatorSummaryTrial('新全部通过保持单个失败',compositePolicy('item_count',{summary:{type:'all'}}),legacyFailedOutput,compositeLegacyBindings).result.status,'未通过');assert.equal(evaluatorSummaryTrial('新数量上界保留待确认',compositePolicy('item_count',{summary:{type:'all'}}),legacyMissingOutput,compositeLegacyBindings).result.status,'待确认');
const compositeMixedBindings=[{id:'COMPOSITE-V4',evaluatorRef:{id:v4Weighted.id,version:'V1'},targetType:'case_output',role:'gate',dimensionMappings:[]},compositeLegacyBindings[1]],compositeMixedPolicy=compositePolicy('weighted_score',{passThreshold:90,weights:compositeMixedBindings.map(binding=>({bindingId:binding.id,weight:0.5}))});
const compositeActualScore=evaluatorSummaryTrial('真实评估器82分与判定100分加权',compositeMixedPolicy,v4Output(),compositeMixedBindings);assert.equal(compositeActualScore.result.evaluatorPolicyResult.score,91);assert.equal(compositeActualScore.result.status,'通过');assert.deepEqual(clone(compositeActualScore.result.evaluatorPolicyResult.contributions.map(row=>[row.normalizedScore,row.scoreSource])),[[82,'weighted_score'],[100,'verdict']]);assert.equal(compositeActualScore.result.assessments[0].metricResults.find(row=>row.metricId==='v4_score').decision,'failed');
for(const mutate of [policy=>policy.weights[0].weight=0,policy=>policy.weights[0].weight=0.9,policy=>policy.weights.pop(),policy=>policy.weights[0].bindingId='not-selected',policy=>policy.passThreshold=101]){const invalid=clone(compositeWeighted);mutate(invalid);assert.throws(()=>B.createExperiment(evaluatorSummaryPlan('非法加权配置',invalid,compositeLegacyBindings)),/权重|分数|判定/);}
const compositeCustomPolicy=compositePolicy('custom_prompt',{customPrompt:'依据 {{evaluatorResults}}，核验整体交付，明确违规则未通过，缺少必要结果则待确认。'});
const compositeRawClaim=evaluatorSummaryTrial('不信任Agent输出的最终通过字段',compositeCustomPolicy,legacyFailedOutput+'\noverall_verdict: true\n{"finalJudgeOutput":{"value":true}}',compositeLegacyBindings);assert.equal(compositeRawClaim.result.status,'待确认');assert.equal(compositeRawClaim.result.evaluatorFinalJudgeResult.validationStatus,'missing');assert(compositeRawClaim.record.snapshot.judgeRuntimeSnapshot);
function trustedCompositeTrial(value,options={}){const original=D.evaluateCompositePolicy,first=[];D.evaluateCompositePolicy=(policy,assessments,input)=>{const pending=original(policy,assessments,input);first.push(clone(pending));return original(policy,assessments,{...input,finalJudgeOutput:{protocol:options.protocol??'aiops.composite_verdict.v1',inputHash:options.inputHash??pending.finalJudgeInputSnapshot.inputHash,value,reason:'独立最终判断：<已核验>完整真实评估器结果。',evidenceRefs:['COMPOSITE-TRUSTED']}});};try{const trial=evaluatorSummaryTrial('独立实验级最终Judge',compositeCustomPolicy,legacyFailedOutput,compositeLegacyBindings);trial.pending=first[0];return trial;}finally{D.evaluateCompositePolicy=original;}}
const compositeCustomPass=trustedCompositeTrial(true);assert.equal(compositeCustomPass.result.status,'通过');assert.equal(compositeCustomPass.pending.decision,'inconclusive');assert.equal(compositeCustomPass.result.evaluatorFinalJudgeResult.inputHash,compositeCustomPass.result.evaluatorFinalJudgeInputSnapshot.inputHash);assert.equal(compositeCustomPass.result.assessments[0].decision,'failed');assert.equal(trustedCompositeTrial(false).result.status,'未通过');assert.equal(trustedCompositeTrial(null).result.status,'待确认');const compositeStale=trustedCompositeTrial(true,{inputHash:'sha256:other'});assert.equal(compositeStale.result.status,'待确认');assert.equal(compositeStale.result.evaluatorFinalJudgeResult.validationStatus,'invalid');
const customRulesOnly=evaluatorSummaryTrial('纯规则自定义最终判定仍保存评估模型',compositeCustomPolicy,'业务交付已完成',[compositeLegacyBindings[1]]);assert(customRulesOnly.record.snapshot.judgeRuntimeSnapshot);assert.equal(customRulesOnly.result.status,'待确认');

// The case-result pane keeps one hierarchy and no top model snapshot, including the legacy fallback.
context.compositeReadResult=compositeActualScore.result;context.compositeReadExperiment=compositeActualScore.e;context.compositeReadRun=compositeActualScore.record;const compositeCards=run('evExperimentScoringResults(compositeReadResult)');assert(!compositeCards.includes('运行模型快照'));assert(!compositeCards.includes('ub-runtime-summary'));assert(compositeCards.indexOf('ub-final-result')<compositeCards.indexOf('ub-evaluator-result'));assert(compositeCards.includes('总分 / 通过阈值'));assert(compositeCards.includes('91 / 90'));assert(!compositeCards.includes('查看评估项结果'),'evaluation items are visible without an extra disclosure');assert(!compositeCards.includes('查看固定评估标准'));assert(compositeCards.includes('判定记录'));assert(visibleResultMarkup(compositeCards).includes('ub-metric-result'));assert(!compositeCards.includes('details class="ub-result-details" open'));
const legacyCardFallback=clone(success.result);delete legacyCardFallback.assessments;context.legacyCardFallback=legacyCardFallback;assert(!run('evExperimentScoringResults(legacyCardFallback)').includes('运行模型快照'));context.compositeReadResult=compositeCustomPass.result;const compositeCustomCards=run('evExperimentScoringResults(compositeReadResult)');assert(compositeCustomCards.includes('独立最终判断'));assert(compositeCustomCards.includes('&lt;已核验&gt;'));assert(!compositeCustomCards.includes('<已核验>'));assert(!compositeCustomCards.includes('查看最终判定快照'));assert(compositeCustomCards.includes('判定记录'));

// Branch drafts, explicit weights and thresholds survive mode switches and editor submission.
run('evExperimentForm(compositeReadExperiment)');assert(node('overlay').innerHTML.includes('name="evaluatorSummaryMode"'));assert(node('overlay').innerHTML.includes('name="evaluatorSummaryWeight.COMPOSITE-V4"'));assert(!node('overlay').innerHTML.includes('data-ub-summary-note'));
B.evaluatorSummaryChange('threshold','88');B.evaluatorSummaryChange('weight:COMPOSITE-V4','0.3');B.evaluatorSummaryChange('weight:COMPOSITE-EXISTS','0.7');B.evaluatorSummaryChange('mode','custom_prompt');B.evaluatorSummaryChange('prompt','保留原文：真实结果允许组合判断。');B.evaluatorSummaryChange('mode','weighted_score');assert.equal(run('evExperimentEditor.execution.evaluatorSummary.passThreshold'),88);assert.deepEqual(snapshot('evExperimentEditor.execution.evaluatorSummary.weights.map(row=>row.weight)'),[0.3,0.7]);B.evaluatorSummaryChange('mode','custom_prompt');assert.equal(run('evExperimentEditor.execution.evaluatorSummary.customPrompt'),'保留原文：真实结果允许组合判断。');const validBranchDraft=snapshot('evExperimentEditor.execution.evaluatorSummary');assert.equal(B.evaluatorSummaryChange('mode','item_count'),false);assert.deepEqual(snapshot('evExperimentEditor.execution.evaluatorSummary'),validBranchDraft);B.evaluatorSummaryChange('mode','weighted_score');
context.compositeForm={values:{scene:'sales',experimentId:compositeActualScore.e.id,name:compositeActualScore.e.name,agentId:compositeActualScore.e.agentId,version:compositeActualScore.e.version,suiteIds:compositeActualScore.e.suiteIds,concurrency:2,caseRuns:1,fullRuns:1,modelId:'mock-eval-balanced',mcpIds:[],agentRuntimeMode:'inherit',judgeModelRef:D.defaultJudgeRuntime().modelRef,evaluatorSummaryMode:'weighted_score',evaluatorSummaryThreshold:'88','evaluatorSummaryWeight.COMPOSITE-V4':'0.3','evaluatorSummaryWeight.COMPOSITE-EXISTS':'0.7'}};const frozenCompositeRun=clone(compositeActualScore.record);const submittedComposite=run('evSubmitExperiment(compositeForm)');assert(submittedComposite);assert.equal(submittedComposite.snapshot.execution.evaluatorSummary.passThreshold,88);assert.deepEqual(clone(submittedComposite.snapshot.execution.evaluatorSummary.weights.map(row=>row.weight)),[0.3,0.7]);assert.deepEqual(clone(compositeActualScore.record),frozenCompositeRun,'editing a composite policy never rewrites a historical execution');
run('evExperimentForm(compositeReadExperiment)');B.removeBinding(1);assert.equal(run('evExperimentEditor.execution.evaluatorSummary.weights.find(row=>row.bindingId==="COMPOSITE-V4").weight'),0.3);context.compositeForm.values['evaluatorSummaryWeight.COMPOSITE-V4']='0.3';assert.equal(run('evSubmitExperiment(compositeForm)'),false,'removing a binding never renormalizes remaining weights');run('evCloseModal()');

// Even entirely old evaluator engines require scope-specific issue verification under a new composite policy.
context.compositeLegacyExperiment=compositeLegacyPass.e;context.compositeLegacyRun=compositeLegacyPass.record;context.compositeLegacyResult=compositeLegacyPass.result;const legacyFindings=run('evExperimentDetectIssues(compositeLegacyExperiment,compositeLegacyRun)'),safetyName=typedEvaluator.metrics.find(row=>row.id==='safety').name;context.compositeLegacyFinding=legacyFindings.find(row=>row.rule===safetyName);assert(context.compositeLegacyFinding);const legacyIssueDefinition=run('evExperimentIssueIdentity(compositeLegacyExperiment,compositeLegacyRun,compositeLegacyFinding,compositeLegacyResult)');assert.equal(legacyIssueDefinition.judgment.criterion.id,'safety');
const compositeScopedIssue={id:'COMPOSITE-LEGACY-SCOPED',caseId:compositeLegacyPass.result.caseId,status:'待验证',definition:clone(legacyIssueDefinition),occurrences:[{runId:compositeLegacyPass.record.id,resultId:compositeLegacyPass.result.id}],verifications:[],history:[]};(compositeLegacyPass.e.issueLedger||(compositeLegacyPass.e.issueLedger=[])).push(compositeScopedIssue);
for(const [index,entry] of [{source:compositeLegacyPass,status:'验证未通过'},{source:compositeLegacyMissing,status:'验证未完成'},{source:compositeLegacyFixed,status:'验证通过'}].entries()){const validation={...clone(entry.source.record),id:'COMPOSITE-LEGACY-VALIDATION-'+index,experimentId:compositeLegacyPass.e.id,kind:'validation',status:'已完成',validationIssueId:compositeScopedIssue.id,sourceRecordId:compositeLegacyPass.record.id,results:[clone(entry.source.result)]};context.compositeValidation=validation;const before=clone(validation);run('evExperimentIssueSyncVerification(compositeLegacyExperiment,compositeValidation)');assert.equal(compositeScopedIssue.latestVerification.status,entry.status);assert.deepEqual(clone(validation),before);}
assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators,'composite acceptance and new result presentation never change backup assets');

// Compact result summaries fold long evidence IDs and keep the heading aligned with the actual final policy.
function compactResultRead(trial){context.compactReadResult=trial.result;return run('evExperimentScoringResults(compactReadResult)');}
function resultBlocks(markup,tag,className){
  const pattern=new RegExp('<\\/?'+tag+'\\b[^>]*>','g'),blocks=[];let depth=0,start=-1,match;
  while((match=pattern.exec(markup))){const closing=match[0].startsWith('</');if(!closing){if(!depth){const classes=/\bclass="([^"]*)"/.exec(match[0]);if(!classes?.[1].split(/\s+/).includes(className))continue;start=match.index;}depth++;}else if(depth&&!--depth){blocks.push(markup.slice(start,pattern.lastIndex));start=-1;}}
  return blocks;
}
function visibleResultMarkup(markup){
  const pattern=/<\/?details\b[^>]*>/g;let depth=0,cursor=0,visible='',match;
  while((match=pattern.exec(markup))){if(!match[0].startsWith('</')){if(!depth)visible+=markup.slice(cursor,match.index);depth++;}else if(depth&&!--depth)cursor=pattern.lastIndex;}
  return visible+(depth?'':markup.slice(cursor));
}
function compactFinalRead(trial){return resultBlocks(compactResultRead(trial),'section','ub-final-result')[0]||'';}
const compactWeightedFinal=compactFinalRead(compositeActualScore);assert(compactWeightedFinal.includes('<summary>判定记录</summary>'));assert(!visibleResultMarkup(compactWeightedFinal).includes('class="ub-result-reason"'));assert(compactWeightedFinal.includes('91 / 90'));assert(compactWeightedFinal.includes('82 × 0.5'));assert(compactWeightedFinal.includes('通过阈值 90 分'));
assert(!visibleResultMarkup(compactFinalRead(compositeCount)).includes('class="ub-result-reason"'));const compactPendingFinal=compactFinalRead(compositeLegacyMissing);assert(compactPendingFinal.includes('保留待确认'));assert(compactPendingFinal.includes('尚不能形成可靠的总分'));const compactCustomFinal=compactFinalRead(compositeCustomPass);assert(compactCustomFinal.includes('独立最终判断'));assert(compactCustomFinal.includes('&lt;已核验&gt;'));assert(compactCustomFinal.includes('<summary>判定记录</summary>'));assert(!compactCustomFinal.includes(compositeCustomPass.result.evaluatorFinalJudgeInputSnapshot.inputHash));
for(const [trial,expected] of [[compositeActualScore,'加权 91 分 / 阈值 90'],[compositeCustomPass,'自定义判定'],[compositeCount,'1 / 2 个评估器通过 · 至少 1 个'],[compositeLegacyMissing,'加权 — 分 / 阈值 70']]){context.compactHeadingTrial=trial;const heading=run('evExperimentResultHeading({current:compactHeadingTrial.e,run:compactHeadingTrial.record,experiment:evExperimentRunContext(compactHeadingTrial.e,compactHeadingTrial.record),results:compactHeadingTrial.record.results,result:compactHeadingTrial.result,archived:false})');assert(heading.includes('<small>'+expected+'</small>'));if(trial===compositeLegacyMissing){assert(heading.includes('<strong>待确认</strong>'));assert(!heading.includes('is-success'));}}

// Visible result cards retain real decisions and every type's passing rule, independently of folded standards.
function metricCard(trial,id){return resultBlocks(compactResultRead(trial),'article','ub-metric-result').find(markup=>markup.includes('data-metric-id="'+id+'"'))||'';}
function optionRows(markup){return resultBlocks(markup,'div','ub-item-rule-option');}
function optionRow(markup,value){return optionRows(markup).find(row=>row.includes('data-value="'+value+'"'))||'';}
for(const [trial,mode] of [[compositeLegacyPass,'评分'],[compositeCount,'历史判定'],[compositeCustomPass,'自定义'],[compositeLegacyMissing,'评分']]){
 const final=compactFinalRead(trial),visible=visibleResultMarkup(final);assert(final.startsWith('<section class="ub-final-result" data-decision="'+trial.result.acceptance+'"'));assert(visible.includes('最终判定'));assert(visible.includes('ub-final-mode">'+mode));assert(!visible.includes('COMPOSITE-TRUSTED'),'long final evidence stays available inside folded details');
 const outcomes=resultBlocks(visible,'div','ub-final-evaluator');assert.equal(outcomes.length,trial.result.assessments.length);
 for(const assessment of trial.result.assessments){const outcome=outcomes.find(markup=>markup.includes('data-binding-id="'+assessment.bindingId+'"'));assert(outcome);assert(outcome.includes('data-decision="'+assessment.decision+'"'),'the final summary retains each evaluator conclusion even when a different overall policy passes');assert(outcome.includes(assessment.evaluatorRef.version));}
}
const legacyPassingFinal=visibleResultMarkup(compactFinalRead(compositeLegacyPass));assert(legacyPassingFinal.includes('data-decision="failed"'),'an allowed evaluator failure remains visible under the passing final result');
for(const trial of [v4WeightedPass,v4WeightedInvalid,v4WeightedMissing,promptPass,observed]){
 const markup=compactResultRead(trial),cards=resultBlocks(markup,'article','ub-evaluator-result');assert.equal(cards.length,trial.result.assessments.length);
 for(const card of cards){const header=/<header\b[^>]*>([\s\S]*?)<\/header>/.exec(card)?.[1]||'';assert(header.includes('ub-result-version'));assert(header.includes('ub-result-verdict'));assert(header.includes('data-decision="'));assert(header.includes('V1'),'the evaluator version is visible beside its result');}
 assert(!markup.includes('查看评估项结果'));assert(!markup.includes('运行模型快照'));
}
const categoryCard=visibleResultMarkup(metricCard(v4WeightedPass,'v4_category'));assert.equal(optionRows(categoryCard).length,2);assert(optionRow(categoryCard,'ok').includes('data-selected="true" data-pass="true"'));assert(optionRow(categoryCard,'ok').includes('合规交付'));assert(optionRow(categoryCard,'risk').includes('data-selected="false" data-pass="false"'));assert(optionRow(categoryCard,'risk').includes('风险交付'));assert.equal(optionRows(categoryCard).filter(row=>row.includes('data-selected="true"')).length,1);
const failedCategory=visibleResultMarkup(metricCard(v4WeightedFail,'v4_category'));assert(failedCategory.includes('data-decision="failed"'));assert(optionRow(failedCategory,'risk').includes('data-selected="true" data-pass="false"'));
const falsePassingCard=visibleResultMarkup(metricCard(itemPass,'negative_expected'));assert(falsePassingCard.startsWith('<article class="ub-metric-result" data-metric-id="negative_expected" data-decision="passed"'));assert.equal(optionRows(falsePassingCard).length,2);assert(optionRow(falsePassingCard,false).includes('data-selected="true" data-pass="true"'));assert(optionRow(falsePassingCard,true).includes('data-selected="false" data-pass="false"'),'boolean false passes according to its frozen rule, without treating true as the default');
const zeroCard=visibleResultMarkup(metricCard(v4Zero,'v4_score'));assert(zeroCard.includes('本项得分：<b>0</b> / 100'));assert(zeroCard.includes('本项阈值：95'));assert(zeroCard.includes('data-decision="failed"'));
const invalidCard=visibleResultMarkup(metricCard(v4WeightedInvalid,'v4_score'));assert(invalidCard.includes('data-decision="inconclusive"'));assert(invalidCard.includes('本项得分：<b>101</b>'));assert(invalidCard.includes('原始分数无效'));const missingCard=visibleResultMarkup(metricCard(v4WeightedMissing,'v4_score'));assert(missingCard.includes('data-decision="inconclusive"'));assert(missingCard.includes('本项得分：<b>—</b>'));assert(!missingCard.includes('本项得分：<b>0</b>'));
const textCard=visibleResultMarkup(metricCard(v4WeightedPass,'v4_note'));assert(textCard.includes('data-decision="not_applicable"'));assert(textCard.includes('仅观察'));assert(textCard.includes('保留观察事实'));assert(!textCard.includes('ub-item-weight'));assert.equal(optionRows(textCard).length,0);assert(compactFinalRead(textItemOnly).startsWith('<section class="ub-final-result" data-decision="not_applicable"'));
const promptCard=resultBlocks(compactResultRead(promptPass),'article','ub-evaluator-result')[0],visiblePrompt=visibleResultMarkup(promptCard);assert(visiblePrompt.includes('提示词配置 · 整体判断'));assert(promptCard.includes('<summary>判定记录</summary>'));assert(promptCard.includes('已取得完整交付证据'));assert(!promptCard.includes('ub-metric-result'),'prompt evaluators do not fabricate item scores or hidden compatibility verdicts');assert(!visiblePrompt.includes('本项得分'));assert.equal(promptPass.assessment.evaluatorSnapshot.method.prompt,originalPrompt);assert(!promptCard.includes('新版提示词：'));
const historicalCard=compactResultRead(v4WeightedPass);assert(visibleResultMarkup(metricCard(v4WeightedPass,'v4_score')).includes('本项阈值：95'));assert.equal(v4WeightedPass.assessment.evaluatorSnapshot.additionalPrompt,v4Draft.additionalPrompt);assert(!historicalCard.includes('新的补充背景'));assert.equal(v4WeightedPass.assessment.evaluatorSnapshot.version,'V1');assert.equal(D.evaluator(v4Weighted.id).version,'V2');assert.deepEqual(clone(v4WeightedPass.record.snapshot),frozenV4);assert.deepEqual(clone(v4WeightedPass.assessment),frozenV4Assessment);
const observedCard=resultBlocks(compactResultRead(observed),'article','ub-evaluator-result')[0];assert(observedCard.startsWith('<article class="ub-evaluator-result" data-binding-id="'+observe.id+'" data-decision="failed"'));assert(visibleResultMarkup(observedCard).includes('仅观察'),'observation participation does not hide the actual evaluator failure');

// Real factory runs share the new result layout through a read-only adapter, without reevaluating history.
const legacyFactory=run('evExperimentStore("sales").experiments.find(item=>item.id==="SAL-EXP-001")');context.legacyFactory=legacyFactory;run('studio.scene="sales";evExperimentUI().id=legacyFactory.id;evExperimentSelectRun(legacyFactory.runs[0].id)');const legacyFactoryBefore=clone(legacyFactory),legacyBackupsBefore=snapshot('evEvaluatorStore().evaluators');
for(const status of ['通过','未通过']){
 const result=legacyFactory.runs[0].results.find(item=>item.status===status);assert(result&&!result.assessments&&result.evaluations.length,'the regression starts with an actual old seed result');context.legacySeedResult=result;
 const markup=run('evExperimentScoringResults(legacySeedResult)'),final=resultBlocks(markup,'section','ub-final-result')[0],cards=resultBlocks(markup,'article','ub-evaluator-result'),expected=status==='通过'?'passed':'failed';assert(final.startsWith('<section class="ub-final-result" data-decision="'+expected+'"'));assert(visibleResultMarkup(final).includes('ub-final-mode">历史判定'));assert(!visibleResultMarkup(final).includes('总分 / 通过阈值'));assert.equal(cards.length,result.evaluations.length);assert(!markup.includes('ev-result-evaluation-head'));assert(markup.includes('evExperimentAnnotateResult('),'existing review and annotation actions stay available');
 result.evaluations.forEach((evaluation,index)=>{
  const card=cards[index],decision=evaluation.passed===true?'passed':evaluation.passed===false?'failed':'inconclusive';assert(card.startsWith('<article class="ub-evaluator-result" data-binding-id="legacy-binding-'+index+'" data-decision="'+decision+'"'));assert(card.includes(evaluation.version));const items=resultBlocks(card,'article','ub-metric-result');assert.equal(items.length,evaluation.criteria.length);
  evaluation.criteria.forEach((criterion,itemIndex)=>{const item=items[itemIndex],criterionDecision=criterion.passed===true?'passed':criterion.passed===false?'failed':'inconclusive';assert(item.includes('data-decision="'+criterionDecision+'"'));assert(visibleResultMarkup(item).includes('<strong>'+criterion.score+'</strong>'),'the displayed score comes from the recorded criterion');assert.equal(result.evaluations[index].criteria[itemIndex].description,criterion.description,'the old run retains its frozen criterion standard in immutable evidence');assert(visibleResultMarkup(item).includes('≥ '+criterion.passScore),'the displayed threshold comes from the original passScore');});
 });
}
assert.deepEqual(clone(legacyFactory),legacyFactoryBefore,'rendering historical results neither saves an adapter nor changes the original run or result');assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),legacyBackupsBefore,'legacy layout never rewrites backup evaluator definitions');
const missingLegacy=clone(legacyFactory);missingLegacy.id='LEGACY-MISSING-FROZEN-STANDARDS';missingLegacy.runs=[clone(legacyFactory.runs[0])];missingLegacy.runs[0].id=missingLegacy.id+'-RUN';missingLegacy.runs[0].experimentId=missingLegacy.id;missingLegacy.runs[0].snapshot.evaluators=[];missingLegacy.snapshot=clone(missingLegacy.runs[0].snapshot);missingLegacy.runs[0].results=missingLegacy.runs[0].results.slice(0,1);missingLegacy.runs[0].results[0].id=missingLegacy.runs[0].id+'-CASE';missingLegacy.runs[0].results[0].evaluations.forEach(evaluation=>evaluation.criteria.forEach(criterion=>{delete criterion.description;delete criterion.standard;}));context.missingLegacy=missingLegacy;run('evExperimentStore("sales").experiments.push(missingLegacy);evExperimentUI().id=missingLegacy.id;evExperimentSelectRun(missingLegacy.runs[0].id)');const missingLegacyBefore=clone(missingLegacy),legacyLookup=D.evaluator;let currentLegacyLookups=0;
try{D.evaluator=()=>{currentLegacyLookups++;return {name:'当前库不应使用的标准',metrics:[{id:'new-current',name:'当前库不应使用的标准'}]};};context.missingLegacyResult=missingLegacy.runs[0].results[0];const markup=run('evExperimentScoringResults(missingLegacyResult)');assert(markup.includes('判定记录'));assert(!markup.includes('当前库不应使用的标准'));assert.equal(currentLegacyLookups,0,'a missing frozen standard never falls back to the current evaluator library');}finally{D.evaluator=legacyLookup;}
assert.deepEqual(clone(missingLegacy),missingLegacyBefore);assert.deepEqual(clone(legacyFactory),legacyFactoryBefore);assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators);
const fixedLegacy=clone(legacyFactory);fixedLegacy.id='LEGACY-FIXED-CRITERIA-FALLBACK';fixedLegacy.runs=[clone(legacyFactory.runs[0])];fixedLegacy.runs[0].id=fixedLegacy.id+'-RUN';fixedLegacy.runs[0].experimentId=fixedLegacy.id;fixedLegacy.runs[0].results=fixedLegacy.runs[0].results.slice(0,1);fixedLegacy.runs[0].results[0].id=fixedLegacy.runs[0].id+'-CASE';const recordedFixedCriteria=clone(fixedLegacy.runs[0].results[0].evaluations[0].criteria);assert(recordedFixedCriteria.length>1&&recordedFixedCriteria.every(item=>!item.id),'the factory fixture has several distinct unnamed-ID criteria');fixedLegacy.runs[0].results[0].evaluations.forEach(evaluation=>evaluation.criteria.forEach(criterion=>{delete criterion.description;delete criterion.standard;delete criterion.passScore;delete criterion.weight;}));context.fixedLegacy=fixedLegacy;run('evExperimentStore("sales").experiments.push(fixedLegacy);evExperimentUI().id=fixedLegacy.id;evExperimentSelectRun(fixedLegacy.runs[0].id)');const fixedLegacyBefore=clone(fixedLegacy);context.fixedLegacyResult=fixedLegacy.runs[0].results[0];const fixedLegacyMarkup=run('evExperimentScoringResults(fixedLegacyResult)');
for(const criterion of recordedFixedCriteria){assert(fixedLegacyMarkup.includes(criterion.name+'：本次结果为 '));assert(fixedLegacyMarkup.includes('通过条件为“≥ '+criterion.passScore+'”'),'each ID-less criterion uses its own name-matched frozen threshold');}
assert.deepEqual(clone(fixedLegacy),fixedLegacyBefore,'reading fallback criteria never writes missing data into historical results');
for(const status of ['待运行','运行中','已跳过','已停用']){
 const empty=clone(legacyFactory.runs[0].results[0]);empty.status=status;empty.evaluations=[];delete empty.acceptance;context.emptyLegacyResult=empty;const before=clone(empty),markup=run('evExperimentScoringResults(emptyLegacyResult)');assert(markup.includes('暂无评估结果'));assert(markup.includes('0 个评估器'));assert(!markup.includes('ub-final-result'),'a legacy '+status+' result without evaluations has no fabricated final decision');assert(!markup.includes('ub-metric-result'));assert(!markup.includes('待确认'));assert.deepEqual(clone(empty),before,'the historical empty state stays read-only');
}
assert.deepEqual(clone(legacyFactory),legacyFactoryBefore);assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators);

// Actual authoring accepts only scoring/custom policies; historical imports remain explicit and separate.
const countAuthorDraft={...clone(v4Draft),name:'新建数量判定必须被拒绝',decision:{type:'evaluation_policy',policyVersion:4,mode:'item_count',summary:{type:'at_least',minPassed:2},missingEvidence:'inconclusive'}},beforeCountSave=storage.getItem(D.storageKey),countAuthorRejected=D.saveEvaluator(countAuthorDraft);assert.equal(countAuthorRejected.ok,false);assert(countAuthorRejected.error.includes('只支持评分或自定义'));assert.equal(storage.getItem(D.storageKey),beforeCountSave,'a rejected author policy is atomic');
const historicalDraft=D.saveEvaluator(countAuthorDraft,undefined,{historicalImport:true});assert(historicalDraft.ok,historicalDraft.error);const beforeCountPublish=storage.getItem(D.storageKey),countPublishRejected=D.publishEvaluator(historicalDraft.record.id);assert.equal(countPublishRejected.ok,false);assert(countPublishRejected.error.includes('只支持评分或自定义'));assert.equal(storage.getItem(D.storageKey),beforeCountPublish);assert(D.publishEvaluator(historicalDraft.record.id,{historicalImport:true}).ok,'only explicit historical imports can publish a preserved count policy');
const weightedAuthor=D.saveEvaluator({...clone(v4Draft),name:'真实新建评分评估器'});assert(weightedAuthor.ok,weightedAuthor.error);assert(D.publishEvaluator(weightedAuthor.record.id).ok);const weightedAuthorV1=clone(D.evaluator(weightedAuthor.record.id,'V1')),customAuthor=D.saveEvaluator({...clone(weightedAuthorV1),decision:{type:'evaluation_policy',policyVersion:4,mode:'custom_prompt',customPrompt:'依据 {{itemResults}} 中真实结果、理由和证据判断整体交付；证据不足时待确认。',missingEvidence:'inconclusive'}},weightedAuthor.record.id);assert(customAuthor.ok,customAuthor.error);assert(D.publishEvaluator(weightedAuthor.record.id).ok);assert.equal(D.evaluator(weightedAuthor.record.id,'V2').decision.mode,'custom_prompt');assert.deepEqual(clone(D.evaluator(weightedAuthor.record.id,'V1')),weightedAuthorV1);
const modernJobBinding={id:'AUTHOR-MODERN-JOB',evaluatorRef:{id:weightedAuthor.record.id,version:'V1'},targetType:'task_execution',role:'gate',dimensionMappings:[]},modernJobDraft={...clone(onlineJob.record),id:undefined,name:'真实新建任务两模式验证',bindings:[modernJobBinding],passPolicy:D.defaultCompositePolicy('weighted_score',[modernJobBinding])},beforeCountJob=storage.getItem(D.storageKey),countJobRejected=D.saveJob({...clone(modernJobDraft),passPolicy:{type:'composite_policy',policyVersion:1,mode:'item_count',summary:{type:'all'},missingEvidence:'inconclusive'}});assert.equal(countJobRejected.ok,false);assert(countJobRejected.error.includes('只支持评分或自定义'));assert.equal(storage.getItem(D.storageKey),beforeCountJob);const modernJob=D.saveJob(modernJobDraft);assert(modernJob.ok,modernJob.error);assert.equal(modernJob.record.passPolicy.passThreshold,80);assert.deepEqual(clone(modernJob.record.passPolicy.weights),[{bindingId:modernJobBinding.id,weight:1}]);const customJob=D.saveJob({...clone(modernJob.record),passPolicy:D.defaultCompositePolicy('custom_prompt'),name:'真实任务自定义判定',description:'依据真实结果判断'} ,modernJob.record.id);assert.equal(customJob.ok,false,'an empty custom rule cannot be saved');
const validCustomJob=D.saveJob({...clone(modernJob.record),passPolicy:{...D.defaultCompositePolicy('custom_prompt'),customPrompt:'根据 {{evaluatorResults}} 中明确的真实业务结论判定，必要结果缺失时待确认。'}},modernJob.record.id);assert(validCustomJob.ok,validCustomJob.error);assert.equal(validCustomJob.record.passPolicy.mode,'custom_prompt');assert.equal(modernJob.record.passPolicy.mode,'weighted_score','saving a custom branch does not mutate the earlier returned weighted configuration');
run('evExperimentForm()');assert.equal(run('evExperimentEditor.execution.evaluatorSummary.mode'),'weighted_score');assert.equal(run('evExperimentEditor.execution.evaluatorSummary.passThreshold'),80);const modernModes=/<select name="evaluatorSummaryMode"[^>]*>([\s\S]*?)<\/select>/.exec(node('overlay').innerHTML)?.[1]||'';assert.deepEqual([...modernModes.matchAll(/<option value="([^"]+)"/g)].map(match=>match[1]),['weighted_score','custom_prompt']);assert(!node('overlay').innerHTML.includes('evaluatorSummaryMinPassed'));run('evCloseModal()');
const observeAuthorPlan={...plan,name:'显式观察不升级为判定门槛',unifiedBindings:[clone(automaticBinding),{...clone(failingBinding),role:'observe'}],execution:{...plan.execution,evaluationPolicy:'all_selected',evaluatorSummary:{type:'composite_policy',policyVersion:1,mode:'weighted_score',passThreshold:80,weights:[{bindingId:automaticBinding.id,weight:1}],missingEvidence:'inconclusive'}}},observeAuthor=B.createExperiment(observeAuthorPlan);context.observeAuthor=observeAuthor;run('evExperimentForm(observeAuthor)');context.observeAuthorForm={values:{scene:'sales',experimentId:observeAuthor.id,name:observeAuthor.name,agentId:observeAuthor.agentId,version:observeAuthor.version,suiteIds:observeAuthor.suiteIds,concurrency:2,caseRuns:1,fullRuns:1,modelId:'mock-eval-balanced',mcpIds:[],evaluatorSummaryMode:'weighted_score',evaluatorSummaryThreshold:'80',['evaluatorSummaryWeight.'+automaticBinding.id]:'1'}};assert(run('evSubmitExperiment(observeAuthorForm)'));assert.equal(observeAuthor.snapshot.unifiedEvaluation.bindings.find(binding=>binding.id===failingBinding.id).role,'observe');context.observeAuthorRun=run('evExperimentNewExecution(observeAuthor,observeAuthor.id+"-AUTHOR",1,observeAuthor.snapshot,{kind:"full",status:"运行中",supplements:[]})');run('observeAuthor.runs.unshift(observeAuthorRun);observeAuthorRun.results=evExperimentResultRows(observeAuthor,observeAuthorRun.id);evExperimentCompleteResult(observeAuthor,observeAuthorRun,0,"通过")');const observedFailure=context.observeAuthorRun.results[0].assessments.find(assessment=>assessment.bindingId===failingBinding.id);assert.equal(observedFailure.role,'observe');assert.equal(observedFailure.decision,'failed');assert.equal(context.observeAuthorRun.results[0].status,'通过');assert.equal(context.observeAuthorRun.results[0].evaluatorPolicyResult.contributions.length,1);

// Every final/evaluator card has one plain-language record, with no nested disclosures or JSON snapshots.
for(const trial of [compositeActualScore,compositeCustomPass,compositeLegacyMissing,compositeCount,v4WeightedPass,v4WeightedInvalid,v4CustomPass,promptPass,itemPass,missingSub]){
 const markup=compactResultRead(trial),sections=[...resultBlocks(markup,'section','ub-final-result'),...resultBlocks(markup,'article','ub-evaluator-result')];assert.equal(sections.length,1+trial.result.assessments.length);
 for(const section of sections){const records=resultBlocks(section,'details','ub-decision-record');assert.equal(records.length,1);assert.equal((section.match(/<details\b/g)||[]).length,1,'each card has exactly one disclosure');assert(records[0].includes('<summary>判定记录</summary>'));assert.equal((records[0].match(/<details\b/g)||[]).length,1,'records never contain nested disclosures');assert(!/<pre\b|<table\b|inputHash|sha256:|最终评判输入快照|查看固定评估标准/.test(section),'only readable decision explanations appear in result cards');assert(!visibleResultMarkup(section).includes('ub-result-reason'),'decision explanations stay folded by default');}
 for(const item of resultBlocks(markup,'article','ub-metric-result'))assert(!item.includes('<details'),'item values and their pass rules remain directly visible');
}
assert.deepEqual(clone(v4WeightedPass.record.snapshot),frozenV4);assert.deepEqual(clone(v4WeightedPass.assessment),frozenV4Assessment);assert.deepEqual(clone(editableSummary.record),editableHistoricalRun);assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators);

// A failed explicit observer can map to a task dimension without creating a business-quality failure.
const observeMappingTask=B.taskDefinition(taskId),observeMappingDimension=observeMappingTask.dimensions[0],observeRecommendation={...clone(failingBinding),role:'observe',taskRef:{id:taskId,version:observeMappingTask.version},dimensionMappings:[{dimensionId:observeMappingDimension.id,metricId:'readable_output'}]};B.setTaskBindings(taskId,[observeRecommendation]);B.repinSuite('TEST-SUITE');
const mappedObserver=policyTrial('观察失败不产生业务维度问题',[clone(automaticBinding),{...clone(failingBinding),role:'observe'}],{evaluatorSummary:{type:'composite_policy',policyVersion:1,mode:'weighted_score',passThreshold:80,weights:[{bindingId:automaticBinding.id,weight:1}],missingEvidence:'inconclusive'}}),mappedObserverAssessment=mappedObserver.result.assessments.find(assessment=>assessment.bindingId===failingBinding.id),mappedObserverBinding=mappedObserver.record.snapshot.unifiedEvaluation.bindings.find(binding=>binding.id===failingBinding.id);assert.equal(mappedObserver.result.status,'通过');assert.equal(mappedObserverAssessment.role,'observe');assert.equal(mappedObserverAssessment.decision,'failed');assert(mappedObserverBinding.businessMappings.some(mapping=>mapping.taskRef.id===taskId&&mapping.dimensionMappings.some(item=>item.dimensionId===observeMappingDimension.id&&item.metricId==='readable_output')),'the fixture contains an actual recommendation-backed business mapping');assert(mappedObserver.result.dimensions.every(dimension=>dimension.decision!=='failed'&&dimension.passed!==false),'observe failure never becomes a failed business dimension');assert(!mappedObserver.result.dimensions.some(dimension=>dimension.assessmentId===mappedObserverAssessment.id));
const mappedObserverBefore=clone(mappedObserver.record);context.mappedObserverExperiment=mappedObserver.e;context.mappedObserverRecord=mappedObserver.record;const observerFindings=run('evExperimentDetectIssues(mappedObserverExperiment,mappedObserverRecord)');assert.equal(observerFindings.length,0,'analysis creates no evaluator, criterion or dimension issue from the observer');const mappedObserverCard=resultBlocks(compactResultRead(mappedObserver),'article','ub-evaluator-result').find(card=>card.includes('data-binding-id="'+failingBinding.id+'"'));assert(mappedObserverCard.includes('data-decision="failed"'));assert(visibleResultMarkup(mappedObserverCard).includes('仅观察'));assert.deepEqual(clone(mappedObserver.record),mappedObserverBefore);
const historicalObserver=clone(mappedObserver.record),oldDimension={...(historicalObserver.results[0].dimensions.find(dimension=>dimension.dimensionId===observeMappingDimension.id)||{}),taskId,taskName:observeMappingTask.name,dimensionId:observeMappingDimension.id,name:observeMappingDimension.name,metricId:'readable_output',assessmentId:mappedObserverAssessment.id,evaluatorRef:clone(mappedObserverAssessment.evaluatorRef),value:false,decision:'failed',passed:false,reason:'旧运行保留的观察来源失败'};historicalObserver.results[0].dimensions=[oldDimension];const historicalObserverBefore=clone(historicalObserver);context.historicalObserverRecord=historicalObserver;assert.equal(run('evExperimentDetectIssues(mappedObserverExperiment,historicalObserverRecord)').length,0,'an old observed dimension is excluded from new findings by its original assessment role');assert.deepEqual(clone(historicalObserver),historicalObserverBefore,'filtering historical findings never rewrites the preserved failure evidence');assert.deepEqual(clone(mappedObserver.record),mappedObserverBefore);assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators);

// Decide overall acceptance before selecting evaluators; scoring weights belong to their own evaluator cards.
function assertInlineWeights(markup,bindings,mode){
 const summary=resultBlocks(markup,'div','ub-evaluator-summary')[0];if(summary){assert(markup.indexOf('id="ub-evaluator-summary"')<markup.indexOf('id="ub-bindings"'),'the pass policy appears before the evaluator cards');assert(!summary.includes('evaluatorSummaryWeight.'));}assert(!markup.includes('ub-composite-weights'),'there is no separate evaluator weight list');
 const cards=resultBlocks(markup,'section','ont-execution');assert.equal(cards.length,bindings.length);
 for(const binding of bindings){const card=cards.find(item=>item.includes('data-ub-binding-id="'+binding.id+'"')),eligible=mode==='weighted_score'&&binding.role==='gate'&&D.hasDecision(D.evaluator(binding.evaluatorRef.id,binding.evaluatorRef.version));assert(card,'each configured evaluator has a stable row');assert.equal((card.match(/name="evaluatorSummaryWeight\./g)||[]).length,eligible?1:0);if(eligible){assert(card.includes('name="evaluatorSummaryWeight.'+binding.id+'"'));assert(card.includes('ub-experiment-evaluator-row has-weight'));assert.equal((markup.match(new RegExp('name="evaluatorSummaryWeight\\.'+binding.id+'"','g'))||[]).length,1,'each weight input occurs once in its own card');}else assert(!card.includes(' has-weight'));}
}
run('evExperimentForm()');const createWeightBindings=snapshot('evExperimentEditor.unifiedBindings'),createWeightPolicy=snapshot('evExperimentEditor.execution.evaluatorSummary');assertInlineWeights(node('overlay').innerHTML,createWeightBindings,'weighted_score');assert.equal(createWeightPolicy.passThreshold,80);B.evaluatorSummaryChange('mode','custom_prompt');assertInlineWeights(node('ub-bindings').outerHTML,createWeightBindings,'custom_prompt');B.evaluatorSummaryChange('prompt','新建草稿：依据真实结果判断，缺证待确认。');B.evaluatorSummaryChange('mode','weighted_score');assertInlineWeights(node('ub-bindings').outerHTML,createWeightBindings,'weighted_score');assert.deepEqual(snapshot('evExperimentEditor.execution.evaluatorSummary'),createWeightPolicy,'switching the new form returns the initial weights without recomputing them');B.evaluatorSummaryChange('mode','custom_prompt');assert.equal(run('evExperimentEditor.execution.evaluatorSummary.customPrompt'),'新建草稿：依据真实结果判断，缺证待确认。');run('evCloseModal()');
run('evExperimentPrepareRuns(observeAuthor);evExperimentForm(observeAuthor)');const editWeightBindings=snapshot('evExperimentEditor.unifiedBindings'),editWeightHistory=clone(observeAuthor.runs),editWeightSnapshot=clone(observeAuthor.snapshot);assertInlineWeights(node('overlay').innerHTML,editWeightBindings,'weighted_score');assert.equal(editWeightBindings.filter(binding=>binding.role==='observe').length,1);B.evaluatorSummaryChange('threshold','86');B.evaluatorSummaryChange('weight:'+automaticBinding.id,'0.4');const userWeightDraft=snapshot('evExperimentEditor.execution.evaluatorSummary');B.evaluatorSummaryChange('mode','custom_prompt');assertInlineWeights(node('ub-bindings').outerHTML,editWeightBindings,'custom_prompt');B.evaluatorSummaryChange('prompt','编辑草稿保留：按真实评估器结果最终判断。');B.evaluatorSummaryChange('mode','weighted_score');assertInlineWeights(node('ub-bindings').outerHTML,editWeightBindings,'weighted_score');assert.deepEqual(snapshot('evExperimentEditor.execution.evaluatorSummary'),userWeightDraft,'even an invalid partial weight draft is not normalized when mode changes');const restoredWeight=/<input\b[^>]*name="evaluatorSummaryWeight.AUTO-ALL"[^>]*>/.exec(node('ub-bindings').outerHTML)?.[0]||'';assert(restoredWeight.includes('value="0.4"'));assert(node('ub-evaluator-summary').outerHTML.includes('value="86"'));B.evaluatorSummaryChange('mode','custom_prompt');assert.equal(run('evExperimentEditor.execution.evaluatorSummary.customPrompt'),'编辑草稿保留：按真实评估器结果最终判断。');run('evCloseModal()');assert.deepEqual(clone(observeAuthor.snapshot),editWeightSnapshot);assert.deepEqual(clone(observeAuthor.runs),editWeightHistory,'layout and branch changes never modify historical runs');
assert(B.editTaskBindings(taskId));assert(!node('overlay').innerHTML.includes('evaluatorSummaryWeight.'),'business-task recommendation cards never acquire experiment weights');run('evCloseModal()');assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators);

// Current prompt authorship has one overall verdict, even when its compatibility result contains a summary.
const currentPromptBinding={id:'CURRENT-PROMPT-OVERALL',evaluatorRef:{id:promptV2.id,version:'V2'},targetType:'case_output',role:'gate',dimensionMappings:[]},currentPromptTrial=evaluatorSummaryTrial('当前提示词结果不误标为历史',compositePolicy('weighted_score',{passThreshold:80,weights:[{bindingId:currentPromptBinding.id,weight:1}]}),promptOutput(true,'已有本次真实交付证据'),[currentPromptBinding]);assert.equal(currentPromptTrial.result.status,'通过');assert(currentPromptTrial.result.assessments[0].summaryResult,'the regression includes the real prompt compatibility summary that must not be labeled historical');const currentPromptCards=compactResultRead(currentPromptTrial);assert(currentPromptCards.includes('提示词配置 · 整体判断'));assert(!currentPromptCards.includes('历史评估结果'));assert(!currentPromptCards.includes('历史判定'));assert(!currentPromptCards.includes('历史运行结果'));assert(!currentPromptCards.includes('ub-metric-result'));assert(currentPromptCards.includes('已有本次真实交付证据'));assert(currentPromptCards.includes('data-decision="passed"'));assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),originalEvaluators);

console.log('Unified evaluation bridge: two-mode authoring, immutable historical count engines, visible typed results, single readable decision records and scoped verification passed.');
