const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

// Exercise the actual new entry's shared runtime, without booting the old workshop shell.
const nativeHTML = fs.readFileSync('dist/new-aiops.html', 'utf8');
const workshopHTML = fs.readFileSync('dist/index.html', 'utf8');
const shared = ['workshop-evaluation-seed.js', 'workshop-evaluation.js', 'workshop-evaluation-versions.js', 'workshop-evaluation-dashboard.js', 'workshop-evaluation-tasks.js', 'workshop-evaluation-assets.js', 'workshop-evaluation-evaluators.js', 'workshop-evaluation-experiment-engine.js', 'workshop-evaluation-reports.js', 'workshop-evaluation-experiments.js', 'workshop-evaluation-issues.js', 'workshop-evaluation-copilot.js', 'workshop-evaluation-optimization.js'];
const runtime = ['aiops/evaluation-foundation.js', ...shared, 'aiops/evaluation.js', 'aiops/evaluation-details.js'];
function scriptOrder(html) { return [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(match => match[1].split('?')[0]); }
const nativeScripts = scriptOrder(nativeHTML), workshopScripts = scriptOrder(workshopHTML);
let previous = -1;
for (const file of runtime) {
  const index = nativeScripts.indexOf(file);
  assert(index > previous, 'new AIOps loads shared evaluation runtime in dependency order: ' + file);
  assert.equal(nativeScripts.filter(item => item === file).length, 1, 'one runtime instance: ' + file);
  previous = index;
}
for (const file of shared) assert(workshopScripts.includes(file), 'original workshop retains ' + file);
assert(nativeScripts.includes('aiops/shared/composer-slash-skills.js'), 'native case inputs retain slash/Skill support');
assert(!workshopScripts.includes('aiops/evaluation.js'), 'native routing adapter never changes the workshop');
assert(!workshopScripts.includes('aiops/evaluation-details.js'), 'workshop detail drawers retain their own implementation');

const nodes = new Map(), selectors = new Map(), lists = new Map(), timers = new Map(), events = new Map();
let clockMs = Date.parse('2026-11-05T10:00:00Z'), sequence = 0, modalSequence = 0, selectedScene = 'all', nativePage = '评测实验', refreshes = 0;
const navigation = [], messages = [], refreshOptions = [];
class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [clockMs])); } static now() { return clockMs; } }
function node(key) {
  if (!nodes.has(key)) {
    const attributes = new Map(), classes = new Set();
    nodes.set(key, { id: key, innerHTML: '', textContent: '', value: '', hidden: false, disabled: false, dataset: {}, childNodes: [], isConnected: true,
      style: { setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; } }, scrollTop: 0, scrollHeight: 100,
      classList: { add(...values) { values.forEach(value => classes.add(value)); }, remove(...values) { values.forEach(value => classes.delete(value)); }, contains(value) { return classes.has(value); }, toggle(value, force) { if (force === undefined ? !classes.has(value) : force) classes.add(value); else classes.delete(value); } },
      focus() {}, remove() { this.isConnected = false; }, click() {}, scrollIntoView() {}, setAttribute(name, value) { attributes.set(name, String(value)); }, getAttribute(name) { return attributes.get(name) || null; }, removeAttribute(name) { attributes.delete(name); },
      appendChild(child) { this.childNodes.push(child); return child; }, replaceChildren(...children) { this.childNodes = children; }, addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
      closest() { return null; }, contains() { return false; }, matches() { return false; },
      getBoundingClientRect() { return { left: 256, top: 70, right: 1440, bottom: 1000, width: 1184, height: 930 }; },
      querySelector(selector) { return selectors.get(key + ' ' + selector) || null; }, querySelectorAll(selector) { return lists.get(key + ' ' + selector) || []; }
    });
    if (key === 'overlay') {
      let markup = '';
      Object.defineProperty(nodes.get(key), 'innerHTML', { get() { return markup; }, set(value) {
        markup = String(value); this.childNodes = [];
        selectors.delete('.ev-modal'); selectors.delete('.ev-backdrop');
        if (/class="[^"]*\bev-modal\b/.test(markup)) {
          const modal = node('mounted-modal-' + (++modalSequence)), backdrop = node('mounted-backdrop-' + modalSequence);
          modal.classList.add('ont-drawer', 'ev-modal'); backdrop.classList.add('ont-backdrop', 'ev-backdrop');
          modal.parentElement = backdrop; selectors.set('.ev-modal', modal); selectors.set('.ev-backdrop', backdrop);
        }
      } });
    }
  }
  return nodes.get(key);
}
class LocalFormData {
  constructor(form) { this.values = form.values || {}; }
  get(key) { const value = this.values[key]; return Array.isArray(value) ? value[0] ?? null : value ?? null; }
  getAll(key) { const value = this.values[key]; return value === undefined ? [] : Array.isArray(value) ? value : [value]; }
  *[Symbol.iterator]() { for (const key of Object.keys(this.values)) for (const value of this.getAll(key)) yield [key, value]; }
}
const scenes = [{ id: 'audit', name: '关联审核', parentId: 'app-audit', items: [] }, ...['sales', 'procurement'].map(id => ({
  id, name: id === 'sales' ? '销售' : '采购', parentId: id + '-app',
  items: [id === 'sales' ? '销售智能分货助手' : '采购协同助手', id === 'sales' ? '销售管理应用 Agent' : '采购管理应用 Agent'].map((name, index) => ({ id: id + ':agents:' + index, name, type: 'Agent' }))
}))];
const context = { console, JSON, URL, URLSearchParams, Blob, Date: ClockDate, FormData: LocalFormData, innerWidth: 1440, innerHeight: 1000,
  setTimeout(fn, delay = 0) { const id = ++sequence; timers.set(id, { id, fn, at: clockMs + Number(delay) }); return id; }, clearTimeout(id) { timers.delete(id); },
  addEventListener(type, handler) { events.set(type, handler); },
  document: { body: node('body'), activeElement: node('active'), getElementById: node, querySelector: selector => selectors.get(selector) || null, querySelectorAll: selector => lists.get(selector) || [], createElement: tag => node('created-' + tag), addEventListener(type, handler) { events.set('document:' + type, handler); } },
  AIOpsResources: { sceneId() { return selectedScene; }, scopeCatalog() { return scenes.filter(scene => selectedScene === 'all' || scene.id === selectedScene); } },
  AIOpsWorkspaces: { scopeCatalog() { return scenes; }, sceneTree() { return []; }, registerEvaluationScenes() {} },
  AIOpsApp: { navigate(page) { nativePage = page; navigation.push(page); }, refresh(options) { refreshes++;refreshOptions.push(options); }, page() { return nativePage; }, toast(message) { messages.push(message); } },
};
context.window = context;
vm.createContext(context);
for (const file of runtime) vm.runInContext(fs.readFileSync('dist/' + file, 'utf8'), context, { filename: file });
const run = source => vm.runInContext(source, context);
const snapshot = source => JSON.parse(run('JSON.stringify(' + source + ')'));
const api = context.AIOpsEvaluation;
function open(page) { api.beforeRender(page); nativePage = page; const markup = api.page(page); node('pageRoot').innerHTML = markup; api.afterRender(page); return markup; }
function drain() { let count = 0; while (timers.size) { assert(++count < 2000, 'finite Mock timers'); const timer = [...timers.values()].sort((a, b) => a.at - b.at || a.id - b.id)[0]; timers.delete(timer.id); clockMs = Math.max(clockMs, timer.at); timer.fn(); } }
function expectFields(markup, fields) { for (const field of fields) assert(markup.includes(field), 'shared field preserved: ' + field); }
function expectCreateModal(kind) {
  const markup = node('overlay').innerHTML, modal = selectors.get('.ev-modal'), backdrop = selectors.get('.ev-backdrop');
  assert(backdrop?.classList.contains('aev-create-backdrop'), 'native creation uses the centered backdrop: ' + kind);
  assert(modal?.classList.contains('aev-create-modal'), 'native creation uses a modal card: ' + kind);
  assert.equal(modal?.getAttribute('data-aev-create-kind'), kind, 'native creation identifies its resource kind');
  assert(/<section\b[^>]*\brole="dialog"/.test(markup) && markup.includes('aria-modal="true"'), 'creation keeps dialog semantics');
  assert(/<form\b[^>]*\bid="ev-form"/.test(markup), 'creation keeps the functional evaluation form');
}
function expectOperationalDrawer() {
  const markup = node('overlay').innerHTML, modal = selectors.get('.ev-modal'), backdrop = selectors.get('.ev-backdrop');
  assert(!modal?.classList.contains('aev-create-modal') && !backdrop?.classList.contains('aev-create-backdrop') && !modal?.getAttribute('data-aev-create-kind'), 'ordinary operations are not relabeled as creation popups');
  assert(!markup.includes('aev-create-modal') && !markup.includes('aev-create-backdrop') && !markup.includes('data-aev-create-kind'), 'other operations keep their existing presentation');
  assert(markup.includes('role="dialog"') && markup.includes('id="ev-form"'));
}
function dimensions(values) { lists.set('#ev-task-dimensions [data-ev-dimension]', values.map(value => ({ querySelector(selector) { return { value: selector === '[data-dimension-name]' ? value.name : selector === '[data-dimension-description]' ? value.description : value.values.join('、') }; } }))); }

assert.deepEqual(Array.from(api.pages), ['评测实验', '评测集', '业务任务', '离线评估器']);
for (const page of api.pages) assert(api.isPage(page));
assert.equal(api.isPage('在线评估器'), false);
open('评测集');
run('evTab("业务任务")');
assert.equal(navigation.at(-1), '业务任务', 'shared cross-module actions update the native left navigation');
const pageFields = {
  '评测实验': ['编号', '名称', 'Agent', '评测集', '最新评测记录', '用例数', '耗时', 'Token消耗', '状态', '通过率', '创建时间', '操作'],
  '评测集': ['编号', '名称', '所属 Agent', '测试目标', '版本', '评测用例数', '覆盖业务任务数', '操作'],
  '业务任务': ['编号', '名称', '所属 Agent', '版本', '评估维度', '操作'],
  '离线评估器': ['编号', '名称', '评分项数', '达标规则', '版本', '状态', '更新时间', '操作']
};
for (const page of api.pages) {
  const markup = open(page);
  expectFields(markup, pageFields[page]);
  assert(markup.includes(page), 'native page title');
  assert(!markup.includes('aria-label="评测页签"'), 'left navigation replaces workshop primary tabs');
}
assert.equal(run('studio.scene'), 'sales', 'all-scenes starts in a supported evaluation scope');
assert.deepEqual(snapshot('evAgents().map(agent=>agent.id)'), ['sales-agent-1', 'sales-app-agent']);
assert(run('evExperimentMcps().length>0'), 'MCP execution choices are present');
const workshopMcps = workshopHTML.match(/const assetMcps=(\[[\s\S]*?\]);/);
assert(workshopMcps, 'workshop MCP owning catalog is inspectable');
assert.deepEqual(snapshot('assetMcps'), JSON.parse(vm.runInNewContext('JSON.stringify(' + workshopMcps[1] + ')')), 'native MCP fields match the workshop catalog');
assert.equal(api.selectScene('procurement'), true);
assert(open('业务任务').includes('PUR-BT-001'), 'local scene selector works under enterprise overview');
assert.equal(api.selectScene('audit'), false, 'local selector cannot enter unsupported data scopes');
assert.equal(api.selectScene('sales'), true);

// Re-rendering a native route keeps local searches and suite detail state.
open('评测集');
run('evAssetState.suiteSearch="渠道";evOpenSuite(evData().suites[0].id)');
const suiteId = run('evState.suiteId');
api.page('评测集');
assert.equal(run('evState.suiteId'), suiteId);
assert.equal(run('evAssetState.suiteSearch'), '渠道');
assert(run('evState.tab==="评测集"'));
run('evSuiteSelectTab("评测集配置")');
const configuration = api.page('评测集');
expectFields(configuration, ['基本信息', '测试目标', '相关业务任务', '评估维度']);
assert.equal(run('evState.suiteTab'), '评测集配置');

// The native page uses the same authoring functions and field validation as the workshop.
open('业务任务');
run('evEditTask()');
expectCreateModal('task');
expectFields(node('overlay').innerHTML, ['业务任务名称', '业务任务所属 Agent', '业务任务提示词', '维度 1 名称', '维度 1 描述', '维度 1 枚举值', '按模板填写']);
dimensions([{ name: '规则遵循', description: '确认规则是否满足', values: ['不满足', '满足'] }]);
context.taskForm = { values: { name: '原生业务任务', agentId: 'sales-agent-1', prompt: '核对订单、库存和规则，输出待确认方案。' } };
assert.equal(run('evSaveTask(taskForm,"",true)'), true);
const createdTask = snapshot('evData().tasks[0]');
assert.equal(createdTask.name, '原生业务任务');
assert.equal(createdTask.publicationStatus, 'published');
assert.equal(createdTask.dimensions[0].name, '规则遵循');
open('评测集');
run('evEditSuite()');
expectCreateModal('suite');
expectFields(node('overlay').innerHTML, ['评测集所属 Agent', '评测集名称', '测试目标', '业务任务']);
context.suiteForm = { values: { scene: 'sales', agentId: 'sales-agent-1', name: '原生评测集', target: '回归业务规则', taskIds: [createdTask.id] } };
assert.equal(run('evSaveSuite(suiteForm,"",true)'), true);
const createdSuite = snapshot('evData().suites[0]');
assert.equal(createdSuite.name, '原生评测集');
assert.deepEqual(createdSuite.taskIds, [createdTask.id]);
run('evEditCase()');
expectCreateModal('case');
expectFields(node('overlay').innerHTML, ['用例名称', '用例标签', '用例输入', '上传输入附件', '预期结果', '参考附件（非必填）', '上传参考附件', '预期要求（非必填）']);
const caseMarkup=node('overlay').innerHTML;
assert(!caseMarkup.includes('ev-case-skill-button'), 'native input removes the Skill button');
assert(caseMarkup.indexOf('name="expected"')<caseMarkup.indexOf('参考附件（非必填）')&&caseMarkup.indexOf('参考附件（非必填）')<caseMarkup.indexOf('预期要求（非必填）'));
assert(!/<textarea[^>]*name="expectedRequirements"[^>]*required/.test(caseMarkup));
context.caseForm = { values: { scene: 'sales', name: '原生评测用例', input: '库存100，需求80', expected: '分配80，库存余20', tags: '回归，正常流程' } };
assert.equal(run('evSaveCase(caseForm,"","",true)'), true);
assert.equal(run('evData().cases[0].name'), '原生评测用例');
const createdCaseId = run('evData().cases[0].id');
assert.deepEqual(snapshot('evData().cases[0].referenceAttachments'), [], 'reference files are optional');
assert.equal(run('evData().cases[0].expectedRequirements'), '', 'requirements are optional');
const referenceFile={id:'reference-fixture',name:'参考结果.csv',size:3,type:'text/csv',dataUrl:'data:text/csv;base64,YSxi'};
context.caseForm.values.referenceAttachments=JSON.stringify([referenceFile]);
context.caseForm.values.expectedRequirements='列出分配依据 <附表>';
assert.equal(run('evSaveCase(caseForm,'+JSON.stringify(createdCaseId)+',"",true)'),true);
assert.deepEqual(snapshot('evData().cases[0].publishedSnapshot.referenceAttachments'),[{...referenceFile,lastModified:0}]);
run('evEditCase('+JSON.stringify(createdCaseId)+')');
expectFields(node('overlay').innerHTML,['参考结果.csv','列出分配依据 &lt;附表&gt;']);
assert.equal(run('evCaseInputEditor.referenceAttachments[0].dataUrl'),referenceFile.dataUrl);
const beforeInvalidReference=snapshot('evData().cases[0]');
context.caseForm.values.referenceAttachments=JSON.stringify([{...referenceFile,size:4}]);
assert.equal(run('evSaveCase(caseForm,'+JSON.stringify(createdCaseId)+')'),false);
assert.deepEqual(snapshot('evData().cases[0]'),beforeInvalidReference,'invalid reference bytes cannot overwrite a case');
context.caseForm.values.referenceAttachments='[]';context.caseForm.values.expectedRequirements='';
assert.equal(run('evSaveCase(caseForm,'+JSON.stringify(createdCaseId)+',"",true)'),true);
run('evCaseDetail('+JSON.stringify(createdCaseId)+',"","V2")');
const historicalReference=run('AIOpsEvaluationDetails.render("评测集")');
expectFields(historicalReference,['参考结果.csv','列出分配依据 &lt;附表&gt;']);
assert(!historicalReference.includes('移除附件'), 'historical reference files are read-only');
assert.deepEqual(snapshot('evData().cases[0].referenceAttachments'),[],'reference files can be cleared');
run('AIOpsEvaluationDetails.reset();evCloseModal()');

open('离线评估器');
run('evEditEvaluator()');
expectCreateModal('evaluator');
expectFields(node('overlay').innerHTML, ['评估器名称', '评估器简介', '评分项 1 名称', '评分项 1 权重', '评分项 1 通过阈值', '评分项 1 标准']);
context.evaluatorForm = { values: { scene: 'sales', name: '原生离线评估器', description: '检查结果正确性', criterionName: ['正确性'], criterionDescription: ['0分错误，100分正确'], criterionWeight: ['1'], criterionPassScore: ['80'] } };
const createdEvaluator = run('evSubmitEvaluator(evaluatorForm,"",true)');
assert.equal(createdEvaluator.name, '原生离线评估器');
assert.equal(createdEvaluator.publicationStatus, 'published');
open('评测实验');
run('evNewExperiment()');
expectCreateModal('experiment');
expectFields(node('overlay').innerHTML, ['实验所属 Agent', '实验 Agent 版本', '评测实验名称', '评测集', '选择评估器', '执行并发数', '全量评测次数', '每个用例执行次数', '评测模型', '选择 MCP']);

// The presentation change applies to manual creation, keeping edits and Copilot confirmation independent.
run('evEditSuite('+JSON.stringify(createdSuite.id)+')');
expectOperationalDrawer();
run('evEditCase('+JSON.stringify(createdCaseId)+')');
expectOperationalDrawer();
run('evEditEvaluator('+JSON.stringify(createdEvaluator.id)+')');
expectOperationalDrawer();
run('evEditCase("","SAL-ES-001")');
expectCreateModal('case');
expectFields(node('overlay').innerHTML, ['关联业务任务与评估维度']);
run('evEditSuite("",evBuildSuiteDraft({agentId:"sales-agent-1",name:"Copilot 待确认评测集"}))');
assert(node('overlay').innerHTML.includes('确认 Copilot 评测集草案'));
expectCreateModal('suite');
run('evEditCase("","",evBuildCaseDraft({name:"Copilot 待确认用例"}))');
assert(node('overlay').innerHTML.includes('确认 Copilot 用例草案'));
expectOperationalDrawer();
run('evCloseModal()');

// Immutable execution plans and run progress work through the native renderer.
context.plan = { name: '原生回归实验', agentId: 'sales-agent-1', version: 'V3', suiteIds: ['SAL-ES-001'], evaluatorIds: [createdEvaluator.id], execution: { concurrency: 1, caseRuns: 1, fullRuns: 1, modelId: 'mock-eval-balanced', mcpIds: [] } };
context.experiment = run('evCreateExperiment(plan)');
run('evEditExperiment(experiment.id)');
expectOperationalDrawer();
run('evCloseModal()');
const originalInput = run('experiment.snapshot.cases[0].input');
run('evData().cases.find(item=>item.id===experiment.snapshot.cases[0].id).input="后来修改的输入"');
assert.equal(run('experiment.snapshot.cases[0].input'), originalInput);
assert(run('Object.isFrozen(experiment.snapshot.cases[0])'));
context.trial = run('evExperimentStart(experiment.id)');
assert(context.trial && context.trial.status === '运行中');
drain();
assert(['已完成', '部分失败'].includes(context.trial.status));
assert(context.trial.results.some(result => ['通过', '未通过', '运行失败'].includes(result.status)));
assert.equal(run('experiment.runs.length'), 1);
const detail = api.page('评测实验');
expectFields(detail, ['用例结果', '问题优化', '实验报告', '实验配置', '实际结果', 'Tokens']);

// Route changes dispose transient editors/chat but retain saved resources and execution history.
run('evCopilot("task")');
assert(run('evState.copilot&&evState.copilot.kind==="task"'));
open('评测集');
assert.equal(run('evState.copilot'), null);
assert.equal(node('overlay').innerHTML, '');
assert(run('evData().tasks.some(task=>task.id==='+JSON.stringify(createdTask.id)+')'));
run('evEditSuite()');
open('业务任务');
assert.equal(node('overlay').innerHTML, '');
assert.equal(run('evSuiteEditor'), null);
assert.equal(run('evExperimentGet(experiment.id).runs.length'), 1);

// The host scope controls native data: unsupported scenes never reveal sales records.
selectedScene = 'audit';
api.onSceneChange();
const unsupported = open('业务任务');
assert(!unsupported.includes('SAL-BT-') && !unsupported.includes('原生业务任务'));
selectedScene = 'procurement';
api.onSceneChange();
const procurement = open('业务任务');
assert.equal(run('studio.scene'), 'procurement');
assert(procurement.includes('PUR-BT-001'));
assert(!procurement.includes('SAL-BT-') && !procurement.includes('原生业务任务'));
selectedScene = 'sales';
api.onSceneChange();
assert(open('业务任务').includes('原生业务任务'), 'returning to a scene keeps authored resources');
assert.equal(run('evExperimentGet(experiment.id).runs.length'), 1, 'scene changes keep saved run history');

// Online task pickers consume authored definitions; recorded old sessions still resolve their snapshot-era task IDs.
for (const file of ['aiops/business-tasks.js', 'aiops/online-evaluators-data.js']) vm.runInContext(fs.readFileSync('dist/' + file, 'utf8'), context, { filename: file });
const businessTasks = context.AIOpsBusinessTasks, onlineData = context.AIOpsOnlineEvaluatorData;
const authored = businessTasks.catalog();
assert(authored.some(task => task.id === createdTask.id));
assert(authored.every(task => task.id.startsWith('SAL-BT-')), 'current task catalogs use the replacement authoring source');
assert(!authored.some(task => task.id === 'BT-001'), 'old task definitions do not remain in authoring pickers');
assert.equal(businessTasks.definition('BT-001').name, '月末关账审核', 'historical session definitions remain readable');
assert.equal(businessTasks.definition(createdTask.id).sourceAgentId, 'sales-agent-1');
assert.equal(businessTasks.definition(createdTask.id).agentId, 'sales:agents:0', 'online resource IDs resolve the authored Agent');
const availableTasks = onlineData.taskDefinitions('sales', 'sales:agents:0');
assert(availableTasks.some(task => task.id === createdTask.id), 'online evaluators can select new authored tasks');
const onlineDraft = onlineData.defaults('sales');
onlineDraft.agentId = 'sales:agents:0';
const bound = onlineData.bindTasks(onlineDraft, [createdTask.id]);
assert.equal(bound.taskSnapshots[0].id, createdTask.id);
assert(bound.prompt.includes('核对订单、库存和规则') && bound.prompt.includes('规则遵循'), 'online task snapshot carries prompts and dimensions');
bound.taskSnapshots[0].dimensions[0].name = '仅修改在线草稿副本';
assert.equal(run('evData().tasks.find(task=>task.id==='+JSON.stringify(createdTask.id)+').dimensions[0].name'), '规则遵循', 'provider snapshots never mutate authored tasks');
selectedScene = 'all';
const seedValues = new Map();
const seedStorage = { getItem: key => seedValues.get(key) || null, setItem: (key, value) => seedValues.set(key, String(value)) };
const seededOnline = onlineData.createStore(seedStorage).seedDefaults();
assert(seededOnline.ok, 'fresh online examples initialize with replacement task definitions');
const businessSeed = seededOnline.records.find(item => item.id === 'OE-DEMO-BUSINESS');
assert.equal(businessSeed.sceneId, 'sales');
assert.equal(businessSeed.agentId, 'sales:agents:0');
assert(businessSeed.taskIds.length > 0 && businessSeed.taskIds.every(id => id.startsWith('SAL-BT-')));
assert.equal(onlineData.validate(businessSeed).length, 0, 'default business evaluator is runnable after replacing the task source');

// Resource definitions use native pages; experiment result and issue details are contextual drawers.
const details = context.AIOpsEvaluationDetails;
assert(details && typeof details.hasDetail === 'function');
function detailPage(page, kind, fields) {
  assert.equal(details.current().kind, kind);
  const markup = api.page(page);
  if(['result','validation','issue'].includes(kind)){
    assert.equal(details.hasPageDetail(),false,'experiment evidence keeps the underlying experiment page');
    assert(markup.includes('ev-experiment-detail-content')&&!markup.includes('aev-detail-page'),'the experiment remains visible behind its drawer');
    api.afterRender(page);
    const drawer=node('overlay').innerHTML;
    assert(drawer.includes('aev-experiment-detail-drawer')&&drawer.includes('aria-modal="true"'),'experiment evidence uses an accessible drawer');
    assert(!drawer.includes('ev-form-nav')&&!drawer.includes('aev-detail-nav')&&!drawer.includes('aria-label="表单分区"'),'experiment drawers omit the left section anchors');
    assert(drawer.includes('data-aev-detail-kind="'+kind+'"'));
    expectFields(drawer,fields);
    return drawer;
  }
  assert.equal(node('overlay').innerHTML, '', 'read detail never renders in the overlay');
  assert(!/class="[^"]*\bev-modal\b/.test(markup), 'secondary page never inherits modal focus trapping');
  assert(!markup.includes('aria-modal="true"'), 'secondary detail is a page, without a modal backdrop');
  if(kind!=='issue')assert(!markup.includes('id="ev-form"'), 'read details do not duplicate the editing drawer form ID');
  expectFields(markup, fields);
  assert(markup.includes('AIOpsEvaluation.backDetail()'), 'secondary page exposes native back navigation');
  return markup;
}
api.onSceneChange();
open('业务任务');
run('evState.search="原生业务任务"');
node('pageRoot').scrollTop = 275;
run('evTaskDetail('+JSON.stringify(createdTask.id)+')');
assert.equal(refreshOptions.at(-1).scrollTop, 0, 'opening a secondary page overrides host deferred scroll restoration');
detailPage('业务任务', 'task', ['基本信息', '所属 Agent', '业务任务提示词', '评估维度', '规则遵循']);
api.backDetail();
assert.equal(refreshOptions.at(-1).scrollTop, 275, 'back passes the parent position to the host renderer');
assert.equal(details.hasDetail(), false);
assert.equal(run('evState.search'), '原生业务任务', 'back keeps the task search');
api.page('业务任务');
api.afterRender('业务任务');
assert.equal(node('pageRoot').scrollTop, 275, 'back restores the source list scroll after its render');

// Changing a displayed version replaces the resource page and preserves one-step return to its list.
run('evVersionPrepare(evData().tasks[0]);evData().tasks[0].prompt="第二版任务提示词";evVersionPublish(evData().tasks[0])');
assert.equal(run('evData().tasks[0].version'), 'V2');
run('evTaskDetail('+JSON.stringify(createdTask.id)+')');
detailPage('业务任务', 'task', ['第二版任务提示词']);
run('evVersionSelect("task",'+JSON.stringify(createdTask.id)+',"V1","detail")');
const historicalTask = detailPage('业务任务', 'task', ['核对订单、库存和规则', '返回当前版本']);
assert(!historicalTask.includes('第二版任务提示词'));
assert(!details.current().parentDetail, 'version changes do not add duplicate back-stack entries');
api.backDetail();
assert.equal(details.hasDetail(), false);

// Historical inspection from an edit drawer must restore its exact unsaved DOM nodes and editor state.
run('evEditTask('+JSON.stringify(createdTask.id)+')');
assert(node('overlay').innerHTML.includes('编辑业务任务'));
const editedPrompt = node('unsaved-task-prompt');
editedPrompt.value = '尚未保存的任务提示词';
node('overlay').childNodes = [editedPrompt];
selectors.set('overlay .ev-version-switcher[data-ev-version-context="edit"][data-ev-version-selection="current"]', node('editor-version-switcher'));
run('evVersionSelect("task",'+JSON.stringify(createdTask.id)+',"V1","edit")');
detailPage('业务任务', 'task', ['核对订单、库存和规则']);
assert.equal(run('evVersionSuspendedEditor.nodes[0]'), editedPrompt);
selectors.delete('overlay .ev-version-switcher[data-ev-version-context="edit"][data-ev-version-selection="current"]');
node('overlay').childNodes = []; // Simulate the browser removing visible drawer children after capture.
run('evVersionSelect("task",'+JSON.stringify(createdTask.id)+',"current","edit")');
assert.equal(details.hasDetail(), false, 'returning to the current edit version leaves historical secondary view');
assert.equal(node('overlay').childNodes[0], editedPrompt);
assert.equal(node('overlay').childNodes[0].value, '尚未保存的任务提示词');
assert.equal(run('evTaskEditor.id'), createdTask.id);
run('evCloseModal()');

open('离线评估器');
run('evEvaluatorDetail('+JSON.stringify(createdEvaluator.id)+')');
detailPage('离线评估器', 'evaluator', ['评估器简介', '评分项', '权重', '通过阈值', '评分标准']);
api.backDetail();
assert.equal(details.hasDetail(), false);

// A task or case reached through a suite returns to that suite and its selected tab.
open('评测集');
run('evAssetState.suiteSearch="保留评测集搜索";evOpenSuite("SAL-ES-001","评测集配置");evTaskDetail("SAL-BT-001")');
detailPage('评测集', 'task', ['业务任务提示词']);
api.backDetail();
assert.equal(run('evState.suiteId'), 'SAL-ES-001');
assert.equal(run('evState.suiteTab'), '评测集配置');
assert.equal(run('evAssetState.suiteSearch'), '保留评测集搜索');
run('evSuiteSelectTab("评测用例");evCaseDetail("SAL-EC-001","SAL-ES-001")');
detailPage('评测集', 'case', ['关联业务任务与评估维度', '基本信息', '评测内容', '预期结果']);
api.backDetail();
assert.equal(run('evState.suiteId'), 'SAL-ES-001');
assert.equal(run('evState.suiteTab'), '评测用例');

// Result attempts and issue processing use drawers; rubric and report snapshots retain resource pages.
open('评测实验');
context.detailPlan = { ...context.plan, name: '详情导航回归实验', execution: { ...context.plan.execution, caseRuns: 2 } };
context.detailExperiment = run('evCreateExperiment(detailPlan)');
run('evExperimentOpen(detailExperiment.id)');
context.previewAttempts = run('evExperimentDisplayResults(detailExperiment,null)');
context.previewFirst = context.previewAttempts[0];
context.previewSecond = context.previewAttempts.find(result => result.caseId === context.previewFirst.caseId && result.id !== context.previewFirst.id);
assert(context.previewSecond);
run('evExperimentCaseDetail(previewFirst.id)');
detailPage('评测实验', 'result', ['版本', '尚未执行', '实际结果', 'Trace']);
assert.equal(node('pageRoot').scrollTop,275,'opening the result drawer leaves the parent page scroll intact');
run('evExperimentCaseDetail(previewSecond.id)');
detailPage('评测实验', 'result', ['版本', '尚未执行']);
assert(!details.current().parentDetail, 'switching repeated pre-run attempts replaces the same result page');
api.backDetail();
assert.equal(details.hasDetail(), false);
context.detailTrial = run('evExperimentStart(detailExperiment.id)');
drain();
open('评测实验');
context.firstAttempt = context.detailTrial.results[0];
context.secondAttempt = context.detailTrial.results.find(result => result.caseId === context.firstAttempt.caseId && result.id !== context.firstAttempt.id);
assert(context.secondAttempt);
run('evExperimentState.resultSearch="保留结果搜索";evExperimentCaseDetail(firstAttempt.id)');
detailPage('评测实验', 'result', ['选择用例执行结果', '评测输入', 'Agent 输出', '评估结果', '开始时间', '结束时间', '评分依据']);
run('evExperimentCaseDetail(secondAttempt.id)');
detailPage('评测实验', 'result', ['选择用例执行结果']);
assert(!details.current().parentDetail, 'switching attempts replaces the current result detail');
api.backDetail();
assert.equal(details.hasDetail(), false);
assert.equal(run('evExperimentState.resultSearch'), '保留结果搜索');
assert.equal(run('evExperimentState.runId'), context.detailTrial.id);
run('evExperimentScoringSnapshot()');
detailPage('评测实验', 'scoring', ['评分标准快照', '评分项', '权重', '通过分数']);
api.backDetail();
assert.equal(run('evExperimentIssueLedgerSync(detailExperiment).length'),0,'completed results do not create problems before explicit analysis or annotation');
run('evExperimentIssueAnalyzeComplete(detailExperiment,detailTrial);evExperimentSelectTab("问题优化")');
context.detailIssue = run('evExperimentIssueLedgerSync(detailExperiment)[0]');
assert(context.detailIssue);
run('evExperimentIssueDetail(detailIssue.id,"all",detailExperiment.id)');
const issuePage = detailPage('评测实验', 'issue', ['问题状态', '问题总览', '问题根因', '优化建议', '输入', '预期结果', '实际结果', '验证记录', '复制问题根因', '复制优化建议', '优化用例', '新增用例', '优化关联用例']);
assert(issuePage.includes('ev-issue-detail-two-columns')&&issuePage.includes('ev-issue-detail-heading'),'problem review uses a fixed summary and dual-column evidence');
assert(!issuePage.includes('每次发现证据')&&!issuePage.includes('复验记录')&&!issuePage.includes('处理记录'),'obsolete discovery and handling sections are absent');
assert(!issuePage.includes('name="status"')&&!issuePage.includes('name="owner"'),'readonly review is not the old triage form');
const occurrence = context.detailIssue.occurrences.at(-1);
context.evidenceOccurrence = occurrence;
const issueBeforeEvidence=JSON.stringify(context.detailIssue);
run('evExperimentIssueOpenEvidence(detailExperiment.id,evidenceOccurrence.runId,evidenceOccurrence.resultId)');
detailPage('评测实验', 'result', ['实际结果']);
assert.equal(details.current().parentDetail.kind,'issue','the result retains its source problem context');
api.backDetail();
assert.equal(details.current().kind, 'issue', 'nested evidence returns to the source issue');
detailPage('评测实验', 'issue', ['问题总览', '问题根因', '验证记录']);
assert.equal(details.current().args[0],context.detailIssue.id,'return selects the same source problem');
assert.equal(JSON.stringify(context.detailIssue),issueBeforeEvidence,'evidence navigation does not change the problem or its original evidence');

// Linked case definitions and new validation results keep their source problem context.
assert.equal(run('evExperimentIssueOpenCase(detailExperiment.id,detailIssue.id,"all")'),true);
detailPage('评测实验','case',['基本信息','评测内容']);
assert.equal(details.current().parentDetail.kind,'issue');api.backDetail();
detailPage('评测实验','issue',['问题根因','验证记录']);
assert.equal(details.current().args[0],context.detailIssue.id);
const rootsBeforeVerification=context.detailExperiment.runs.length,baselineBeforeVerification=JSON.stringify(context.detailTrial.initialFullResult);
context.detailIssue.status='待验证';context.issueValidationRun=run('evExperimentIssueVerify(detailExperiment.id,detailIssue.id)');
assert(context.issueValidationRun&&context.issueValidationRun.kind==='validation');assert.equal(context.detailIssue.status,'待验证');assert.equal(context.detailIssue.verifying,true);
drain();run('evExperimentIssueLedgerSync(detailExperiment)');
assert.equal(context.detailExperiment.runs.length,rootsBeforeVerification,'validation stays under the original full evaluation record');
assert.equal(JSON.stringify(context.detailTrial.initialFullResult),baselineBeforeVerification,'validation preserves the first complete full result');
context.issueValidation=context.detailIssue.verifications.find(row=>row.validationRunId===context.issueValidationRun.id);
assert(context.issueValidation&&context.issueValidation.resultId,'completed validation retains inspectable result evidence');
run('evExperimentIssueDetail(detailIssue.id,"all",detailExperiment.id)');
detailPage('评测实验','issue',['验证记录','查看验证详情']);
run('evExperimentIssueValidationDetail(detailExperiment.id,issueValidation.runId,issueValidation.resultId)');
const validationDrawer=detailPage('评测实验','validation',['实际结果','验证结果','验证编号','验证执行']);
assert(validationDrawer.includes(context.issueValidation.resultId+'-CONVERSATION'),'validation uses the same result review drawer with its own independent conversation');
api.backDetail();detailPage('评测实验','issue',['问题根因','验证记录']);
assert.equal(details.current().args[0],context.detailIssue.id);

// Creating a regression case reuses evidence in an editable authoring modal.
const caseCountBeforeRegression=run('evData().cases.length'),sourceResultBeforeRegression=JSON.stringify(context.detailTrial.results);
context.regressionDraft=run('evExperimentIssueCreateCase(detailExperiment.id,detailIssue.id,"all")');
expectCreateModal('case');
expectFields(node('overlay').innerHTML,['从问题新增用例','sourceIssueId','sourceExperimentId','targetSuiteId','评测集','用例名称','预期结果']);
assert.equal(context.regressionDraft.input,context.detailTrial.results.find(row=>row.id===occurrence.resultId).input);
assert.equal(context.regressionDraft.expected,context.detailTrial.results.find(row=>row.id===occurrence.resultId).expected);
context.regressionSuite=run('evData().suites.find(suite=>suite.agentId===detailTrial.snapshot.agent.id&&suite.caseIds.includes(detailIssue.caseId))');assert(context.regressionSuite);
context.regressionBindings=run('evCaseBindings(regressionSuite,detailIssue.caseId)');assert(context.regressionBindings.length);
context.regressionForm={values:{scene:'sales',copilot:'false',sourceIssueId:context.detailIssue.id,sourceExperimentId:context.detailExperiment.id,name:'从问题编辑的新回归用例',input:context.regressionDraft.input+'\n补充业务上下文',expected:context.regressionDraft.expected+'\n补充预期约束',inputAttachments:'[]',tags:'问题回归'}};
assert.equal(run('evSaveCase(regressionForm)'),false,'an issue-derived new case must select a target suite');assert.equal(run('evData().cases.length'),caseCountBeforeRegression);
context.regressionForm.values.targetSuiteId=context.regressionSuite.id;
context.regressionForm.values.coverageTaskIds=Array.from(context.regressionBindings,binding=>binding.taskId);
context.regressionForm.values.coverageDimensions=Array.from(context.regressionBindings).flatMap(binding=>Array.from(binding.dimensionNames,name=>JSON.stringify([binding.taskId,name])));
assert.equal(run('evSaveCase(regressionForm)'),true,'the editable issue-derived case can actually be saved to the selected suite');
assert.equal(run('evData().cases.length'),caseCountBeforeRegression+1);
const regressionCase=run('evData().cases.find(row=>row.name==="从问题编辑的新回归用例")');
assert(context.regressionSuite.caseIds.includes(regressionCase.id),'the new regression case is attached to the chosen suite');
assert.equal(regressionCase.source,'问题优化');assert.equal(regressionCase.sourceIssueId,context.detailIssue.id);assert.equal(regressionCase.sourceExperimentId,context.detailExperiment.id);
assert(regressionCase.input.endsWith('补充业务上下文')&&regressionCase.expected.endsWith('补充预期约束'),'user edits are retained');
assert.equal(JSON.stringify(context.detailTrial.results),sourceResultBeforeRegression,'creating regression coverage never rewrites original outputs');
context.invalidRegressionForm={values:{...context.regressionForm.values,name:'失效来源不能创建',sourceExperimentId:'foreign-experiment'}};
assert.equal(run('evSaveCase(invalidRegressionForm)'),false,'source provenance is validated against the current experiment and scene');
assert.equal(run('evData().cases.length'),caseCountBeforeRegression+1);
if(!details.hasDetail())run('evExperimentIssueDetail(detailIssue.id,"all",detailExperiment.id)');
api.backDetail();
assert.equal(details.hasDetail(), false);
assert.equal(run('evExperimentState.tab'), '问题优化');
run('evExperimentCaseDetail(firstAttempt.id)');
detailPage('评测实验','result',['选择用例执行结果']);
run('evEvaluatorDetail('+JSON.stringify(createdEvaluator.id)+')');
detailPage('评测实验','evaluator',['评分标准']);
api.backDetail();
detailPage('评测实验','result',['选择用例执行结果']);
run('evModal("标注评估结果","<p>待保存的标注</p>")');
api.afterRender('评测实验');
assert(node('overlay').innerHTML.includes('待保存的标注'),'background rendering keeps a temporary annotation form open');
run('evCloseModal()');
assert(node('overlay').innerHTML.includes('aev-experiment-detail-drawer'),'closing a temporary annotation restores its result drawer');
assert.equal(run('evExperimentAnnotateOutput(firstAttempt.id,1)'),true,'a native result offers annotation on its actual Agent reply');
const nativeOutputDialog=node('overlay').innerHTML;
assert(nativeOutputDialog.includes('ev-annotation-dialog')&&nativeOutputDialog.includes('ev-annotation-backdrop'),'Agent annotation uses the shared centered dialog presentation');
assert(nativeOutputDialog.includes('name="problemType"')&&nativeOutputDialog.includes('name="note"')&&!nativeOutputDialog.includes('name="decision"'),'Agent annotation asks for problem type and content');
api.afterRender('评测实验');
assert.equal(node('overlay').innerHTML,nativeOutputDialog,'background rendering preserves the open output annotation form');
run('evCloseModal()');
assert(node('overlay').innerHTML.includes('aev-experiment-detail-drawer'),'closing output annotation returns to the same result drawer');
assert.equal(details.current().args[0],context.firstAttempt.id);

// Real annotation dialogs retain the previous result DOM as an inert underlay.
// Saving explicitly requests a new detail render; the restored old modal must
// not be mistaken for an operation that still owns the foreground form.
const nativeAnnotationOverlay=node('overlay'),nativeAnnotationScroll=node('native-annotation-return-scroll');
const nativeUnderlayBackdrop=selectors.get('.ev-backdrop');
let restoredAnnotationUnderlays=0;
nativeAnnotationOverlay.children=[nativeUnderlayBackdrop];
nativeAnnotationOverlay.insertAdjacentHTML=function(position,markup){
  assert.equal(position,'afterbegin');
  const preserved=this.innerHTML;
  this.innerHTML=markup+preserved;
  const annotationBackdrop=selectors.get('.ev-backdrop');
  annotationBackdrop.remove=()=>{restoredAnnotationUnderlays++;annotationBackdrop.isConnected=false;this.innerHTML=preserved;};
  selectors.set('.ev-annotation-backdrop',annotationBackdrop);
};
nativeAnnotationScroll.scrollTop=237;
selectors.set('.ev-result-conversation-content:not([hidden])',nativeAnnotationScroll);
assert.equal(run('evExperimentAnnotateOutput(firstAttempt.id,1)'),true);
const retainedDialogMarkup=nativeAnnotationOverlay.innerHTML;
assert(retainedDialogMarkup.includes('ev-annotation-dialog')&&retainedDialogMarkup.includes('aev-experiment-detail-drawer'),'annotation is layered over the actual result markup');
const nativeAnnotationToken=run('evExperimentAnnotationEditor.token');
context.nativeAnnotationSaveEvent={currentTarget:{values:{scene:'sales',annotationToken:nativeAnnotationToken,problemType:'输出不准确',note:'原生标注保存后应即时回显'}},preventDefault(){}};
assert(run('evSaveExperimentResultAnnotation(nativeAnnotationSaveEvent,firstAttempt.id,"output:1")'));
assert.equal(restoredAnnotationUnderlays,1,'save closes the retained annotation layer');
nativeAnnotationScroll.scrollTop=0;
api.afterRender('评测实验');
assert(nativeAnnotationOverlay.innerHTML.includes('原生标注保存后应即时回显'),'saving renders the newly saved output annotation rather than the preserved old result');
assert(nativeAnnotationOverlay.innerHTML.includes('编辑第 1 轮 Agent 输出标注'),'the output icon immediately switches to edit state');
assert.equal(nativeAnnotationScroll.scrollTop,237,'saving and rebuilding the native result preserves the originating column scroll');
delete nativeAnnotationOverlay.insertAdjacentHTML;nativeAnnotationOverlay.children=[];
selectors.delete('.ev-annotation-backdrop');selectors.delete('.ev-result-conversation-content:not([hidden])');
const savedResultTab=api.captureView('评测实验');
open('业务任务');
assert.equal(node('overlay').innerHTML,'','leaving the experiment closes its contextual drawer');
assert.equal(api.restoreView(savedResultTab,'评测实验'),true);
open('评测实验');
assert(node('overlay').innerHTML.includes('aev-experiment-detail-drawer'),'returning to the experiment module restores its result drawer');
assert.equal(details.current().args[0],context.firstAttempt.id);
run('evCloseModal()');
assert.equal(details.hasDetail(),false,'closing the restored drawer exits its detail stack');
run('evExperimentIssueDetail(detailIssue.id,"all",detailExperiment.id)');
context.issueProcessingForm = { values: { scene: 'sales', status: '待修复', note: '补充业务规则证据' } };
assert.equal(run('evSaveExperimentIssue(issueProcessingForm,detailExperiment.id,"all",detailIssue.id)'), true);
assert.equal(context.detailIssue.owner, undefined);
assert.equal(context.detailIssue.status, '待修复');
assert.equal(node('overlay').innerHTML, '');
if (details.hasDetail()) api.backDetail();
run('evExperimentIssueDetail(detailIssue.id,"all",detailExperiment.id)');
assert.equal(run('evExperimentIssueOpenEvidence(detailExperiment.id,evidenceOccurrence.runId)'), true);
assert.equal(details.hasDetail(), false, 'viewing only the source batch exits the issue secondary page');
assert.equal(run('evExperimentState.runId'), occurrence.runId);
assert.equal(run('evExperimentState.tab'), '用例结果');
run('evExperimentSelectTab("实验报告");evExperimentReportSync(detailExperiment,detailTrial)');
assert.equal(run('evExperimentReportEvidence(detailExperiment.id,detailTrial.id,firstAttempt.id)'), true);
detailPage('评测实验', 'reportEvidence', ['执行证据', '输入', '预期结果', '实际结果', '判定依据']);
api.backDetail();
assert.equal(run('evExperimentState.tab'), '实验报告');
assert.equal(details.hasDetail(), false);
api.beforeRender('工作台');
assert.equal(node('overlay').innerHTML, '');
// Module tabs retain UI snapshots without copying or reverting resource data.
api.onSceneChange();open('业务任务');
run('evState.search="返回任务页签";evTaskDetail('+JSON.stringify(createdTask.id)+')');
const savedTaskTab=api.captureView('业务任务');
open('离线评估器');
run('evEvaluatorState.search="返回评估器页签"');
const savedEvaluatorTab=api.captureView('离线评估器');
assert.equal(api.restoreView(savedTaskTab,'业务任务'),true);
assert(open('业务任务').includes('aev-detail-page'));
assert.equal(details.current().kind,'task');
assert.equal(run('evState.search'),'返回任务页签');
assert.equal(api.restoreView(savedEvaluatorTab,'离线评估器'),true);
open('离线评估器');
assert.equal(run('evEvaluatorState.search'),'返回评估器页签');
assert.equal(details.hasDetail(),false);
selectedScene='procurement';
assert.equal(api.restoreView(savedTaskTab,'业务任务'),false,'a different global scene never revives a stale detail tab');

// Closing a module clears only its view preferences, leaving authored resources and other tabs intact.
selectedScene='sales';api.onSceneChange();open('离线评估器');
const authoredBeforeReset=snapshot('evCatalog.sales');
const evaluatorsBeforeReset=snapshot('evEvaluatorStore("sales")');
const experimentsBeforeReset=snapshot('evExperimentStore("sales")');
run('evEvaluatorState.search="关闭前评估器搜索";evListFilters.evaluator={enabled:["disabled"]}');
api.resetView('离线评估器');
assert.equal(run('evEvaluatorState.search'),'','reopening a closed evaluator module starts with a fresh search');
assert.equal(run('evFilterMatch("evaluator","enabled","enabled")'),true,'closing clears evaluator column filters');
open('离线评估器');
run('evEvaluatorDetail('+JSON.stringify(createdEvaluator.id)+');evAssetState.suiteSearch="关闭前评测集搜索";evListFilters.suite={agent:["sales-app-agent"]}');
const untouchedEvaluatorDetail=details.current();
api.resetView('评测集');
assert.equal(details.current(),untouchedEvaluatorDetail,'closing an inactive suite tab does not discard the active evaluator detail');
assert.equal(run('evAssetState.suiteSearch'),'','reopening a closed suite module starts with a fresh search');
assert.equal(run('evFilterMatch("suite","agent","sales-agent-1")'),true,'closing clears suite Agent filters');
assert.deepEqual(snapshot('evCatalog.sales'),authoredBeforeReset,'view resets never change tasks, suites or case catalogs');
assert.deepEqual(snapshot('evEvaluatorStore("sales")'),evaluatorsBeforeReset,'view resets never change evaluator definitions or versions');
assert.deepEqual(snapshot('evExperimentStore("sales")'),experimentsBeforeReset,'view resets never change saved experiments, runs or report evidence');
console.log('PASS new AIOps evaluation: shared parity, native routes, authoring, snapshots/runs, secondary details/back, version restoration, evidence, scope isolation');
