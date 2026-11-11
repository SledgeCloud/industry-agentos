const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

// The module may only consume supplied arrays/callbacks. Any ambient service access fails this check.
const context = { Date, console };
for (const key of ['document', 'localStorage', 'fetch', 'setTimeout', 'setInterval']) Object.defineProperty(context, key, { get() { throw new Error('Pure filters touched ' + key); } });
context.window = context; vm.createContext(context);
vm.runInContext(fs.readFileSync('dist/aiops/online-evaluators-filters.js', 'utf8'), context);
const F = context.AIOpsOnlineEvaluatorFilters, copy = value => JSON.parse(JSON.stringify(value));
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const ids = records => Array.from(records, item => item.id);
assert.deepEqual(copy(F.defaultsList()), { status: '', granularity: '', agentId: '', tag: '' });
assert.deepEqual(copy(F.defaultsDetail()), { query: '', dateBy: 'evaluation', from: '', to: '', resultChoice: 'all', minScore: '', maxScore: '', text: '', pass: 'all' });
const defaultList = F.defaultsList(); defaultList.tag = 'changed'; assert.equal(F.defaultsList().tag, '');
const defaultDetail = F.defaultsDetail(); defaultDetail.from = 'changed'; assert.equal(F.defaultsDetail().from, '');

const evaluators = freeze([
  { id: 'E-1', name: 'Quality Check', description: '线上会话准确性', agentId: 'A-1', granularity: 'session', enabled: true, tags: ['质量', '财务'] },
  { id: 'E-2', name: 'Quality Trace', description: '链路检查', agentId: 'A-1', granularity: 'trace', enabled: false, tags: ['质量'] },
  { id: 'E-3', name: '工具调用质量', description: '正式用户工具调用', agentId: 'A-2', granularity: 'span', tags: ['质量分析'] },
  { id: 'E-4', name: '业务任务', description: '关账检查', agentId: 'A-2', granularity: 'business-task', enabled: true, tags: ['财务'] }
]);
const evaluatorSnapshot = copy(evaluators), agentName = record => ({ 'A-1': '财务 Agent', 'A-2': '成本 Agent' }[record.agentId]);
assert.deepEqual(ids(F.evaluators(evaluators, {}, '', agentName)), ['E-1', 'E-2', 'E-3', 'E-4']);
assert.deepEqual(ids(F.evaluators(evaluators, { status: 'enabled', agentId: 'A-1', granularity: 'session', tag: '质量' }, 'qUaLiTy', agentName)), ['E-1']);
assert.deepEqual(ids(F.evaluators(evaluators, { tag: '质量' }, '', agentName)), ['E-1', 'E-2'], 'Tag matching is exact, not a substring');
assert.deepEqual(ids(F.evaluators(evaluators, { status: 'disabled', agentId: 'A-1' }, '链路', agentName)), ['E-2']);
assert.deepEqual(ids(F.evaluators(evaluators, { status: 'enabled' }, '成本', agentName)), ['E-3', 'E-4'], 'Legacy enabled state defaults to enabled');
assert.deepEqual(ids(F.evaluators(evaluators, { status: 'disabled', granularity: 'span' }, '', agentName)), [], 'Dimensions combine with AND');
assert.deepEqual(ids(F.evaluators(evaluators, {}, 'e-4', agentName)), ['E-4']);
assert.deepEqual(copy(evaluators), evaluatorSnapshot);
assert.equal(F.evaluators(evaluators, {}, '', agentName)[0], evaluators[0], 'Selection returns original record references in a new array');

const sessions = freeze({
  S1: { name: 'Case ALPHA', time: '2026-11-04 23:59' },
  S2: { name: 'Case ALPHA', time: '2026-11-05 00:00' },
  S3: { name: '风险复核', time: '2026-11-05T23:59:59+08:00' },
  S4: { name: '次日任务', time: '2026-11-06T00:00:00+08:00' },
  S5: { name: '缺少时间' },
  UNSAFE: { name: '<img src=x onerror=alert(1)>', time: '2026-11-05 08:00' }
});
const observations = freeze([
  { id: 'BOOL-FALSE', sessionId: 'S1', evaluatedAt: '2026-11-04T16:00:00Z', p: { type: 'boolean', value: false, pass: true } },
  { id: 'BOOL-TRUE', sessionId: 'S2', evaluatedAt: '2026-11-04T15:59:59.999Z', p: { type: 'boolean', value: true, pass: false } },
  { id: 'CATEGORY-OLD', sessionId: 'S2', evaluatedAt: '2026-11-05T15:59:59.999Z', outputConfig: { type: 'category', categories: [{ name: '已删除类别', pass: false }, { name: 'True', pass: true }] }, p: { type: 'category', value: '已删除类别', pass: false } },
  { id: 'CATEGORY-FALSE', sessionId: 'S3', evaluatedAt: '2026-11-05T16:00:00Z', outputConfig: { type: 'category', categories: [{ name: 'False', pass: true }] }, p: { type: 'category', value: 'False', pass: true } },
  { id: 'SCORE-ZERO', sessionId: 'S2', evaluatedAt: '2026-11-05T00:00:00+08:00', p: { type: 'score', value: 0, pass: false } },
  { id: 'SCORE-80', sessionId: 'S3', evaluatedAt: '2026-11-05T10:00:00Z', p: { type: 'score', value: { score: 80 }, pass: true } },
  { id: 'TEXT', sessionId: 'S3', evaluatedAt: '2026-11-05T23:59:59+08:00', p: { type: 'text', value: '用户 ALPHA 的问题仍需补充资料。', pass: null } },
  { id: 'UNKNOWN', sessionId: 'S5', evaluatedAt: '', p: { type: 'boolean', value: null, pass: null } },
  { id: 'TASK-COMPLETE', sessionId: 'S2', evaluatedAt: '2026-11-05T08:00:00+08:00', completion: 'completed', p: { type: 'task-executions', value: { completion: 'running' }, pass: null } },
  { id: 'TASK-RUNNING', sessionId: 'S3', evaluatedAt: '2026-11-05T08:00:00+08:00', p: { type: 'task-executions', value: { completion: 'running' }, pass: null } },
  { id: 'TASK-FAILED', sessionId: 'S4', evaluatedAt: '2026-11-05T08:00:00+08:00', completion: 'failed', p: { type: 'task-executions', value: null, pass: false } },
  { id: 'FALLBACK', sessionId: 'MISSING', sessionName: 'Fallback Alpha', evaluatedAt: '2026-11-05T08:00:00+08:00', p: { type: 'text', value: '仅有输出内容。', pass: null } },
  { id: 'UNSAFE', sessionId: 'UNSAFE', evaluatedAt: '2026-11-05T08:00:00+08:00', p: { type: 'category', value: '<svg onload=alert(1)>', pass: false } }
]);
let presentations = 0;
const options = { presentation(item) { presentations++; return item.p; }, session: id => sessions[id] || null };
const result = filters => F.results(observations, filters, options), resultIds = filters => ids(result(filters));
const snapshot = copy(observations);
assert.deepEqual(resultIds({ resultChoice: 'boolean:false' }), ['BOOL-FALSE'], 'False is a valid output and does not mean the pass decision is false');
assert.deepEqual(resultIds({ resultChoice: 'boolean:false', pass: 'yes', query: 'alpha', from: '2026-11-05', to: '2026-11-05' }), ['BOOL-FALSE']);
assert.deepEqual(resultIds({ resultChoice: 'boolean:false', pass: 'no' }), []);
assert.deepEqual(resultIds({ resultChoice: 'boolean:true', pass: 'no' }), ['BOOL-TRUE']);
assert.deepEqual(resultIds({ resultChoice: 'category:' + encodeURIComponent('False') }), ['CATEGORY-FALSE'], 'Literal category False stays distinct from boolean false');
assert.deepEqual(resultIds({ resultChoice: 'score', minScore: '0', maxScore: '0' }), ['SCORE-ZERO'], 'Zero scores are not mistaken for empty values');
assert.deepEqual(resultIds({ resultChoice: 'score', minScore: '80', maxScore: '80', pass: 'yes' }), ['SCORE-80']);
assert.deepEqual(resultIds({ resultChoice: 'score', minScore: '', maxScore: '' }), ['SCORE-ZERO', 'SCORE-80']);
assert.deepEqual(resultIds({ resultChoice: 'text', text: 'aLpHa' }), ['TEXT'], 'Content search only applies to text outputs');
assert.deepEqual(resultIds({ query: 'ALPHA', resultChoice: 'text' }), ['FALLBACK'], 'Session search is distinct from searching result text');
assert.deepEqual(resultIds({ resultChoice: 'text', query: 's3', text: 'alpha' }), ['TEXT']);
assert.deepEqual(resultIds({ resultChoice: 'empty' }), ['UNKNOWN'], 'False, 0, and task states are nonempty');
assert.deepEqual(resultIds({ pass: 'undecided' }), ['UNKNOWN', 'TASK-COMPLETE', 'TASK-RUNNING'], 'Unknown pass decisions exclude text outputs');
assert.deepEqual(resultIds({ pass: 'not-applicable' }), ['TEXT', 'FALLBACK']);
assert.deepEqual(resultIds({ resultChoice: 'task:completed' }), ['TASK-COMPLETE'], 'The execution record state takes priority over an embedded state');
assert.deepEqual(resultIds({ resultChoice: 'task:running' }), ['TASK-RUNNING']);
assert.deepEqual(resultIds({ resultChoice: 'task:failed' }), ['TASK-FAILED']);

const evaluationDay = resultIds({ from: '2026-11-05', to: '2026-11-05' });
assert(evaluationDay.includes('BOOL-FALSE') && !evaluationDay.includes('BOOL-TRUE'), '16:00Z is Shanghai midnight and 15:59:59.999Z belongs to the prior day');
assert(evaluationDay.includes('CATEGORY-OLD') && !evaluationDay.includes('CATEGORY-FALSE'), 'The entire selected day is inclusive without spilling into the next midnight');
assert(!evaluationDay.includes('UNKNOWN'), 'Missing timestamps do not satisfy an active date range');
assert.deepEqual(resultIds({ dateBy: 'session', from: '2026-11-05', to: '2026-11-05', resultChoice: 'boolean:false' }), [], 'Session time filtering is independent of evaluation time');
assert.deepEqual(resultIds({ dateBy: 'session', from: '2026-11-05', to: '2026-11-05', resultChoice: 'boolean:true' }), ['BOOL-TRUE']);
assert(!resultIds({ dateBy: 'session', from: '2026-11-05', to: '2026-11-05' }).includes('FALLBACK'), 'A fallback display name cannot stand in for a missing session timestamp');
assert(!resultIds({ dateBy: 'session', to: '2026-11-05' }).includes('TASK-FAILED'), 'A session at next-day midnight is excluded by an inclusive upper day');
assert(resultIds({ dateBy: 'session', from: '2026-11-04', to: '2026-11-04' }).includes('BOOL-FALSE'), 'Offsetless session timestamps are interpreted in Shanghai');
for (const filters of [{ from: '2026-02-29' }, { to: '2026-13-01' }, { from: 'not-a-date' }, { from: '2026-11-06', to: '2026-11-05' }, { resultChoice: 'score', minScore: 'no' }, { resultChoice: 'score', minScore: Infinity }, { resultChoice: 'score', maxScore: -1 }, { resultChoice: 'score', maxScore: '101' }, { resultChoice: 'score', minScore: '80', maxScore: '70' }]) {
  assert(F.validate(filters), 'Invalid filter must report an error: ' + JSON.stringify(filters)); assert.deepEqual(resultIds(filters), [], 'Invalid ranges never silently reverse or discard the filter');
}
assert.equal(F.validate({ from: '2024-02-29', to: '2024-02-29', minScore: 0, maxScore: 100 }), '');
assert.equal(F.validate({ from: '0001-01-01', to: '9999-12-31', minScore: '', maxScore: ' ' }), '');
assert(F.validate({ from: '1900-02-29' })); assert.equal(F.validate({ from: '2000-02-29' }), '');
const staleScoreFilters = { resultChoice: 'score', minScore: '90', maxScore: '80', text: 'not present' };
assert(F.validate(staleScoreFilters)); assert.deepEqual(resultIds(staleScoreFilters), []);
staleScoreFilters.resultChoice = 'all'; assert.equal(F.validate(staleScoreFilters), '');
assert.deepEqual(resultIds(staleScoreFilters), ids(observations), 'All results restore after leaving a reversed score range; hidden score/text values have no effect');
staleScoreFilters.resultChoice = 'boolean:false'; assert.deepEqual(resultIds(staleScoreFilters), ['BOOL-FALSE'], 'Boolean output ignores hidden reversed scores and stale text content');
staleScoreFilters.resultChoice = 'category:' + encodeURIComponent('False'); assert.deepEqual(resultIds(staleScoreFilters), ['CATEGORY-FALSE']);
staleScoreFilters.resultChoice = 'empty'; assert.deepEqual(resultIds(staleScoreFilters), ['UNKNOWN']);
assert.deepEqual(resultIds({ resultChoice: 'score', minScore: 0, maxScore: 0, text: 'no matching content' }), ['SCORE-ZERO'], 'Score mode ignores hidden text search');
assert.deepEqual(resultIds({ resultChoice: 'text', text: 'alpha', minScore: 'bad hidden bound', maxScore: -1 }), ['TEXT'], 'Text mode ignores hidden invalid score bounds');
assert.deepEqual(copy(observations), snapshot); assert.equal(result({})[0], observations[0]);

const choices = copy(F.resultChoices(observations, options.presentation, { type: 'category', categories: [{ name: '新类别', pass: true }, { name: '已删除类别', pass: true }] }));
assert.equal(choices[0].id, 'all');
for (const id of ['boolean:true', 'boolean:false', 'score', 'text', 'task:completed', 'task:running', 'task:failed', 'empty', ...['已删除类别', '新类别', 'True', 'False', '<svg onload=alert(1)>'].map(name => 'category:' + encodeURIComponent(name))]) assert(choices.some(choice => choice.id === id), 'Choice survives historical/current union: ' + id);
assert.equal(choices.filter(choice => choice.id === 'category:' + encodeURIComponent('已删除类别')).length, 1, 'Historical categories remain selectable without duplication');
assert.equal(choices.find(choice => choice.id === 'category:True').label, 'True');
assert(!choices.find(choice => choice.id === 'category:' + encodeURIComponent('<svg onload=alert(1)>')).id.includes('<'), 'Arbitrary category data is encoded into safe choice IDs');
assert.deepEqual(resultIds({ query: '<img src=x', resultChoice: 'category:' + encodeURIComponent('<svg onload=alert(1)>') }), ['UNSAFE'], 'Search treats angle brackets and event-handler text as literal data');
assert.deepEqual(ids(F.results(observations, { resultChoice: 'category:%E0%A4%A' }, options)), [], 'Malformed encoded choices do not throw or match arbitrary categories');
const currentOnly = copy(F.resultChoices([], options.presentation, { type: 'score' })); assert(currentOnly.some(choice => choice.id === 'score'));
assert(!currentOnly.some(choice => choice.id.startsWith('task:') || choice.id === 'text'));
assert.equal(resultIds({ pass: 'yes' }).includes('CATEGORY-OLD'), false, 'A later category pass mapping never reinterprets historical pass values');

const large = freeze(Array.from({ length: 906 }, (_, i) => ({ id: 'SPAN-' + i, sessionId: 'LARGE-' + (i % 25), evaluatedAt: '2026-11-05T12:00:00+08:00', p: { type: 'boolean', value: i % 2 === 0, pass: i % 2 === 0 } })));
const largeOptions = { presentation: item => item.p, session: id => ({ name: '同名会话', time: '2026-11-05 09:00', id }) };
assert.equal(F.results(large, {}, largeOptions).length, 906, 'Filtering never paginates or truncates a large Span history');
assert.equal(F.results(large, { pass: 'yes', resultChoice: 'boolean:true' }, largeOptions).length, 453);
assert.equal(F.results(large, { query: 'LARGE-24', from: '2026-11-05', to: '2026-11-05' }, largeOptions).length, 36);
assert(presentations > 0); assert.deepEqual(copy(observations), snapshot);
console.log('Passed: pure AND evaluator/result filters; exact tags; session-ID/name queries; Shanghai inclusive dates and invalid ranges; active-output-only score/text conditions and stale hidden-field recovery; independent output/pass filters; False/zero/task states; historical category union and literal injection-safe IDs; no mutation/service access; complete 906-record filtering.');
