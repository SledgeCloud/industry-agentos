const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const KEY = 'aiops.online-evaluators.v1';
const NOW = Date.parse('2026-11-05T00:00:00Z');
const copy = value => JSON.parse(JSON.stringify(value));
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [NOW])); } static now() { return NOW; } }

function fixture(options = {}) {
  const saved = new Map(), listeners = {}, dialogs = [], nodes = {};
  let writes = 0, rejectWrites = false, sideEffects = 0, renders = 0;
  const storage = { getItem: key => saved.get(key) || null, setItem(key, value) { if (rejectWrites) throw new Error('quota'); writes++; saved.set(key, value); } };
  function node(attributes = {}) {
    const attrs = Object.assign({}, attributes);
    return { id: attrs.id || '', value: '', innerHTML: '', hidden: false, disabled: false, textContent: '',
      classList: { toggle() {} }, focus() {}, scrollIntoView() {}, closest() { return null; },
      getAttribute(key) { return attrs[key] ?? null; }, setAttribute(key, value) { attrs[key] = String(value); }, removeAttribute(key) { delete attrs[key]; },
      hasAttribute(key) { return Object.prototype.hasOwnProperty.call(attrs, key); },
      matches(selector) { const match = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/); return !!match && Object.prototype.hasOwnProperty.call(attrs, match[1]) && (match[2] == null || attrs[match[1]] === match[2]); }
    };
  }
  for (const id of ['oeRows', 'oeOverviewStats', 'oeListHeading', 'oeSessionResults', 'oeDetailStats', 'oeSessionTabCount', 'oeFilterSummary', 'oeResultFilterError', 'oeResultFilters']) nodes[id] = node({ id });
  const context = {
    console, Date: Clock, localStorage: storage, addEventListener() {},
    fetch() { sideEffects++; throw new Error('Configuration must not execute a model or service'); },
    setInterval() { sideEffects++; throw new Error('Configuration must not start a scheduler'); },
    setTimeout() { sideEffects++; throw new Error('Configuration must not schedule background work'); },
    document: {
      addEventListener(type, handler) { (listeners[type] ||= []).push(handler); },
      getElementById(id) { return nodes[id] || null; }, querySelector() { return null; }, querySelectorAll() { return []; },
      body: { appendChild(element) { dialogs.push(element); } },
      createElement(tag) {
        assert.equal(tag, 'dialog'); const events = {}, children = {};
        return Object.assign(node(), { isConnected: true, children, fields: [], tasks: [],
          addEventListener(type, handler) { events[type] = handler; }, showModal() { this.open = true; },
          close() { this.open = false; if (events.close) events.close(); }, remove() { this.isConnected = false; },
          contains(element) { return this.fields.includes(element) || this.tasks.includes(element) || Object.values(children).includes(element); },
          querySelector(selector) {
            if (selector === '[name="oeOutputType"]:checked') return null;
            const fieldMatch = selector.match(/^\[data-oe-field="([^"]+)"\]$/);
            if (fieldMatch) { const field = this.fields.find(item => item.getAttribute('data-oe-field') === fieldMatch[1]); if (field) return field; }
            return children[selector] ||= node(selector.startsWith('#') ? { id: selector.slice(1) } : {});
          },
          querySelectorAll(selector) { return selector === '[data-oe-field]' ? this.fields : selector === '[data-oe-task]:checked' ? this.tasks.filter(item => item.checked) : []; }
        });
      }
    }
  };
  context.window = context; vm.createContext(context);
  for (const file of ['workspace-nav.js', 'resource-ui.js', 'session-detail.js', 'business-tasks.js', 'online-evaluators-data.js', 'online-evaluators-filters.js', 'online-evaluators.js']) {
    vm.runInContext(fs.readFileSync('dist/aiops/' + file, 'utf8'), context, { filename: file });
  }
  const data = context.AIOpsOnlineEvaluatorData, ui = context.AIOpsOnlineEvaluators, resources = context.AIOpsResources;
  let runtimeFixture = options.runtime;
  if (runtimeFixture) {
    vm.runInContext(fs.readFileSync('dist/aiops/online-evaluators-runtime.js', 'utf8'), context, { filename: 'online-evaluators-runtime.js' });
    const presentation = context.AIOpsOnlineEvaluatorRuntime.presentation;
    assert.equal(typeof presentation, 'function', 'UI history fixtures use the real frozen-result presentation contract');
    runtimeFixture = Object.assign({ presentation }, runtimeFixture);
    context.AIOpsOnlineEvaluatorRuntime = undefined;
  }
  const sessions = options.sessions || (() => []);
  resources.configure({ lang: () => 'zh', icons() {}, render() {}, changed() { ui.onSceneChange(); } });
  context.AIOpsSessionDetail.bind({ lang: () => 'zh', row: id => sessions().find(row => row.id === id), render() {} });
  context.AIOpsBusinessTasks.configure({ lang: () => 'zh', icons() {}, render() {}, toast() {}, sessions });
  if (options.initializeRuntime) context.AIOpsOnlineEvaluatorRuntime = runtimeFixture;
  if (options.scheduler) context.AIOpsOnlineEvaluatorScheduler = options.scheduler;
  ui.configure({ lang: () => 'zh', icons() {}, render() { renders++; }, toast() {}, sessions });
  // UI-only history fixtures are attached after configure so tests never invoke seeding or scanning.
  if (runtimeFixture) context.AIOpsOnlineEvaluatorRuntime = runtimeFixture;
  const fire = (type, properties) => {
    const event = Object.assign({ preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} }, properties);
    listeners[type].at(-1)(event); return event;
  };
  const click = (action, id = '', attributes = {}) => {
    const control = node(Object.assign({ 'data-oe': action, 'data-id': id }, Object.fromEntries(Object.entries(attributes).map(([key, value]) => ['data-' + key, value]))));
    return fire('click', { target: { closest: selector => selector === '[data-oe]' ? control : selector === '.oe-tag-picker' && ['select-tag', 'remove-tag'].includes(action) ? {} : null } });
  };
  const field = (path, value) => Object.assign(node({ 'data-oe-field': path }), { value });
  const task = (id, checked = true) => Object.assign(node({ 'data-oe-task': '' }), { value: id, checked });
  const filterControl = (kind, key, value) => Object.assign(node({ ['data-oe-' + kind + '-filter']: key, ...(kind === 'result' && key === 'query' ? { id: 'oeSessionSearch' } : {}) }), { value });
  const filter = (kind, key, value, event = 'change') => fire(event, { target: filterControl(kind, key, value) });
  return { context, data, ui, resources, storage, saved, dialogs, nodes, click, fire, field, task, filter, renders: () => renders, writes: () => writes, sideEffects: () => sideEffects, failWrites(value) { rejectWrites = value; } };
}

const f = fixture(), D = f.data;
function valid(scene = 'audit', type = 'boolean') {
  const draft = D.defaults(scene);
  Object.assign(draft, { name: '线上任务质量评估', description: '验证正式用户记录的回答质量', agentId: D.agents(draft.sceneId)[0].id, tags: ['质量'], filterLogic: '当天新增的正式用户会话', prompt: '仅根据原始会话和执行证据判断', granularity: 'session' });
  draft.output.type = type; draft.output.scoreItems[0].criteria = '依据原始来源判断事实与结论是否一致'; return draft;
}
function frozenResult(item, evaluator) {
  item.outputConfig = copy(evaluator.output);
  if (item.outputType === 'task-executions') {
    item.taskSnapshot = copy(evaluator.taskSnapshots.find(task => task.id === item.taskId));
    item.value = { taskId: item.taskId, taskVersion: item.taskVersion, completion: item.completion, acceptance: item.acceptance, dimensions: item.dimensions || [] };
  }
  item.output = copy(item.value == null ? null : item.value);
  return item;
}
function rejects(draft, field) { assert(D.validate(draft).some(error => error.field === field), 'Expected validation error: ' + field); }
assert.deepEqual(copy(D.constants.models), ['deepseek 4.1 flash', 'GPT-6.1 Sol', 'Claude 5.5 Opus']);
assert.deepEqual(copy(D.constants.granularities.map(item => item.id)), ['session', 'trace', 'span', 'business-task']);
assert.deepEqual(copy(D.constants.spanTypes.map(item => item.id)), ['ontology', 'model', 'tool', 'agent', 'guard']);
assert.equal(D.defaults('audit').enabled, true, 'New evaluators default to enabled without adding a form status field');
assert.equal(D.scenes().length, 3); assert.equal(D.defaults('app-analysis').sceneId, 'cost');
for (const scene of D.scenes()) {
  const actual = D.agents(scene.id), catalog = f.context.AIOpsWorkspaces.scopeCatalog().find(item => item.id === scene.id);
  assert.deepEqual(copy(actual), copy(catalog.items.filter(item => item.type === 'Agent').map(item => ({ id: item.id, name: item.name }))));
  assert.equal(D.validate(valid(scene.id)).length, 0);
}
for (const field of ['name', 'description', 'agentId', 'filterLogic', 'prompt']) { const draft = valid(); draft[field] = ' '; rejects(draft, field); }
const missingTags = valid(); missingTags.tags = ['  ']; rejects(missingTags, 'tags');
const wrongAgent = valid(); wrongAgent.agentId = D.agents('cost')[0].id; rejects(wrongAgent, 'agentId');
const wrongScene = valid(); wrongScene.sceneId = 'app-audit'; rejects(wrongScene, 'sceneId');
for (const model of D.constants.models) { const draft = valid(); draft.model = model; assert.equal(D.validate(draft).length, 0); }
const otherModel = valid(); otherModel.model = 'unconfigured-model'; rejects(otherModel, 'model');
for (const sampling of [0, -1, 100.001, '', null, Infinity, NaN]) { const draft = valid(); draft.samplingRate = sampling; rejects(draft, 'samplingRate'); }
for (const sampling of [0.000001, 20, 100]) { const draft = valid(); draft.samplingRate = sampling; assert.equal(D.validate(draft).length, 0); }
const span = valid(); span.granularity = 'span'; rejects(span, 'spanTypes'); span.spanTypes = ['unknown']; rejects(span, 'spanTypes');
span.spanTypes = ['model', 'tool', 'tool']; assert.equal(D.validate(span).length, 0); assert.deepEqual(copy(D.normalize(span).spanTypes), ['model', 'tool']);
span.granularity = 'trace'; assert.deepEqual(copy(D.normalize(span).spanTypes), []); assert.equal(span.spanTypes.length, 3, 'Normalization leaves the editable draft untouched');

const boolean = valid(); boolean.output.booleanPass = false; assert.equal(D.validate(boolean).length, 0);
assert.deepEqual(copy(D.normalize(boolean).output), { type: 'boolean', booleanPass: false });
boolean.output.booleanPass = 'false'; rejects(boolean, 'output.booleanPass');
const category = valid('audit', 'category'); assert.equal(D.validate(category).length, 0);
category.output.categories[1].name = '符合'; rejects(category, 'output.categories.1.name');
category.output.categories = [{ name: '只有一个', pass: true }]; rejects(category, 'output.categories');
category.output.categories = [{ name: 'A', pass: true }, { name: 'B', pass: true }]; assert.equal(D.validate(category).length, 0, 'Every category may independently map to passed');
category.output.categories.forEach(item => { item.pass = false; }); assert.equal(D.validate(category).length, 0, 'Every category may independently map to not passed');
assert.deepEqual(copy(D.normalize(category).output.categories.map(item => item.pass)), [false, false]);
category.output.categories[0].pass = true;
category.output.categories[1].pass = 'false'; rejects(category, 'output.categories.1.pass');
category.output.categories[1].pass = false; assert.equal(D.validate(category).length, 0);
assert.deepEqual(Object.keys(D.normalize(category).output).sort(), ['categories', 'type']);
const score = valid('audit', 'score');
score.output.scoreItems = [{ name: '准确性', criteria: '与事实及证据一致', weight: .6 }, { name: '完整性', criteria: '覆盖必需信息', weight: .4 }];
for (const threshold of [0, 80, 100]) { score.output.threshold = threshold; assert.equal(D.validate(score).length, 0); }
for (const threshold of [-.01, 100.01, null]) { score.output.threshold = threshold; rejects(score, 'output.threshold'); }
score.output.threshold = 80;
for (const weight of [0, -.1, null, Infinity]) { const draft = copy(score); draft.output.scoreItems[0].weight = weight; rejects(draft, 'output.scoreItems.0.weight'); }
const badSum = copy(score); badSum.output.scoreItems[0].weight = .5; rejects(badSum, 'output.scoreItems');
const tolerance = copy(score); tolerance.output.scoreItems[0].weight = .6000004; assert.equal(D.validate(tolerance).length, 0);
const missingCriteria = copy(score); missingCriteria.output.scoreItems[0].criteria = ''; rejects(missingCriteria, 'output.scoreItems.0.criteria');
assert.deepEqual(Object.keys(D.normalize(score).output).sort(), ['scoreItems', 'threshold', 'type']);
const text = valid('audit', 'text'); text.output.threshold = -1; text.output.categories = []; text.output.booleanPass = null;
assert.equal(D.validate(text).length, 0); assert.deepEqual(copy(D.normalize(text).output), { type: 'text' });

const scheduled = valid(); scheduled.schedule.time = '24:00'; rejects(scheduled, 'schedule.time');
scheduled.schedule.time = '09:00'; scheduled.schedule.timezone = 'UTC'; rejects(scheduled, 'schedule.timezone'); scheduled.schedule.timezone = 'Asia/Shanghai';
scheduled.schedule.repeat = 'weekly'; scheduled.schedule.weekdays = []; rejects(scheduled, 'schedule.weekdays');
for (const days of [[0], [8], [1.5]]) { scheduled.schedule.weekdays = days; rejects(scheduled, 'schedule.weekdays'); }
scheduled.schedule.weekdays = [1, 7]; assert.equal(D.validate(scheduled).length, 0); assert(D.scheduleSummary(scheduled.schedule).includes('每周一、日'));
scheduled.schedule.repeat = 'monthly'; scheduled.schedule.monthdays = [1, 31]; assert.equal(D.validate(scheduled).length, 0);
scheduled.schedule.monthdays = [32]; rejects(scheduled, 'schedule.monthdays');
scheduled.schedule.repeat = 'interval'; scheduled.schedule.time = ''; scheduled.schedule.intervalHours = 1; assert.equal(D.validate(scheduled).length, 0, 'Interval schedules do not require a wall-clock time');
for (const hours of [0, .5, null]) { scheduled.schedule.intervalHours = hours; rejects(scheduled, 'schedule.intervalHours'); }
scheduled.schedule.repeat = 'once';
for (const onceAt of ['', '2026-11-05T07:59', '2026-11-05T08:00', '2030-02-30T09:00']) { scheduled.schedule.onceAt = onceAt; rejects(scheduled, 'schedule.onceAt'); }
scheduled.schedule.onceAt = '2026-11-05T09:00'; assert.equal(D.validate(scheduled).length, 0, 'Offsetless single-run times are interpreted as Asia/Shanghai');
scheduled.schedule.repeat = 'daily'; scheduled.schedule.time = '09:00'; assert.equal(D.validate(scheduled).length, 0, 'Unused schedule fields do not block another frequency');

const store = D.createStore(f.storage); assert.deepEqual(copy(store.list()), []); assert.equal(f.writes(), 0);
const request = '每天 09:30，使用 GPT-6.1 Sol，对成本分析 Agent 当天新增的模型调用和工具调用 Span 进行在线评测，采样率 20%，按准确性60%、完整性40%评分，通过阈值85分，保留原始调用证据。';
const generated = D.generate(request, 'app-analysis');
assert.equal(generated.sceneId, 'cost'); assert.equal(generated.agentId, D.agents('cost')[0].id); assert.equal(generated.model, 'GPT-6.1 Sol');
assert.equal(generated.granularity, 'span'); assert.deepEqual(copy(generated.spanTypes), ['model', 'tool']); assert.equal(generated.samplingRate, 20);
assert.equal(generated.schedule.time, '09:30'); assert.equal(generated.schedule.repeat, 'daily'); assert.equal(generated.output.type, 'score'); assert.equal(generated.output.threshold, 85);
assert.deepEqual(copy(generated.output.scoreItems.map(item => item.weight)), [.6, .4]);
assert(generated.filterLogic.includes('当天') && generated.filterLogic.includes('新增'));
assert.equal(generated.source, 'copilot'); assert.equal(generated.originalRequest, request); assert(generated.prompt.includes(request)); assert.equal(D.validate(generated).length, 0);
assert.equal(f.writes(), 0, 'Generating or discarding a Copilot draft does not create a stored evaluator');
const named = D.generate('用性能分析 Agent 评估会话是否准确', 'all'); assert.equal(named.sceneId, 'cost'); assert.equal(named.agentId, D.agents('cost')[1].id);
const namedChild = D.generate('使用规则优化 Agent 评测每个 Trace，输出类别：符合、不符合', 'app-audit');
assert.equal(namedChild.sceneId, 'manufacturing'); assert.equal(namedChild.agentId, D.agents('manufacturing')[1].id); assert.equal(namedChild.output.type, 'category');
const generatedAllPass = D.generate('输出类别：优秀、合格', 'audit');
assert.deepEqual(copy(generatedAllPass.output.categories.map(item => item.pass)), [true, true], 'Copilot does not force a failing category');
assert.equal(D.validate(generatedAllPass).length, 0);
const generatedAllFail = D.generate('输出类别：不符合、失败', 'audit');
assert.deepEqual(copy(generatedAllFail.output.categories.map(item => item.pass)), [false, false], 'Copilot does not force a passing category');
assert.equal(D.validate(generatedAllFail).length, 0);
assert(/昨天|前一天|上一自然日/.test(D.generate('评估昨天新增的会话', 'audit').filterLogic));
assert(/(?:近|最近)\s*2\s*小时/.test(D.generate('评估近2小时新增的会话', 'audit').filterLogic));
assert.equal(D.generate('每周一、三、五上午9点，对工具调用 Span 评分', 'audit').schedule.weekdays.join(','), '1,3,5');
assert.equal(D.generate('每月1、15日18:00输出文本', 'audit').schedule.repeat, 'monthly');
assert.equal(D.generate('每隔2小时，false为通过', 'audit').output.booleanPass, false);

const first = store.save(valid()); assert.equal(first.ok, true); assert.equal(first.record.id, 'OE-001'); assert.equal(first.record.enabled, true);
const second = store.save(valid()); assert.equal(second.record.id, 'OE-002'); assert.equal(store.list().length, 2, 'Repeated creates allocate unique IDs');
const edited = copy(first.record); edited.name = '修改后的评估器'; const update = store.save(edited, first.record.id);
assert.equal(update.record.id, first.record.id); assert.equal(store.list().length, 2); assert.equal(update.record.createdAt, first.record.createdAt); assert.equal(update.record.updatedAt, new Clock().toISOString());
const created = store.save(generated); assert.equal(created.record.id, 'OE-003');
const copilotEdit = copy(created.record); copilotEdit.source = 'manual'; copilotEdit.originalRequest = 'changed';
const savedCopilot = store.save(copilotEdit, created.record.id); assert.equal(savedCopilot.record.source, 'copilot'); assert.equal(savedCopilot.record.originalRequest, request);
assert.equal(store.list(['audit']).length, 2); assert.equal(store.list(['app-audit']).length, 2); assert.equal(store.list(['cost:agents:0']).length, 1); assert.equal(store.list([]).length, 0);
const detached = store.list(); detached[0].name = 'mutated snapshot'; detached[0].tags.push('mutated'); assert.notEqual(store.list()[0].name, detached[0].name); assert(!store.list()[0].tags.includes('mutated'));
assert.equal(D.createStore(f.storage).list().length, 3, 'Reload reads committed evaluator definitions');
let before = [...f.saved], writes = f.writes(); const invalid = valid(); invalid.name = ''; assert.equal(store.save(invalid).ok, false); assert.equal(f.writes(), writes);
f.failWrites(true); assert.equal(store.save(valid()).ok, false); assert.deepEqual([...f.saved], before); f.failWrites(false);
assert.equal(store.save(valid(), 'OE-999').ok, false); assert.deepEqual([...f.saved], before);
const collisionRecords = JSON.parse(f.saved.get(KEY)); collisionRecords.push(Object.assign({}, copy(first.record), { id: 'OE-009' })); f.saved.set(KEY, JSON.stringify(collisionRecords));
assert.equal(store.save(valid()).record.id, 'OE-010', 'ID allocation observes persisted records rather than a stale counter');
assert.equal(new Set(store.list().map(record => record.id)).size, store.list().length);

// Renderer snapshots use the real store; opening and cancelling editors never executes anything.
const empty = fixture(); assert(empty.ui.page().includes('暂无在线评估器')); assert(empty.ui.page().includes('手动新建') && empty.ui.page().includes('Copilot 新建'));
empty.click('manual'); let dialog = empty.dialogs.at(-1);
for (const label of ['名称', '关联 Agent', '描述', '标签', '评估粒度', '筛选逻辑', '评测模型', '采样率', '评估频率', '提示词', '输出类型']) assert(dialog.innerHTML.includes(label));
assert(dialog.innerHTML.includes('value="false"')); empty.click('close'); assert.equal(empty.writes(), 0);
empty.click('copilot'); dialog = empty.dialogs.at(-1); dialog.querySelector('#oeCopilotRequest').value = request; empty.click('generate');
assert(dialog.querySelector('#oeCopilotPreview').innerHTML.includes('GPT-6.1 Sol')); assert.equal(empty.writes(), 0);
empty.click('review-draft'); assert(empty.dialogs.at(-1).innerHTML.includes('Copilot 草稿')); empty.click('close'); assert.equal(empty.writes(), 0);
assert.equal(empty.sideEffects(), 0);

// Drive the real tag handlers against saved history and a small dialog/control surface.
const tagging = fixture(), tagStore = tagging.data.createStore(tagging.storage);
for (const [scene, tags] of [['audit', ['质量', '准确性', 'Quality']], ['audit', ['完整性', '准确性']], ['cost', ['成本效率']]]) {
  const draft = valid(scene); draft.tags = tags; assert.equal(tagStore.save(draft).ok, true);
}
const tagWrites = tagging.writes(), tagSnapshot = [...tagging.saved];
tagging.resources.selectScene('audit'); tagging.click('manual');
const tagDialog = tagging.dialogs.at(-1), tagInput = tagDialog.querySelector('#oeTagInput'), tagMenu = tagDialog.querySelector('#oeTagMenu'), chips = tagDialog.querySelector('#oeTagChips');
const tagOptions = () => [...tagMenu.innerHTML.matchAll(/data-oe="select-tag" data-index="(\d+)"[^>]*>([^<]*)<\/button>/g)].map(match => ({ index: Number(match[1]), name: match[2] }));
const typeTag = value => { tagInput.value = value; tagging.fire('input', { target: tagInput }); };
const enterTag = properties => tagging.fire('keydown', Object.assign({ target: tagInput, key: 'Enter' }, properties));
tagging.fire('focusin', { target: tagInput });
assert.equal(tagMenu.hidden, false);
assert.deepEqual(tagOptions().map(item => item.name).sort(), ['Quality', '完整性', '准确性', '质量'].sort(), 'History deduplicates tags from saved records in the active scene');
assert(!tagMenu.innerHTML.includes('成本效率'));
typeTag('quality'); assert.deepEqual(tagOptions().map(item => item.name), ['Quality'], 'History search is case-insensitive');
typeTag('准'); assert.deepEqual(tagOptions().map(item => item.name), ['准确性']);
typeTag('新标签'); assert(tagMenu.innerHTML.includes('回车添加新标签'));
assert.equal(enterTag().defaultPrevented, true, 'Adding a tag with Enter prevents form submission');
assert(chips.innerHTML.includes('<span>新标签</span>')); assert.equal(tagInput.value, '');
typeTag(' 新标签 '); enterTag();
assert.equal([...chips.innerHTML.matchAll(/class="oe-tag-chip"/g)].length, 1, 'Enter trims and deduplicates a new tag');
typeTag('输入中'); const beforeComposition = chips.innerHTML;
enterTag({ isComposing: true }); assert.equal(chips.innerHTML, beforeComposition);
enterTag({ keyCode: 229 }); assert.equal(chips.innerHTML, beforeComposition, 'IME Enter is left to composition and does not create a chip');
assert.equal(tagInput.value, '输入中'); assert.equal(tagging.writes(), tagWrites);
tagging.click('remove-tag', '', { index: 0 }); assert(!chips.innerHTML.includes('oe-tag-chip'));
typeTag('准'); const existingTag = tagOptions()[0]; tagging.click('select-tag', '', { index: existingTag.index });
assert(chips.innerHTML.includes('<span>准确性</span>')); assert.equal(tagInput.value, '');
assert(!tagOptions().some(item => item.name === '准确性'), 'Selected history tags are excluded from the dropdown');
typeTag('准确性'); enterTag(); assert.equal([...chips.innerHTML.matchAll(/class="oe-tag-chip"/g)].length, 1);
tagging.click('close'); assert.equal(tagging.writes(), tagWrites); assert.deepEqual([...tagging.saved], tagSnapshot, 'Cancelling tag edits leaves every saved evaluator unchanged');
tagging.resources.selectScene('cost'); tagging.click('manual');
const costTagInput = tagging.dialogs.at(-1).querySelector('#oeTagInput'); tagging.fire('focusin', { target: costTagInput });
const costHistory = tagging.dialogs.at(-1).querySelector('#oeTagMenu').innerHTML;
assert(costHistory.includes('成本效率') && !costHistory.includes('准确性')); tagging.click('close');

// The schedule is driven by the live select/button handlers; changing repeat retains its day arrays.
const scheduling = fixture(); scheduling.click('manual'); const scheduleDialog = scheduling.dialogs.at(-1);
const repeatField = scheduling.field('schedule.repeat', 'daily'), timeField = scheduling.field('schedule.time', '09:00');
scheduleDialog.fields = [repeatField, timeField];
const repeat = value => { repeatField.value = value; scheduling.fire('change', { target: repeatField }); return scheduleDialog.querySelector('#oeSchedule').innerHTML; };
const pressedDay = (html, kind, day, pressed) => assert.match(html, new RegExp('data-kind="' + kind + '" data-day="' + day + '" aria-pressed="' + pressed + '"'));
let scheduleHtml = repeat('weekly');
assert.equal([...scheduleHtml.matchAll(/data-oe="schedule-day"/g)].length, 7); pressedDay(scheduleHtml, 'weekdays', 1, true);
scheduling.click('schedule-day', '', { kind: 'weekdays', day: 3 });
assert(scheduleDialog.querySelector('.oe-schedule-summary').textContent.includes('每周一、三'));
scheduleHtml = repeat('monthly'); assert.equal([...scheduleHtml.matchAll(/data-oe="schedule-day"/g)].length, 31); pressedDay(scheduleHtml, 'monthdays', 1, true);
scheduling.click('schedule-day', '', { kind: 'monthdays', day: 15 });
assert(scheduleDialog.querySelector('.oe-schedule-summary').textContent.includes('1、15'));
repeat('daily'); scheduleHtml = repeat('weekly'); pressedDay(scheduleHtml, 'weekdays', 1, true); pressedDay(scheduleHtml, 'weekdays', 3, true);
scheduleHtml = repeat('monthly'); pressedDay(scheduleHtml, 'monthdays', 1, true); pressedDay(scheduleHtml, 'monthdays', 15, true);
scheduling.click('schedule-day', '', { kind: 'monthdays', day: 1 }); repeat('weekly'); scheduleHtml = repeat('monthly');
pressedDay(scheduleHtml, 'monthdays', 1, false); pressedDay(scheduleHtml, 'monthdays', 15, true);
timeField.value = '18:45'; scheduling.fire('input', { target: timeField });
assert(scheduleDialog.querySelector('.oe-schedule-summary').textContent.includes('18:45'));
scheduling.click('close'); assert.equal(scheduling.writes(), 0, 'Cancelling schedule changes does not persist a draft');

// Business-task choices use the native definitions; changing scope/grain rebuilds the real editor sections.
const taskEditing = fixture(); taskEditing.click('manual'); const taskDialog = taskEditing.dialogs.at(-1);
const taskAgent = taskEditing.field('agentId', 'audit:agents:0'), taskGrain = taskEditing.field('granularity', 'business-task');
const taskSampling = taskEditing.field('samplingRate', '20'), taskPrompt = taskEditing.field('prompt', '');
taskDialog.fields = [taskAgent, taskGrain, taskSampling, taskPrompt];
taskEditing.fire('change', { target: taskGrain });
let taskRange = taskDialog.querySelector('#oeRange').innerHTML;
const nativeTasks = taskEditing.data.taskDefinitions('audit', 'audit:agents:0');
assert(nativeTasks.length >= 2);
assert(nativeTasks.every(task => taskRange.includes('value="' + task.id + '"')), 'All associated Agent tasks are available for selection');
assert(!taskRange.includes('BT-007') && !taskRange.includes('BT-008'), 'Other-scene task definitions are not offered');
assert(!taskRange.includes('class="oe-task-snapshot"'), 'No task definition is imported before selection');
assert.match(taskDialog.querySelector('#oeSampling').innerHTML, /value="100"[^>]*disabled/);
assert(taskDialog.querySelector('#oeOutputSection').innerHTML.includes('任务执行记录'));
assert(!taskDialog.querySelector('#oeOutputSection').innerHTML.includes('name="oeOutputType"'), 'Task results have a fixed structured output rather than scalar output choices');
const chosenTask = nativeTasks[0], chosenCheckbox = taskEditing.task(chosenTask.id);
taskDialog.tasks = [chosenCheckbox]; taskEditing.fire('change', { target: chosenCheckbox });
taskRange = taskDialog.querySelector('#oeRange').innerHTML;
const importedDefinition = taskRange.match(/<section class="oe-task-snapshot">[\s\S]*?<\/section>/)[0];
for (const value of [chosenTask.name, chosenTask.version, chosenTask.description, chosenTask.completion, ...chosenTask.criteria, ...chosenTask.dimensions.map(dimension => dimension.name)]) assert(importedDefinition.includes(value), 'Imported snapshot contains ' + value);
assert(!/<input|<textarea|contenteditable=/i.test(importedDefinition), 'Imported task definition and standards are read-only');
for (const value of [chosenTask.name, chosenTask.description, chosenTask.completion, chosenTask.criteria[0], chosenTask.dimensions[0].name]) assert(taskPrompt.value.includes(value), 'Generated evaluator prompt carries the actual task standards');
taskSampling.value = '7'; taskEditing.fire('change', { target: taskSampling });
taskEditing.fire('change', { target: chosenCheckbox });
assert.match(taskDialog.querySelector('#oeSampling').innerHTML, /value="100"[^>]*disabled/, 'Task scanning remains full coverage after unrelated edits');
taskAgent.value = 'audit:agents:1'; taskEditing.fire('change', { target: taskAgent });
assert(taskDialog.querySelector('#oeRange').innerHTML.includes('该 Agent 暂无业务任务'));
assert(!taskDialog.querySelector('#oeRange').innerHTML.includes('class="oe-task-snapshot"'), 'Changing Agent removes incompatible task snapshots');
assert(!taskPrompt.value.includes(chosenTask.name), 'The old task definition is removed from the generated prompt');
taskDialog.tasks = []; taskGrain.value = 'session'; taskEditing.fire('change', { target: taskGrain });
assert(!taskDialog.querySelector('#oeRange').innerHTML.includes('data-oe-task'));
assert(!taskDialog.querySelector('#oeSampling').innerHTML.includes(' disabled'), 'Normal evaluator sampling is editable again');
assert.equal([...taskDialog.querySelector('#oeOutputSection').innerHTML.matchAll(/name="oeOutputType"/g)].length, 4, 'Switching back restores all ordinary output choices');
taskEditing.click('close'); assert.equal(taskEditing.writes(), 0); assert.equal(taskEditing.sideEffects(), 0);

// Read-only history fixtures drive the real overview/detail metrics and tabs without running a model.
const historyResults = [], historyRuns = [];
const history = fixture({ runtime: {
  results(id) { return historyResults.filter(item => item.evaluatorId === id); },
  runs(id) { return historyRuns.filter(item => item.evaluatorId === id); }
} });
const historyStore = history.data.createStore(history.storage);
const taskConfig = history.data.bindTasks(valid(), ['BT-001']); taskConfig.name = '关账业务任务评估'; taskConfig.filterLogic = '全部正式用户会话';
const historyTask = historyStore.save(taskConfig).record;
const scoreConfig = copy(score); scoreConfig.name = '会话评分'; const historyScore = historyStore.save(scoreConfig).record;
const textConfig = valid('cost', 'text'); textConfig.name = '成本问题摘要'; const historyText = historyStore.save(textConfig).record;
assert(historyTask && historyScore && historyText);
for (const [id, completion, acceptance] of [['H-1', 'completed', 'passed'], ['H-2', 'completed', 'rejected'], ['H-3', 'running', 'pending']]) historyResults.push(frozenResult({ id, executionId: id + '-execution', evaluatorId: historyTask.id, taskId: 'BT-001', taskVersion: 'v1.3', sessionId: 'CR-HISTORY', outputType: 'task-executions', completion, acceptance, reason: '基于原始会话证据判断', evaluatedAt: new Clock().toISOString() }, historyTask));
for (const [id, value, acceptance] of [['S-1', 80, 'passed'], ['S-2', 40, 'rejected']]) historyResults.push(frozenResult({ id, evaluatorId: historyScore.id, sessionId: 'CR-HISTORY', outputType: 'score', value, acceptance, evaluatedAt: new Clock().toISOString() }, historyScore));
historyResults.push(frozenResult({ id: 'T-1', evaluatorId: historyText.id, sessionId: 'CR-COST', outputType: 'text', value: '存在待复核记录', acceptance: 'na', evaluatedAt: new Clock().toISOString() }, historyText));
for (const id of ['SCAN-1', 'SCAN-2']) historyRuns.push({ id, evaluatorId: historyTask.id, status: 'success', scanned: 2, recognized: 3, created: id === 'SCAN-1' ? 3 : 0, updated: 0, unchanged: id === 'SCAN-2' ? 3 : 0, startedAt: new Clock().toISOString(), finishedAt: new Clock().toISOString() });
const renderedMetrics = html => Object.fromEntries([...html.matchAll(/<article class="oe-metric"><span>([^<]+)<\/span><strong>([^<]+)<\/strong>/g)].map(match => [match[1], match[2]]));
let historyPage = history.ui.page();
assert.deepEqual(renderedMetrics(historyPage), { 在线评估器: '3', 已启用: '3', 评估记录: '6', 评估通过率: '50.0%' });
for (const record of [historyTask, historyScore, historyText]) assert(historyPage.includes('data-oe="view" data-id="' + record.id + '"'), 'Entry lists every existing evaluator in the current scope');
const historyWrites = history.writes(), historyDialogCount = history.dialogs.length;
history.click('view', historyTask.id); historyPage = history.ui.page();
assert.equal(history.dialogs.length, historyDialogCount, 'Opening an evaluator navigates to its detail page');
assert(historyPage.includes('oe-detail-page') && historyPage.includes('oe-session-table'));
assert.deepEqual(renderedMetrics(historyPage), { 识别执行次数: '3', 任务完成率: '66.7%', 任务通过率: '50.0%', 未判定记录: '1' });
assert(/评估会话 <span[^>]*>1<\/span>/.test(historyPage) && !historyPage.includes('data-result-id='), 'Task detail initially presents one collapsed source-session row');
history.click('expand-session', 'CR-HISTORY'); historyPage = history.ui.page();
assert(historyPage.includes('data-oe="result" data-id="H-1"') && historyPage.includes('CR-HISTORY'));
history.click('detail-tab', 'runs'); historyPage = history.ui.page();
assert(historyPage.includes('oe-runs-table') && historyPage.includes('SCAN-1') && historyPage.includes('SCAN-2'));
assert(!historyPage.includes('oe-results-table'));
history.click('detail-tab', 'configuration'); historyPage = history.ui.page();
assert(historyPage.includes('oe-configuration') && historyPage.includes('完成条件') && historyPage.includes('核验完整性'));
assert(!historyPage.includes('oe-runs-table') && !/<input|<textarea|contenteditable=/i.test(historyPage), 'Configuration tab is read-only');
history.click('detail-tab', 'results'); assert(history.ui.page().includes('oe-session-table') && history.ui.page().includes('oe-results-table'), 'Switching tabs preserves the same session expansion');
history.click('back-list'); historyPage = history.ui.page();
assert(!historyPage.includes('oe-detail-page') && historyPage.includes('在线评估器列表'));
history.click('view', historyScore.id); assert.deepEqual(renderedMetrics(history.ui.page()), { 评估记录: '2', 评估通过率: '50.0%', 未判定记录: '0', 平均评分: '60.0' });
history.ui.onNavigate('线上会话'); assert(!history.ui.page().includes('oe-detail-page'), 'Leaving and re-entering restores the complete evaluator list');
history.resources.selectScene('cost'); historyPage = history.ui.page();
assert.deepEqual(renderedMetrics(historyPage), { 在线评估器: '1', 已启用: '1', 评估记录: '1', 评估通过率: '—' });
assert(historyPage.includes('成本问题摘要') && !historyPage.includes('关账业务任务评估'));
history.click('view', historyText.id); assert(history.ui.page().includes('oe-pass is-empty') && !history.ui.page().includes('oe-pass is-no'), 'Text results have no fabricated No at the parent session level'); history.click('back-list');
assert.equal(history.writes(), historyWrites, 'Overview/detail/tab/navigation reads never rewrite evaluator configuration');
assert.equal(history.sideEffects(), 0);

// Group by stable source-session IDs, keep all child observations, and preserve distinct completion anchors.
const sourceSessions = [
  { id: 'CR-1024', name: '同名会话', agent: '关账审核智能体', user: 'qa', time: '2026-10-14 10:32', messages: 42, tokens: '8.6', errors: 1, warnings: 2 },
  { id: 'CR-OTHER', name: '同名会话', agent: '关账审核智能体', user: 'qa', time: '2026-10-14 10:35', messages: 2, tokens: '.1', errors: 0, warnings: 0, conversation: [{ inputId: 'other-user', outputId: 'other-agent', input: '请执行月末关账审核', output: '正在核对资料，尚未完成。' }] },
  { id: 'SESSION-"<tag>', name: '<img src=x onerror=alert(1)>', agent: '关账审核智能体', user: 'qa', time: '2026-10-14 11:00', messages: 2, tokens: '.1', errors: 0, warnings: 0 },
  ...Array.from({ length: 25 }, (_, i) => ({ id: 'SPAN-SESSION-' + i, name: '模型调用会话 ' + i, agent: '关账审核智能体', user: 'qa', time: '2026-10-14 12:00', messages: 2, tokens: '.1', errors: 0, warnings: 0 }))
];
const groupedResults = [], groupedRuns = []; let manualRunCalls = 0;
const grouped = fixture({ sessions: () => sourceSessions, runtime: {
  results(id) { return groupedResults.filter(item => item.evaluatorId === id); },
  runs(id) { return groupedRuns.filter(item => item.evaluatorId === id); },
  run() { manualRunCalls++; return { ok: true, run: {} }; }
} });
const groupedStore = grouped.data.createStore(grouped.storage);
const groupedTaskConfig = grouped.data.bindTasks(valid(), ['BT-001']); groupedTaskConfig.filterLogic = '全部正式用户会话';
const groupedTask = groupedStore.save(groupedTaskConfig).record;
const groupedTraceConfig = valid(); groupedTraceConfig.granularity = 'trace'; const groupedTrace = groupedStore.save(groupedTraceConfig).record;
const groupedSpanConfig = valid(); groupedSpanConfig.granularity = 'span'; groupedSpanConfig.spanTypes = ['model']; const groupedSpan = groupedStore.save(groupedSpanConfig).record;
const groupedSession = groupedStore.save(valid()).record;
const timestamp = new Clock().toISOString();
const taskObservations = [
  { id: 'TASK-FIRST', executionId: 'EXEC-FIRST', taskId: 'BT-001', taskVersion: 'v1.3', sessionId: 'CR-1024', startRound: 1, startMessageId: 'CR-1024-msg-001', completionRound: 17, completionMessageId: 'CR-1024-msg-034', completion: 'completed', acceptance: 'rejected', reason: '第一次执行有待修复项' },
  { id: 'TASK-SECOND', executionId: 'EXEC-SECOND', taskId: 'BT-001', taskVersion: 'v1.3', sessionId: 'CR-1024', startRound: 19, startMessageId: 'CR-1024-msg-037', completionRound: 21, completionMessageId: 'CR-1024-msg-042', completion: 'completed', acceptance: 'passed', reason: '第二次独立请求已通过' },
  { id: 'TASK-OTHER', executionId: 'EXEC-OTHER', taskId: 'BT-001', taskVersion: 'v1.3', sessionId: 'CR-OTHER', startRound: 1, startMessageId: 'other-user', completion: 'running', acceptance: 'pending', reason: '等待资料补充' }
].map(item => frozenResult(Object.assign(item, { evaluatorId: groupedTask.id, outputType: 'task-executions', evaluatedAt: timestamp }), groupedTask));
groupedResults.push(...taskObservations);
for (let i = 0; i < 2; i++) groupedResults.push(frozenResult({ id: 'TRACE-' + i, evaluatorId: groupedTrace.id, sessionId: 'CR-1024', targetId: 'trace-' + i, targetName: 'Trace ' + i, outputType: 'boolean', value: i === 0, acceptance: i === 0 ? 'passed' : 'rejected', evaluatedAt: timestamp }, groupedTrace));
for (let i = 0; i < 906; i++) groupedResults.push(frozenResult({ id: 'SPAN-' + i, evaluatorId: groupedSpan.id, sessionId: 'SPAN-SESSION-' + (i % 25), targetId: 'span-' + i, targetName: '模型调用 ' + i, outputType: 'boolean', value: i % 3 === 2 ? null : i % 3 === 0, acceptance: ['passed', 'rejected', 'pending'][i % 3], evaluatedAt: timestamp }, groupedSpan));
for (const sessionId of ['CR-1024', 'CR-OTHER']) groupedResults.push(frozenResult({ id: 'SESSION-RESULT-' + sessionId, evaluatorId: groupedSession.id, sessionId, outputType: 'boolean', value: true, acceptance: 'passed', evaluatedAt: timestamp }, groupedSession));
groupedRuns.push({ id: 'GROUP-RUN-1', evaluatorId: groupedTask.id, status: 'success', scanned: 2, recognized: 3, created: 3, updated: 0, unchanged: 0, startedAt: timestamp, finishedAt: timestamp });
const parentSessionIds = html => [...html.matchAll(/<tr class="oe-session-row(?: is-expanded)?" data-session-id="([^"]+)"/g)].map(match => match[1]);
const childResultIds = html => [...html.matchAll(/<tr data-result-id="([^"]+)"/g)].map(match => match[1]);
const mixedTypes = copy([groupedResults[0], groupedResults[1], groupedResults[3], groupedResults[5], groupedResults.at(-1)]);
mixedTypes[3].sessionId = 'CR-1024'; const mixedBefore = copy(mixedTypes), mixedGroups = copy(grouped.ui.groupResults(mixedTypes));
assert.equal(mixedGroups.length, 2, 'Same display names with different session IDs remain separate groups');
assert.equal(mixedGroups.find(group => group.id === 'CR-1024').items.length, 4, 'Trace, Span and task observations share the same stable source-session grouping rule');
assert.deepEqual(mixedTypes, mixedBefore, 'Grouping/sorting never mutates input history');
grouped.click('view', groupedTask.id); let groupedPage = grouped.ui.page();
assert.deepEqual(parentSessionIds(groupedPage).sort(), ['CR-1024', 'CR-OTHER']);
assert(/评估会话 <span[^>]*>2<\/span>/.test(groupedPage) && groupedPage.includes('共 3 条评估记录'));
assert.equal(childResultIds(groupedPage).length, 0, 'Children are omitted until the parent session is expanded');
assert.deepEqual(renderedMetrics(groupedPage), { 识别执行次数: '3', 任务完成率: '66.7%', 任务通过率: '50.0%', 未判定记录: '1' }, 'Top metrics use child observations rather than parent-session counts');
grouped.click('expand-session', 'CR-1024'); groupedPage = grouped.ui.page();
assert.deepEqual(childResultIds(groupedPage), ['TASK-FIRST', 'TASK-SECOND']);
assert.match(groupedPage, /data-id="CR-1024" aria-expanded="true"/);
const parentTaskRow = groupedPage.match(/<tr class="oe-session-row is-expanded" data-session-id="CR-1024">([\s\S]*?)<\/tr>/)[1];
assert(parentTaskRow.includes('2 条任务执行') && parentTaskRow.includes('是 1 / 否 1') && parentTaskRow.includes('<td>50.0%</td>'), 'Parent aggregates every execution within the session');
taskObservations[0].acceptance = taskObservations[0].value.acceptance = 'pending'; taskObservations[2].acceptance = taskObservations[2].value.acceptance = 'na';
const pendingTaskParent = grouped.ui.page().match(/<tr class="oe-session-row is-expanded" data-session-id="CR-1024">([\s\S]*?)<\/tr>/)[1];
assert(pendingTaskParent.includes('是 1 / — 1') && pendingTaskParent.includes('<td>50.0%</td>'), 'Task parent pass rate divides one passed execution by both completed executions, including the pending acceptance');
const taskGroupAggregate = grouped.ui.groupResults(taskObservations).find(group => group.id === 'CR-1024');
assert.equal(taskGroupAggregate.completed, 2); assert.equal(taskGroupAggregate.pending, 1);
const incompleteTaskAggregate = grouped.ui.groupResults(taskObservations).find(group => group.id === 'CR-OTHER');
assert.equal(incompleteTaskAggregate.pending, 1); assert.equal(incompleteTaskAggregate.na, 0, 'An unfinished task has a standard but no decision; it is not confused with text without a pass standard');
taskObservations[0].acceptance = taskObservations[0].value.acceptance = 'rejected'; taskObservations[2].acceptance = taskObservations[2].value.acceptance = 'pending';
assert(groupedPage.includes('第 1→17 轮') && groupedPage.includes('第 19→21 轮'));
grouped.click('result', 'TASK-FIRST'); assert(grouped.dialogs.at(-1).innerHTML.includes('CR-1024-msg-034'));
assert(!grouped.dialogs.at(-1).innerHTML.includes('CR-1024-msg-042'), 'First execution evidence does not drift to the later completion'); grouped.click('close');
grouped.click('session', 'TASK-FIRST'); groupedPage = grouped.ui.page();
assert(groupedPage.includes('data-message-id="CR-1024-msg-034" data-round="17"') && groupedPage.includes('data-completion-record="EXEC-FIRST"'));
grouped.click('back-results'); assert(grouped.ui.page().includes('data-session-children="CR-1024"'), 'Returning from a completion reply preserves the expanded source session');
grouped.click('session', 'TASK-SECOND'); groupedPage = grouped.ui.page();
assert(groupedPage.includes('data-message-id="CR-1024-msg-042" data-round="21"') && groupedPage.includes('data-completion-record="EXEC-SECOND"'));
assert(!groupedPage.includes('data-completion-record="EXEC-FIRST"'), 'Only the selected independent task execution is highlighted');
grouped.click('back-results'); grouped.click('expand-session', 'CR-1024'); assert.equal(childResultIds(grouped.ui.page()).length, 0, 'A second click collapses every child result');
grouped.click('expand-session', 'CR-1024'); grouped.click('view', groupedTrace.id); groupedPage = grouped.ui.page();
assert.equal(parentSessionIds(groupedPage).length, 1); assert.equal(childResultIds(groupedPage).length, 0, 'Expansion does not leak across evaluator detail pages');
grouped.click('expand-session', 'CR-1024'); assert.deepEqual(childResultIds(grouped.ui.page()), ['TRACE-0', 'TRACE-1']);
const pendingTrace = groupedResults.find(item => item.id === 'TRACE-1'); pendingTrace.acceptance = 'pending'; pendingTrace.value = pendingTrace.output = null;
const pendingTraceParent = grouped.ui.page().match(/<tr class="oe-session-row is-expanded" data-session-id="CR-1024">([\s\S]*?)<\/tr>/)[1];
assert(pendingTraceParent.includes('是 1 / — 1') && pendingTraceParent.includes('<td>100.0%</td>'), 'Ordinary Trace parent pass rate excludes pending results from its decided-result denominator');
pendingTrace.acceptance = 'rejected'; pendingTrace.value = pendingTrace.output = false;
grouped.click('view', groupedSession.id); groupedPage = grouped.ui.page();
assert.equal(parentSessionIds(groupedPage).length, 2);
assert(!groupedPage.includes('data-oe="expand-session"') && !groupedPage.includes('oe-session-children'), 'Session-level evaluation has no redundant second level');
assert(groupedPage.includes('data-oe="result" data-id="SESSION-RESULT-CR-1024"') && groupedPage.includes('data-oe="group-session"'));
grouped.click('view', groupedSpan.id); groupedPage = grouped.ui.page();
assert.equal(parentSessionIds(groupedPage).length, 25); assert(groupedPage.includes('共 906 条评估记录'));
assert.deepEqual(renderedMetrics(groupedPage), { 评估记录: '906', 评估通过率: '50.0%', 未判定记录: '302', 评估会话: '25' });
grouped.click('expand-session', 'SPAN-SESSION-0'); assert.equal(childResultIds(grouped.ui.page()).length, 37, 'One source session exposes all of its Span records');
for (let i = 1; i < 25; i++) grouped.click('expand-session', 'SPAN-SESSION-' + i);
const allSpanChildren = childResultIds(grouped.ui.page()); assert.equal(allSpanChildren.length, 906); assert.equal(new Set(allSpanChildren).size, 906, 'Large Span histories are complete and never truncated or duplicated');
grouped.click('expand-session', 'SPAN-SESSION-0'); assert.equal(childResultIds(grouped.ui.page()).length, 869);
grouped.resources.selectScene('cost'); grouped.resources.selectScene('all'); grouped.click('view', groupedSpan.id);
assert.equal(childResultIds(grouped.ui.page()).length, 0, 'Scene changes clear expanded groups');
grouped.click('expand-session', 'SPAN-SESSION-0'); grouped.ui.onNavigate('线上会话'); grouped.ui.onNavigate('在线评估器'); grouped.click('view', groupedSpan.id);
assert.equal(childResultIds(grouped.ui.page()).length, 0, 'Leaving and re-entering the evaluator page clears expanded groups');
const unsafeSessionId = sourceSessions[2].id;
groupedResults.push({ id: 'RESULT-"<unsafe>', evaluatorId: groupedTrace.id, sessionId: unsafeSessionId, targetName: '<svg onload=alert(1)>', outputType: 'text', value: '<script>bad</script>', acceptance: 'na', evaluatedAt: timestamp });
grouped.click('view', groupedTrace.id); grouped.click('expand-session', unsafeSessionId); groupedPage = grouped.ui.page();
assert(groupedPage.includes('data-session-id="SESSION-&quot;&lt;tag&gt;"') && groupedPage.includes('&lt;img src=x'));
assert(groupedPage.includes('data-result-id="RESULT-&quot;&lt;unsafe&gt;"') && groupedPage.includes('&lt;svg onload=') && groupedPage.includes('&lt;script&gt;bad&lt;/script&gt;'));
assert(!/<img src=x|<svg onload=|<script>bad/i.test(groupedPage), 'Grouped parent names, IDs and child outputs are escaped');

grouped.click('view', groupedTask.id); grouped.filter('result', 'resultChoice', 'task:completed');
assert.deepEqual(copy(grouped.ui.filterResults(taskObservations)).map(item => item.id).sort(), ['TASK-FIRST', 'TASK-SECOND']);
assert.deepEqual(renderedMetrics(grouped.ui.page()), { 识别执行次数: '2', 任务完成率: '100.0%', 任务通过率: '50.0%', 未判定记录: '0' });
grouped.filter('result', 'pass', 'yes'); grouped.click('expand-session', 'CR-1024');
assert.deepEqual(childResultIds(grouped.ui.page()), ['TASK-SECOND'], 'A task filter preserves only the selected independent execution within a shared conversation');
grouped.filter('result', 'resultChoice', 'task:running'); grouped.filter('result', 'pass', 'undecided');
assert.deepEqual(copy(grouped.ui.filterResults(taskObservations)).map(item => item.id), ['TASK-OTHER']);
assert.equal(grouped.ui.groupResults(grouped.ui.filterResults(taskObservations))[0].pending, 1);
grouped.filter('result', 'pass', 'no'); assert.equal(grouped.ui.filterResults(taskObservations).length, 0, 'An unfinished task is not classified as No');
grouped.click('reset-result-filters'); assert.equal(grouped.ui.filterResults(taskObservations).length, 3);

// Enable/disable is a separate durable operation: old editor saves and stale stop buttons cannot re-enable it.
const ledgerKey = 'aiops.online-evaluation-ledger.v1';
grouped.saved.set(ledgerKey, JSON.stringify({ taskExecutions: taskObservations.map(item => Object.assign({}, item, { id: item.executionId })) }));
const businessBeforeDisable = copy(grouped.context.AIOpsBusinessTasks.summary(grouped.context.AIOpsBusinessTasks.tasks()));
assert.deepEqual(businessBeforeDisable, { tasks: 9, executions: 3, completed: 2, passed: 1 });
const ledgerBeforeDisable = grouped.saved.get(ledgerKey), observationsBeforeDisable = copy(groupedResults), runsBeforeDisable = copy(groupedRuns);
grouped.click('view', groupedTask.id); grouped.click('toggle-enabled', groupedTask.id, { enabled: 'false' });
assert.equal(groupedStore.list().find(record => record.id === groupedTask.id).enabled, false);
let disabledPage = grouped.ui.page(); assert(disabledPage.includes('oe-enabled-status is-disabled'));
assert.match(disabledPage, new RegExp('data-oe="run" data-id="' + groupedTask.id + '" disabled'));
assert.deepEqual(renderedMetrics(disabledPage), { 识别执行次数: '3', 任务完成率: '66.7%', 任务通过率: '50.0%', 未判定记录: '1' });
const disabledWrites = grouped.writes(); grouped.click('toggle-enabled', groupedTask.id, { enabled: 'false' });
assert.equal(groupedStore.list().find(record => record.id === groupedTask.id).enabled, false); assert.equal(grouped.writes(), disabledWrites, 'A stale stop action is idempotent and never toggles a stopped evaluator back on');
grouped.click('run', groupedTask.id); assert.equal(manualRunCalls, 0, 'A stopped evaluator is guarded even if its run action is invoked programmatically');
grouped.click('back-list'); disabledPage = grouped.ui.page();
assert.equal(renderedMetrics(disabledPage).已启用, '3'); assert(disabledPage.includes('data-oe="toggle-enabled" data-id="' + groupedTask.id + '" data-enabled="true"'));
assert.equal(grouped.saved.get(ledgerKey), ledgerBeforeDisable); assert.deepEqual(groupedResults, observationsBeforeDisable); assert.deepEqual(groupedRuns, runsBeforeDisable);
assert.deepEqual(copy(grouped.context.AIOpsBusinessTasks.summary(grouped.context.AIOpsBusinessTasks.tasks())), businessBeforeDisable, 'Disabling preserves both evaluator history and business-task counters');
grouped.click('edit', groupedTrace.id); grouped.click('toggle-enabled', groupedTrace.id, { enabled: 'false' });
grouped.fire('submit', { target: { id: 'oeForm' } });
assert.equal(groupedStore.list().find(record => record.id === groupedTrace.id).enabled, false, 'Saving a pre-disable editor snapshot does not restore enabled state');
grouped.click('toggle-enabled', groupedTask.id, { enabled: 'true' }); assert.equal(groupedStore.list().find(record => record.id === groupedTask.id).enabled, true);
assert.equal(grouped.saved.get(ledgerKey), ledgerBeforeDisable); assert.equal(grouped.sideEffects(), 0);

// Configure and toggle integration can use scheduler callbacks without creating any actual timers.
const scheduledCalls = { configure: 0, start: 0, tick: 0, runNow: 0, runtimeConfigure: 0, initialize: 0 };
let schedulerCallbacks;
const scheduledUi = fixture({ initializeRuntime: true, runtime: {
  configure() { scheduledCalls.runtimeConfigure++; }, initialize() { scheduledCalls.initialize++; return { ok: true }; }, results() { return []; }, runs() { return []; }
}, scheduler: {
  configure(next) { scheduledCalls.configure++; schedulerCallbacks = next; }, start() { scheduledCalls.start++; }, tick() { scheduledCalls.tick++; return Promise.resolve(); },
  nextRunAt() { return '2026-11-06T01:00:00Z'; }, runNow() { scheduledCalls.runNow++; return Promise.resolve({ ok: true, run: {} }); }
} });
assert.deepEqual(scheduledCalls, { configure: 1, start: 1, tick: 0, runNow: 0, runtimeConfigure: 1, initialize: 1 });
const scheduledRecord = scheduledUi.data.createStore(scheduledUi.storage).save(valid()).record;
assert(scheduledUi.ui.page().includes('下次：'));
scheduledUi.click('toggle-enabled', scheduledRecord.id, { enabled: 'false' }); scheduledUi.click('run', scheduledRecord.id);
assert.equal(scheduledCalls.tick, 1); assert.equal(scheduledCalls.runNow, 0); assert.equal(scheduledUi.sideEffects(), 0, 'Injected scheduler calls never start real intervals/timeouts or network requests in UI checks');
scheduledUi.ui.onNavigate('在线评估器');
for (const id of ['oeSearch', 'oeSessionSearch', 'minScore', 'text', 'listTag']) {
  scheduledUi.context.document.activeElement = { id, closest: selector => selector === '.oe-session-filters, .oe-filter-bar' && id !== 'oeSearch' ? {} : null };
  const beforeRefresh = scheduledUi.renders(); schedulerCallbacks.onRun({ evaluatorId: scheduledRecord.id });
  assert.equal(scheduledUi.renders(), beforeRefresh, 'Automatic result refresh preserves an active filter input: ' + id);
}
scheduledUi.context.document.activeElement = { id: 'outside', closest() { return null; } };
const beforeOrdinaryRefresh = scheduledUi.renders(); schedulerCallbacks.onRun({ evaluatorId: scheduledRecord.id });
assert.equal(scheduledUi.renders(), beforeOrdinaryRefresh + 1, 'Automatic refresh still renders when no filter is being edited');

const unsafe = valid(); unsafe.name = '<img src=x onerror=alert(1)>'; unsafe.description = '<script>bad</script>'; unsafe.prompt = '<img src=y>'; unsafe.tags = ['<b>tag</b>'];
const unsafeRecord = store.save(unsafe).record; const page = f.ui.page(), definition = f.ui.definition(unsafeRecord);
assert(page.includes('&lt;img src=x') && !page.includes('<img src=x'));
assert(definition.includes('&lt;script&gt;bad&lt;/script&gt;') && definition.includes('&lt;img src=y&gt;'));
assert(!/<input|<textarea|contenteditable=/i.test(definition));
assert(f.ui.definition(D.normalize(Object.assign(valid(), { output: { type: 'boolean', booleanPass: false } }))).includes('通过值：False'));
assert(f.ui.definition(D.normalize(category)).includes('不通过'));
assert(f.ui.definition(D.normalize(score)).includes('最终通过阈值：80 / 100'));
assert(f.ui.definition(D.normalize(text)).includes('无通过标准'));
f.resources.selectScene('cost'); assert(f.ui.page().includes('工具调用质量评测') && !f.ui.page().includes('修改后的评估器'));
f.resources.selectScene('all'); f.click('edit', created.record.id); assert(f.dialogs.at(-1).innerHTML.includes('Span 类型')); assert(f.dialogs.at(-1).innerHTML.includes('oe-score-table')); f.click('close');
assert.equal(f.sideEffects(), 0);

// Real filter events act on frozen result values, then group only the matching observations.
const filterSessions = [
  ['FILTER-A', '杭州销售复核', '2026-11-04 23:59'],
  ['FILTER-B', '同名会话', '2026-11-05 00:00'],
  ['FILTER-C', '同名会话', '2026-11-05 23:59'],
  ['FILTER-D', '次日会话', '2026-11-06 00:00']
].map(([id, name, time]) => ({ id, name, time, agent: '关账审核智能体', user: 'qa', messages: 2, tokens: '.1', errors: 0, warnings: 0 }));
const filterHistory = [], filterRuns = [];
const filteredUi = fixture({ sessions: () => filterSessions, runtime: {
  results(id) { return filterHistory.filter(item => item.evaluatorId === id); },
  runs(id) { return filterRuns.filter(item => item.evaluatorId === id); }
} });
const filterStore = filteredUi.data.createStore(filteredUi.storage);
const saveFilterConfig = (name, type, granularity, agentId, tags) => {
  const draft = valid(agentId.startsWith('cost:') ? 'cost' : 'audit', type);
  Object.assign(draft, { name, granularity, agentId, tags, filterLogic: '全部正式用户会话' });
  if (granularity === 'span') draft.spanTypes = ['model'];
  if (type === 'category') draft.output.categories = [{ name: '当前合规', pass: true }, { name: '当前违规', pass: false }];
  if (type === 'score') draft.output.threshold = 90;
  const saved = filterStore.save(draft); assert(saved.ok); return saved.record;
};
const filterBoolean = saveFilterConfig('链路布尔检测', 'boolean', 'trace', 'audit:agents:0', ['生产', '共用']);
const filterCategory = saveFilterConfig('安全类别判断', 'category', 'span', 'audit:agents:0', ['安全', '共用']);
const filterScore = saveFilterConfig('模型评分检测', 'score', 'span', 'audit:agents:1', ['生产']);
const filterText = saveFilterConfig('成本文本摘要', 'text', 'session', 'cost:agents:0', ['生产']);
assert(filterStore.setEnabled(filterCategory.id, false).ok);
const oldCategoryName = '旧版/需复核<历史>', oldCategoryOutput = { type: 'category', categories: [{ name: '旧版合规', pass: true }, { name: oldCategoryName, pass: false }] };
const booleanOutput = { type: 'boolean', booleanPass: false }, scoreOutput = copy(filterScore.output); scoreOutput.threshold = 80;
const addFilterResult = (config, id, sessionId, value, acceptance, evaluatedAt, outputConfig) => {
  const item = frozenResult({ id, evaluatorId: config.id, sessionId, targetId: id, targetName: id, outputType: outputConfig.type, value, acceptance, evaluatedAt, reason: '原始证据摘要', sourceEvidence: [{ id: id + '-evidence', kind: 'output', text: '原始输出：' + String(value) }] }, Object.assign({}, config, { output: outputConfig }));
  filterHistory.push(item); return item;
};
addFilterResult(filterBoolean, 'BOOL-FALSE-START', 'FILTER-A', false, 'passed', '2026-11-04T16:00:00.000Z', booleanOutput);
addFilterResult(filterBoolean, 'BOOL-TRUE-END', 'FILTER-A', true, 'rejected', '2026-11-05T15:59:59.999Z', booleanOutput);
addFilterResult(filterBoolean, 'BOOL-UNKNOWN', 'FILTER-B', null, 'pending', '2026-11-05T16:00:00.000Z', booleanOutput);
addFilterResult(filterBoolean, 'BOOL-FALSE-PREVIOUS', 'FILTER-C', false, 'passed', '2026-11-04T15:59:59.999Z', booleanOutput);
addFilterResult(filterCategory, 'CATEGORY-OLD', 'FILTER-A', oldCategoryName, 'rejected', timestamp, oldCategoryOutput);
addFilterResult(filterCategory, 'CATEGORY-YES', 'FILTER-B', '旧版合规', 'passed', timestamp, oldCategoryOutput);
addFilterResult(filterCategory, 'CATEGORY-UNKNOWN', 'FILTER-C', '尚未定义的类别', 'pending', timestamp, oldCategoryOutput);
for (const [id, value] of [['SCORE-ZERO', 0], ['SCORE-EIGHTY', 80], ['SCORE-HUNDRED', 100], ['SCORE-UNKNOWN', null]]) addFilterResult(filterScore, id, value === 0 ? 'FILTER-A' : 'FILTER-B', value, value == null ? 'pending' : value < 80 ? 'rejected' : 'passed', timestamp, scoreOutput);
for (const [id, value] of [['TEXT-EVIDENCE', '费用报销缺少附件'], ['TEXT-OTHER', '收入核验完成'], ['TEXT-EMPTY', null]]) addFilterResult(filterText, id, id === 'TEXT-EVIDENCE' ? 'FILTER-A' : 'FILTER-B', value, 'na', timestamp, { type: 'text' });
const filterReadOnlyBefore = [...filteredUi.saved], idsOf = items => copy(items).map(item => item.id).sort();
assert.deepEqual(renderedMetrics(filteredUi.ui.page()), { 在线评估器: '4', 已启用: '3', 评估记录: '14', 评估通过率: '62.5%' });
for (const key of ['status', 'granularity', 'agentId', 'tag']) assert(filteredUi.ui.page().includes('data-oe-list-filter="' + key + '"'));
filteredUi.filter('list', 'status', 'enabled'); assert.equal(filteredUi.ui.filteredEvaluators().length, 3);
filteredUi.filter('list', 'granularity', 'span'); assert.deepEqual(idsOf(filteredUi.ui.filteredEvaluators()), [filterScore.id]);
filteredUi.filter('list', 'agentId', 'audit:agents:0'); assert.deepEqual(idsOf(filteredUi.ui.filteredEvaluators()), []);
filteredUi.filter('list', 'tag', '生产');
assert.deepEqual(renderedMetrics(filteredUi.ui.page()), { 在线评估器: '0', 已启用: '0', 评估记录: '0', 评估通过率: '—' });
assert(filteredUi.ui.page().includes('没有匹配的在线评估器'));
assert.deepEqual(renderedMetrics(filteredUi.nodes.oeOverviewStats.innerHTML), { 在线评估器: '0', 已启用: '0', 评估记录: '0', 评估通过率: '—' });
assert(filteredUi.nodes.oeRows.innerHTML.includes('没有匹配的在线评估器') && filteredUi.nodes.oeListHeading.innerHTML.includes('0 / 4'), 'List change handlers refresh both visible rows and overview without rebuilding the input');
filteredUi.filter('list', 'agentId', 'audit:agents:1'); assert.deepEqual(idsOf(filteredUi.ui.filteredEvaluators()), [filterScore.id]);
filteredUi.filter('list', 'status', 'disabled'); filteredUi.filter('list', 'agentId', 'audit:agents:0'); filteredUi.filter('list', 'tag', '共用');
assert.deepEqual(idsOf(filteredUi.ui.filteredEvaluators()), [filterCategory.id], 'Four single-select filters compose with AND');
assert.deepEqual(renderedMetrics(filteredUi.ui.page()), { 在线评估器: '1', 已启用: '0', 评估记录: '3', 评估通过率: '50.0%' });
filteredUi.click('reset-list-filters'); assert.equal(filteredUi.ui.filteredEvaluators().length, 4);

filteredUi.click('view', filterBoolean.id);
filteredUi.filter('result', 'from', '2026-11-05'); filteredUi.filter('result', 'to', '2026-11-05');
let filterPage = filteredUi.ui.page();
assert.deepEqual(parentSessionIds(filterPage), ['FILTER-A']);
assert.deepEqual(renderedMetrics(filterPage), { 评估记录: '2', 评估通过率: '50.0%', 未判定记录: '0', 评估会话: '1' }, 'Inclusive Shanghai evaluation-day filtering excludes both adjacent day boundaries');
assert.deepEqual(renderedMetrics(filteredUi.nodes.oeDetailStats.innerHTML), { 评估记录: '2', 评估通过率: '50.0%', 未判定记录: '0', 评估会话: '1' });
assert.deepEqual(parentSessionIds(filteredUi.nodes.oeSessionResults.innerHTML), ['FILTER-A']);
assert.equal(filteredUi.nodes.oeSessionTabCount.textContent, 1); assert.equal(filteredUi.nodes.oeFilterSummary.textContent, '当前筛选：1 个会话，2 条评估记录');
filteredUi.click('expand-session', 'FILTER-A'); assert.deepEqual(childResultIds(filteredUi.ui.page()).sort(), ['BOOL-FALSE-START', 'BOOL-TRUE-END']);
filteredUi.filter('result', 'resultChoice', 'boolean:false');
assert.deepEqual(childResultIds(filteredUi.ui.page()), ['BOOL-FALSE-START'], 'Expanded child rows contain only observations matching the active output choice');
assert.deepEqual(childResultIds(filteredUi.nodes.oeSessionResults.innerHTML), ['BOOL-FALSE-START']);
assert.deepEqual(renderedMetrics(filteredUi.ui.page()), { 评估记录: '1', 评估通过率: '100.0%', 未判定记录: '0', 评估会话: '1' });
assert(filteredUi.ui.page().includes('oe-pass is-yes'), 'False is a passing value under its frozen Boolean standard');
filteredUi.filter('result', 'pass', 'no'); assert.equal(filteredUi.ui.filterResults(filterHistory.filter(item => item.evaluatorId === filterBoolean.id)).length, 0);
assert(filteredUi.ui.page().includes('暂无评估记录'));
filteredUi.filter('result', 'pass', 'yes');
filteredUi.click('group-session', 'FILTER-A'); assert(filteredUi.ui.page().includes('oe-session-context'));
filteredUi.click('back-results'); assert.deepEqual(childResultIds(filteredUi.ui.page()), ['BOOL-FALSE-START'], 'Returning from the source session preserves filters and expanded children');
filteredUi.click('result', 'BOOL-FALSE-START');
const filterEvidenceDialog = filteredUi.dialogs.at(-1).innerHTML;
assert(filterEvidenceDialog.includes('False') && filterEvidenceDialog.includes('判断依据') && filterEvidenceDialog.includes('原始输出'));
filteredUi.click('close'); assert.deepEqual(childResultIds(filteredUi.ui.page()), ['BOOL-FALSE-START']);
filteredUi.click('view', filterBoolean.id);
assert.equal(filteredUi.ui.filterResults(filterHistory.filter(item => item.evaluatorId === filterBoolean.id)).length, 4, 'Opening a new evaluator detail clears its previous record filters');
filteredUi.filter('result', 'query', '杭州', 'input'); assert.deepEqual(idsOf(filteredUi.ui.filterResults(filterHistory.filter(item => item.evaluatorId === filterBoolean.id))), ['BOOL-FALSE-START', 'BOOL-TRUE-END']);
filteredUi.filter('result', 'query', 'filter-b', 'input'); assert.deepEqual(idsOf(filteredUi.ui.filterResults(filterHistory.filter(item => item.evaluatorId === filterBoolean.id))), ['BOOL-UNKNOWN']);
assert.deepEqual(parentSessionIds(filteredUi.nodes.oeSessionResults.innerHTML), ['FILTER-B'], 'Typing a session ID updates the grouped results without submitting a form');
filteredUi.filter('result', 'query', '', 'input'); filteredUi.filter('result', 'dateBy', 'session'); filteredUi.filter('result', 'from', '2026-11-05'); filteredUi.filter('result', 'to', '2026-11-05');
assert.deepEqual(parentSessionIds(filteredUi.ui.page()).sort(), ['FILTER-B', 'FILTER-C'], 'Session-time selection uses source-session dates rather than evaluation dates');
filteredUi.filter('result', 'from', '2026-11-06'); assert.equal(filteredUi.ui.filterResults(filterHistory).length, 0); assert(filteredUi.ui.page().includes('开始日期不能晚于结束日期'));
assert.equal(filteredUi.nodes.oeResultFilterError.hidden, false); assert.equal(filteredUi.nodes.oeResultFilterError.textContent, '开始日期不能晚于结束日期。');

filteredUi.click('view', filterCategory.id); filterPage = filteredUi.ui.page();
assert(filterPage.includes('category:' + encodeURIComponent(oldCategoryName)), 'Historical category values remain selectable after evaluator categories change');
filteredUi.filter('result', 'resultChoice', 'category:' + encodeURIComponent(oldCategoryName)); filteredUi.filter('result', 'pass', 'no');
assert.deepEqual(idsOf(filteredUi.ui.filterResults(filterHistory.filter(item => item.evaluatorId === filterCategory.id))), ['CATEGORY-OLD']);
filteredUi.filter('result', 'pass', 'yes'); assert.equal(filteredUi.ui.filterResults(filterHistory.filter(item => item.evaluatorId === filterCategory.id)).length, 0);
filteredUi.click('view', filterCategory.id); filteredUi.filter('result', 'pass', 'undecided');
assert.deepEqual(idsOf(filteredUi.ui.filterResults(filterHistory.filter(item => item.evaluatorId === filterCategory.id))), ['CATEGORY-UNKNOWN']);

filteredUi.click('view', filterScore.id); filteredUi.filter('result', 'resultChoice', 'score'); filteredUi.filter('result', 'minScore', '0'); filteredUi.filter('result', 'maxScore', '0');
assert(filteredUi.nodes.oeResultFilters.innerHTML.includes('data-oe-result-filter="minScore"') && filteredUi.nodes.oeResultFilters.innerHTML.includes('data-oe-result-filter="maxScore"'), 'Choosing score reveals both bound controls');
assert.deepEqual(idsOf(filteredUi.ui.filterResults(filterHistory.filter(item => item.evaluatorId === filterScore.id))), ['SCORE-ZERO'], 'Zero is an actual score and both score bounds are inclusive');
filteredUi.filter('result', 'minScore', '80'); filteredUi.filter('result', 'maxScore', '100');
assert.deepEqual(idsOf(filteredUi.ui.filterResults(filterHistory.filter(item => item.evaluatorId === filterScore.id))), ['SCORE-EIGHTY', 'SCORE-HUNDRED']);
assert.deepEqual(renderedMetrics(filteredUi.ui.page()), { 评估记录: '2', 评估通过率: '100.0%', 未判定记录: '0', 平均评分: '90.0' }, 'Pass decisions use frozen threshold 80 rather than the evaluator current threshold 90');
filteredUi.filter('result', 'minScore', '90'); filteredUi.filter('result', 'maxScore', '80'); assert.equal(filteredUi.ui.filterResults(filterHistory).length, 0);
filteredUi.filter('result', 'resultChoice', 'all');
assert.equal(filteredUi.ui.filterResults(filterHistory.filter(item => item.evaluatorId === filterScore.id)).length, 4, 'Hidden score bounds cannot restrict the All Results choice');
assert.equal(filteredUi.nodes.oeResultFilterError.hidden, true);
filteredUi.filter('result', 'resultChoice', 'score');
filteredUi.filter('result', 'minScore', ''); filteredUi.filter('result', 'maxScore', ''); filteredUi.filter('result', 'pass', 'undecided');
assert.deepEqual(idsOf(filteredUi.ui.filterResults(filterHistory.filter(item => item.evaluatorId === filterScore.id))), ['SCORE-UNKNOWN']);

filteredUi.click('view', filterText.id); filteredUi.filter('result', 'resultChoice', 'text'); filteredUi.filter('result', 'text', '缺少'); filteredUi.filter('result', 'pass', 'not-applicable');
assert(filteredUi.nodes.oeResultFilters.innerHTML.includes('data-oe-result-filter="text"') && !filteredUi.nodes.oeResultFilters.innerHTML.includes('data-oe-result-filter="minScore"'), 'Text filtering uses its own content control');
assert.deepEqual(idsOf(filteredUi.ui.filterResults(filterHistory.filter(item => item.evaluatorId === filterText.id))), ['TEXT-EVIDENCE']);
assert(filteredUi.ui.page().includes('oe-pass is-empty') && !filteredUi.ui.page().includes('oe-pass is-no'), 'Text outputs have no pass standard and never display a fabricated No');
filteredUi.filter('result', 'pass', 'undecided'); assert.equal(filteredUi.ui.filterResults(filterHistory.filter(item => item.evaluatorId === filterText.id)).length, 0);
filteredUi.filter('result', 'pass', 'no'); assert.equal(filteredUi.ui.filterResults(filterHistory.filter(item => item.evaluatorId === filterText.id)).length, 0);
filteredUi.filter('result', 'pass', 'all'); filteredUi.filter('result', 'resultChoice', 'all');
assert.equal(filteredUi.ui.filterResults(filterHistory.filter(item => item.evaluatorId === filterText.id)).length, 3, 'A hidden text query cannot restrict the All Results choice');
filteredUi.filter('result', 'text', ''); filteredUi.filter('result', 'pass', 'not-applicable'); filteredUi.filter('result', 'resultChoice', 'empty');
assert.deepEqual(idsOf(filteredUi.ui.filterResults(filterHistory.filter(item => item.evaluatorId === filterText.id))), ['TEXT-EMPTY']);
filteredUi.resources.selectScene('audit'); filteredUi.resources.selectScene('all'); filteredUi.click('view', filterText.id);
assert.equal(filteredUi.ui.filterResults(filterHistory.filter(item => item.evaluatorId === filterText.id)).length, 3, 'Scene changes clear detail filters');
filteredUi.filter('result', 'pass', 'no'); filteredUi.ui.onNavigate('线上会话'); filteredUi.ui.onNavigate('在线评估器'); filteredUi.click('view', filterText.id);
assert.equal(filteredUi.ui.filterResults(filterHistory.filter(item => item.evaluatorId === filterText.id)).length, 3, 'Leaving the page clears result filters');
filteredUi.click('back-list'); filteredUi.filter('list', 'status', 'disabled'); filteredUi.ui.onNavigate('线上会话'); filteredUi.ui.onNavigate('在线评估器');
assert.equal(filteredUi.ui.filteredEvaluators().length, 4, 'Leaving the page also clears list filters');
assert.deepEqual([...filteredUi.saved], filterReadOnlyBefore, 'Searching, filtering, grouping and opening evidence do not modify saved evaluator definitions');
assert.equal(filteredUi.sideEffects(), 0);

const entry = fs.readFileSync('dist/new-aiops.html', 'utf8'), app = fs.readFileSync('dist/aiops/aiops.js', 'utf8');
assert(entry.indexOf('aiops/online-evaluators-data.js') < entry.indexOf('aiops/online-evaluators.js'));
assert(entry.includes('aiops/online-evaluators-filters.js') && entry.indexOf('aiops/online-evaluators-filters.js') < entry.indexOf('aiops/online-evaluators.js'), 'Pure filter helpers load before the UI');
assert(entry.indexOf('aiops/online-evaluators.js') < entry.indexOf('src="aiops/aiops.js'));
assert(app.includes("{ id: '在线评估器', icon: 'scan-line' }"));
assert.match(app, /'在线评估器': function \(\) \{ return window\.AIOpsOnlineEvaluators\.page\(\)/, 'the backup route still delegates to the original online evaluator implementation');
assert(app.includes("zh: '在线评估器（备份）'"), 'the retained implementation is visibly labeled as a backup');
assert(app.includes('AIOpsOnlineEvaluators.configure(') && app.includes('AIOpsOnlineEvaluators.onNavigate(page)') && app.includes('AIOpsOnlineEvaluators.onSceneChange()'));
console.log('Passed: evaluator schema/task imports and form interactions; durable CRUD; session-ID grouped Trace/Span/task history with all 906 Span children and exact completion anchors; frozen output/pass judgment; real list/detail filter events, Shanghai date boundaries, type-specific controls, filtered metrics/children and navigation resets; enable/disable history isolation; scheduler UI integration without timers/network; native asset ordering.');
