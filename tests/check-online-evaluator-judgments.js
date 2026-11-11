const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const clone = value => JSON.parse(JSON.stringify(value));
const saved = new Map(); let reads = 0, writes = 0, sourceReads = 0;
const storage = { getItem(key) { reads++; return saved.get(key) || null; }, setItem(key, value) { writes++; saved.set(key, value); } };
const row = { id: 'CR-JUDGMENT', name: '判断依据核验会话', agentId: 'audit:agents:0', agent: '关账审核智能体', time: '2026-11-05 09:00', messages: 2, tokens: '0.1', errors: 0, warnings: 0, conversation: { rounds: [{ n: 1, input: '请执行「月末关账审核」任务，核对原始记录和全部核验项。', output: '' }], records: [
  { id: 'SPAN-positive', type: 'model', name: '核验准确性', round: 1, input: { source: '原始报表第3页', instruction: '逐项对比依据' }, output: '已核对原始记录，准确且符合全部规则。', status: 'completed' },
  { id: 'SPAN-negative', type: 'model', name: '差异核验', round: 1, input: { source: '原始报表第4页' }, output: '不符合：输出数据与源记录不一致。', status: 'completed' },
  { id: 'SPAN-pending', type: 'model', name: '缺失资料核验', round: 1, input: { source: '待补充附件' }, output: '证据不足，尚未生成完整结果。', status: 'completed' }
] } };
const context = { console, Date, localStorage: storage, addEventListener() {}, document: { addEventListener() {}, querySelector() { return null; } } }; context.window = context; vm.createContext(context);
for (const file of ['workspace-nav.js', 'resource-ui.js', 'session-detail.js', 'business-tasks.js', 'online-evaluators-data.js', 'online-evaluators-runtime.js']) vm.runInContext(fs.readFileSync('dist/aiops/' + file, 'utf8'), context, { filename: file });
const D = context.AIOpsOnlineEvaluatorData, R = context.AIOpsOnlineEvaluatorRuntime, B = context.AIOpsBusinessTasks, store = D.createStore(storage), task = B.definition('BT-001');
row.conversation.rounds[0].output = '已完成「月末关账审核」本次执行。\n' + task.dimensions.map(item => '- ' + item.name + '：符合。' + item.description).join('\n') + '\n通过标准核验：满足，逐项核验均符合。';
B.configure({ sessions: () => [row] }); R.configure({ storage, sessions: () => [row], now: '2026-11-05T01:01:00.000Z' });
const originalData = context.AIOpsSessionDetail.data; context.AIOpsSessionDetail.data = value => { sourceReads++; return originalData(value); };
function create(type, output = {}) { const draft = D.defaults('audit'); Object.assign(draft, { name: type + '判断测试', description: '分离原始评估输出与是否通过', agentId: 'audit:agents:0', tags: ['判断依据'], granularity: 'span', spanTypes: ['model'], filterLogic: '全部正式用户会话', prompt: '依据原始记录判断并输出配置类型。' }); Object.assign(draft.output, output, { type }); const result = store.save(draft); assert(result.ok, JSON.stringify(result)); return result.record; }
function evaluated(record, target) { assert.equal(R.run(record).ok, true); return R.results(record.id).find(item => item.targetId === target); }
const bool = create('boolean', { booleanPass: false }), goodBool = evaluated(bool, 'SPAN-positive'), badBool = R.results(bool.id).find(item => item.targetId === 'SPAN-negative'), pendingBool = R.results(bool.id).find(item => item.targetId === 'SPAN-pending');
assert.equal(goodBool.output, false); assert.equal(goodBool.pass, true); assert.equal(goodBool.acceptance, 'passed'); assert.equal(badBool.output, true); assert.equal(badBool.pass, false); assert.equal(pendingBool.output, null); assert.equal(pendingBool.pass, null);
assert.equal(R.derivePass(false, { type: 'boolean', booleanPass: false }), true); assert.equal(R.derivePass(false, { type: 'boolean', booleanPass: true }), false); assert.equal(R.derivePass(null, { type: 'boolean', booleanPass: false }), null);
assert.equal(R.presentation({ outputType: 'boolean', outputConfig: { type: 'boolean', booleanPass: false }, output: false, pass: false, acceptance: 'rejected' }).pass, true, 'Frozen output semantics take precedence over legacy contradictory status fields');

const category = create('category', { categories: [{ name: '符合', pass: true }, { name: '不符合', pass: false }] });
assert.equal(evaluated(category, 'SPAN-positive').output, '符合'); assert.equal(R.results(category.id).find(item => item.targetId === 'SPAN-negative').pass, false);
const pendingCategory = R.results(category.id).find(item => item.targetId === 'SPAN-pending'); assert.equal(pendingCategory.output, null); assert.equal(pendingCategory.pass, null, 'Missing pending category cannot fall back to the first label');
const mapped = create('category', { categories: [{ name: '符合', pass: true }, { name: '待确认', pass: false }] });
const mappedPending = evaluated(mapped, 'SPAN-pending'); assert.equal(mappedPending.output, '待确认'); assert.equal(mappedPending.pass, false); assert.equal(mappedPending.acceptance, 'rejected', 'A produced valid category uses its configured passing map');
assert.equal(R.presentation({ outputConfig: category.output, output: '未定义类别', acceptance: 'rejected' }).pass, null);
assert.equal(R.presentation({ outputConfig: category.output, output: '未定义类别' }).value, null);

const scoring = { type: 'score', scoreItems: [{ name: '准确性', criteria: '与源记录逐项一致', weight: 0.6 }, { name: '完整性', criteria: '全部核验项齐全', weight: 0.4 }], threshold: 80 };
const weighted = { items: [{ name: '准确性', score: 90, weight: 0.1 }, { name: '完整性', score: 70, weight: 0.9 }], score: 1 };
const view = R.presentation({ outputConfig: scoring, output: weighted }); assert.equal(view.value, 82); assert.equal(view.pass, true); assert(view.criteria.includes('80') && view.observations.includes('90×0.6') && view.observations.includes('70×0.4'));
assert.equal(R.presentation({ outputConfig: Object.assign({}, scoring, { threshold: 85 }), output: weighted }).pass, false);
assert.equal(R.presentation({ outputConfig: scoring, output: { items: [{ name: '准确性', score: 90 }], score: 92 } }).pass, null, 'An incomplete weighted result cannot borrow a reported total');
assert.equal(R.presentation({ outputConfig: scoring, output: null, acceptance: 'rejected' }).pass, null);
assert.equal(R.presentation({ outputConfig: { type: 'score', threshold: 80 }, output: 80 }).pass, true);
const scoreRecord = create('score', scoring), actualScore = evaluated(scoreRecord, 'SPAN-positive'); assert.equal(actualScore.pass, true); assert.equal(actualScore.judgment.criteria.includes('80'), true);
assert.equal(R.results(scoreRecord.id).find(item => item.targetId === 'SPAN-pending').output, null);

const textRecord = create('text'), text = evaluated(textRecord, 'SPAN-positive'), textView = R.presentation(text); assert.equal(typeof textView.value, 'string'); assert.equal(textView.pass, null); assert.equal(textView.hasCriteria, false); assert.equal(textView.decisionStatus, 'na'); assert(textView.reason.includes('无通过标准'));
assert.equal(R.presentation({ outputType: 'text', output: '记录摘要', acceptance: 'rejected', pass: false }).pass, null);

// New records always keep concrete standards, observed outputs, and inspectable source snippets.
for (const item of R.results()) {
  assert(item.judgment.criteria && item.judgment.observations && item.judgment.conclusion); assert.equal(item.reason, item.judgment.conclusion);
  assert(item.judgment.evidence.some(part => part.kind === 'span' && part.text.includes('输出：')));
  assert(item.judgment.observations.includes('引用证据：')); assert(!item.reason.startsWith('本地演示依据'));
  const shown = R.presentation(item); assert.equal(shown.pass === true ? 'passed' : shown.pass === false ? 'rejected' : shown.type === 'text' ? 'na' : 'pending', item.acceptance);
}
const oldLedger = saved.get(R.storageKey), editedBool = clone(bool); editedBool.output.booleanPass = true; assert.equal(store.save(editedBool, bool.id).ok, true);
assert.equal(R.presentation(goodBool).pass, true); assert.equal(R.presentation(goodBool).value, false); assert.equal(saved.get(R.storageKey), oldLedger, 'Presentation after config edits is read-only and uses the historical output snapshot');

// Older records may resolve their frozen output configuration from their scan snapshot, never from current settings.
const noOutputSnapshot = clone(goodBool); delete noOutputSnapshot.outputConfig; delete noOutputSnapshot.judgment; noOutputSnapshot.pass = false; noOutputSnapshot.acceptance = 'rejected';
reads = 0; writes = 0; assert.equal(R.presentation(noOutputSnapshot).pass, true); for (let index = 0; index < 906; index++) R.presentation(noOutputSnapshot);
assert(reads <= 1, 'A scan snapshot is indexed once rather than parsing the entire ledger for every result'); assert.equal(writes, 0);
const missing = R.presentation({ outputType: 'boolean', output: null, acceptance: 'rejected', sessionId: 'CR-MISSING', runId: 'MISSING-RUN' }); assert.equal(missing.pass, null); assert.equal(missing.decisionStatus, 'pending'); assert(missing.criteria.includes('未保存') && missing.observations.includes('未找到'));

// Repeated legacy Span rendering reuses a defensive source index instead of cloning the full conversation 906 times.
R.configure({ storage, sessions: () => [row], now: '2026-11-05T01:01:00.000Z' }); const legacySpan = clone(actualScore); delete legacySpan.judgment; sourceReads = 0; reads = 0; writes = 0;
for (let index = 0; index < 906; index++) R.presentation(legacySpan); assert.equal(sourceReads, 1); assert.equal(reads, 0); assert.equal(writes, 0);

const taskDraft = D.bindTasks(Object.assign(D.defaults('audit'), { name: '业务任务判断', description: '完成与通过分开保存', agentId: 'audit:agents:0', tags: ['任务'], filterLogic: '全部正式用户会话' }), ['BT-001']); const savedTask = store.save(taskDraft).record;
assert.equal(R.run(savedTask).ok, true); const taskItem = R.results(savedTask.id)[0], taskView = R.presentation(taskItem); assert.equal(taskView.pass, true); assert.equal(typeof taskView.value, 'object'); assert(taskView.observations.includes('核验完整性'));
const running = clone(taskItem); running.completion = 'running'; running.acceptance = 'na'; running.output.completion = 'running'; running.output.acceptance = 'na'; const runningView = R.presentation(running); assert.equal(runningView.pass, null); assert.equal(runningView.hasCriteria, true); assert.equal(runningView.currentlyApplicable, false); assert.equal(runningView.decisionStatus, 'pending');
const unresolved = clone(taskItem); unresolved.acceptance = 'pending'; unresolved.output.acceptance = 'pending'; assert.equal(R.presentation(unresolved).pass, null); assert(R.presentation(unresolved).reason.includes('证据尚未'));
const stats = R.summary([bool.id, category.id, mapped.id, scoreRecord.id, textRecord.id, savedTask.id]); assert(stats.passed > 0 && stats.rejected > 0); assert(stats.pending > 0); assert(stats.passRate > 0 && stats.passRate < 100);
console.log('Passed: typed outputs and independent pass values; False passing values; frozen category mappings; weighted score thresholds; text without pass criteria; pending outputs without fabrication; structured task states; concrete judgments with source snippets; historical snapshot compatibility without writes; one-time snapshot/source indexing; and value-derived aggregate statistics.');
