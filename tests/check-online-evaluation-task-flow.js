const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const clone = value => JSON.parse(JSON.stringify(value));
const range = { from: '2026-11-09T03:00:00Z', to: '2026-11-09T05:00:00Z' };

function fixture() {
  let now = Date.parse('2026-11-09T04:00:00Z'), scans = 0;
  const saved = new Map(), notifications = [];
  const storage = { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) };
  const task = { id: 'TASK-SALES', name: '销售分货', version: 'V1', sceneId: 'sales', agentId: 'sales-agent', dimensions: [] };
  const otherTask = { id: 'TASK-PROCUREMENT', name: '采购寻源', version: 'V1', sceneId: 'procurement', agentId: 'procurement-agent', dimensions: [] };
  const catalog = [task, otherTask];
  const rows = [
    { id: 'S-CLOSED', name: '生产完整会话', sceneId: 'sales', agentId: 'sales-agent', environment: 'production', status: 'closed', endedAt: '2026-11-09T03:40:00Z', tags: ['重点'], conversation: {
      rounds: [{ n: 1, inputId: 'C-U1', outputId: 'C-A1', input: '请执行销售分货', output: '已完成销售分货并生成方案。', inputAt: '2026-11-09T03:30:00Z', outputAt: '2026-11-09T03:40:00Z' }],
      records: [{ id: 'SPAN-STOCK', round: 1, type: 'tool', name: 'inventory_lookup', toolName: 'inventory_lookup', input: '查询库存', output: '库存充足', status: 'completed', startedAt: '2026-11-09T03:31:00Z', endedAt: '2026-11-09T03:32:00Z' }, { id: 'SPAN-MODEL', round: 1, type: 'model', name: 'answer', model: 'model-a', output: '方案已生成', status: 'completed', endedAt: '2026-11-09T03:40:00Z' }]
    } },
    { id: 'S-RECENT', name: '生产进行中会话', sceneId: 'sales', agentId: 'sales-agent', environment: 'production', status: 'active', conversation: {
      rounds: [{ n: 1, inputId: 'R-U1', outputId: 'R-A1', input: '库存查询失败，请协助', output: '正在处理', outputAt: '2026-11-09T03:58:00Z' }],
      records: [{ id: 'SPAN-FAILED', round: 1, type: 'tool', name: 'inventory_lookup', output: 'TIMEOUT', status: 'error', endedAt: '2026-11-09T03:57:00Z' }, { id: 'SPAN-PENDING', round: 1, type: 'tool', name: 'retry_lookup', status: 'running', startedAt: '2026-11-09T03:58:00Z' }]
    } },
    { id: 'S-STAGING', name: '预发布无关会话', sceneId: 'sales', agentId: 'sales-agent', environment: 'staging', status: 'closed', endedAt: '2026-11-09T03:25:00Z', conversation: {
      rounds: [{ n: 1, inputId: 'T-U1', outputId: 'T-A1', input: '你好', output: '您好', outputAt: '2026-11-09T03:25:00Z' }], records: []
    } },
    { id: 'S-WRONG-SCENE', name: '其他场景同名Agent数据', sceneId: 'procurement', agentId: 'sales-agent', environment: 'production', status: 'closed', endedAt: '2026-11-09T03:25:00Z', conversation: {
      rounds: [{ n: 1, inputId: 'X-U1', outputId: 'X-A1', input: '采购寻源', output: '已完成', outputAt: '2026-11-09T03:25:00Z' }], records: []
    } }
  ];
  const context = { console, Date, setInterval: () => 1, clearInterval() {}, localStorage: storage };
  context.window = context;
  context.AIOpsWorkspaces = { scopeCatalog: () => [{ id: 'sales', items: [{ id: 'sales-agent', name: '销售智能体', type: 'Agent' }] }, { id: 'procurement', items: [{ id: 'procurement-agent', name: '采购智能体', type: 'Agent' }] }] };
  context.AIOpsOnlineEvaluatorRuntime = { scanTaskSession(config, row) {
    scans++;
    if (row.id !== 'S-CLOSED') return [];
    return [{ id: 'EXEC-SALES', taskId: 'TASK-SALES', startMessageId: 'C-U1', completionMessageId: 'C-A1', completion: 'completed', evidence: ['C-U1', 'C-A1'], output: row.conversation.rounds[0].output }];
  } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('dist/aiops/unified-evaluation-data.js', 'utf8'), context, { filename: 'unified-evaluation-data.js' });
  // These fixtures exercise persisted legacy task flows. Current authoring is checked separately.
  const engine = context.AIOpsUnifiedData;
  const D = {...engine,
    saveEvaluator:(draft,id)=>engine.saveEvaluator(draft,id,{historicalImport:true}),
    publishEvaluator:id=>engine.publishEvaluator(id,{historicalImport:true}),
    saveJob:(draft,id)=>engine.saveJob(draft,id,{historicalImport:true})
  };
  D.configure({ storage, sessions: () => rows, businessTasks: () => catalog, now: () => now, onRun: run => notifications.push(clone(run)) });
  assert.equal(D.initialize().ok, true);
  function draft(targetType = 'session') {
    return { name: '在线任务流程检查', enabled: true, selector: { sceneId: 'sales', agentId: 'sales-agent', targetType, taskIds: targetType === 'task_execution' ? [task.id] : [], spanTypes: [], filter: { text: '', status: 'all', logic: 'all', conditions: [] } }, sampling: { rate: 100 }, readiness: { mode: 'any', idleMinutes: 10 }, trigger: { mode: 'manual', events: ['ready'] }, reEvaluation: { mode: 'on_change' }, schedule: { repeat: 'manual', timezone: 'Asia/Shanghai' }, bindings: [{ id: 'B-OUTPUT', evaluatorRef: { id: 'UE-OUTPUT-EXISTS', version: 'V1' }, targetType, role: 'gate', dimensionMappings: [], inputMapping: { actual: '/target/output' } }] };
  }
  function save(value) { const result = D.saveJob(value, value.id); assert.equal(result.ok, true, result.error); return result.record; }
  function backfill(id, extra = {}) { const result = D.runJob(id, { mode: 'backfill', range, ...extra }); assert.equal(result.ok, true, result.error); return result.run; }
  return { D, rows, task, otherTask, catalog, saved, storage, context, notifications, draft, save, backfill, setTime: value => { now = Date.parse(value); }, get scans() { return scans; } };
}

// Preview filters the same source data but never creates evaluations or invokes task recognition.
{
  const f = fixture(), d = f.draft();
  const before = f.saved.get(f.D.storageKey), count = f.D.runs().length;
  let preview = f.D.previewJob(d, { limit: 20 });
  assert.equal(preview.ok, true, preview.error);
  assert.equal(preview.summary.candidateCount, 3, 'Explicitly different scenes are excluded before matching source data');
  assert.equal(f.saved.get(f.D.storageKey), before);
  assert.equal(f.D.runs().length, count);
  assert.equal(f.D.assessments().length, 0);
  assert.equal(f.scans, 0);
  d.selector.filter.conditions = [{ id: 'PROD', field: 'environment', operator: 'equals', value: 'production' }, { id: 'ERROR', field: 'hasError', operator: 'equals', value: true }];
  preview = f.D.previewJob(d);
  assert.equal(preview.summary.candidateCount, 1);
  assert.equal(preview.items[0].sessionId, 'S-RECENT');
  d.selector.filter.logic = 'any';
  assert.equal(f.D.previewJob(d).summary.candidateCount, 2, 'OR matching is applied within the already-scoped candidate population');
  d.selector.filter.conditions = [{ id: 'TOOL', field: 'containsTool', operator: 'contains', value: 'inventory_lookup' }];
  assert.equal(f.D.previewJob(d).summary.candidateCount, 2, 'A matching child tool selects its entire session');
  d.readiness = { mode: 'idle', idleMinutes: 10 };
  preview = f.D.previewJob(d);
  assert.equal(preview.summary.readyCount, 1);
  assert.equal(preview.summary.waitingCount, 1);
  assert.equal(preview.items.find(item => item.sessionId === 'S-RECENT').ready, false);
  assert(preview.items.find(item => item.sessionId === 'S-RECENT').reason);
  assert.equal(f.saved.get(f.D.storageKey), before, 'Repeated preview and waiting checks remain read-only');
}

// Moving legacy fields into the single builder preserves AND constraints around an OR group.
{
  const f = fixture(), d = f.draft();
  d.selector.filter = { status: 'completed', text: 'inventory_lookup', logic: 'any', conditions: [
    { id: 'STAGING', field: 'environment', operator: 'equals', value: 'staging' },
    { id: 'IMPORTANT', field: 'tags', operator: 'contains', value: '重点' }
  ] };
  const original = f.D.previewJob(d);
  assert.equal(original.ok, true, original.error);
  assert.deepEqual(Array.from(original.items, item => item.id), ['S-CLOSED']);
  const before = f.saved.get(f.D.storageKey), migrated = f.D.normalizeJobFilter(d.selector);
  assert.equal(f.saved.get(f.D.storageKey), before, 'Preparing visible filter rows does not save or change the source task');
  assert.equal(migrated.status, 'all');assert.equal(migrated.text, '');assert.equal(migrated.logic, 'any');
  assert.equal(migrated.conditions.filter(condition => condition.required).length, 2);
  assert(migrated.conditions.some(condition => condition.field === 'ended' && condition.value === true));
  assert(migrated.conditions.some(condition => condition.field === 'keyword' && condition.value === 'inventory_lookup'));
  d.selector.filter = clone(migrated);
  assert.deepEqual(Array.from(f.D.previewJob(d).items, item => item.id), ['S-CLOSED'], 'Legacy mandatory fields must not join the ordinary OR group');
  const saved = f.save(d);
  assert.equal(saved.selector.filter.status, 'all');assert.equal(saved.selector.filter.text, '');
  assert.deepEqual(Array.from(f.D.previewJob(f.D.job(saved.id)).items, item => item.id), ['S-CLOSED']);
  f.rows[0].tags = [];
  assert.equal(f.D.previewJob(d).summary.candidateCount, 0, 'Mandatory rows passing cannot replace the original ordinary OR group');
  f.rows[0].tags = ['重点'];f.rows[0].status = 'failed';
  assert.deepEqual(Array.from(f.D.previewJob(d).items, item => item.id), ['S-CLOSED'], 'Completed means ended, including failed terminal sessions');
  d.selector.filter.conditions = [{ id: 'KEYWORD', field: 'keyword', operator: 'contains', value: 'inventory_lookup' }];d.selector.filter.logic = 'all';
  assert.equal(f.D.previewJob(d).summary.candidateCount, 2, 'The builder keyword field keeps full object and conversation matching');
}

// Span conditions target individual records, while session conditions keep their parent semantics.
{
  const f = fixture(), d = f.draft('span');
  d.selector.filter.conditions = [{ id: 'TYPE', field: 'spanType', operator: 'equals', value: 'tool' }, { id: 'ERROR', field: 'hasError', operator: 'equals', value: true }];
  const preview = f.D.previewJob(d);
  assert.equal(preview.summary.candidateCount, 1);
  assert.equal(preview.items[0].id, 'SPAN-FAILED');
  assert.equal(preview.items[0].sessionId, 'S-RECENT');
  assert.equal(f.D.previewJob({ ...clone(d), selector: { ...clone(d.selector), filter: { logic: 'all', conditions: [{ id: 'BAD', field: 'notAField', operator: 'equals', value: 'x' }] } } }).ok, false, 'Unknown field conditions are not silently ignored');
  assert.equal(f.D.previewJob({ ...clone(d), selector: { ...clone(d.selector), filter: { logic: 'all', conditions: [{ id: 'BAD-OP', field: 'spanType', operator: 'runJavascript', value: 'tool' }] } } }).ok, false, 'Unknown operators are rejected before scanning');
}

// Task identity is discovered only during execution; candidate-session sampling precedes recognition.
{
  const f = fixture(), d = f.draft('task_execution');
  const before = f.saved.get(f.D.storageKey), preview = f.D.previewJob(d);
  assert.equal(preview.ok, true, preview.error);
  assert.equal(preview.summary.candidateCount, 3);
  assert.equal(preview.summary.taskRecognitionPending, true);
  assert(preview.items.every(item => item.recognition === 'pending'));
  assert.equal(f.scans, 0);
  assert.equal(f.saved.get(f.D.storageKey), before);
  d.sampling.rate = 0;
  const none = f.save(d), noneRun = f.backfill(none.id);
  assert.equal(f.scans, 0, 'Sampled-out candidate sessions are not sent through task recognition');
  assert.equal(noneRun.assessed, 0);
  d.sampling.rate = 100;
  const all = f.save(d), allRun = f.backfill(all.id);
  assert.equal(f.scans, 3);
  assert.equal(allRun.recognition.scanned, 3);
  assert.equal(allRun.recognition.matched, 1);
  assert.equal(allRun.recognition.notMatched, 2);
  assert.equal(allRun.recognition.executions, 1);
  assert.equal(allRun.assessed, 1, 'Task non-matches fail at the final-result layer without fabricating evaluator assessments');
  assert.equal(allRun.objectResults.length, 3);
  assert.equal(allRun.objectResults.filter(result => result.reasonCode === 'TASK_NOT_MATCHED' && result.decision === 'failed').length, 2);
  assert(allRun.objectResults.filter(result => result.reasonCode === 'TASK_NOT_MATCHED').every(result => !result.evaluatorResults.length));
  assert.equal(f.D.assessments(all.id)[0].targetRef.id, 'EXEC-SALES');
  f.rows[0].conversation.rounds[0].output = '销售分货方案补充证据。';
  f.rows[0].conversation.rounds[0].outputAt = '2026-11-09T03:45:00Z';
  assert.equal(f.backfill(all.id).assessed, 1);
  assert.equal(new Set(f.D.assessments(all.id).map(assessment => assessment.targetRef.id)).size, 1, 'New evidence re-evaluates the existing logical task execution');
  const invalid = f.draft('task_execution'); invalid.selector.taskIds = [f.otherTask.id];
  assert.equal(f.D.saveJob(invalid).ok, false, 'Task definitions must belong to the selected scene and Agent');
}

// A missing semantic recognizer is distinguishable from a genuine no-match decision.
{
  const f = fixture(), d = f.draft('task_execution');
  delete f.context.AIOpsOnlineEvaluatorRuntime;
  const job = f.save(d), before = f.D.assessments(job.id).length;
  const result = f.D.runJob(job.id, { mode: 'backfill', range });
  if (result.ok) {
    assert.equal(result.run.recognition.notMatched, 0);
    assert.equal(result.run.recognition.inconclusive, 3);
    assert.equal(result.run.objectResults.length, 3);
    assert(result.run.objectResults.every(verdict => verdict.decision === 'inconclusive'));
    assert(result.run.objectResults.every(verdict => verdict.reasonCode !== 'TASK_NOT_MATCHED'));
  }
  assert.equal(f.D.assessments(job.id).length, before, 'Unavailable recognition cannot invent task instances or failed assessments');
}

// A generic evaluator applies to every selected business definition discovered in the candidate session.
{
  const f = fixture(), second = { ...clone(f.task), id: 'TASK-SALES-REVIEW', name: '销售风险审核' };
  f.catalog.push(second);
  f.context.AIOpsOnlineEvaluatorRuntime.scanTaskSession = (_config, row) => row.id === 'S-CLOSED' ? [f.task, second].map(task => ({ id: 'EXEC-' + task.id, taskId: task.id, startMessageId: 'C-U1', completionMessageId: 'C-A1', completion: 'completed', evidence: ['C-U1', 'C-A1'], output: '任务已完成。' })) : [];
  const d = f.draft('task_execution');d.selector.taskIds.push(second.id);
  const job = f.save(d), run = f.backfill(job.id);
  assert.equal(run.recognition.matched, 1);assert.equal(run.recognition.executions, 2);assert.equal(run.assessed, 2);
  assert.deepEqual(Array.from(f.D.assessments(job.id), result => result.taskSnapshot.id).sort(), [f.task.id, second.id].sort());
  const scoped = clone(job);scoped.bindings[0].taskRef={id:f.task.id,version:f.task.version};
  assert.equal(f.D.saveJob(scoped,job.id).ok,true);
  scoped.selector.taskIds=[second.id];const beforeInvalidScope=f.saved.get(f.D.storageKey);
  assert.equal(f.D.saveJob(scoped,job.id).ok,false,'Removing a selected definition requires explicit evaluator scope correction');
  assert.equal(f.saved.get(f.D.storageKey),beforeInvalidScope,'A stale task-specific scope cannot overwrite the saved configuration');
  delete scoped.bindings[0].taskRef;scoped.bindings[0].dimensionMappings=[];
  assert.equal(f.D.saveJob(scoped,job.id).ok,true,'Explicitly choosing all selected definitions corrects the stale scope');
}

// Repeated scans preserve history; the first-only policy differs from evidence-update re-evaluation.
{
  const f = fixture(), initial = f.draft();
  initial.selector.filter.conditions = [{ id: 'ONE', field: 'name', operator: 'equals', value: '生产完整会话' }];
  const job = f.save(initial), first = f.backfill(job.id);
  assert.equal(first.assessed, 1);
  const history = clone(f.D.assessments(job.id));
  assert.equal(f.backfill(job.id).assessed, 0);
  f.rows[0].conversation.rounds[0].output = '补充后的销售分货方案。';
  f.rows[0].conversation.rounds[0].outputAt = '2026-11-09T03:45:00Z';
  assert.equal(f.backfill(job.id).assessed, 1);
  assert.equal(f.D.assessments(job.id).length, 2);
  assert.deepEqual(clone(f.D.assessments(job.id)[1]), history[0], 'Old evidence and verdict snapshots remain immutable');
  const once = clone(initial); once.name = '只评首次'; once.reEvaluation.mode = 'first_only';
  const onceJob = f.save(once);
  assert.equal(f.backfill(onceJob.id).assessed, 1);
  f.rows[0].conversation.rounds[0].output = '第二次新增证据。';
  f.rows[0].conversation.rounds[0].outputAt = '2026-11-09T03:46:00Z';
  assert.equal(f.backfill(onceJob.id).assessed, 0, 'First-only policy skips changed evidence for an already-evaluated target');
  assert.equal(f.D.job(onceJob.id).reEvaluation.mode, 'first_only');
  assert.equal(f.D.job(job.id).selector.filter.conditions[0].field, 'name', 'Structured filters survive save/reload');
}

// Automatic events ignore retained batch restrictions, while scope and event conditions remain binding.
{
  const f=fixture(), d=f.draft('span');
  d.trigger={mode:'automatic',events:['negative_feedback','evaluation_result'],evaluationCondition:{key:'quality',operator:'lte',value:0.5}};
  d.selector.spanTypes=['tool'];
  d.selector.filter={status:'retired-status',text:'never matches current traffic',logic:'all',conditions:[{id:'ENV',field:'environment',operator:'equals',value:'staging'},{id:'NAME',field:'name',operator:'equals',value:'a completely different Span'},{id:'RETIRED',field:'retired-field',operator:'retired-operator',value:'x'}]};
  const job=f.save(d), saved=JSON.stringify(f.D.job(job.id));
  const preview=f.D.previewJob(f.D.job(job.id));assert.equal(preview.ok,true,preview.error);assert.equal(preview.summary.candidateCount,4,'Automatic internal source selection ignores both stale batch conditions and Span-type restrictions');assert(preview.items.some(item=>item.id==='SPAN-MODEL'));
  assert.equal(JSON.stringify(f.D.job(job.id)),saved,'Ignoring batch-only settings cannot erase their saved drafts');
  f.setTime('2026-11-09T04:01:00Z');
  const high=f.D.emitEvent({id:'EVENT-ONLY-HIGH',type:'evaluation_result',jobId:job.id,sessionId:'S-CLOSED',targetId:'SPAN-MODEL',key:'quality',value:0.9});assert.equal(high.ok,true);assert.equal(f.D.assessments(job.id).length,0,'The configured event threshold still applies');
  const low=f.D.emitEvent({id:'EVENT-ONLY-LOW',type:'evaluation_result',jobId:job.id,sessionId:'S-CLOSED',targetId:'SPAN-MODEL',key:'quality',value:0.2});assert.equal(low.ok,true,low.error);assert.equal(f.D.assessments(job.id).length,1,'A matching event can evaluate a model Span even when the inactive batch draft says tool-only');
  const run=f.D.runs(job.id)[0];assert.equal(run.selectionSnapshot.mode,'event');assert.deepEqual(Array.from(run.selectionSnapshot.selector.spanTypes),[]);assert.equal(run.selectionSnapshot.selector.filter.conditions.length,0);assert.deepEqual(Array.from(run.jobSnapshot.selector.filter.conditions,item=>item.field),['environment','name','retired-field','keyword'],'The frozen job retains the inactive drafts separately from the applied selection');
  assert.equal(run.targetSnapshots[0].id,'SPAN-MODEL');
  const count=f.D.assessments(job.id).length;
  f.D.emitEvent({id:'EVENT-ONLY-WRONG-SCENE',type:'negative_feedback',jobId:job.id,sessionId:'S-WRONG-SCENE',targetId:'SPAN-MODEL'});
  const wrongAgent=clone(f.rows[0]);wrongAgent.id='S-WRONG-AGENT';wrongAgent.agentId='procurement-agent';wrongAgent.conversation.records[0].id='SPAN-WRONG-AGENT';f.rows.push(wrongAgent);
  f.D.emitEvent({id:'EVENT-ONLY-WRONG-AGENT',type:'negative_feedback',jobId:job.id,sessionId:wrongAgent.id,targetId:'SPAN-WRONG-AGENT'});assert.equal(f.D.assessments(job.id).length,count,'Event routing cannot bypass the task scene or Agent scope');
  const invalidManual=clone(f.D.job(job.id));invalidManual.trigger.mode='manual';assert.equal(f.D.saveJob(invalidManual,job.id).ok,false,'Retained unsupported batch filters become validated when manual mode activates them');
}

// Manual and scheduled modes apply the same retained source criteria; automatic mode makes them inert.
{
  const f=fixture(), d=f.draft();d.selector.filter.conditions=[{id:'ONE',field:'name',operator:'equals',value:'生产完整会话'}];
  const job=f.save(d);assert.equal(f.D.previewJob(job).summary.candidateCount,1);
  const scheduled=clone(f.D.job(job.id));scheduled.trigger.mode='scheduled';scheduled.schedule={repeat:'daily',time:'09:00',timezone:'Asia/Shanghai'};f.save(scheduled);assert.equal(f.D.previewJob(f.D.job(job.id)).summary.candidateCount,1);
  const automatic=clone(f.D.job(job.id));automatic.trigger.mode='automatic';automatic.trigger.events=['negative_feedback'];f.save(automatic);assert.equal(f.D.previewJob(f.D.job(job.id)).summary.candidateCount,3);
  const all=f.backfill(job.id);assert.equal(all.assessed,3,'Even an explicit run of an automatic task uses the event-mode source scope');assert.equal(all.selectionSnapshot.mode,'event');
  const restored=clone(f.D.job(job.id));restored.trigger.mode='manual';f.save(restored);assert.equal(f.D.previewJob(f.D.job(job.id)).summary.candidateCount,1);assert.equal(f.D.job(job.id).selector.filter.conditions[0].value,'生产完整会话');
  const narrow=f.backfill(job.id);assert.equal(narrow.selectionSnapshot.mode,'filter');assert.equal(narrow.selectionSnapshot.selector.filter.conditions[0].field,'name');
}

// Explicit feedback is a fresh trigger even when content has already been evaluated.
{
  const f = fixture(), d = f.draft();
  d.selector.filter.conditions = [{ id: 'ONE', field: 'name', operator: 'equals', value: '生产完整会话' }];
  d.trigger = { mode: 'automatic', events: ['negative_feedback'] };
  const job = f.save(d);
  const baseline=f.backfill(job.id).assessed;assert.equal(baseline,3,'An automatic task ignores its retained batch-only name condition');
  f.setTime('2026-11-09T04:01:00Z');
  const event = { id: 'FEEDBACK-1', type: 'negative_feedback', jobId: job.id, sessionId: 'S-CLOSED', value: -1 };
  const emitted = f.D.emitEvent(event);
  assert.equal(emitted.ok, true, emitted.error);
  assert(emitted.results.some(result => result.ok && result.run && result.run.assessed === 1), 'A new feedback event can evaluate already-seen contents');
  assert.equal(f.D.assessments(job.id).length, baseline+1);
  const beforeReplay = f.saved.get(f.D.storageKey);
  assert.equal(f.D.emitEvent(event).ok, true);
  assert.equal(f.saved.get(f.D.storageKey), beforeReplay, 'The same event ID is idempotent');
  assert.equal(f.D.assessments(job.id).length, baseline+1);
  const unrelated = f.D.emitEvent({ id: 'FEEDBACK-OTHER', type: 'negative_feedback', jobId: job.id, sessionId: 'S-WRONG-SCENE', value: -1 });
  assert.equal(unrelated.ok, true);
  assert.equal(f.D.assessments(job.id).length, baseline+1, 'Event routing cannot bypass task scene and Agent scope');
  f.D.setJobEnabled(job.id, false);
  f.D.emitEvent({ id: 'FEEDBACK-DISABLED', type: 'negative_feedback', jobId: job.id, sessionId: 'S-CLOSED', value: -1 });
  assert.equal(f.D.assessments(job.id).length, baseline+1, 'Disabled jobs do not process new automatic events');
}

// A feedback event waits for the selected object to become ready and is consumed exactly once.
{
  const f = fixture(), d = f.draft();
  d.selector.filter.conditions = [{ id: 'ONE', field: 'name', operator: 'equals', value: '生产完整会话' }];
  d.trigger = { mode: 'automatic', events: ['negative_feedback'] };
  d.readiness = { mode: 'idle', idleMinutes: 10 };
  const job = f.save(d);
  delete f.rows[0].endedAt; f.rows[0].status = 'active'; f.rows[0].conversation.rounds[0].outputAt = '2026-11-09T03:59:00Z';
  f.D.scheduler.tick();
  f.setTime('2026-11-09T04:01:00Z');
  const event = { id: 'WAITING-FEEDBACK', type: 'negative_feedback', jobId: job.id, sessionId: 'S-CLOSED', value: -1 };
  assert.equal(f.D.emitEvent(event).ok, true);
  assert.equal(f.D.assessments(job.id).length, 0, 'An arriving event does not bypass the configured idle condition');
  const beforeReplay = f.saved.get(f.D.storageKey);
  assert.equal(f.D.emitEvent(event).ok, true);
  assert.equal(f.saved.get(f.D.storageKey), beforeReplay);
  f.setTime('2026-11-09T04:11:00Z');f.D.scheduler.tick();
  assert.equal(f.D.assessments(job.id).length, 1, 'A retained event is processed after the same target becomes idle');
  const afterHandled = f.saved.get(f.D.storageKey);
  f.setTime('2026-11-09T04:11:01Z');f.D.scheduler.tick();
  assert.equal(f.D.assessments(job.id).length, 1);
  assert.equal(f.saved.get(f.D.storageKey), afterHandled, 'A consumed event produces no further writes');
}

// Continuous readiness polling stays quiet without new eligible evidence.
{
  const f = fixture(), d = f.draft();
  d.trigger = { mode: 'automatic', events: ['ready'] };
  const job = f.save(d), before = f.saved.get(f.D.storageKey), runs = f.D.runs(job.id).length;
  f.D.scheduler.tick();f.setTime('2026-11-09T04:00:01Z');f.D.scheduler.tick();f.setTime('2026-11-09T04:00:02Z');f.D.scheduler.tick();
  assert.equal(f.D.runs(job.id).length, runs);
  assert.equal(f.saved.get(f.D.storageKey), before, 'Readiness ticks cannot fill the ledger with empty runs');
  f.rows[0].conversation.rounds[0].outputAt = '2026-11-09T04:00:03Z';
  f.setTime('2026-11-09T04:00:04Z');f.D.scheduler.tick();
  assert.equal(f.D.assessments(job.id).length, 1);
  const after = f.saved.get(f.D.storageKey);
  f.setTime('2026-11-09T04:00:05Z');f.D.scheduler.tick();
  assert.equal(f.saved.get(f.D.storageKey), after, 'An unchanged ready object remains deduplicated during automatic polling');
}

// Terminal failed traces can be ready even when no assistant output was produced.
for (const status of ['failed', 'cancelled', 'timeout']) {
  const f = fixture(), d = f.draft('trace');
  d.selector.filter.conditions = [{ id: 'ONE', field: 'sessionName', operator: 'equals', value: '生产完整会话' }];d.readiness.mode = 'completed';
  const turn = f.rows[0].conversation.rounds[0];turn.hasOutput = false;turn.output = '';turn.status = status;turn.endedAt = '2026-11-09T03:40:00Z';
  const preview = f.D.previewJob(d);
  assert.equal(preview.ok, true, preview.error);assert.equal(preview.summary.candidateCount, 1);assert.equal(preview.summary.readyCount, 1, status + ' is a terminal execution state');
}

// Names select the intended object; contains is partial matching and equals is exact.
{
  const f = fixture();
  f.rows[0].conversation.rounds[0].traceName = 'Sales allocation main';
  const trace = f.draft('trace');
  trace.selector.filter.conditions = [{ id: 'NAME', field: 'name', operator: 'contains', value: 'ALLOCATION' }];
  assert.deepEqual(Array.from(f.D.previewJob(trace).items, item => item.id), ['S-CLOSED:trace:1']);
  trace.selector.filter.conditions[0].operator = 'equals';
  assert.equal(f.D.previewJob(trace).summary.candidateCount, 0, 'An exact name does not accept a substring');
  trace.selector.filter.conditions[0].value = 'Sales allocation main';
  assert.equal(f.D.previewJob(trace).summary.candidateCount, 1);
  trace.selector.filter.conditions[0].value = f.rows[0].name;
  assert.equal(f.D.previewJob(trace).summary.candidateCount, 0, 'Trace name must not silently match its parent session title');
  trace.selector.filter.conditions[0].field = 'sessionName';
  assert.equal(f.D.previewJob(trace).summary.candidateCount, 1);
  const task = f.draft('task_execution');
  assert.equal(f.D.filterFields('task_execution').find(field => field.id === 'name').label, '会话名称');
  task.selector.filter.conditions = [{ id: 'SESSION', field: 'name', operator: 'contains', value: '完整' }];
  assert.deepEqual(Array.from(f.D.previewJob(task).items, item => item.id), ['S-CLOSED']);
  assert.equal(f.scans, 0, 'Task candidate filters remain session-scoped before recognition');
}

function finalRule(f, name, value, observe = false) {
  const record = clone(f.D.evaluator('UE-OUTPUT-EXISTS', 'V1'));
  record.name = name;record.description = name;
  record.method.checks = [{ metricId: 'output_exists', inputPath: value === 'execution_error' ? '/reference' : value === 'unknown' ? '/actual/missing' : '/actual', operator: ['unknown','execution_error'].includes(value) ? 'equals' : 'exists', ...(['unknown','execution_error'].includes(value) ? { expected: true } : {}), onTrue: value === true, onFalse: value === true }];
  record.decision = observe ? { type: 'none', missingEvidence: 'inconclusive' } : { type: 'boolean_equals', metricId: 'output_exists', value: true, missingEvidence: 'inconclusive' };
  const saved = f.D.saveEvaluator(record);assert.equal(saved.ok, true, saved.error);
  const published = f.D.publishEvaluator(saved.record.id);assert.equal(published.ok, true, published.error);
  return f.D.evaluator(saved.record.id, 'V1');
}
function finalBinding(record, index, role = 'gate') { return { id: 'FINAL-' + index, evaluatorRef: { id: record.id, version: record.version }, targetType: 'session', role, dimensionMappings: [], inputMapping: { actual: '/target/output' } }; }
function oneFinalSession(f) { const d=f.draft();d.selector.filter.conditions=[{id:'ONE',field:'name',operator:'equals',value:'生产完整会话'}];return d; }

// Final decisions aggregate evaluator verdicts, while preserving each evaluator's own result.
{
  const f=fixture(), yes=finalRule(f,'明确通过',true), no=finalRule(f,'明确未通过',false), observation=finalRule(f,'仅观察',true,true), d=oneFinalSession(f);
  d.bindings=[finalBinding(yes,1),finalBinding(no,2),finalBinding(observation,3,'observe')];d.passPolicy={type:'all'};
  const job=f.save(d), first=f.backfill(job.id), verdict=first.objectResults[0];
  assert.equal(first.assessed,3);assert.equal(first.objectResults.length,1,'One target has one final verdict despite three evaluator calls');
  assert.equal(verdict.decision,'failed');assert.equal(verdict.counts.total,2);assert.equal(verdict.counts.passed,1);assert.equal(verdict.counts.failed,1);assert.equal(verdict.counts.observed,1);assert.equal(verdict.required,2);
  const frozen=JSON.stringify(first.objectResults), assessments=JSON.stringify(f.D.assessments(job.id));
  const edited=clone(f.D.job(job.id));edited.passPolicy={type:'at_least',minPassed:1};f.save(edited);
  const second=f.backfill(job.id);assert.equal(second.assessed,0,'Changing only the job pass policy reuses valid frozen evaluator assessments');
  assert.equal(second.objectResults[0].decision,'passed');assert.equal(second.objectResults[0].counts.failed,1,'The final pass does not erase a failed child evaluator');
  assert.equal(JSON.stringify(f.D.assessments(job.id)),assessments);assert.equal(JSON.stringify(f.D.runs(job.id).find(run=>run.id===first.id).objectResults),frozen);
  assert.equal(second.objectResults[0].passPolicySnapshot.minPassed,1);assert.equal(verdict.passPolicySnapshot.type,'all');
  assert.equal(f.D.objectResults(job.id).length,2);
  for(const minPassed of [0,3,1.5]) { const invalid=clone(edited);invalid.passPolicy={type:'at_least',minPassed};assert.equal(f.D.saveJob(invalid,job.id).ok,false,'Invalid evaluator-count thresholds cannot silently save'); }
}

// Missing evidence is uncertain; partial passing uses reachable bounds and observations never auto-pass.
{
  const f=fixture(), yes=finalRule(f,'通过',true), unknown=finalRule(f,'缺少比较证据','unknown'), d=oneFinalSession(f);
  d.bindings=[finalBinding(yes,1),finalBinding(unknown,2)];d.passPolicy={type:'all'};
  const job=f.save(d), all=f.backfill(job.id);assert.equal(all.objectResults[0].decision,'inconclusive');assert.equal(all.objectResults[0].counts.inconclusive,1);
  const partial=clone(f.D.job(job.id));partial.passPolicy={type:'at_least',minPassed:1};f.save(partial);
  assert.equal(f.backfill(job.id).objectResults[0].decision,'passed');
  const observe=finalRule(f,'全观察',true,true), observation=oneFinalSession(f);observation.name='所有评估器仅观察';observation.bindings=[finalBinding(observe,1,'observe')];observation.passPolicy={type:'all'};
  const observed=f.backfill(f.save(observation).id).objectResults[0];assert.equal(observed.decision,'not_applicable');assert.equal(observed.counts.total,0);assert.equal(observed.counts.observed,1);
}

// Multiple selected task definitions are alternatives: any one match passes the recognition gate.
{
  const f=fixture(), second={...clone(f.task),id:'TASK-ALTERNATIVE',name:'销售风险复核'};f.catalog.push(second);
  const d=f.draft('task_execution');d.selector.taskIds.push(second.id);d.selector.filter.conditions=[{id:'SOURCE',field:'name',operator:'equals',value:'生产完整会话'}];d.passPolicy={type:'all'};
  const run=f.backfill(f.save(d).id);assert.equal(run.recognition.matched,1);assert.equal(run.assessed,1);assert.equal(run.objectResults.length,1);
  assert.equal(run.objectResults[0].decision,'passed');assert(!run.objectResults.some(result=>result.reasonCode==='TASK_NOT_MATCHED'),'An unmatched alternative task must not fail a session with another selected task match');
}

// A newly triggered execution failure overrides an older success on the identical evidence/config.
{
  const f=fixture();f.rows.splice(1); // Isolate one source object; automatic mode does not apply a batch name filter.
  const evaluator=finalRule(f,'暂时无法执行的评估器','execution_error'), d=oneFinalSession(f);
  d.bindings=[finalBinding(evaluator,1)];d.trigger={mode:'automatic',events:['negative_feedback']};d.passPolicy={type:'all'};
  const job=f.save(d), initial=f.backfill(job.id);assert.equal(initial.failedExecutions,1);
  // Seed a previous external judge success, then let this deterministic fixture reproduce the next failure.
  const state=JSON.parse(f.saved.get(f.D.storageKey)),prior=state.assessments.find(assessment=>assessment.jobId===job.id);
  prior.executionStatus='succeeded';prior.decision='passed';delete prior.error;prior.metricResults=[{metricId:'output_exists',value:true,decision:'passed',reason:'先前外部评估器明确通过'}];
  const oldVerdict=state.runs.find(run=>run.id===initial.id).objectResults[0];oldVerdict.decision='passed';oldVerdict.counts={total:1,passed:1,failed:0,inconclusive:0,observed:0};
  f.storage.setItem(f.D.storageKey,JSON.stringify(state));f.setTime('2026-11-09T04:01:00Z');
  const event=f.D.emitEvent({id:'FRESH-FAILED-JUDGE',type:'negative_feedback',jobId:job.id,sessionId:'S-CLOSED',value:-1});assert.equal(event.ok,true,event.error);
  const fresh=f.D.runs(job.id)[0];assert.equal(fresh.triggerEventId,'FRESH-FAILED-JUDGE');assert.equal(fresh.failedExecutions,1);
  assert.equal(fresh.objectResults[0].decision,'inconclusive','The new failed execution must not inherit the older content assessment pass');
  assert.equal(fresh.objectResults[0].counts.inconclusive,1);
  assert.equal(fresh.objectResults[0].evaluatorResults[0].assessmentId,fresh.assessmentIds[0]);
  assert.equal(f.D.runs(job.id).find(run=>run.id===initial.id).objectResults[0].decision,'passed','The historical result remains frozen');
}

// Invalid recognition and incomplete evidence are uncertainty, whereas valid empty recognition fails.
for(const scenario of ['null','undefined','throw','truncated','valid-empty']) {
  const f=fixture(), d=f.draft('task_execution');d.selector.filter.conditions=[{id:'SOURCE',field:'name',operator:'equals',value:'生产完整会话'}];
  f.context.AIOpsOnlineEvaluatorRuntime.scanTaskSession=()=>{if(scenario==='throw')throw Error('识别服务暂不可用');return scenario==='null'?null:scenario==='undefined'?undefined:[];};
  if(scenario==='truncated')f.rows[0].truncated=true;
  const run=f.backfill(f.save(d).id), verdict=run.objectResults[0];assert.equal(run.assessed,0);
  assert.equal(verdict.decision,scenario==='valid-empty'?'failed':'inconclusive',scenario);
  assert.equal(verdict.reasonCode,scenario==='valid-empty'?'TASK_NOT_MATCHED':'TASK_RECOGNITION_INCONCLUSIVE',scenario);
}

// No-match final results deduplicate, obey first-only, and still allow a fresh configured feedback event.
{
  const f=fixture(), d=f.draft('task_execution');d.selector.filter.conditions=[{id:'SOURCE',field:'name',operator:'equals',value:'预发布无关会话'}];
  d.trigger={mode:'automatic',events:['ready','negative_feedback']};d.reEvaluation={mode:'first_only'};
  const job=f.save(d);f.setTime('2026-11-09T04:01:00Z');
  const event={id:'NO-HIT-FEEDBACK-1',type:'negative_feedback',jobId:job.id,sessionId:'S-STAGING',value:-1};
  assert.equal(f.D.emitEvent(event).ok,true);assert.equal(f.D.objectResults(job.id).length,1);assert.equal(f.D.objectResults(job.id)[0].decision,'failed');
  const after=f.saved.get(f.D.storageKey);f.D.emitEvent(event);assert.equal(f.saved.get(f.D.storageKey),after);
  f.rows[2].conversation.rounds[0].output='新的无关回复';f.rows[2].conversation.rounds[0].outputAt='2026-11-09T04:02:00Z';f.setTime('2026-11-09T04:02:01Z');f.D.scheduler.tick();
  assert.equal(f.D.objectResults(job.id).length,1,'First-only suppresses evidence-only updates after a completed non-match verdict');
  f.D.emitEvent({...event,id:'NO-HIT-FEEDBACK-2'});assert.equal(f.D.objectResults(job.id).length,2,'A new explicit feedback event gets a separate final non-match verdict');
  assert.equal(f.D.assessments(job.id).length,0,'Repeated recognition failures still do not fabricate evaluator outputs');
}

// Capacity limits defer whole targets; an unprocessed object must not be falsely marked failed.
{
  const f=fixture();f.D.configure({storage:f.storage,sessions:()=>f.rows,businessTasks:()=>f.catalog,now:()=>Date.parse('2026-11-09T04:00:00Z'),maxTargetsPerRun:1});
  const job=f.save(f.draft()), first=f.backfill(job.id);assert.equal(first.deferred,2);assert.equal(first.objectResults.length,1);assert.equal(first.objectResults[0].decision,'passed');
  const second=f.backfill(job.id),third=f.backfill(job.id);assert.equal(second.objectResults.length,1);assert.equal(third.objectResults.length,1);
  assert.equal(new Set(f.D.objectResults(job.id).map(result=>result.targetRef.id)).size,3);
  assert(f.D.objectResults(job.id).every(result=>result.decision==='passed'));
}

// No-hit outcomes respect the same batch capacity and leave deferred source sessions available.
{
  const f=fixture();let at=Date.parse('2026-11-09T04:00:00Z');
  f.D.configure({storage:f.storage,sessions:()=>f.rows,businessTasks:()=>f.catalog,now:()=>at,maxTargetsPerRun:1});
  f.context.AIOpsOnlineEvaluatorRuntime.scanTaskSession=()=>[];
  const d=f.draft('task_execution');d.selector.filter.conditions=[{id:'ENDED',field:'ended',operator:'equals',value:true}];d.readiness.mode='completed';d.trigger={mode:'automatic',events:['ready']};
  const job=f.save(d);f.rows.forEach(row=>{row.updatedAt='2026-11-09T04:00:30Z';});at=Date.parse('2026-11-09T04:01:00Z');f.D.scheduler.tick();
  assert.equal(f.D.objectResults(job.id).length,1);assert.equal(f.D.runs(job.id)[0].deferred,1);
  at+=1000;f.D.scheduler.tick();assert.equal(f.D.objectResults(job.id).length,2);assert.equal(new Set(f.D.objectResults(job.id).map(result=>result.targetRef.id)).size,2);
  assert(f.D.objectResults(job.id).every(result=>result.reasonCode==='TASK_NOT_MATCHED'&&result.decision==='failed'));
  assert.equal(f.D.assessments(job.id).length,0);const complete=f.saved.get(f.D.storageKey);at+=1000;f.D.scheduler.tick();assert.equal(f.saved.get(f.D.storageKey),complete,'Completed no-hit sources leave no repeating empty automatic runs');
}

// Repeating the same evaluator version cannot inflate the number of passing evaluators.
{
  const f=fixture(), d=oneFinalSession(f);d.bindings.push({...clone(d.bindings[0]),id:'B-OUTPUT-DUPLICATE'});d.passPolicy={type:'at_least',minPassed:2};
  const before=f.saved.get(f.D.storageKey), saved=f.D.saveJob(d);
  assert.equal(saved.ok,false,'Duplicate binding IDs are not needed to detect the same evaluator repeated under new IDs');
  assert.match(saved.error,/重复|重叠|相同/);assert.equal(f.saved.get(f.D.storageKey),before,'An invalid duplicated vote cannot save a misleading threshold');
}

// The same evaluator can serve disjoint task scopes, but generic/specific or same-task overlaps are rejected.
{
  const f=fixture(), second={...clone(f.task),id:'TASK-DISJOINT',name:'销售独立复核'};f.catalog.push(second);
  const d=f.draft('task_execution');d.selector.taskIds.push(second.id);d.passPolicy={type:'at_least',minPassed:1};
  const first={...clone(d.bindings[0]),taskRef:{id:f.task.id,version:f.task.version}};
  const other={...clone(d.bindings[0]),id:'B-DISJOINT',taskRef:{id:second.id,version:second.version}};
  d.bindings=[first,other];const valid=f.save(d);assert.equal(valid.bindings.length,2,'Explicit disjoint business-task evaluator scopes remain reusable');
  const original=f.saved.get(f.D.storageKey), generic=clone(valid);delete generic.bindings[0].taskRef;
  assert.equal(f.D.saveJob(generic,valid.id).ok,false,'A generic evaluator overlaps an identical task-specific evaluator');
  const sameTask=clone(valid);sameTask.bindings[1].taskRef=clone(sameTask.bindings[0].taskRef);
  assert.equal(f.D.saveJob(sameTask,valid.id).ok,false,'Repeated identical task scope also duplicates the same evaluator vote');
  assert.equal(f.saved.get(f.D.storageKey),original,'Rejected overlap edits preserve the prior valid disjoint configuration');
}

console.log('PASS online evaluation task flow: read-only previews, structured object filters, readiness, candidate-session task recognition and sampling, final all/partial verdicts and immutable policy changes, uncertainty, task non-match gates, capacity, fresh feedback precedence, evaluator-scope overlap protection and idempotency.');
