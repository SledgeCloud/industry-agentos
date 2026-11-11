const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

// Use the native page's current source records; the operations iframe has a separate dataset.
const appSource = fs.readFileSync('dist/aiops/aiops.js', 'utf8');
const sessionSource = appSource.match(/function sessionRows\([^)]*\) \{[\s\S]*?\n  \}(?=\n\n  function sessionTokenLabel)/);
assert(sessionSource, 'Native session source must be available');
const stored = new Map();
let rejectWrites = false;
const storage = {
  getItem: key => stored.get(key) || null,
  setItem(key, value) { if (rejectWrites) throw new Error('Storage unavailable'); stored.set(key, value); }
};
const plain = value => JSON.parse(JSON.stringify(value));

function fixture(options = {}) {
  const listeners = {}, nodes = { btTaskRows: { innerHTML: '' }, btTaskCount: { textContent: '' } };
  const selectors = {};
  let renders = 0;
  const context = {
    console, localStorage: storage, state: { sessionMarks: {} }, addEventListener() {}, getComputedStyle: () => ({ paddingTop: '16px' }),
    document: {
      addEventListener(type, handler) { (listeners[type] ||= []).push(handler); },
      getElementById(id) { return nodes[id] || null; },
      querySelector(selector) { return selectors[selector] || null; }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(sessionSource[0], context);
  let sessionClick;
  for (const file of ['workspace-nav.js', 'resource-ui.js', 'session-detail.js', 'business-tasks.js']) {
    const firstClick = (listeners.click || []).length;
    vm.runInContext(fs.readFileSync('dist/aiops/' + file, 'utf8'), context, { filename: file });
    if (file === 'session-detail.js') sessionClick = listeners.click[firstClick];
  }
  const api = context.AIOpsBusinessTasks, resources = context.AIOpsResources;
  const render = () => { renders++; };
  api.configure({ lang: () => 'zh', sessions: options.sessions || context.sessionRows, render, icons() {}, toast() {} });
  resources.configure({ lang: () => 'zh', render, icons() {}, changed(reason) { if (reason === 'scene') api.onSceneChange(); } });
  context.AIOpsSessionDetail.bind({ lang: () => 'zh', row: id => context.sessionRows().find(row => row.id === id), render });
  const click = (action, id = '') => listeners.click.at(-1)({ target: { closest: selector => selector === '[data-bt]' ? { getAttribute: key => key === 'data-bt' ? action : id } : null } });
  const search = value => listeners.input.at(-1)({ target: { id: 'btSearch', value }, isComposing: false });
  const checkFilter = (key, value, checked) => listeners.change.at(-1)({ target: { value, checked, matches: selector => selector === '[data-bt-filter]', getAttribute: () => key } });
  const sdClick = (action, attributes = {}) => {
    const control = { closest: () => null, getAttribute: key => key === 'data-sd' ? action : attributes[key.replace('data-', '')] };
    sessionClick({ target: { closest: selector => selector === '[data-sd]' ? control : null }, preventDefault() {}, stopImmediatePropagation() {} });
  };
  return { context, api, resources, click, search, checkFilter, sdClick, nodes, selectors, renders: () => renders };
}

function assertRenderedRates(html, completed, passed) {
  const metricValue = key => {
    const card = [...html.matchAll(/<article\b[^>]*data-bt-metric="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)].find(match => match[1] === key);
    assert(card, 'The rendered metric card exists: ' + key);
    return card[2].match(/<strong>([^<]*)<\/strong>/)[1];
  };
  assert.equal(metricValue('completed'), completed, 'Completion rate uses all triggered execution records as its denominator');
  assert.equal(metricValue('passed'), passed, 'Pass rate uses completed execution records as its denominator');
  assert(html.includes('任务完成率') && html.includes('任务通过率'));
}

function assertRenderedTaskRates(html, taskId, executions, completed, passed) {
  const row = [...html.matchAll(/<tr>[\s\S]*?<\/tr>/g)].find(match => match[0].includes('class="bt-task-name"') && match[0].includes('data-id="' + taskId + '"'));
  assert(row, 'The rendered task row exists: ' + taskId);
  const numericCells = [...row[0].matchAll(/<td class="bt-number">([^<]*)<\/td>/g)].map(match => match[1]);
  assert.deepEqual(numericCells, [String(executions), completed, passed], 'List rows show execution count followed by completion and pass rates');
}

function assertCompletionFocus(html, round, messageId, recordId) {
  const messages = [...html.matchAll(/<article\b([^>]*)>/g)].filter(match => /class="sd-message\b[^\"]*\bis-task-completion\b/.test(match[1]));
  assert.equal(messages.length, 1, 'Exactly the completion reply is highlighted');
  assert(!messages[0][1].includes('is-user'), 'The completion target is an Agent reply');
  assert(messages[0][1].includes('data-message-id="' + messageId + '"'));
  assert(messages[0][1].includes('data-round="' + round + '"'));
  assert(messages[0][1].includes('data-completion-record="' + recordId + '"'));
  assert(html.includes('任务完成 · 第 ' + round + ' 轮'));
  assert.match(html, /id="sd-tab-conversation"[^>]*aria-selected="true"/);
  assert.match(html, /data-sd="format" data-value="conversation"[^>]*aria-pressed="true"/);
  const activeRound = [...html.matchAll(/<button\b([^>]*)>/g)].find(match => match[1].includes('data-sd="round"') && match[1].includes('class="is-active"'));
  assert(activeRound && activeRound[1].includes('data-round="' + round + '"'), 'The selected conversation round matches the completion reply');
}

const { context, api, resources, click, search, checkFilter, sdClick, nodes } = fixture();
const current = () => plain(api.summary(api.tasks()));
const all = current();
assert.deepEqual(all, { tasks: 9, executions: 28, completed: 25, passed: 19 });
assertRenderedRates(api.page(), '89.3%', '76.0%');
assertRenderedTaskRates(api.page(), 'BT-001', 4, '100.0%', '25.0%');
assertRenderedTaskRates(api.page(), 'BT-007', 1, '100.0%', '100.0%');
assertRenderedTaskRates(api.page(), 'BT-008', 2, '0.0%', '—');
assert(!api.page().includes('任务完成次数') && !api.page().includes('任务通过次数'), 'Cards and list columns use rate labels');
const allTasks = plain(api.tasks()), allRecords = plain(api.records(allTasks.map(task => task.id)));
const sessions = plain(context.sessionRows());
assert.equal(new Set(allTasks.map(task => task.id)).size, allTasks.length);
assert.equal(new Set(allRecords.map(run => run.id)).size, allRecords.length);
assert.equal(new Set(allRecords.map(run => run.sessionId)).size, allRecords.length);
for (const run of allRecords) {
  assert(sessions.some(session => session.id === run.sessionId), 'Every execution links to a native observed session');
  assert(allTasks.some(task => task.id === run.taskId), 'Every execution links to a task definition');
  assert.equal(run.session.id, run.sessionId);
  const lastActivity = Date.parse(run.session.time.replace(' ', 'T') + ':00+08:00');
  assert(Date.parse(run.triggeredAt) < lastActivity, 'Trigger time comes from the first conversation input, before latest activity');
  assert.equal(run.triggeredAt, context.AIOpsSessionDetail.startedAt(run.session));
  if (run.acceptance === 'passed') assert.equal(run.completion, 'completed');
  if (run.completion === 'completed') {
    const reply = context.AIOpsSessionDetail.replyAt(run.session, run.completionRound);
    assert.deepEqual(plain(reply), { round: run.completionRound, messageId: run.completionMessageId, completedAt: run.completedAt });
    assert(Date.parse(run.completedAt) >= Date.parse(run.triggeredAt) && Date.parse(run.completedAt) <= lastActivity);
  } else {
    assert.equal(run.completionRound, null);
    assert.equal(run.completionMessageId, null);
    assert.equal(run.completedAt, null, 'Incomplete executions have no fabricated completion anchor');
  }
}
assert(allRecords.some(run => run.completion === 'completed' && run.acceptance === 'pending'));
assert(allRecords.some(run => run.completion === 'completed' && run.acceptance === 'rejected'));
assert(allRecords.some(run => run.completion === 'completed' && run.acceptance === 'passed' && run.session.errors > 0), 'A recovered request error does not determine business acceptance');
assert(allRecords.some(run => run.completion === 'failed' && run.acceptance === 'na'));
assert(allRecords.some(run => run.completion === 'running' && run.acceptance === 'na'));

const byScene = {};
const sceneRates = { audit: ['96.0%', '75.0%'], manufacturing: ['100.0%', '100.0%'], cost: ['0.0%', '—'] };
for (const scene of context.AIOpsWorkspaces.scopeCatalog()) {
  resources.selectScene(scene.id);
  assert(api.tasks().every(task => task.scene === scene.id));
  byScene[scene.id] = current();
  assert(byScene[scene.id].passed <= byScene[scene.id].completed);
  assertRenderedRates(api.page(), ...sceneRates[scene.id]);
}
assert.deepEqual(byScene.audit, { tasks: 7, executions: 25, completed: 24, passed: 18 });
assert.deepEqual(byScene.manufacturing, { tasks: 1, executions: 1, completed: 1, passed: 1 });
assert.deepEqual(byScene.cost, { tasks: 1, executions: 2, completed: 0, passed: 0 });
for (const app of context.AIOpsWorkspaces.sceneTree()) {
  resources.selectScene(app.id);
  const expected = Object.fromEntries(Object.keys(all).map(key => [key, app.children.reduce((sum, child) => sum + byScene[child.id][key], 0)]));
  assert.deepEqual(current(), expected, 'Application statistics aggregate their business scenes without duplication');
  assertRenderedRates(api.page(), ...(app.id === 'app-audit' ? ['96.2%', '76.0%'] : ['0.0%', '—']));
}
resources.selectScene('all');
assert.deepEqual(current(), all, 'Returning to enterprise overview restores all tasks and executions');
assertRenderedRates(api.page(), '89.3%', '76.0%');

const noRecords = fixture({ sessions: () => [] });
assert.deepEqual(plain(noRecords.api.summary(noRecords.api.tasks())), { tasks: 9, executions: 0, completed: 0, passed: 0 });
assertRenderedRates(noRecords.api.page(), '—', '—');
assertRenderedTaskRates(noRecords.api.page(), 'BT-001', 0, '—', '—');
assert(!/NaN|Infinity/.test(noRecords.api.page()), 'No observed records leave both rates undefined');

// Column filters combine checked values with OR, then intersect both columns and the search query.
const visibleIds = () => Array.from(api.filteredTasks(), task => task.id);
const allIds = allTasks.map(task => task.id);
assert.deepEqual(plain(api.filterOptions('scene')).sort(), ['audit', 'cost', 'manufacturing']);
assert.deepEqual(plain(api.filterOptions('agent')).sort(), [...new Set(allTasks.map(task => task.agent))].sort());
assert.deepEqual(plain(api.filterOptions('unknown')), []);
assert.equal(api.setFilter('unknown', ['audit']), false);
assert.equal(api.setFilter('scene', 'audit'), false);
assert.deepEqual(visibleIds(), allIds, 'Invalid filter arguments leave the current selection unchanged');
assert.equal(api.setFilter('scene', ['audit', 'cost', 'audit', 'unknown']), true);
assert.deepEqual(visibleIds(), ['BT-001', 'BT-002', 'BT-003', 'BT-004', 'BT-005', 'BT-006', 'BT-008', 'BT-009']);
api.setFilter('agent', ['关账审核智能体', '成本分析智能体']);
assert.deepEqual(visibleIds(), ['BT-001', 'BT-002', 'BT-003', 'BT-004', 'BT-005', 'BT-006', 'BT-008']);
search('v1.1');
assert.deepEqual(visibleIds(), ['BT-003', 'BT-008'], 'Search intersects the selected scene and Agent values');
assert.equal(nodes.btTaskCount.textContent, 2);
assert.deepEqual(current(), all, 'List filters do not change the selected scenario statistics');
assert.match(api.page(), /data-bt-metric="tasks"[\s\S]*?<strong>9<\/strong>/);
api.setFilter('scene', ['audit']);
assert.deepEqual(visibleIds(), ['BT-003']);
click('filter-clear', 'scene');
assert.deepEqual(visibleIds(), ['BT-003', 'BT-008'], 'Clearing the scene column retains the Agent column and search');
search('');
assert.deepEqual(visibleIds(), ['BT-001', 'BT-002', 'BT-003', 'BT-004', 'BT-005', 'BT-006', 'BT-008']);
api.setFilter('scene', ['audit', 'manufacturing']);
api.setFilter('agent', ['制造业规则审核智能体']);
search('v1.2');
assert.deepEqual(visibleIds(), ['BT-007']);
click('filter-clear', 'agent');
assert.deepEqual(visibleIds(), ['BT-002', 'BT-004', 'BT-007'], 'Clearing Agent retains the scene column and search');
api.setFilter('scene', ['audit']);
api.setFilter('agent', ['制造业规则审核智能体']);
assert.deepEqual(visibleIds(), []);
assert(nodes.btTaskRows.innerHTML.includes('没有匹配的业务任务'));
click('reset');
assert.deepEqual(visibleIds(), allIds, 'Reset clears both column filters and the search query');
assert(api.page().includes('value=""'));
checkFilter('scene', 'audit', true);
assert.equal(visibleIds().length, 7, 'Checkbox changes use the same scene filter behavior');
checkFilter('scene', 'audit', false);
assert.deepEqual(visibleIds(), allIds);
checkFilter('agent', '会话质量分析智能体', true);
assert.deepEqual(visibleIds(), ['BT-009']);
checkFilter('scene', 'cost', true);
assert.deepEqual(visibleIds(), []);
checkFilter('agent', '会话质量分析智能体', false);
assert.deepEqual(visibleIds(), ['BT-008']);
assert.deepEqual(plain(api.tasks()), allTasks, 'Filtering does not mutate the task definitions');
click('reset');

const listHtml = api.page();
assert(listHtml.includes('<th scope="col">版本</th>'));
assert.equal([...listHtml.matchAll(/<td class="bt-version">/g)].length, allTasks.length);
for (const nameCell of listHtml.matchAll(/<span class="bt-task-copy">([\s\S]*?)<\/span>/g)) {
  assert(!/<small>|BT-\d|v\d/.test(nameCell[1]), 'The task name contains no second-line identifier or version');
}
assert(!/bt-eyebrow|bt-heading-meta|btListCount|从正式用户的执行记录中|查看任务定义与每次执行触发记录/.test(listHtml));
assert.equal([...listHtml.matchAll(/id="btTaskCount"/g)].length, 1, 'The list has a single visible result count');

// Every read-only task modal exposes the complete selected definition and populated dimensions.
const liveTasks = api.tasks(), dimensionObjects = [], valueArrays = [];
for (const task of liveTasks) {
  const definition = api.definitionMarkup(task.id);
  const scene = context.AIOpsWorkspaces.scopeCatalog().find(item => item.id === task.scene);
  for (const field of [task.name, task.id, task.version, scene.name, task.agent, task.description, task.input, task.output, task.completion, ...task.criteria]) {
    assert(definition.includes(field), 'Task details include each selected definition field');
  }
  assert(definition.includes('任务定义') && definition.includes('通过标准') && definition.includes('评估维度'));
  assert(task.dimensions.length > 0);
  assert.equal(new Set(task.dimensions.map(dimension => dimension.name)).size, task.dimensions.length);
  for (const dimension of task.dimensions) {
    assert(dimension.name.trim() && dimension.description.trim());
    assert(dimension.values.length > 0 && dimension.values.every(value => typeof value === 'string' && value.trim()));
    assert.equal(new Set(dimension.values).size, dimension.values.length);
    for (const value of [dimension.name, dimension.description, ...dimension.values]) assert(definition.includes(value));
    dimensionObjects.push(dimension); valueArrays.push(dimension.values);
  }
  assert(!/<(?:input|textarea|select)\b|contenteditable\s*=/i.test(definition), 'Task definition fields and dimensions are read-only');
  const controls = [...definition.matchAll(/<button\b([^>]*)>/g)];
  assert(controls.length > 0 && controls.every(control => control[1].includes('data-bt="definition-close"')), 'Only close controls are present');
}
assert.equal(new Set(dimensionObjects).size, dimensionObjects.length, 'Each task owns independent dimension objects');
assert.equal(new Set(valueArrays).size, valueArrays.length, 'Dimension value arrays do not share mutable storage');
assert.equal(api.definitionMarkup('unknown'), '');
resources.selectScene('cost');
assert.equal(api.definitionMarkup('BT-001'), '', 'A task outside the selected global scenario is not exposed by the modal');
assert.deepEqual(plain(api.filterOptions('scene')), ['cost']);
assert.deepEqual(plain(api.filterOptions('agent')), ['成本分析智能体']);
resources.selectScene('all');

// Feedback writes validate the selected task and content, then persist independently per task.
const untouched = [...stored];
for (const [id, content] of [['BT-001', '   '], ['BT-001', 'x'.repeat(2001)], ['unknown', 'feedback']]) {
  assert.equal(api.saveFeedback(id, content).ok, false);
}
assert.deepEqual([...stored], untouched);
resources.selectScene('cost');
assert.equal(api.saveFeedback('BT-001', 'Task outside selected scene').ok, false);
assert.equal(api.feedback().length, 0);
resources.selectScene('all');
const unsafe = '<img src=x onerror=alert(1)> & "feedback"';
assert.equal(api.saveFeedback('BT-001', '  ' + unsafe + '  ').ok, true);
assert.equal(api.saveFeedback('BT-002', 'x'.repeat(2000)).ok, true, 'The documented 2000-character limit is accepted');
assert.equal(api.feedback('BT-001').length, 1);
assert.equal(api.feedback('BT-001')[0].content, unsafe, 'Whitespace is trimmed without altering the feedback');
assert.equal(api.feedback('BT-002')[0].content.length, 2000);
const reloaded = fixture();
assert.deepEqual(plain(reloaded.api.feedback()), plain(api.feedback()), 'Reload reads the committed browser feedback');

click('task', 'BT-001');
let html = api.page();
assertRenderedRates(html, '100.0%', '25.0%');
assert(html.includes('任务详情') && html.includes('执行触发记录') && html.includes('任务反馈'));
assert(!/bt-detail-layout|bt-definition|bt-readonly|核对月末关账资料与报表/.test(html), 'Definition panels and explanatory text live in the modal instead of the task records page');
assert(html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;feedback&quot;'));
assert(!html.includes('<img src=x'));
assert(!html.includes('x'.repeat(2000)), 'Feedback from another task is not shown');
assert(!html.includes('textarea'), 'Task definitions stay read-only');
click('session', 'CR-1024');
html = api.page();
assert(html.includes('返回执行触发记录') && html.includes('CR-1024') && html.includes('session-detail'), 'Observed records open native conversation and trace inspection');
assertCompletionFocus(html, 17, 'CR-1024-msg-034', 'TR-1024');
assert(17 < Math.ceil(sessions.find(row => row.id === 'CR-1024').messages / 2), 'The recorded completion precedes later conversation turns');
sdClick('format', { value: 'json' });
assert.match(api.page(), /data-sd="format" data-value="json"[^>]*aria-pressed="true"/);
click('back-records');
click('session', 'CR-1024');
assertCompletionFocus(api.page(), 17, 'CR-1024-msg-034', 'TR-1024');
sdClick('tab', { value: 'trace' });
assert.match(api.page(), /id="sd-tab-trace"[^>]*aria-selected="true"/);
click('back-records');
click('session', 'CR-1024');
assertCompletionFocus(api.page(), 17, 'CR-1024-msg-034', 'TR-1024');
sdClick('round', { value: '2' });
assert(api.page().includes('data-round="2"'));
click('back-records');
click('session', 'CR-1024');
assertCompletionFocus(api.page(), 17, 'CR-1024-msg-034', 'TR-1024');
click('back-records');
assert(api.page().includes('执行触发记录'));

// Completion anchors validate an exact assistant message, preserve context isolation, and scroll once.
const focused = fixture(), detail = focused.context.AIOpsSessionDetail;
const row = focused.context.sessionRows().find(item => item.id === 'CR-1024');
const target = { round: 17, messageId: 'CR-1024-msg-034', recordId: 'TR-1024', taskId: 'BT-001', taskName: '月末关账审核' };
assert.deepEqual(plain(detail.replyAt(row, 17)), { round: 17, messageId: target.messageId, completedAt: allRecords.find(run => run.sessionId === row.id).completedAt });
for (const invalidRound of [0, -1, 1.5, '17', 999]) assert.equal(detail.replyAt(row, invalidRound), null);
const inputOnly = focused.context.sessionRows().find(item => item.id === 'CR-1028');
assert.equal(detail.replyAt(inputOnly, 13), null, 'An input-only final turn cannot be treated as a completion reply');
for (const invalidTarget of [
  { round: 17, messageId: 'CR-1024-msg-033' },
  { round: 16, messageId: target.messageId },
  { round: 17, messageId: 'CR-1019-msg-034' },
  { round: 99, messageId: 'CR-1024-msg-198' }
]) {
  assert.equal(detail.focusReply(row, target), true);
  assert.equal(detail.focusReply(row, invalidTarget), false);
  const invalidHtml = detail.page(row, true);
  assert(!invalidHtml.includes('is-task-completion'), 'Invalid anchors clear the previous highlight');
  assert.match(invalidHtml, /id="sd-tab-conversation"[^>]*aria-selected="true"/);
  assert.match(invalidHtml, /data-sd="round" data-round="1"[^>]*class="is-active"/);
}
assert.equal(detail.focusReply(inputOnly, { round: 13, messageId: 'CR-1028-msg-026' }), false);
assert.equal(detail.focusReply(null, target), false);
detail.setContext('page:线上会话');
detail.page(row, true);
focused.sdClick('format', { value: 'json' });
focused.sdClick('tab', { value: 'trace' });
detail.setContext('page:业务任务');
focused.click('task', 'BT-001'); focused.click('session', row.id);
assertCompletionFocus(focused.api.page(), 17, target.messageId, 'TR-1024');
detail.setContext('page:线上会话');
assert.match(detail.page(row, true), /id="sd-tab-trace"[^>]*aria-selected="true"/);
focused.sdClick('tab', { value: 'conversation' });
const originalContext = detail.page(row, true);
assert.match(originalContext, /data-sd="format" data-value="json"[^>]*aria-pressed="true"/);
assert(!originalContext.includes('is-task-completion'), 'Task focus does not leak into the original sessions context');
detail.setContext('page:业务任务');
assertCompletionFocus(focused.api.page(), 17, target.messageId, 'TR-1024');
const anotherRow = focused.context.sessionRows().find(item => item.id === 'CR-1023');
assert(!detail.page(anotherRow, true).includes('is-task-completion'), 'Another session does not inherit the completion highlight');
focused.click('session', row.id);
assertCompletionFocus(focused.api.page(), 17, target.messageId, 'TR-1024');

const scroller = { scrollTop: 40, getBoundingClientRect: () => ({ top: 100 }) };
const active = { getBoundingClientRect: () => ({ top: 200, bottom: 224 }) };
const nav = { scrollTop: 0, getBoundingClientRect: () => ({ top: 80, bottom: 180 }), querySelector: () => active };
focused.selectors['.session-detail'] = {};
focused.selectors['.sd-message.is-task-completion'] = { getBoundingClientRect: () => ({ top: 460 }) };
focused.selectors['.sd-conversation-scroll'] = scroller;
focused.selectors['.sd-rounds nav'] = nav;
detail.afterRender();
assert.equal(scroller.scrollTop, 384, 'The nested conversation scroller positions the actual completion message');
assert.equal(nav.scrollTop, 44, 'The active round is brought into the round navigation viewport');
scroller.scrollTop = 333; nav.scrollTop = 99;
detail.afterRender();
assert.equal(scroller.scrollTop, 333, 'Routine rerenders do not scroll back after the one-time jump');
assert.equal(nav.scrollTop, 99);
focused.nodes['sd-turn-2'] = { getBoundingClientRect: () => ({ top: 260 }) };
focused.sdClick('round', { value: '2' });
detail.afterRender();
assert.equal(scroller.scrollTop, 477, 'Selecting another round uses its normal turn anchor rather than the completion message');

focused.click('task', 'BT-008');
for (const id of ['CR-1028', 'CR-1025']) {
  focused.click('session', id);
  const incomplete = focused.api.page();
  assert(!incomplete.includes('is-task-completion') && !incomplete.includes('sd-completion-heading'));
  assert.match(incomplete, /id="sd-tab-conversation"[^>]*aria-selected="true"/);
  assert.match(incomplete, /data-sd="round" data-round="1"[^>]*class="is-active"/);
}
assert.equal(detail.focusReply(row, null), true);
assert(!detail.page(row, true).includes('is-task-completion'), 'Null focus explicitly clears a previously saved completion target');

const committed = [...stored];
rejectWrites = true;
const failed = api.saveFeedback('BT-001', 'This must not appear saved');
rejectWrites = false;
assert.equal(failed.ok, false);
assert(failed.error.includes('失败'));
assert.deepEqual([...stored], committed);
assert.equal(api.feedback('BT-001').length, 1, 'Failed writes never create an apparent committed feedback entry');

click('back');
search('no-matching-task');
assert(nodes.btTaskRows.innerHTML.includes('没有匹配的业务任务'));
assert(api.page().includes('value="no-matching-task"'));
click('task', 'BT-001');
api.onSceneChange();
html = api.page();
assert(html.includes('id="btSearch"') && html.includes('value=""'));
assert(!html.includes('data-bt="definition"'), 'Scene changes clear the selected task and its execution detail');
search('monthly-nonmatch');
api.setFilter('scene', ['audit']);
api.setFilter('agent', ['关账审核智能体']);
click('task', 'BT-001');
resources.selectScene('cost');
html = api.page();
assert(html.includes('value=""') && html.includes('模型调用成本分析') && !html.includes('data-bt="definition"'));
assert.deepEqual(visibleIds(), ['BT-008'], 'Global scene changes reset both column selections along with query and detail');
resources.selectScene('all');
assert.deepEqual(visibleIds(), allIds);

console.log('Passed: native session linkage and explicit completion-reply anchors; exact Agent-message highlight, original-conversation restore, context isolation and one-time nested scroll; incomplete/invalid anchor handling; trigger times and scenario aggregation; rendered rate denominators and zero cases; filters and read-only definition modals; feedback persistence, escaping and storage failures.');
