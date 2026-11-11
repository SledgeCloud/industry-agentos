const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const clone = value => JSON.parse(JSON.stringify(value));
const values = new Map(), notifications = [];
const storage = {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
let now = Date.parse('2026-11-10T02:00:00Z'), sourceFailure = false;
const rows = [{id:'SESSION-LIVE',name:'完整销售会话',sceneId:'sales',agentId:'sales-agent',status:'closed',endedAt:'2026-11-10T01:30:00Z',conversation:{rounds:[{n:1,inputId:'USER-1',outputId:'ANSWER-1',input:'请生成方案',output:'方案已生成',outputAt:'2026-11-10T01:30:00Z'}],records:[]}}];
const context = {Date,console,setInterval:()=>1,clearInterval(){},localStorage:storage};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('dist/aiops/unified-evaluation-data.js','utf8'),context);
const D = context.AIOpsUnifiedData;
D.configure({storage,now:()=>now,sessions:()=>{if(sourceFailure)throw Error('会话来源暂时不可用');return rows;},businessTasks:()=>[],onRun:run=>notifications.push(clone(run))});
assert(D.initialize().ok);

function object(type,id,decision,runId,extra={}) {
  const assessmentId='A-'+runId+'-'+id;
  return {id:'O-'+runId+'-'+id,jobId:'MIXED',runId,evaluatedAt:runId==='R2'?'2026-11-10T02:00:00Z':'2026-11-10T01:00:00Z',sourceSessionId:'S1',targetRef:{type,id,snapshotId:'SNAP-'+id},targetSnapshot:{type,id,sessionId:'S1',sessionName:'冻结的销售会话',name:type==='span'?'工具查询':id,agentId:'sales-agent'},decision,evaluatorResults:[{assessmentId,bindingId:'B1',decision}],...extra};
}
function assessment(result,extra={}) {return {id:result.evaluatorResults[0].assessmentId,jobId:result.jobId,runId:result.runId,evaluatedAt:result.evaluatedAt,bindingId:'B1',evaluatorRef:{id:'E1',version:'V1'},targetRef:clone(result.targetRef),targetSnapshot:clone(result.targetSnapshot),executionStatus:'succeeded',decision:result.decision,metricResults:[],...extra};}
const state=JSON.parse(storage.getItem(D.storageKey));
const initial=['session','trace','span','task_execution'].map((type,index)=>object(type,'T'+index,'passed','R1',type==='task_execution'?{taskRef:{id:'BUSINESS',version:'V1'}}:{}));
const changed=object('span','T2','failed','R2');
const reused=object('trace','REUSED','passed','R2',{evaluatorResults:[{assessmentId:initial[1].evaluatorResults[0].assessmentId,bindingId:'B1',decision:'passed',reused:true}]});
const observed=object('span','OBSERVED','not_applicable','R2',{sourceSessionId:'OBSERVE',targetSnapshot:{type:'span',id:'OBSERVED',sessionId:'OBSERVE',sessionName:'仅观察会话'}});
state.runs.push({id:'R1',jobId:'MIXED',startedAt:'2026-11-10T00:59:58Z',finishedAt:'2026-11-10T01:00:00Z',objectResults:initial,assessmentIds:initial.map(item=>item.evaluatorResults[0].assessmentId),targetSnapshots:initial.map(item=>item.targetSnapshot)}, {id:'R2',jobId:'MIXED',startedAt:'2026-11-10T01:59:59Z',finishedAt:'2026-11-10T02:00:00Z',objectResults:[changed,reused,observed],assessmentIds:[changed,observed].map(item=>item.evaluatorResults[0].assessmentId),targetSnapshots:[changed,reused,observed].map(item=>item.targetSnapshot)});
state.assessments.push(...initial.map(item=>assessment(item)),assessment(changed),assessment(observed));
state.assessments.push({id:'LEGACY',jobId:'MIXED',evaluatedAt:'2026-11-10T00:30:00Z',targetRef:{type:'session',id:'HISTORICAL'},targetSnapshot:{name:'历史会话'},evaluatorRef:{id:'E1',version:'V1'},decision:'failed'},...['ONE','TWO'].map(id=>({id:'UNKNOWN-'+id,jobId:'MIXED',targetRef:{type:'span',id},evaluatorRef:{id:'E1',version:'V1'},decision:'inconclusive'})));
storage.setItem(D.storageKey,JSON.stringify(state));
const original=storage.getItem(D.storageKey),groups=D.sessionResults('MIXED'),session=D.sessionResult('MIXED','S1');
assert.equal(groups.length,5,'A mixed-target session, observation session, legacy session and two unknown targets stay distinct');
assert.equal(session.sessionName,'冻结的销售会话');
assert.equal(session.objectCount,5,'A repeated span snapshot replaces its earlier value in the current view');
assert.deepEqual(clone(session.targetCounts),{session:1,trace:2,span:1,task_execution:1});
assert.equal(session.history.length,6,'Earlier final object results remain inspectable');
assert.equal(session.counts.failed,1);assert.equal(session.counts.passed,4);assert.equal(session.decision,'failed');
assert.equal(session.objectResults.find(item=>item.targetRef.id==='T2').runId,'R2');
assert.equal(session.assessmentCount,5,'Reused assessments are included once without duplicating evaluator calls');
assert.equal(session.latestAssessments.length,4,'Only current final-result assessment links are marked latest');
assert.equal(D.sessionResult('MIXED','OBSERVE').decision,'not_applicable');
const historical=D.sessionResult('MIXED','HISTORICAL');
assert.equal(historical.historicalAssessmentCount,1);assert.equal(historical.objectCount,1);assert.equal(historical.counts.total,0,'Standalone evaluator verdicts do not invent a final object verdict');
assert.equal(groups.filter(group=>group.sessionMissing).length,2,'Missing parent session metadata never merges unrelated targets');
const batch=D.sessionResults('MIXED',{runId:'R2'});
assert.equal(batch.length,2);assert.equal(batch.find(group=>group.sessionId==='S1').objectCount,2);assert.deepEqual(clone(batch.find(group=>group.sessionId==='S1').runIds),['R2']);
assert(batch.find(group=>group.sessionId==='S1').assessments.some(item=>item.id===initial[1].evaluatorResults[0].assessmentId),'Run drilldown follows reused assessments from earlier runs');
assert.equal(D.run('R1').sessionCounts.total,1);assert.equal(D.run('R1').durationMs,2000);
session.objectResults[0].decision='tampered';assert.equal(D.sessionResult('MIXED','S1').counts.failed,1);
assert.equal(storage.getItem(D.storageKey),original,'Session and run views are read-only and return defensive copies');

function draft(mode='manual') {return {name:'触发记录验证',enabled:true,selector:{sceneId:'sales',agentId:'sales-agent',targetType:'session',taskIds:[],spanTypes:[],filter:{text:'',status:'all'}},sampling:{rate:100},readiness:{mode:'any',idleMinutes:10},trigger:{mode,events:['ready']},reEvaluation:{mode:'on_change'},schedule:{repeat:mode==='scheduled'?'interval':'manual',intervalHours:1,timezone:'Asia/Shanghai'},bindings:[{id:'B-OUTPUT',evaluatorRef:{id:'UE-OUTPUT-EXISTS',version:'V1'},targetType:'session',role:'gate',dimensionMappings:[],inputMapping:{actual:'/target/output'}}]};}
function save(value,id){const result=D.saveJob(value,id,{historicalImport:true});assert.equal(result.ok,true,result.error);return result.record;}
const manual=save(draft()),range={from:'2026-11-10T01:00:00Z',to:'2026-11-10T02:00:00Z'};
const first=D.runJob(manual.id,{mode:'backfill',range,trigger:'manual'});assert(first.ok,first.error);
assert.equal(first.run.sessionCounts.scanned,1);assert.equal(first.run.sessionCounts.matched,1);assert.equal(first.run.sessionCounts.total,1);
assert.equal(first.run.executionCounts.total,1);assert.equal(first.run.targetSnapshots[0].sessionName,'完整销售会话');
const frozenRun=clone(first.run),empty=D.runJob(manual.id,{mode:'backfill',range,trigger:'manual'});assert(empty.ok);assert.equal(empty.run.objectCounts.total,0);assert.match(empty.run.emptyReason,/已评测/);
assert.equal(D.runs(manual.id).length,2,'Every valid manual trigger creates a record, including an empty run');
const edit=D.job(manual.id);edit.name='修改后的任务';save(edit,edit.id);rows[0].name='修改后的来源会话';
assert.deepEqual(clone(D.run(first.run.id)),frozenRun,'Task edits and source updates do not rewrite historical execution metadata');
const scheduled=save(draft('scheduled'));
assert(D.runJob(scheduled.id,{mode:'backfill',range,trigger:'manual'}).ok,'Scheduled tasks accept an explicit manual trigger');
now+=3600000;
const scheduledAt=new Date(now).toISOString(),scheduledRun=D.runJob(scheduled.id,{trigger:'scheduled',scheduledAt,revision:scheduled.revision});assert(scheduledRun.ok,scheduledRun.error);assert.equal(scheduledRun.run.trigger,'scheduled');assert.equal(scheduledRun.run.objectCounts.total,0);
const count=D.runs(scheduled.id).length;assert(D.runJob(scheduled.id,{trigger:'scheduled',scheduledAt,revision:scheduled.revision}).skipped);assert.equal(D.runs(scheduled.id).length,count,'A schedule slot produces one record');
sourceFailure=true;
const beforeFailure=clone(D.assessments(manual.id)),failed=D.runJob(manual.id,{trigger:'manual'});assert.equal(failed.ok,false);assert.equal(failed.run.status,'failed');assert.equal(failed.run.error,'会话来源暂时不可用');assert.deepEqual(clone(D.assessments(manual.id)),beforeFailure);assert.deepEqual(clone(D.run(failed.run.id)),clone(failed.run));
const nextSlot=new Date(now+3600000).toISOString();now+=3600000;
const notificationsBeforeFailedSchedule=notifications.length,failedSchedule=D.runJob(scheduled.id,{trigger:'scheduled',scheduledAt:nextSlot,revision:scheduled.revision});assert.equal(failedSchedule.ok,false);assert.equal(failedSchedule.run.status,'failed');assert.equal(notifications.length,notificationsBeforeFailedSchedule+1);assert.equal(notifications.at(-1).status,'failed');
const failedCount=D.runs(scheduled.id).length;D.runJob(scheduled.id,{trigger:'scheduled',scheduledAt:nextSlot,revision:scheduled.revision});assert.equal(D.runs(scheduled.id).length,failedCount,'Repeated failed schedule slots do not duplicate the failure ledger');assert.equal(notifications.length,notificationsBeforeFailedSchedule+1,'The duplicate failed slot does not notify again');
sourceFailure=false;
const automatic=save(draft('automatic'));const autoCount=D.runs(automatic.id).length;assert(D.runJob(automatic.id,{trigger:'automatic'}).skipped);assert.equal(D.runs(automatic.id).length,autoCount,'Idle automatic ticks do not create empty records');

console.log('PASS online session results: mixed target aggregation, latest snapshots, immutable history, reused evidence, legacy orphan retention, unknown session isolation, manual/scheduled empty and failed runs, and schedule-slot idempotency.');
