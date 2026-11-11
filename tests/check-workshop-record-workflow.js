const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

const shared=['workshop-evaluation-seed.js','workshop-evaluation.js','workshop-evaluation-versions.js','workshop-evaluation-dashboard.js','workshop-evaluation-tasks.js','workshop-evaluation-assets.js','workshop-evaluation-evaluators.js','workshop-evaluation-experiment-engine.js','workshop-evaluation-reports.js','workshop-evaluation-experiments.js','workshop-evaluation-issues.js','workshop-evaluation-copilot.js'];
const scriptSources=html=>[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(match=>match[1].split('?')[0]);
for(const entry of ['dist/index.html','dist/new-aiops.html']){
  const scripts=scriptSources(fs.readFileSync(entry,'utf8'));let previous=-1;
  for(const file of shared){const index=scripts.indexOf(file);assert(index>previous,entry+' shares the ordered execution implementation: '+file);previous=index;}
}

function boot(native){
  const nodes=new Map(),timers=new Map(),selectors=new Map();let now=Date.parse('2026-11-07T02:00:00Z'),serial=0;
  const node=key=>{
    if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',value:'',hidden:false,disabled:false,dataset:{},children:[],style:{setProperty(){}},isConnected:true,scrollTop:0,scrollLeft:0,
      classList:{add(){},remove(){},toggle(){}},focus(){},remove(){},click(){},setAttribute(){},removeAttribute(){},getAttribute(){return null;},scrollIntoView(){},contains(){return false;},closest(){return null;},
      getBoundingClientRect(){return {left:256,top:60,right:1440,bottom:1000,width:1184,height:940};},querySelector(){return null;},querySelectorAll(){return [];}});
    return nodes.get(key);
  };
  class ClockDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  class LocalFormData{constructor(form){this.values=form.values||{};}get(key){const value=this.values[key];return Array.isArray(value)?value[0]??null:value??null;}getAll(key){const value=this.values[key];return value===undefined?[]:Array.isArray(value)?value:[value];}}
  const context={console,JSON,URL,URLSearchParams,Blob,Date:ClockDate,FormData:LocalFormData,innerWidth:1440,innerHeight:1000,
    setTimeout(fn,delay=0){const id=++serial;timers.set(id,{id,fn,at:now+Number(delay)});return id;},clearTimeout(id){timers.delete(id);},addEventListener(){},
    document:{body:node('body'),activeElement:node('active'),getElementById:node,querySelector:key=>selectors.get(key)||null,querySelectorAll:()=>[],createElement:tag=>node('created-'+tag),addEventListener(){}},
    AIOpsResources:{sceneId:()=> 'all',scopeCatalog:()=>[{id:'sales'},{id:'procurement'}]},AIOpsWorkspaces:{registerEvaluationScenes(){}},AIOpsApp:{page:()=> '评测实验',refresh(){},navigate(){}}};
  context.window=context;vm.createContext(context);
  for(const file of ['aiops/evaluation-foundation.js',...shared,...(native?['aiops/evaluation.js','aiops/evaluation-details.js']:[])])vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),context,{filename:file});
  const run=source=>vm.runInContext(source,context),clone=source=>JSON.parse(run('JSON.stringify('+source+')'));
  const advance=()=>{const timer=[...timers.values()].sort((a,b)=>a.at-b.at||a.id-b.id)[0];if(!timer)return false;timers.delete(timer.id);now=Math.max(now,timer.at);timer.fn();return true;};
  const drain=()=>{let count=0;while(timers.size){assert(++count<20000,'independent runs and supplements have finite timers');advance();}};
  const decode=value=>value.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  const hiddenValues=()=>Object.fromEntries([...node('overlay').innerHTML.matchAll(/<input\b[^>]*type="hidden"[^>]*>/g)].map(match=>[match[0].match(/name="([^"]+)"/)?.[1],decode(match[0].match(/value="([^"]*)"/)?.[1]||'')]));
  return {context,run,clone,node,advance,drain,timers,hiddenValues};
}

for(const native of [false,true]){
  const label=native?'new AIOps':'workshop',h=boot(native),{context,run,clone,node,advance,drain,timers}=h;
  run("currentSection='studio';studio.scene='sales';wtState.open=true;evData();evExperimentStore()");
  context.fields={name:label+' independent conversation regression',agentId:'sales-agent-1',version:'V3',suiteIds:['SAL-ES-001'],evaluatorIds:['SAL-EV-001'],execution:{caseRuns:3,fullRuns:2,concurrency:2,modelId:'mock-eval-balanced',mcpIds:[]}};
  context.experiment=run('evCreateExperiment(fields)');const experiment=context.experiment;
  run('evExperimentOpen(experiment.id);evEditExperiment(experiment.id)');
  const formMarkup=node('overlay').innerHTML;
  assert(formMarkup.includes('name="caseRuns"')&&formMarkup.includes('name="fullRuns"'),label+' exposes the two repetition settings');
  assert(!formMarkup.includes('执行轮数')&&!formMarkup.includes('每轮重复次数'),label+' does not label execution repetition as dialogue turns');
  run('evCloseModal()');
  const enabledCases=experiment.snapshot.cases.filter(row=>row.enabled!==false).length;
  context.first=run('evExperimentStart(experiment.id)');const first=context.first;
  assert.equal(experiment.runs.length,2,label+' creates two independent full evaluation records');
  const roots=[...experiment.runs].sort((a,b)=>a.sequence-b.sequence),second=roots[1];context.second=second;
  assert.equal(first,roots[0]);assert.equal(first.kind,'full');assert.equal(second.kind,'full');
  assert.equal(first.results.filter(row=>row.enabled!==false).length,enabledCases*3);
  assert.equal(second.results.filter(row=>row.enabled!==false).length,enabledCases*3);
  assert.equal(second.status,'排队中','the next full evaluation waits instead of being hidden inside one result');
  assert.equal(run('evExperimentSelectedRecord(experiment).id'),first.id);
  assert.equal(run('evExperimentSelectedRun(experiment).id'),first.id);
  assert(advance(),'the first independent conversation makes progress');
  run('evPauseExperiment(experiment.id)');assert.equal(first.status,'已暂停');assert.equal(second.status,'排队中');assert.equal(run('evExperimentTimers.has(first.id)'),false,'pause cancels the active evaluation scheduler');drain();assert.equal(first.status,'已暂停');assert.equal(second.status,'排队中','pausing also prevents automatic queue advancement');
  assert.throws(()=>run('evUpdateExperiment(experiment.id,{name:"must stay locked"})'));
  run('evResumeExperiment(experiment.id)');drain();
  assert(['已完成','部分失败'].includes(first.status)&&['已完成','部分失败'].includes(second.status));
  for(const record of roots){
    assert(record.initialFullResult&&Object.isFrozen(record.initialFullResult),label+' retains the first complete full result');
    assert.equal(record.initialFullResult.results.filter(row=>row.enabled!==false).length,enabledCases*3);
    assert(Object.isFrozen(record.initialFullResult.results)&&Object.isFrozen(record.initialFullResult.snapshot));
  }
  const allResults=roots.flatMap(record=>record.results),ids=allResults.map(row=>row.conversationId);
  assert(ids.every(Boolean)&&new Set(ids).size===ids.length,'every repeat owns a fresh conversation ID across records');
  assert(allResults.every(row=>!Object.hasOwn(row,'round')),'execution attempts do not masquerade as dialogue rounds');
  const attempts=first.results.filter(row=>row.caseId===first.results[0].caseId&&row.enabled!==false);
  assert.equal(attempts.length,3);assert.deepEqual(Array.from(attempts,row=>row.attempt),[1,2,3]);
  assert.equal(new Set(attempts.map(row=>row.input)).size,1,'independent conversations start from the identical case input');
  assert(attempts.every(row=>Array.isArray(row.messages)&&row.messages[0].role==='user'&&row.messages[0].content===row.input));
  assert(new Set(attempts.map(row=>row.messages)).size===3,'messages are not shared between independent conversations');
  const firstEvidence=JSON.stringify(first.initialFullResult),firstResults=JSON.stringify(first.results),firstReport=JSON.stringify(first.report),fullCount=experiment.runs.length;
  const failedRoot=roots.find(record=>record.results.some(row=>['未通过','运行失败'].includes(row.status)));assert(failedRoot);
  context.source=failedRoot;run('evExperimentOpen(experiment.id,source.id)');
  context.supplement=run('evExperimentRetry(experiment.id,source.id)');const supplement=context.supplement;
  assert(supplement&&supplement.kind==='supplement');assert.equal(supplement.parentRunId,failedRoot.id);assert.equal(experiment.runs.length,fullCount);
  assert(failedRoot.supplements.includes(supplement),'failed reruns belong to the original full evaluation record');
  assert.equal(run('evExperimentSelectedRecord(experiment).id'),failedRoot.id);
  assert.equal(run('evExperimentSelectedRun(experiment).id'),supplement.id);
  assert(supplement.results.every(row=>row.sourceResultId&&row.conversationId&&!ids.includes(row.conversationId)),'supplement output never reuses the original conversation');
  drain();
  assert.equal(JSON.stringify(first.initialFullResult),firstEvidence,'supplements never rewrite the future comparison baseline');
  assert.equal(JSON.stringify(first.results),firstResults,'the original full evaluation output remains unchanged');
  assert.equal(JSON.stringify(first.report),firstReport,'the original report is preserved after supplement execution');
  run('evExperimentOpen(experiment.id,supplement.id)');
  assert.equal(run('evExperimentSelectedRecord(experiment).id'),failedRoot.id);assert.equal(run('evExperimentSelectedRun(experiment).id'),supplement.id);
  assert.equal(run('evExperimentViewRun(experiment).id'),failedRoot.id,'the case-result page always presents the selected full evaluation record');
  let markup=run('evExperimentDetail(experiment)');
  assert(!markup.includes('aria-label="结果范围"')&&!markup.includes('ev-record-source-note'),'full results do not require a supplement-scope dropdown or explanation');
  assert(!markup.includes('ev-run-summary')&&!markup.includes('ev-experiment-run-summary'),'full results omit the duplicate status and processed-count summary');
  const rootResultIds=new Set(failedRoot.results.map(row=>row.id)),visibleResultIds=[...markup.matchAll(/evExperimentCaseDetail\('([^']+)'\)/g)].map(match=>match[1]);
  assert(visibleResultIds.length&&visibleResultIds.every(id=>rootResultIds.has(id)),'a direct supplement context still renders the full original case list');
  assert(run('evExperimentDetailTabs(experiment)').includes('id="ev-experiment-result-count">'+failedRoot.results.length+'</span>'),'the case tab count remains the full record size after supplement execution');
  const fullMetrics=clone('evDashboardRunMetrics(experiment,evExperimentViewRun(experiment))');
  assert.equal(fullMetrics[0].value,failedRoot.results.filter(row=>['通过','未通过','运行失败'].includes(row.status)).length,'main execution metrics retain the complete original-record denominator');
  assert(!/比较|对比/.test((markup.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)||[]).join('')),'no comparison feature is added ahead of scope');
  const supplementResult=supplement.results.find(row=>row.actual)||supplement.results[0];context.supplementResultId=supplementResult.id;
  assert(run('evExperimentCaseDetail(supplementResultId)'),'supplement evidence remains directly accessible from issue and report links');
  if(native)run('AIOpsEvaluation.afterRender("评测实验")');
  assert(node('overlay').innerHTML.includes(supplementResult.conversationId),'the direct drawer resolves the supplement conversation instead of the original result');
  assert.equal(JSON.stringify(first.initialFullResult),firstEvidence,'viewing supplement evidence preserves the frozen full-evaluation baseline');
  run('evExperimentOpen(experiment.id,source.id)');assert.equal(run('evExperimentSelectedRun(experiment).id'),failedRoot.id,'choosing the root restores the original complete results');
  const baselineResult=failedRoot.initialFullResult.results.find(row=>row.actual);assert(baselineResult);
  context.originalResultId=baselineResult.id;run('evExperimentCaseDetail(originalResultId)');
  if(native)run('AIOpsEvaluation.afterRender("评测实验")');
  const detail=node('overlay').innerHTML;
  assert(detail.includes(baselineResult.conversationId),'a result identifies its independent conversation');
  assert(detail.includes('用例执行')&&!detail.includes('批 · 轮 · 次'),'the result heading uses record and attempt positioning');
  // A review of the first identical-input conversation cannot leak to another.
  const markable=failedRoot.results.filter(row=>row.actual&&row.caseId===baselineResult.caseId);if(markable.length>1){
    context.reviewFirst=markable[0];context.reviewOther=markable[1];run('evExperimentAnnotateOutput(reviewFirst.id,1)');
    context.reviewEvent={currentTarget:{values:{...h.hiddenValues(),problemType:'其他',note:'仅复核这个独立对话'}},preventDefault(){}};
    assert(run('evSaveExperimentResultAnnotation(reviewEvent,reviewFirst.id,"output:1")'));
    assert.equal(run('evExperimentOutputAnnotation(reviewOther.id,1)'),null,'a matching input does not share an annotation across conversations');
    assert.equal(JSON.stringify(first.initialFullResult),firstEvidence,'review also preserves the original evaluation snapshot');
  }
  assert.equal(run('evExperimentExecutionGet(experiment,supplement.id).id'),supplement.id,'supplement evidence remains directly addressable');

  // Configuration always describes the plan for the next full evaluation, even when an older record is selected.
  context.configExperiment=run('evCreateExperiment({...fields,name:"当前配置查看回归",version:"V3",execution:{...fields.execution,caseRuns:1,fullRuns:1}})');
  context.configRecord=run('evRunExperiment(configExperiment.id)');drain();
  run('evUpdateExperiment(configExperiment.id,{version:"V2",execution:{caseRuns:3}});evExperimentOpen(configExperiment.id,"","实验配置")');
  const configMarkup=run('evExperimentDetail(configExperiment)');
  assert(configMarkup.includes(' / V2'),label+' configuration shows the updated Agent version before its first execution');
  assert(/<dt>每个用例执行次数<\/dt><dd>3<\/dd>/.test(configMarkup),label+' configuration shows the updated per-case execution count');
  assert.equal(context.configRecord.snapshot.agent.version,'V3');assert.equal(context.configRecord.snapshot.execution.caseRuns,1,'showing the current configuration preserves historical execution snapshots');
  run('evExperimentOpen(configExperiment.id,configRecord.id,"实验报告")');
  const historicalReport=run('evExperimentReportView(configExperiment,configRecord)');
  assert(historicalReport.includes(' / V3')&&historicalReport.includes('每个用例执行 1 次'),label+' original report continues to show its original execution configuration');
}
console.log('PASS independent full evaluation records, repeated conversations, immutable first results, full-record result pages and direct supplement evidence');
