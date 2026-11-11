'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

// Run the shared production modules under each entry point's real host contract.
// The clock checks observable batch boundaries, rather than sleeping in real time.
function fixture(host){
 const entry=fs.readFileSync('dist/'+(host==='workshop'?'index.html':'new-aiops.html'),'utf8');
 const nodes=new Map(),timers=new Map();let now=Date.parse('2026-11-09T04:00:00Z'),serial=0;
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,innerHTML:'',textContent:'',value:'',dataset:{},style:{},isConnected:true,
  classList:{add(){},remove(){},toggle(){}},focus(){},remove(){},click(){},setAttribute(){},removeAttribute(){},scrollIntoView(){},closest(){return null;},contains(){return false;},
  querySelector(){return null;},querySelectorAll(){return [];},getBoundingClientRect(){return {left:0,top:0,right:1440,bottom:1000,width:1440,height:1000};}});return nodes.get(id);};
 const context={console,Date:Clock,JSON,URL,URLSearchParams,Blob,innerWidth:1440,innerHeight:1000,
  addEventListener(){},setTimeout(fn,delay=0){const id=++serial;timers.set(id,{fn,at:now+Number(delay)});return id;},clearTimeout(id){timers.delete(id);},
  document:{body:node('body'),activeElement:node('active'),getElementById:node,querySelector(){return null;},querySelectorAll(){return [];},createElement:node,addEventListener(){}}};
 context.window=context;vm.createContext(context);
 if(host==='workshop')for(const match of entry.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(match[1],context);
 else vm.runInContext(fs.readFileSync('dist/aiops/evaluation-foundation.js','utf8'),context);
 for(const file of ['workshop-evaluation-seed.js','workshop-evaluation.js','workshop-evaluation-versions.js','workshop-evaluation-dashboard.js','workshop-evaluation-tasks.js','workshop-evaluation-assets.js','workshop-evaluation-evaluators.js','workshop-evaluation-experiment-engine.js','workshop-evaluation-reports.js','workshop-evaluation-experiments.js','workshop-evaluation-issues.js','workshop-evaluation-copilot.js','workshop-evaluation-optimization.js']){
  assert(entry.includes('src="'+file),host+' loads shared '+file);vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),context,{filename:file});
 }
 const run=code=>vm.runInContext(code,context),snapshot=code=>JSON.parse(run('JSON.stringify('+code+')'));
 const advanceTo=target=>{let count=0;while(timers.size){const next=[...timers].sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(next[1].at>target)break;assert(++count<3000,'finite timers');timers.delete(next[0]);now=next[1].at;next[1].fn();}now=target;};
 const advanceBy=delay=>advanceTo(now+delay);
 run("currentSection='studio';studio.scene='sales';evData();evExperimentStore();evExperimentRefresh=()=>{}");
 run(`{
  const data=evData(),source=data.suites.find(suite=>suite.agentId==='sales-agent-1'),original=data.cases.find(item=>source.caseIds.includes(item.id));
  const cases=Array.from({length:8},(_,index)=>({...JSON.parse(JSON.stringify(original)),id:'BATCH-CASE-'+index,name:'分批用例 '+index,enabled:true}));
  data.cases.push(...cases);data.suites.push({...JSON.parse(JSON.stringify(source)),id:'BATCH-SUITE',name:'批量执行专项',caseIds:cases.map(item=>item.id)});
 }`);
 context.fields={name:host+'分批执行专项',agentId:'sales-agent-1',version:'V3',suiteIds:['BATCH-SUITE'],evaluatorIds:['SAL-EV-001'],execution:{concurrency:4,caseRuns:1,fullRuns:1}};
 return {context,run,snapshot,advanceBy,timers};
}

for(const host of ['workshop','native']){
 const {context,run,snapshot,advanceBy,timers}=fixture(host);
 context.experiment=run('evCreateExperiment(fields)');context.record=run('evRunExperiment(experiment.id)');
 const metrics=()=>snapshot('evDashboardRunMetrics(experiment,record).map(item=>item.value)');
 const initial=metrics();
 assert.deepEqual(initial,[0,null,null,null],host+' starts with uncommitted metrics');
 assert.equal(run('record.results.filter(item=>item.status==="运行中").length'),4);
 assert.equal(run('record.results.filter(item=>item.status==="待运行").length'),4);
 let markup=run('evExperimentResultTable(experiment,record)');
 assert.equal((markup.match(/data-execution-phase="running"/g)||[]).length,4,host+' marks running rows');
 assert.equal((markup.match(/data-execution-phase="queued"/g)||[]).length,4,host+' marks waiting rows');
 assert(markup.includes('ev-row-spinner')&&markup.includes('ev-row-waiting'),host+' supplies both inline activity animations');
 advanceBy(1499);assert.equal(run('evExperimentSummary(record).executed'),0,host+' each batch lasts 1.5 seconds');assert.deepEqual(metrics(),initial);
 advanceBy(1);assert.equal(run('evExperimentSummary(record).executed'),4);assert.equal(run('record.results.filter(item=>item.status==="运行中").length'),4);
 assert.deepEqual(metrics(),initial,host+' first batch completion does not publish intermediate metrics');
 advanceBy(1499);assert.equal(run('evExperimentSummary(record).executed'),4);assert.deepEqual(metrics(),initial);
 advanceBy(1);assert.equal(run('evExperimentSummary(record).executed'),8);assert.equal(metrics()[0],8);assert(metrics()[2]>0);assert(metrics()[3]>=0);
 markup=run('evExperimentResultTable(experiment,record)');assert(!markup.includes('data-execution-phase="running"')&&!markup.includes('data-execution-phase="queued"'),host+' completion clears activity markers');assert.equal(timers.size,0);

 // Full evaluation repetitions form one operation: selecting an already finished
 // first record must not reveal metrics while its second record is still running.
 run('evUpdateExperiment(experiment.id,{execution:{fullRuns:2}})');context.first=run('evRunExperiment(experiment.id)');
 context.record=context.first;const groupInitial=metrics();advanceBy(3000);
 assert(['已完成','部分失败'].includes(context.first.status));assert.equal(run('evExperimentActiveExecution(experiment).sequence'),context.first.sequence+1);
 assert.deepEqual(metrics(),groupInitial,host+' metrics remain unchanged across the full-run queue');
 advanceBy(3000);assert.equal(metrics()[0],8);assert.equal(run('evExperimentActiveExecution(experiment)'),null);

 // Pause/resume preserves committed metrics; stopping is a terminal operation
 // and publishes only evidence produced before the stop.
 run('evUpdateExperiment(experiment.id,{execution:{concurrency:1,fullRuns:1}})');context.record=run('evRunExperiment(experiment.id)');
 assert.equal(run('record.results.filter(item=>item.status==="运行中").length'),1,'explicit serial execution remains respected');
 advanceBy(1500);assert.equal(run('evExperimentSummary(record).executed'),1);assert.equal(metrics()[0],0);
 run('evPauseExperiment(experiment.id)');assert.equal(timers.size,0);advanceBy(3000);assert.equal(metrics()[0],0,host+' pause does not publish partial metrics');
 run('evResumeExperiment(experiment.id)');advanceBy(1500);assert.equal(run('evExperimentSummary(record).executed'),2);assert.equal(metrics()[0],0);
 const stale=[...timers.values()].map(timer=>timer.fn);run('evStopExperiment(experiment.id)');assert.equal(metrics()[0],2);assert.equal(timers.size,0);
 const stopped=snapshot('record');for(const callback of stale)callback();assert.deepEqual(snapshot('record'),stopped,host+' stale timers cannot modify stopped evidence');

 // A multi-turn conversation is one case execution; the demo delay remains
 // 1.5s even when several question/answer turns are generated for that case.
 assert.equal(run('evExperimentModeLabel({mode:"scenario_simulation"})'),'多轮执行');
 run('evUpdateExperiment(experiment.id,{execution:{mode:"scenario_simulation",scenarioPrompt:"逐步补充需求并核对结果",maxTurns:5,concurrency:4,fullRuns:1}})');
 context.record=run('evRunExperiment(experiment.id)');advanceBy(1499);assert.equal(run('evExperimentSummary(record).executed'),0);
 advanceBy(1);assert.equal(run('evExperimentSummary(record).executed'),4);assert.equal(metrics()[0],0);
 advanceBy(1500);assert.equal(metrics()[0],8);assert(run('record.results.some(item=>item.actualTurns>1)'),host+' keeps generated multi-turn evidence');
}
console.log('PASS both evaluation hosts: 1.5s batch boundaries, 4 running/4 queued row animations, completion-only metrics, full-run queue barrier, explicit serial execution and pause/stop cancellation');
