const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const ledgerKey = 'aiops.online-evaluation-ledger.v1';
const source = fs.readFileSync('dist/aiops/aiops.js', 'utf8');
const sessionSource = source.match(/function sessionRows\([^)]*\) \{[\s\S]*?\n  \}(?=\n\n  function sessionTokenLabel)/);
assert(sessionSource);
const stored = new Map(), listeners = {};
const context = {
  console, state: { sessionMarks: {} }, addEventListener() {},
  localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) },
  document: { addEventListener(type, handler) { (listeners[type] ||= []).push(handler); }, querySelector() { return null; }, getElementById() { return null; } }
};
context.window = context; vm.createContext(context); vm.runInContext(sessionSource[0], context);
for (const file of ['workspace-nav.js', 'resource-ui.js', 'session-detail.js', 'business-tasks.js']) vm.runInContext(fs.readFileSync('dist/aiops/' + file, 'utf8'), context, { filename: file });
const tasks = context.AIOpsBusinessTasks, detail = context.AIOpsSessionDetail;
context.AIOpsResources.configure({ lang: () => 'zh', icons() {}, render() {}, changed() {} });
tasks.configure({ lang: () => 'zh', sessions: context.sessionRows, render() {}, icons() {}, toast() {} });
detail.bind({ lang: () => 'zh', row: id => context.sessionRows().find(row => row.id === id), render() {} });
const copy = value => JSON.parse(JSON.stringify(value));

assert.deepEqual(copy(tasks.summary(tasks.tasks())), { tasks: 9, executions: 28, completed: 25, passed: 19 });
const definitions = tasks.catalog();
assert.equal(definitions.length, 9);
assert.equal(tasks.definition('BT-001').agentId, 'audit:agents:0');
assert.equal(tasks.definition('BT-007').agentId, 'manufacturing:agents:0');
assert.equal(tasks.definition('BT-008').agentId, 'cost:agents:0');
definitions[0].criteria[0] = 'MUTATED'; definitions[0].name = 'MUTATED';
const definition = tasks.definition('BT-001'); definition.dimensions[0].name = 'MUTATED';
assert(!JSON.stringify(tasks.catalog()).includes('MUTATED'));
assert.equal(tasks.definition('missing'), null);
assert.notEqual(tasks.executionKey('a', 'b|c', 'd'), tasks.executionKey('a|b', 'c', 'd'));

const session = context.sessionRows().find(row => row.id === 'CR-1024');
let dialogue = detail.data(session);
assert(dialogue.rounds[0].input.includes('请执行「月末关账审核」任务'));
assert(dialogue.rounds[16].output.includes('已完成「月末关账审核」本次执行'));
assert(dialogue.rounds[16].output.includes('待补充'));
assert(dialogue.rounds[18].input.includes('新的一次'));
assert(dialogue.rounds[20].output.includes('通过标准核验：满足'));
dialogue.rounds[0].input = 'MUTATED'; dialogue.records[0].output = 'MUTATED';
assert(!JSON.stringify(detail.data(session)).includes('MUTATED'));

const first = tasks.records(['BT-001']).find(run => run.sessionId === session.id);
assert.equal(first.executionKey, tasks.executionKey('BT-001', session.id, 'CR-1024-msg-001'));
const updated = Object.assign({}, copy(first), { evaluatorId: 'OE-TEST', evaluatorName: '<script>unsafe</script>', evaluatedAt: '2026-11-05T09:00:00+08:00', acceptance: 'passed', reason: '已根据会话来源完成评估', dimensions: [{ name: '<b>准确性</b>', value: '符合', reason: '<img src=x>' }] });
delete updated.session;
dialogue = detail.data(session);
const secondStart = dialogue.rounds[18], secondEnd = detail.replyAt(session, 21);
const second = Object.assign({}, copy(updated), { id: 'TR-1024-SECOND', startRound: 19, startMessageId: secondStart.inputId, triggeredAt: secondStart.inputAt, executionKey: tasks.executionKey('BT-001', session.id, secondStart.inputId), completionRound: secondEnd.round, completionMessageId: secondEnd.messageId, completedAt: secondEnd.completedAt });
const write = entries => stored.set(ledgerKey, JSON.stringify({ version: 1, runs: [], results: [], taskExecutions: entries }));
write([updated, second]);
assert.equal(tasks.records(['BT-001']).length, 5, 'A scanned seed execution is updated; a new start in the same session adds one execution');
assert.deepEqual(copy(tasks.summary(tasks.tasks())), { tasks: 9, executions: 29, completed: 26, passed: 21 });
write([updated, second, Object.assign({}, second, { evaluatorId: 'OE-OTHER', reason: '另一个评估器重复扫描' })]);
assert.equal(tasks.records(['BT-001']).length, 5, 'Duplicate ledger entries and another evaluator cannot multiply a task execution');
assert.equal(tasks.recordById(second.id).reason, '另一个评估器重复扫描');
assert(tasks.openExecution(second.id));
let html = tasks.page();
assert.match(html, /is-task-completion[^>]*data-message-id="CR-1024-msg-042"/);
assert(html.includes('data-completion-record="TR-1024-SECOND"'));
assert(!html.includes('data-completion-record="TR-1024"'));
assert(tasks.openExecution(first.id)); html = tasks.page();
assert.match(html, /is-task-completion[^>]*data-message-id="CR-1024-msg-034"/);
assert.equal(tasks.openExecution('missing'), false);

const click = (action, id = '') => listeners.click.at(-1)({ target: { closest: selector => selector === '[data-bt]' ? { getAttribute: key => key === 'data-bt' ? action : id } : null } });
click('back-records'); html = tasks.page();
assert(html.includes('&lt;script&gt;unsafe&lt;/script&gt;') && !html.includes('<script>unsafe'));
assert(html.includes('&lt;b&gt;准确性&lt;/b&gt;') && !html.includes('<img src=x>'));
assert(html.includes('data-bt="session" data-id="TR-1024-SECOND"'));

write([Object.assign({}, updated, { acceptance: 'pending' }), second]);
html = tasks.page();
const evaluatedPending = [...html.matchAll(/<tr>[\s\S]*?<\/tr>/g)].find(row => row[0].includes('class="bt-record-id">TR-1024</span>'));
assert(evaluatedPending && evaluatedPending[0].includes('class="bt-status is-pending">待确认</span>'), 'An evaluated pending outcome is awaiting confirmation rather than another evaluation');
assert(html.includes('class="bt-status is-pending">待评测</span>'), 'A seeded pending outcome without evaluatedAt remains awaiting evaluation');
assert(tasks.openExecution(first.id));
assert(tasks.page().includes('class="bt-status is-pending">待确认</span>'), 'The linked session context uses the same evaluated pending label');

write([Object.assign({}, updated, { startMessageId: 'missing' }), Object.assign({}, second, { completionMessageId: 'CR-1024-msg-041' })]);
assert.equal(tasks.records(['BT-001']).length, 4, 'Invalid start or completion anchors never affect task totals');
stored.set(ledgerKey, '{corrupt'); assert.equal(tasks.records().length, 28);
stored.set(ledgerKey, JSON.stringify({ taskExecutions: {} })); assert.equal(tasks.records().length, 28);

const custom = { id: 'CR-CUSTOM', name: 'Custom live dialogue', user: 'tester', time: '2026-11-05 10:00', agent: '关账审核智能体', tokens: '0', errors: 0, warnings: 0, conversation: [
  { input: '请执行月末关账审核', output: '正在审核', inputId: 'custom-start', outputId: 'custom-progress' },
  { input: '补充资料', output: '已生成审核报告', outputId: 'custom-finish' }
] };
const customData = detail.data(custom);
assert.equal(customData.messageCount, 4); assert.equal(customData.rounds[0].inputId, 'custom-start');
assert.equal(detail.replyAt(custom, 2).messageId, 'custom-finish');
custom.conversation[1].output = '已修订审核报告';
assert.equal(detail.data(custom).rounds[1].output, '已修订审核报告', 'Changed conversation evidence invalidates the session cache');
custom.conversation[1].hasOutput = false; assert.equal(detail.replyAt(custom, 2), null);
custom.conversation = { rounds: [{ input: 'new', output: 'done', outputId: 'custom-new' }], records: [{ id: 'custom-trace', type: 'tool' }] };
assert.equal(detail.data(custom).records[0].id, 'custom-trace');

console.log('Passed: definition/session defensive snapshots; visible task evidence; seeded record overlay and cross-evaluator idempotence; multiple executions per session with exact completion navigation; safe dimension rendering; malformed ledger isolation; custom dialogue and cache refresh.');
