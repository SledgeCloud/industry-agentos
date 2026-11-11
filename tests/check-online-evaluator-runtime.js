const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const app = fs.readFileSync('dist/aiops/aiops.js', 'utf8');
const source = app.match(/function sessionRows\([^)]*\) \{[\s\S]*?\n  \}(?=\n\n  function sessionTokenLabel)/)[0];
const clone = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const saved = new Map(); let fail = false, rows;
  const storage = { getItem: key => saved.get(key) || null, setItem(key, value) { if (fail) throw new Error('quota'); saved.set(key, value); } };
  const context = { console, Date, localStorage: storage, state: { sessionMarks: {} }, addEventListener() {}, document: { addEventListener() {}, querySelector() { return null; } } };
  context.window = context; vm.createContext(context); vm.runInContext(source, context);
  for (const file of ['workspace-nav.js', 'resource-ui.js', 'session-detail.js', 'business-tasks.js', 'online-evaluators-data.js', 'online-evaluators-runtime.js']) vm.runInContext(fs.readFileSync('dist/aiops/' + file, 'utf8'), context, { filename: file });
  const B = context.AIOpsBusinessTasks, R = context.AIOpsOnlineEvaluatorRuntime, D = context.AIOpsOnlineEvaluatorData;
  rows = context.sessionRows(); B.configure({ sessions: () => rows });
  R.configure({ sessions: () => rows, storage, now: () => '2026-11-05T00:00:00.000Z' });
  return { context, storage, saved, B, R, D, fail(value) { fail = value; }, rows(value) { if (value) rows = value; return rows; } };
}
const f = fixture(), { B, R, D } = f, store = D.createStore(f.storage);
const baseline = clone(B.summary(B.catalog())); assert.equal(baseline.executions, 28);
let draft = D.defaults('audit'); Object.assign(draft, { name: '业务任务识别测试', description: '核对独立任务与完整结果', tags: ['任务'], agentId: 'audit:agents:0', filterLogic: '全部正式用户会话' });
draft = D.bindTasks(draft, ['BT-001']);
assert.equal(draft.output.type, 'task-executions'); assert.equal(draft.samplingRate, 100); assert.equal(draft.taskSnapshots[0].version, 'v1.3');
assert(draft.prompt.includes('完成条件') && draft.prompt.includes('评估维度'));
const bad = clone(draft); bad.taskIds.push('BT-008'); assert(D.validate(bad).some(error => error.field === 'taskIds'));
bad.taskIds = ['BT-001']; bad.samplingRate = 20; assert(D.validate(bad).some(error => error.field === 'samplingRate'));
const tampered = clone(draft); tampered.taskSnapshots[0].criteria = ['伪造标准']; assert(!D.normalize(tampered).taskSnapshots[0].criteria.includes('伪造标准'));
const record = store.save(draft).record; assert(record);
const scanned = R.run(record); assert.equal(scanned.ok, true); assert.equal(scanned.run.recognized, 5); assert.equal(scanned.run.created, 1);
const items = R.results(record.id); assert.equal(items.length, 5);
const first = items.find(item => item.sessionId === 'CR-1024' && item.startRound === 1), second = items.find(item => item.sessionId === 'CR-1024' && item.startRound === 19);
assert(first && second); assert.equal(first.executionId, 'TR-1024'); assert.equal(first.completionRound, 17); assert.equal(first.completionMessageId, 'CR-1024-msg-034'); assert.equal(first.acceptance, 'pending');
assert.equal(second.completionRound, 21); assert.equal(second.acceptance, 'passed'); assert.notEqual(first.executionId, second.executionId);
assert.equal(items.find(item => item.sessionId === 'CR-1019').acceptance, 'rejected');
assert.equal(first.model, record.model); assert.equal(first.taskSnapshot.version, 'v1.3'); assert.equal(R.runs(record.id)[0].evaluatorSnapshot.model, record.model);
// Runtime executes the current persisted configuration, so simulate a genuinely stale
// saved task snapshot rather than an unsaved object the runtime intentionally ignores.
const configKey = 'aiops.online-evaluators.v1', currentConfigurations = f.saved.get(configKey);
const outdatedConfigurations = JSON.parse(currentConfigurations); outdatedConfigurations.find(item => item.id === record.id).taskSnapshots[0].version = 'v0.1';
f.saved.set(configKey, JSON.stringify(outdatedConfigurations));
const ledgerBeforeOutdated = f.saved.get(R.storageKey), outdatedRun = R.run(record);
assert.equal(outdatedRun.ok, false, 'A persisted task snapshot on an obsolete definition version cannot execute');
assert.match(outdatedRun.error, /业务任务定义|快照/);
assert.equal(f.saved.get(R.storageKey), ledgerBeforeOutdated, 'Rejecting a stale task definition cannot rewrite execution history');
f.saved.set(configKey, currentConfigurations);
assert.equal(B.summary(B.catalog()).executions, 29); assert.equal(B.records(['BT-001']).length, 5);
const rescan = R.run(record); assert.equal(rescan.ok, true); assert.equal(rescan.run.created, 0); assert.equal(rescan.run.updated, 0); assert.equal(rescan.run.unchanged, 5); assert.equal(R.results(record.id).length, 5); assert.equal(B.summary(B.catalog()).executions, 29);
const twin = store.save(Object.assign(clone(record), { id: undefined, name: '第二个评估器' })).record; assert(twin);
assert.equal(R.run(twin).run.created, 0); assert.equal(B.summary(B.catalog()).executions, 29, 'Evaluator identity does not multiply business executions');

// New evidence is updated on the same task execution, even after the session gains more turns.
const custom = { id: 'CR-CUSTOM', name: '自定义真实会话样例', agentId: 'audit:agents:0', agent: '关账审核智能体', time: '2026-11-05 08:00', messages: 4, tokens: '0.1', errors: 0, warnings: 0, conversation: [
  { n: 1, input: '请执行「月末关账审核」任务。', output: '正在整理资料，尚未生成完整任务产出。' },
  { n: 2, input: '继续补充「月末关账审核」的报表。', output: '资料收到。' }
] };
f.rows([custom]); const customScan = R.run(record); assert.equal(customScan.run.recognized, 1); const customResult = R.results(record.id).find(item => item.sessionId === custom.id); assert.equal(customResult.completion, 'running');
const task = B.definition('BT-001'); custom.conversation.push({ n: 3, input: '继续完成本次审核。', output: '已完成「月末关账审核」本次执行。\n' + task.dimensions.map(d => '- ' + d.name + '：符合。' + d.description).join('\n') + '\n通过标准核验：满足，逐项核验均符合。' }); custom.messages = 6;
const updated = R.run(record); assert.equal(updated.run.created, 0); assert.equal(updated.run.updated, 1); const updatedResult = R.results(record.id).find(item => item.sessionId === custom.id);
assert.equal(updatedResult.executionId, customResult.executionId); assert.equal(updatedResult.completion, 'completed'); assert.equal(updatedResult.acceptance, 'passed'); assert.equal(updatedResult.completionRound, 3);
assert(updatedResult.dimensions.every(item => item.value === '符合'), 'A criterion containing a negated error is not a failing assessment');

// Merely describing or declining a task is not a trigger.
for (const prompt of ['请解释「月末关账审核」任务的定义。', '什么是月末关账审核？', '不要执行「月末关账审核」，只是讨论。']) {
  const row = Object.assign({}, custom, { id: 'CR-MENTION-' + prompt, conversation: [{ n: 1, input: prompt, output: '任务说明。' }], messages: 2 });
  assert.equal(R.scanTaskSession(record, row).length, 0);
}
const beforeFailure = [...f.saved]; f.fail(true); const failed = R.run(record); assert.equal(failed.ok, false); assert.deepEqual([...f.saved], beforeFailure); f.fail(false);
function saveAndRunFilter(logic) {
  const saved = store.save(Object.assign(clone(record), { filterLogic: logic }), record.id);
  assert.equal(saved.ok, true, 'The configured filter is persisted before executing: ' + logic);
  return R.run(saved.record);
}
assert.equal(saveAndRunFilter('客户满意度大于90分').ok, false);
for (const logic of ['当天Token大于1000', '当天新增且用户为Feng的会话', '全部Token大于1000记录', '所属场景为关联审核且用户为Feng', 'Agent为关联审核智能体且Token大于1000']) assert.equal(saveAndRunFilter(logic).ok, false, 'Unsupported residual filters cannot silently match: ' + logic);
assert.equal(saveAndRunFilter('当天新增且已结束的正式用户会话').ok, true);
assert.equal(saveAndRunFilter('已结束').ok, true);
assert.equal(saveAndRunFilter('所属场景为关联审核；Agent 为关联审核智能体；仅包含正式用户使用记录；近 1 小时新增、包含错误的 Trace').ok, true);
assert.equal(saveAndRunFilter('昨天新增的正式用户会话').run.scanned, 0);

// Disabling only controls future executions. Historical outcomes and business task
// counters survive, and callers holding a previously enabled record cannot bypass it.
assert.equal(store.save(record, record.id).ok, true);
const resultsBeforeStop = clone(R.results(record.id)), runsBeforeStop = clone(R.runs(record.id)), tasksBeforeStop = clone(B.summary(B.catalog())), ledgerBeforeStop = f.saved.get(R.storageKey);
assert.equal(store.setEnabled(record.id, false).ok, true);
assert.equal(store.list().find(item => item.id === record.id).enabled, false);
assert.deepEqual(clone(R.results(record.id)), resultsBeforeStop);
assert.deepEqual(clone(R.runs(record.id)), runsBeforeStop);
assert.deepEqual(clone(B.summary(B.catalog())), tasksBeforeStop);
assert.equal(f.saved.get(R.storageKey), ledgerBeforeStop);
const staleRun = R.run(record); assert.equal(staleRun.ok, false, 'An old enabled record cannot bypass the persisted disabled state');
assert.equal(R.run(Object.assign(clone(record), { enabled: true })).ok, false);
assert.equal(f.saved.get(R.storageKey), ledgerBeforeStop, 'Blocked manual executions cannot append a run or rewrite old outcomes');
const editedWhileDisabled = store.save(Object.assign(clone(record), { name: '停用后编辑的任务评估器', enabled: true }), record.id);
assert.equal(editedWhileDisabled.ok, true); assert.equal(editedWhileDisabled.record.enabled, false, 'An editor opened before disable cannot restore its stale enabled state');
assert.equal(R.run(record).ok, false); assert.equal(f.saved.get(R.storageKey), ledgerBeforeStop);
assert.equal(store.setEnabled(record.id, true).ok, true);
assert.deepEqual(clone(R.results(record.id)), resultsBeforeStop);
assert.deepEqual(clone(R.runs(record.id)), runsBeforeStop);
assert.deepEqual(clone(B.summary(B.catalog())), tasksBeforeStop);
const resumed = R.run(record); assert.equal(resumed.ok, true, 'Re-enabled records can execute again');
assert.equal(resumed.run.evaluatorName, editedWhileDisabled.record.name, 'The resumed execution uses the current persisted configuration');

// First-time initialization preserves existing configurations and creates inspectable histories for four grains.
const seeded = fixture(); const beforeSeed = seeded.D.createStore(seeded.storage).save(draft).record;
assert.equal(seeded.R.initialize().ok, true); const configs = seeded.D.createStore(seeded.storage).list();
assert.equal(configs.length, 5); assert(configs.some(item => item.id === beforeSeed.id));
assert.equal(new Set(configs.map(item => item.granularity)).size, 4); assert(seeded.R.results().length > 0); assert.equal(seeded.R.runs().length, 4);
const seedsBefore = [...seeded.saved]; assert.equal(seeded.R.initialize().ok, true); assert.deepEqual([...seeded.saved], seedsBefore);
assert(seeded.R.runs().every(item => item.evaluatorId.startsWith('OE-DEMO-') && item.trigger === 'seed'));
assert(seeded.R.results().some(item => item.outputType === 'score' && item.output && item.output.items.length));
const totals = seeded.R.summary(); assert(totals.records > 0 && totals.executions > 0); assert(Number.isFinite(totals.passRate));
assert(Number.isFinite(totals.averageScore));
// Corrupted nested records are rejected as a whole, without replacing the stored ledger.
const validLedger = seeded.saved.get(seeded.R.storageKey), parsedLedger = JSON.parse(validLedger);
const malformed = [
  ['runs', null], ['runs', {}], ['runs', Object.assign({}, parsedLedger.runs[0], { startedAt: null })], ['runs', Object.assign({}, parsedLedger.runs[0], { scanned: '<img src=x>' })],
  ['results', null], ['results', {}], ['results', Object.assign({}, parsedLedger.results[0], { evaluatedAt: 'invalid' })], ['results', Object.assign({}, parsedLedger.results[0], { dimensions: [null] })], ['results', Object.assign({}, parsedLedger.results[0], { evidence: [null] })],
  ['taskExecutions', null], ['taskExecutions', {}], ['taskExecutions', Object.assign({}, parsedLedger.taskExecutions[0], { evaluatorId: null })]
];
for (const [collection, badRecord] of malformed) {
  const corrupted = clone(parsedLedger); corrupted[collection].push(badRecord); const raw = JSON.stringify(corrupted); seeded.saved.set(seeded.R.storageKey, raw);
  assert.deepEqual(clone(seeded.R.results()), []); assert.deepEqual(clone(seeded.R.runs()), []); assert.equal(seeded.R.summary().records, 0);
  const initialization = seeded.R.initialize(); assert.equal(initialization.ok, false); assert(initialization.error.includes('读取失败'));
  assert.equal(seeded.R.run(configs.find(item => item.id === 'OE-DEMO-BUSINESS')).ok, false);
  assert.equal(seeded.saved.get(seeded.R.storageKey), raw, 'Malformed data stays untouched for recovery: ' + collection);
}
seeded.saved.set(seeded.R.storageKey, validLedger); assert.equal(seeded.R.results().length, totals.records);
console.log('Passed: task binding and persisted snapshot validation; visible conversation evidence and exact completion anchors; repeat-scan deduplication and evolving conversations; stored filter execution; enable/disable history preservation, stale-object/manual-run rejection and stale-editor isolation; atomic write failures; seeded summaries/history and ordinary evaluation outputs.');
