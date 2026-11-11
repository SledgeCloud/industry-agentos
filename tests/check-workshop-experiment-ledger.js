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
const resultRows=markup=>[...(markup.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1]||'').matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m=>m[1]).filter(row=>row.includes('evExperimentCaseDetail('));
const resultIds=markup=>resultRows(markup).map(row=>row.match(/evExperimentCaseDetail\('([^']+)'\)/)?.[1]);

const clone=value=>JSON.parse(JSON.stringify(value));
run("currentSection='studio';studio.scene='sales';evData();evExperimentStore()");
const template=clone(run('evExperimentStore().experiments[0]'));
const caseA={id:'SAL-EC-LEDGER-A',name:'重复质量问题',version:'V1',input:'输入A',expected:'期望A',enabled:true,tags:[]};
const caseB={id:'SAL-EC-LEDGER-B',name:'独立执行异常',version:'V1',input:'输入B',expected:'期望B',enabled:true,tags:[]};
const standard={id:'SAL-EV-LEDGER',name:'规则评估器',version:'V1',criteria:[{name:'规则R',description:'必须包含依据',weight:1,passScore:80}]};
context.experiment={...template,id:'SAL-EXP-LEDGER',name:'跨批次问题台账',configurationRevision:1,runs:[],sequence:0,issueLedger:[],issueLedgerSequence:0,status:'未运行',snapshot:{...clone(template.snapshot),cases:[caseA,caseB],evaluators:[standard]}};
context.experiment.snapshot.suites=[{...clone(template.snapshot.suite),caseIds:[caseA.id,caseB.id]}];context.experiment.snapshot.suite=context.experiment.snapshot.suites[0];
const experiment=context.experiment;
run('evExperimentStore().experiments.unshift(experiment);evExperimentOpen(experiment.id,"","问题优化")');
let batchNumber=0;
function row(caseId,status,{scored=true}={}){return {caseId,status,scored};}
function addBatch(specs,{status='部分失败',scorerVersion='V1',standardText='必须包含依据',agentVersion='V1',parent=null,source=null,analyze=true}={}){
  const ordinal=++batchNumber,sequence=parent?parent.sequence:ordinal,supplementSequence=parent?(parent.supplements||[]).length+1:undefined,id=parent?parent.id+'-SUP-'+supplementSequence:experiment.id+'-RUN-'+sequence,snapshot=clone(experiment.snapshot);
  snapshot.agent.version=agentVersion;snapshot.evaluators[0].version=scorerVersion;snapshot.evaluators[0].criteria[0].description=standardText;
  const start=clockMs+ordinal*1000;
  const results=specs.map((spec,index)=>{
    const c=snapshot.cases.find(record=>record.id===spec.caseId),passed=spec.status==='通过',criterion={...snapshot.evaluators[0].criteria[0],score:passed?100:20,passed,reason:passed?'符合标准':'缺少依据'};
    return {id:id+'-RESULT-'+index,caseId:c.id,name:c.name,version:c.version,input:c.input,expected:c.expected,tags:[],enabled:true,attempt:index+1,conversationId:id+'-CONV-'+index,suiteIds:[snapshot.suite.id],status:spec.status,
      actual:['通过','未通过'].includes(spec.status)?passed?'完整结果':'缺少依据':'',reason:spec.status==='运行失败'?'工具超时':'',dimensions:[],evaluations:spec.scored&&['通过','未通过'].includes(spec.status)?[{evaluatorId:standard.id,name:standard.name,version:scorerVersion,passed,score:criterion.score,criteria:[criterion]}]:[],durationMs:100,tokens:10,startedAtMs:start+index*100,endedAtMs:start+(index+1)*100,startedAt:new TestDate(start+index*100).toISOString(),endedAt:new TestDate(start+(index+1)*100).toISOString()};
  });
  const batch={id,experimentId:experiment.id,experimentName:experiment.name,configurationRevision:1,kind:parent?'supplement':'full',parentRunId:parent?.id||null,sourceRunId:source?.id||parent?.id||null,supplementSequence,supplementKind:parent?'failed':undefined,supplements:[],sequence,status,snapshot,results,startedAtMs:start,endedAtMs:start+results.length*100,startedAt:new TestDate(start).toISOString(),endedAt:new TestDate(start+results.length*100).toISOString()};
  if(parent)parent.supplements.push(batch);else experiment.runs.unshift(batch);experiment.sequence=Math.max(experiment.sequence,sequence);context.batch=batch;context.analyzeBatch=analyze;run('evExperimentIssuesSync(experiment,batch);if(analyzeBatch&&["已完成","部分失败","已停止"].includes(batch.status)&&batch.results.some(result=>["通过","未通过","运行失败"].includes(result.status)))evExperimentIssueAnalyzeComplete(experiment,batch);evExperimentIssueLedgerSync(experiment)');return batch;
}
const ledger=()=>run('evExperimentIssueLedgerSync(experiment)');
const issueA=()=>ledger().find(issue=>issue.caseId===caseA.id&&issue.type==='评估未达标'&&issue.evaluatorVersion==='V1');
const setStatus=(issue,status)=>{context.issue=issue;context.form={values:{scene:'sales',status,owner:'复验负责人',note:'保留跨批次处理记录'}};assert.equal(run('evSaveExperimentIssue(form,experiment.id,"all",issue.id)'),true);};
const initial=addBatch([row(caseA.id,'未通过'),row(caseA.id,'未通过'),row(caseB.id,'运行失败')]);
assert.equal(initial.issues.length,3,'raw findings remain one record per failed execution');
assert.equal(ledger().length,2,'repeated findings for the same case and standard aggregate into one logical problem');
assert.equal(issueA().occurrences.length,2);assert.equal(issueA().status,'待修复');
const rawBefore=clone(initial.issues),resultsBefore=clone(initial.results);
run('evExperimentIssuesUI(experiment,null)');
assert.equal(run('evExperimentIssueState.scope'),'all');assert(!Object.hasOwn(run('evExperimentIssueState'),'status'));
assert.equal(run('evDashboardExperimentMetrics([experiment],"experiment-list").find(metric=>metric.id==="experiment-pending").value'),2,'outer pending count is logical problems, not duplicate raw findings');
setStatus(issueA(),'待修复');
const repeated=addBatch([row(caseA.id,'未通过')],{agentVersion:'V2'});
assert.equal(ledger().length,2,'an Agent version change retains the same case and scoring problem identity');assert.equal(issueA().occurrences.length,3);assert.equal(issueA().status,'待修复','a new batch retains in-progress human handling');
assert.equal(issueA().owner,undefined);assert.equal(issueA().note,'保留跨批次处理记录');
const beforeUnanalysed=issueA().occurrences.length,unanalysedMixed=addBatch([row(caseA.id,'通过'),row(caseA.id,'未通过')],{analyze:false});assert.equal(unanalysedMixed.issues.length,0);assert.equal(issueA().status,'待修复','unanalyzed mixed pass/fail output cannot verify an existing problem');assert.equal(issueA().occurrences.length,beforeUnanalysed,'unanalyzed failures cannot silently create new discoveries');
assert.equal(run('evDashboardExperimentMetrics([experiment],"experiment-list").find(metric=>metric.id==="experiment-pending").value'),2,'raw pending labels cannot override ledger handling state');
context.repeatedId=repeated.id;
run('evExperimentIssueSetScope(experiment.id,repeatedId)');
assert.equal(run('evExperimentIssueScopeIssues(experiment).length'),1);assert.equal(run('evExperimentIssueScopeIssues(experiment)[0].id'),issueA().id);
assert.equal(run('evExperimentState.runId'),'','problem batch scope does not change the case-result selected batch');
run('evExperimentIssueSetScope(experiment.id,"all")');
addBatch([row(caseB.id,'通过')],{status:'已完成'});
assert.equal(issueA().status,'待修复','a batch that does not cover this case cannot close or verify it');
addBatch([row(caseA.id,'通过',{scored:false})],{status:'已完成'});
assert.equal(issueA().status,'待修复','a passing output without the required scorer is not a verification');
addBatch([row(caseA.id,'已跳过')],{status:'已完成'});
assert.equal(issueA().status,'待修复','skipped cases do not count as passing verification');
addBatch([row(caseA.id,'通过'),row(caseA.id,'未通过')]);
assert.equal(issueA().status,'待修复','one passing repetition cannot hide another failure of the same problem in that batch');
addBatch([row(caseA.id,'通过'),row(caseA.id,'待运行')]);assert.equal(issueA().status,'待修复','a passing repetition cannot verify a case whose other planned repetitions remain pending');
addBatch([row(caseA.id,'通过'),row(caseA.id,'运行中')],{status:'运行中'});assert.equal(issueA().status,'待修复','a live batch is not terminal verification evidence');
addBatch([row(caseA.id,'通过'),row(caseA.id,'已跳过')],{status:'已停止'});assert.equal(issueA().status,'待修复','an interrupted case with skipped planned attempts is not a complete recheck');
addBatch([row(caseA.id,'通过')],{status:'已完成',scorerVersion:'V2',standardText:'修改后的更严格标准'});
assert.equal(issueA().status,'待修复','a different scorer version/standard cannot verify the old judgment item');
const verification=addBatch([row(caseA.id,'通过'),row(caseB.id,'运行失败')]);
assert.equal(verification.status,'部分失败');assert.equal(issueA().status,'待修复','ordinary evaluation results do not change problem-validation status');
assert(!issueA().verifications.some(record=>record.runId===verification.id));assert.notEqual(issueA().status,'已关闭','passing recheck requires human confirmation before closing');
setStatus(issueA(),'已关闭');
for(let i=0;i<3;i++)ledger();assert.equal(issueA().status,'已关闭','repeated sync does not reopen already-consumed historical evidence');
const recurrence=addBatch([row(caseA.id,'未通过')]);
assert.equal(issueA().status,'待修复','new evidence reopens a resolved problem');assert(issueA().occurrences.some(record=>record.runId===recurrence.id));
assert(!issueA().verifications.some(record=>record.runId===verification.id),'ordinary case results stay separate after recurrence');
for(let i=0;i<3;i++)ledger();assert.equal(issueA().status,'待修复','older passing evidence cannot override a newer recurrence');
const previousId=issueA().id;
addBatch([row(caseA.id,'未通过')],{scorerVersion:'V2',standardText:'修改后的更严格标准'});
const caseAProblems=ledger().filter(issue=>issue.caseId===caseA.id&&issue.type==='评估未达标');
assert.equal(caseAProblems.length,2,'changed scoring standards form a separate logical problem');assert(caseAProblems.some(issue=>issue.id===previousId));
assert.deepEqual(clone(initial.issues),rawBefore,'human workflow and subsequent batches preserve original raw issue evidence');
assert.deepEqual(clone(initial.results),resultsBefore);
run('evExperimentIssueState.search="完全不匹配";evExperimentIssueState.type="运行异常"');
assert.equal(run('evExperimentIssueScopeIssues(experiment).length'),ledger().length,'scope evidence is independent of list filters');
const markup=run('evExperimentDetail(experiment)');handlers(markup);
assert(markup.includes('ev-issue-scope')&&!markup.includes('id="ev-experiment-history"'),'problem analysis has its own cross-batch scope control');

// Supplements contribute separate evidence beneath their root without counting the root again.
run('evExperimentIssueState.search="";evExperimentIssueState.type=""');
const supplementRoot=addBatch([row(caseA.id,'未通过')]),rootEvidence=clone(supplementRoot.results),rootFindings=clone(supplementRoot.issues);
const occurrencesBeforeSupplement=issueA().occurrences.length,recordCountBeforeSupplement=new Set(issueA().occurrences.map(item=>item.recordId||item.runId)).size;
const supplementPass=addBatch([row(caseA.id,'通过')],{status:'已完成',parent:supplementRoot});
assert.equal(issueA().status,'待修复','ordinary supplements stay separate from problem verification');
assert.equal(issueA().latestVerification,undefined,'case supplements do not create a problem validation record');
assert.equal(issueA().occurrences.length,occurrencesBeforeSupplement,'a supplement does not duplicate the root finding');
setStatus(issueA(),'已关闭');
const supplementFail=addBatch([row(caseA.id,'未通过')],{parent:supplementRoot,source:supplementPass});
assert.equal(issueA().status,'待修复','a later failed supplement reopens the same problem');
assert.equal(issueA().occurrences.length,occurrencesBeforeSupplement+1);assert.equal(new Set(issueA().occurrences.map(item=>item.recordId||item.runId)).size,recordCountBeforeSupplement,'supplement findings retain their parent record identity');
assert.deepEqual(clone(supplementRoot.results),rootEvidence);assert.deepEqual(clone(supplementRoot.issues),rootFindings);
context.rootId=supplementRoot.id;context.childId=supplementFail.id;context.issueId=issueA().id;
assert.equal(run('evExperimentIssueSetScope(experiment.id,rootId)'),true);assert.equal(run('evExperimentIssueScopeIssues(experiment).length'),1,'root scope includes its supplements');
assert.equal(run('evExperimentIssueContext(experiment.id,rootId,issueId).run.id'),supplementFail.id);
assert.equal(run('evExperimentIssueSetScope(experiment.id,childId)'),true);assert.equal(run('evExperimentIssueContext(experiment.id,childId,issueId).run.id'),supplementFail.id);
assert(run('evExperimentIssueScopeControl(experiment)').includes('补跑 #2'));
assert.equal(run('evExperimentIssueDetail(issueId,childId,experiment.id)'),true);
assert(node('overlay').innerHTML.includes('问题根因')&&node('overlay').innerHTML.includes('验证记录'));assert(!node('overlay').innerHTML.includes('每次发现证据'));assert(!node('overlay').innerHTML.includes('第 1 轮 /'));
const countAfterSupplement=issueA().occurrences.length;for(let i=0;i<3;i++)ledger();assert.equal(issueA().occurrences.length,countAfterSupplement,'resync consumes root and supplement evidence once');
// Explicit sources gate discovery; manual reviews remain isolated by target and conversation.
const srcExp={...clone(template),id:'SAL-EXP-SOURCES',name:'显式问题来源',runs:[],sequence:0,configurationRevision:1,issueLedger:[],issueLedgerSequence:0,status:'未运行'};
srcExp.snapshot.execution={...srcExp.snapshot.execution,caseRuns:2,fullRuns:1};srcExp.execution=clone(srcExp.snapshot.execution);context.srcExp=srcExp;
run('evExperimentStore().experiments.unshift(srcExp);evExperimentOpen(srcExp.id)');
context.srcRoot=run('evRunExperiment(srcExp.id)');drain();const srcRoot=context.srcRoot;
const frozenBefore=JSON.stringify(srcRoot.initialFullResult),resultBefore=JSON.stringify(srcRoot.results),reportBefore=JSON.stringify(srcRoot.report);
assert.equal(run('evExperimentIssuesSync(srcExp,srcRoot).length'),0,'finished runs do not auto-create AI findings');
assert.equal(run('evExperimentIssueLedgerSync(srcExp).length'),0,'rendering and dashboards do not start analysis');
assert(run('evExperimentIssueAnalyzeComplete(srcExp,srcRoot).length')>0);
const aiCount=run('evExperimentIssueLedgerSync(srcExp).length');assert(aiCount>0);assert(run('srcExp.issueLedger.every(issue=>issue.sourceKind==="ai"&&issue.sourceLabel==="AI分析")'));
run('evExperimentIssueAnalyzeComplete(srcExp,srcRoot)');assert.equal(run('srcExp.issueLedger.length'),aiCount,'reanalysis does not duplicate the same evidence');
const samples=srcRoot.results.filter(result=>result.actual&&result.caseId===srcRoot.results[0].caseId);assert.equal(samples.length,2);context.annotationResult=samples[0];
context.annotationContext={current:srcExp,run:srcRoot,result:samples[0]};context.manualAnnotation={problemType:'输出错误',note:'手工发现的输出问题',targetType:'output',turn:1,updatedAt:run('evExperimentTime()')};
context.manualIssue=run('evExperimentIssueFromAnnotation(annotationContext,manualAnnotation,"output:1")');const manualIssue=context.manualIssue;
assert(manualIssue);assert.equal(manualIssue.sourceKind,'annotation');assert.equal(manualIssue.sourceLabel,'手工标注');assert.equal(manualIssue.type,'手工标注');
assert.equal(run('srcExp.issueLedger.length'),aiCount+1,'a human finding is a distinct source from AI findings');
context.manualAnnotation.note='补充后的标注内容';assert.equal(run('evExperimentIssueFromAnnotation(annotationContext,manualAnnotation,"output:1").id'),manualIssue.id);assert.equal(manualIssue.rootCause,'补充后的标注内容');
assert.equal(run('srcExp.issueLedger.length'),aiCount+1,'editing the same mark upserts its issue');
context.otherAnnotationContext={current:srcExp,run:srcRoot,result:samples[1]};assert.notEqual(run('evExperimentIssueFromAnnotation(otherAnnotationContext,manualAnnotation,"output:1").id'),manualIssue.id,'identical inputs in independent conversations do not share manual issues');
assert.notEqual(run('evExperimentIssueFromAnnotation(annotationContext,manualAnnotation,"evaluator:test").id'),manualIssue.id,'an evaluator annotation is independent from an output annotation');
assert.equal(JSON.stringify(srcRoot.initialFullResult),frozenBefore);assert.equal(JSON.stringify(srcRoot.results),resultBefore);assert.equal(JSON.stringify(srcRoot.report),reportBefore);
// Running or unanalysed supplementary output cannot silently verify a manual problem.
context.manualIssue.status='待验证';const rootCount=srcExp.runs.length;run('evExperimentOpen(experiment.id)');assert.equal(run('evExperimentIssueVerify(srcExp.id,manualIssue.id)'),false,'a stale button cannot validate another experiment after navigation');assert.equal(srcExp.runs.length,rootCount);assert.equal(manualIssue.status,'待验证');run('evExperimentOpen(srcExp.id)');run('var originalDomainOutcome=evExperimentOutcome;evExperimentOutcome=()=>"通过"');
context.validation=run('evExperimentIssueVerify(srcExp.id,manualIssue.id)');const validation=context.validation;assert(validation&&validation.validationIssueId===manualIssue.id);assert.equal(validation.sourceRecordId,srcRoot.id);assert.equal(srcExp.runs.length,rootCount);assert.equal(manualIssue.status,'待验证');assert.equal(manualIssue.verifying,true);
assert.equal(run('evExperimentIssueVerify(srcExp.id,manualIssue.id)'),false,'in-flight validation cannot be duplicated');drain();run('evExperimentIssueLedgerSync(srcExp)');
assert.equal(manualIssue.status,'验证完成');assert.equal(manualIssue.verificationPassed,true);assert(manualIssue.verifications.every(item=>item.status==='验证通过'&&item.explicit));assert(manualIssue.verifications.every(item=>validation.results.some(result=>result.id===item.resultId)));
const firstValidationCount=manualIssue.verifications.length;run('evExperimentIssueLedgerSync(srcExp)');assert.equal(manualIssue.verifications.length,firstValidationCount,'validation completion is consumed once');
manualIssue.status='待验证';run('evExperimentOutcome=()=>"未通过"');context.failedValidation=run('evExperimentIssueVerify(srcExp.id,manualIssue.id)');drain();run('evExperimentIssueLedgerSync(srcExp)');
assert.equal(manualIssue.status,'验证完成');assert.equal(manualIssue.verificationPassed,false);assert(manualIssue.verifications.some(item=>item.runId===context.failedValidation.id&&item.status==='验证未通过'));
run('evExperimentOutcome=originalDomainOutcome');assert.equal(srcExp.runs.length,rootCount);assert.equal(JSON.stringify(srcRoot.initialFullResult),frozenBefore);assert.equal(JSON.stringify(srcRoot.results),resultBefore);assert.equal(JSON.stringify(srcRoot.report),reportBefore);
const beforeForeign=clone(ledger());run('studio.scene="procurement";evData()');
assert.equal(run('evSaveExperimentIssue(form,experiment.id,"all",issue.id)'),false);assert.deepEqual(clone(run('evExperimentIssueLedgerSync(experiment)')),beforeForeign);
console.log('PASS experiment-level issue ledger: stable fingerprints, cross-batch occurrences and handling, conservative verification, recurrence reopening, raw evidence preservation, scopes and scene guards');
