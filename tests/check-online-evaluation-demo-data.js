const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const clone = value => JSON.parse(JSON.stringify(value));
const source = fs.readFileSync('dist/aiops/unified-evaluation-data.js', 'utf8');
const now = Date.parse('2026-11-09T04:00:00Z');
const range = { from: '2026-11-09T03:00:00Z', to: '2026-11-09T04:00:00Z' };

function fixture(seedOnlineTaskDemos = false, saved = new Map()) {
  const catalog = [
    { id: 'TASK-SALES', name: '销售分货', version: 'V1', sceneId: 'sales', agentId: 'sales-agent', dimensions: [] },
    { id: 'TASK-PROCUREMENT', name: '采购寻源', version: 'V1', sceneId: 'procurement', agentId: 'procurement-agent', dimensions: [] },
    { id: 'TASK-AUDIT', name: '关账审核', version: 'V1', sceneId: 'audit', agentId: 'audit-agent', dimensions: [] }
  ];
  const rows = catalog.map((task, index) => {
    const id = ['SESSION-SALES', 'SESSION-PROCUREMENT', 'SESSION-AUDIT'][index];
    return {
      id, name: task.name + '线上会话', agentId: task.agentId, agent: task.name + '智能体', sceneId: task.sceneId,
      status: 'closed', environment: 'production', tags: ['重点', task.sceneId],
      startedAt: '2026-11-09T03:20:00Z', endedAt: '2026-11-09T03:40:00Z',
      conversation: {
        rounds: [{ n: 1, name: task.name + '执行链路', inputId: id + '-U', outputId: id + '-A', input: '请执行' + task.name, output: task.name + '已完成，结果已生成。', hasOutput: true, inputAt: '2026-11-09T03:20:00Z', outputAt: '2026-11-09T03:40:00Z' }],
        records: [
          { id: id + '-TOOL', round: 1, type: 'tool', name: task.sceneId + '_lookup', toolName: task.sceneId + '_lookup', status: index === 2 ? 'error' : 'completed', input: '查询业务数据', output: index === 2 ? 'TIMEOUT' : '业务数据已返回', startedAt: '2026-11-09T03:21:00Z', endedAt: '2026-11-09T03:22:00Z' },
          { id: id + '-MODEL', round: 1, type: 'model', name: '生成' + task.name + '结果', model: 'source-model', status: 'completed', input: '业务数据', output: task.name + '结果', endedAt: '2026-11-09T03:40:00Z' }
        ]
      },
      taskExecutions: [{ id: id + '-EXEC', taskId: task.id, startMessageId: id + '-U', completionMessageId: id + '-A', completion: 'completed', completedAt: '2026-11-09T03:40:00Z', output: task.name + '已完成，结果已生成。', evidence: [id + '-U', id + '-A'] }]
    };
  });
  const notifications = [], storage = { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) };
  const context = { console, Date, localStorage: storage, setInterval: () => 1, clearInterval() {} };
  context.window = context;
  context.AIOpsWorkspaces = { scopeCatalog: () => catalog.map(task => ({ id: task.sceneId, items: [{ id: task.agentId, name: task.name + '智能体', type: 'Agent' }] })) };
  vm.createContext(context);vm.runInContext(source, context, { filename: 'unified-evaluation-data.js' });
  // These fixtures exercise persisted legacy task flows. Current authoring is checked separately.
  const engine = context.AIOpsUnifiedData;
  const D = {...engine,
    saveEvaluator:(draft,id)=>engine.saveEvaluator(draft,id,{historicalImport:true}),
    publishEvaluator:id=>engine.publishEvaluator(id,{historicalImport:true}),
    saveJob:(draft,id)=>engine.saveJob(draft,id,{historicalImport:true})
  };
  function configure(enabled) { D.configure({ storage, seedOnlineTaskDemos: enabled, sessions: () => rows, businessTasks: () => catalog, now: () => now, onRun: run => notifications.push(clone(run)) }); }
  configure(seedOnlineTaskDemos);
  return { D, catalog, rows, notifications, saved, configure };
}

function checkReferences(f, jobs) {
  for (const job of jobs) {
    assert(['session', 'trace', 'span', 'task_execution'].includes(job.selector.targetType));
    assert(f.rows.some(row => row.sceneId === job.selector.sceneId && row.agentId === job.selector.agentId), job.name + ' uses an actual source scope');
    assert(job.sampling.rate >= 0 && job.sampling.rate <= 100);
    assert(['manual', 'scheduled', 'automatic'].includes(job.trigger.mode));
    assert.equal(job.passPolicy.type,'composite_policy');assert(['weighted_score','custom_prompt'].includes(job.passPolicy.mode));if(job.passPolicy.mode==='weighted_score'){assert.equal(job.passPolicy.passThreshold,80);assert(Math.abs(job.passPolicy.weights.reduce((sum,row)=>sum+row.weight,0)-1)<1e-8);}else assert(job.bindings.every(binding=>binding.role==='observe'));
    assert(job.bindings.length > 0);
    for (const binding of job.bindings) {
      const evaluator = f.D.evaluator(binding.evaluatorRef.id, binding.evaluatorRef.version);
      assert(evaluator, job.name + ' references an existing published evaluator version');
      assert.equal(binding.targetType, job.selector.targetType);
      assert(evaluator.supportedTargets.includes(binding.targetType));
    }
    if (job.selector.targetType === 'task_execution') {
      assert(job.selector.taskIds.length > 0);
      for (const taskId of job.selector.taskIds) {
        const task = f.catalog.find(item => item.id === taskId);
        assert(task && task.agentId === job.selector.agentId && task.sceneId === job.selector.sceneId);
        assert(job.taskSnapshots.some(snapshot => snapshot.id === task.id && snapshot.version === task.version));
      }
    }
  }
}

// Ordinary hosts keep their existing seed contract; the richer examples are explicitly opted in.
const f = fixture();assert.equal(f.D.initialize().ok, true);assert.equal(f.D.listJobs().length, 1);
assert.equal(f.notifications.length, 0);
assert.equal(JSON.parse(f.saved.get(f.D.storageKey)).onlineTaskDemoVersion, undefined);

// Migrate an already-used local store without replacing authored configuration or frozen history.
const original = f.D.job('UJ-SESSION-DEMO');original.name = '用户已改名的原示例';original.enabled = false;
assert.equal(f.D.saveJob(original, original.id).ok, true);
const draft = clone(original);delete draft.id;draft.name = '用户自建在线任务';draft.enabled = true;
const created = f.D.saveJob(draft);assert.equal(created.ok, true, created.error);
const custom = f.D.runJob(created.record.id, { mode: 'backfill', range });assert.equal(custom.ok, true, custom.error);
const originalSnapshot = JSON.stringify(f.D.job(original.id)), customSnapshot = JSON.stringify(f.D.job(created.record.id));
const customHistory = JSON.stringify(f.D.runs(created.record.id)), notifications = f.notifications.length;
f.configure(true);assert.equal(f.D.initialize().ok, true);
assert.equal(JSON.stringify(f.D.job(original.id)), originalSnapshot);
assert.equal(JSON.stringify(f.D.job(created.record.id)), customSnapshot);
assert.equal(JSON.stringify(f.D.runs(created.record.id)), customHistory);
assert.equal(f.notifications.length, notifications, 'Seeding histories does not dispatch real evaluator runs or render callbacks');
const state = JSON.parse(f.saved.get(f.D.storageKey));assert.equal(state.onlineTaskDemoVersion, 1);assert.equal(state.onlineTaskPolicyVersion,2);assert.equal(state.sessionDemoPolicyVersion,2);
const demos = f.D.listJobs().filter(job => job.id.startsWith('UJ-DEMO-'));
assert.equal(demos.length, 11);assert.equal(f.D.listJobs().length, 13);
assert.equal(new Set(demos.map(job => job.id)).size, demos.length);
assert.deepEqual([...new Set(demos.map(job => job.selector.targetType))].sort(), ['session', 'span', 'task_execution', 'trace']);
assert.deepEqual([...new Set(demos.map(job => job.trigger.mode))].sort(), ['automatic', 'manual', 'scheduled']);
assert(demos.some(job => job.enabled === false) && demos.some(job => job.enabled !== false));
assert(demos.some(job => job.sampling.rate < 100));
assert.deepEqual([...new Set(demos.map(job=>job.passPolicy.mode))].sort(),['custom_prompt','weighted_score']);
assert(new Set(demos.map(job => job.selector.sceneId)).size >= 2);
for (const event of ['ready', 'negative_feedback', 'negative_sentiment', 'evaluation_result'])assert(demos.some(job => job.trigger.mode === 'automatic' && job.trigger.events.includes(event)));
checkReferences(f, demos);

const runs = demos.flatMap(job => Array.from(f.D.runs(job.id)));
assert(runs.length >= 3, 'Examples include inspectable run history, rather than only configuration rows');
const assessments = new Map(Array.from(f.D.assessments()).map(item => [item.id, item]));
const sourceIds = new Set(f.rows.map(row => row.id)), decisions = new Set();
for (const run of runs) {
  assert.equal(run.source, 'mock');assert(run.jobSnapshot && run.jobSnapshot.id === run.jobId);
  assert.equal(run.jobSnapshot.sampling.rate, 100, 'Historical demonstration batches freeze the all-data sampling configuration they actually used');
  assert.equal(run.jobSnapshot.readiness.mode, 'any');
  assert(f.D.job(run.jobId).revision > run.jobSnapshot.revision, 'The historical full-data configuration remains distinct from the current patrol settings');
  assert(Array.isArray(run.objectResults));
  assert.equal(run.assessed, run.assessmentIds.length);
  assert.equal(Object.values(run.counts).reduce((sum, value) => sum + value, 0), run.assessed);
  assert.equal(run.objectCounts.total, run.objectResults.length);
  for (const snapshot of run.sourceSnapshots)assert(sourceIds.has(snapshot.sessionId || snapshot.id), 'Business recognition retains source sessions separately from recognized execution targets');
  for (const id of run.assessmentIds) { const assessment = assessments.get(id);assert(assessment && assessment.jobId === run.jobId);assert.equal(assessment.source, 'mock'); }
  for (const result of run.objectResults) {
    assert.equal(result.runId, run.id);assert.equal(result.jobId, run.jobId);decisions.add(result.decision);
    assert(sourceIds.has(result.sourceSessionId || result.targetSnapshot.sessionId || result.targetSnapshot.id));
    assert(result.passPolicySnapshot && result.targetSnapshot && result.targetRef.snapshotId);
    for (const entry of result.evaluatorResults || [])if (entry.assessmentId)assert(assessments.has(entry.assessmentId));
    if (result.reasonCode === 'TASK_NOT_MATCHED') { assert.equal(result.decision, 'failed');assert.equal(result.evaluatorResults.length, 0); }
  }
}
for (const decision of ['passed', 'failed', 'inconclusive', 'not_applicable'])assert(decisions.has(decision), 'Demo histories include ' + decision);

const beforeStartRuns = JSON.stringify(f.D.runs());f.D.startScheduler();
assert.equal(JSON.stringify(f.D.runs()), beforeStartRuns, 'Starting the local scheduler does not replay historical demo traffic');
assert.equal(f.notifications.length, notifications, 'Demo initialization does not turn into real automatic runs on scheduler start');
f.D.stopScheduler();

// Repeated initialization and refresh are idempotent; edited or removed examples are never resurrected.
const stable = f.saved.get(f.D.storageKey);assert.equal(f.D.initialize().ok, true);assert.equal(f.saved.get(f.D.storageKey), stable);
const editable = clone(demos[0]);editable.name = '用户编辑后的演示任务';assert.equal(f.D.saveJob(editable, editable.id).ok, true);
const edited = JSON.stringify(f.D.job(editable.id)), frozenHistory = JSON.stringify(f.D.runs(editable.id));
const deleted = demos[1].id;assert.equal(f.D.deleteJob(deleted).ok, true);
const afterChanges = f.saved.get(f.D.storageKey);assert.equal(f.D.initialize().ok, true);
assert.equal(f.saved.get(f.D.storageKey), afterChanges);assert.equal(JSON.stringify(f.D.job(editable.id)), edited);
assert.equal(JSON.stringify(f.D.runs(editable.id)), frozenHistory);assert.equal(f.D.job(deleted), null);
const refreshed = fixture(true, f.saved);assert.equal(refreshed.D.initialize().ok, true);
assert.equal(refreshed.saved.get(refreshed.D.storageKey), afterChanges);assert.equal(refreshed.D.job(deleted), null);
assert.equal(refreshed.notifications.length, 0);

// Source rows may carry the Agent display name instead of its authored ID.
const aliases = fixture(true);aliases.rows.forEach(row => { delete row.agentId; });
assert.equal(aliases.D.initialize().ok, true);
const aliasDemos = aliases.D.listJobs().filter(job => job.id.startsWith('UJ-DEMO-'));
assert.equal(aliasDemos.length, 11);
assert(aliases.D.runs().some(run => run.jobId.startsWith('UJ-DEMO-')), 'Display-name Agent linkage still supplies real evidence for example history');
for (const job of aliasDemos)assert(aliases.catalog.some(task => task.sceneId === job.selector.sceneId && task.agentId === job.selector.agentId));

// A host which has not received its traffic yet can finish the migration on a later initialization.
const delayed = fixture(true), laterRows = clone(delayed.rows);delayed.rows.splice(0);
assert.equal(delayed.D.initialize().ok, true);
assert.equal(JSON.parse(delayed.saved.get(delayed.D.storageKey)).onlineTaskDemoVersion, undefined);
delayed.rows.push(...laterRows);assert.equal(delayed.D.initialize().ok, true);
assert.equal(delayed.D.listJobs().filter(job => job.id.startsWith('UJ-DEMO-')).length, 11);

// Business demonstration history keeps a definite non-match distinct from unavailable recognition.
const noMatch = fixture(true);noMatch.rows[0].taskExecutions = [];
assert.equal(noMatch.D.initialize().ok, true);
const noMatchJob = noMatch.D.listJobs().find(job => job.id.startsWith('UJ-DEMO-') && job.selector.targetType === 'task_execution' && job.selector.sceneId === 'sales');
const noMatchRun = noMatch.D.runs(noMatchJob.id)[0];assert(noMatchRun);
assert.equal(noMatchRun.assessed, 0);assert.equal(noMatchRun.recognition.notMatched, 1);
assert.equal(noMatchRun.objectResults[0].reasonCode, 'TASK_NOT_MATCHED');assert.equal(noMatchRun.objectResults[0].decision, 'failed');
assert.equal(noMatchRun.objectResults[0].evaluatorResults.length, 0);
const unavailable = fixture(true);delete unavailable.rows[0].taskExecutions;
assert.equal(unavailable.D.initialize().ok, true);
const uncertainJob = unavailable.D.listJobs().find(job => job.id.startsWith('UJ-DEMO-') && job.selector.targetType === 'task_execution' && job.selector.sceneId === 'sales');
const uncertainRun = unavailable.D.runs(uncertainJob.id)[0];assert(uncertainRun);
assert.equal(uncertainRun.assessed, 0);assert.equal(uncertainRun.objectResults[0].decision, 'inconclusive');
assert.equal(uncertainRun.objectResults[0].reasonCode, 'TASK_RECOGNITION_INCONCLUSIVE');

// Existing default policies upgrade separately from curated V2 resources and frozen histories.
const oldPolicies=fixture(true);assert(oldPolicies.D.initialize().ok);
const oldState=JSON.parse(oldPolicies.saved.get(oldPolicies.D.storageKey)),partialIds=new Set(['UJ-DEMO-SALES-TRACE','UJ-DEMO-PROCUREMENT-TASK','UJ-DEMO-SENTIMENT']);
function oldPolicy(id){return partialIds.has(id)?{type:'at_least',minPassed:1}:{type:'all'};}
for(const job of oldState.jobs){job.passPolicy=oldPolicy(job.id);job.judgeRuntime=null;delete job.demoPolicyVersion;}
for(const run of oldState.runs){run.jobSnapshot.passPolicy=oldPolicy(run.jobId);run.jobSnapshot.judgeRuntime=null;for(const result of run.objectResults || [])result.passPolicySnapshot=oldPolicy(run.jobId);}
const customDefault=oldState.jobs.find(job=>job.id==='UJ-DEMO-SALES-SESSION');customDefault.name='用户改过的旧默认任务';
const removedDefault='UJ-DEMO-SALES-SPAN';oldState.jobs=oldState.jobs.filter(job=>job.id!==removedDefault);
const unchangedDefault=oldState.jobs.find(job=>job.id==='UJ-DEMO-SALES-TRACE');unchangedDefault.revision=9;unchangedDefault.incrementalSince='2026-11-09T03:55:00Z';unchangedDefault.armedAt='2026-11-09T03:58:00Z';unchangedDefault.updatedAt='2026-11-09T03:59:00Z';
const ownJob={...clone(unchangedDefault),id:'USER-COUNT-JOB',name:'用户保留的旧数量任务'};oldState.jobs.push(ownJob);
delete oldState.onlineTaskPolicyVersion;delete oldState.sessionDemoPolicyVersion;
const historiesBefore=JSON.stringify(oldState.runs),assessmentsBefore=JSON.stringify(oldState.assessments),editedDefaultBefore=JSON.stringify(customDefault),ownBefore=JSON.stringify(ownJob),cursorBefore=unchangedDefault.incrementalSince,armedBefore=unchangedDefault.armedAt;
oldPolicies.saved.set(oldPolicies.D.storageKey,JSON.stringify(oldState));const notificationsBefore=oldPolicies.notifications.length;assert(oldPolicies.D.initialize().ok);
const upgraded=oldPolicies.D.job(unchangedDefault.id);assert.equal(upgraded.passPolicy.mode,'weighted_score');assert.equal(upgraded.passPolicy.passThreshold,80);assert.equal(upgraded.revision,10);assert.equal(upgraded.incrementalSince,cursorBefore);assert.equal(upgraded.armedAt,armedBefore);
assert.equal(oldPolicies.D.job('UJ-SESSION-DEMO').passPolicy.mode,'custom_prompt');assert.equal(oldPolicies.D.job('UJ-DEMO-OBSERVATION').passPolicy.mode,'custom_prompt');
const upgradedState=JSON.parse(oldPolicies.saved.get(oldPolicies.D.storageKey));assert.equal(JSON.stringify(upgradedState.runs),historiesBefore);assert.equal(JSON.stringify(upgradedState.assessments),assessmentsBefore);assert.equal(JSON.stringify(upgradedState.jobs.find(job=>job.id===customDefault.id)),editedDefaultBefore);assert.equal(JSON.stringify(upgradedState.jobs.find(job=>job.id===ownJob.id)),ownBefore);assert.equal(oldPolicies.D.job(removedDefault),null);assert.equal(oldPolicies.notifications.length,notificationsBefore);
const upgradedStable=oldPolicies.saved.get(oldPolicies.D.storageKey);assert(oldPolicies.D.initialize().ok);assert.equal(oldPolicies.saved.get(oldPolicies.D.storageKey),upgradedStable,'policy migration is one-time and never rewrites a deleted default or frozen history');
// The new AIOps host explicitly opts in; the workshop and ordinary API consumers do not.
assert.match(fs.readFileSync('dist/aiops/aiops.js', 'utf8'), /seedOnlineTaskDemos:\s*true/);
assert.doesNotMatch(fs.readFileSync('dist/index.html', 'utf8'), /seedOnlineTaskDemos/);
console.log('PASS online evaluation demos: current score/custom defaults, preserved legacy-policy migration, opt-in examples, source-backed diverse task examples and frozen Mock histories, reference integrity, no initialization callbacks, idempotency and authored-state preservation.');
