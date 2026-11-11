const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');

// Load the same inline foundation and evaluation modules used by index.html.
const html = fs.readFileSync('dist/index.html', 'utf8');
const nodes = new Map(), lists = new Map(), selectors = new Map(), listeners = new Map(), timers = new Map();
let timerId = 0;
const node = key => {
  if (!nodes.has(key)) nodes.set(key, {
    innerHTML: '', textContent: '', value: '', hidden: false, disabled: false,
    dataset: {}, style: {}, scrollTop: 0, scrollHeight: 100,
    focus() {}, remove() {}, setAttribute() {}, removeAttribute() {},
    getBoundingClientRect() { return {left:700,top:60,right:1440,bottom:1000,width:740,height:940}; },
    contains() { return true; }, closest() { return null; },
    classList: { add() {}, remove() {}, toggle() {} },
    querySelector(selector) { return selectors.get(key + ' ' + selector) || null; },
    querySelectorAll(selector) { return lists.get(key + ' ' + selector) || []; }
  });
  return nodes.get(key);
};
class FormDataMock {
  constructor(form) { this.values = form.values || {}; }
  get(key) { const value = this.values[key]; return Array.isArray(value) ? value[0] ?? null : value ?? null; }
  getAll(key) { const value = this.values[key]; return value === undefined ? [] : Array.isArray(value) ? value : [value]; }
  *[Symbol.iterator]() { for (const key of Object.keys(this.values)) for (const value of this.getAll(key)) yield [key, value]; }
}
const sandbox = {
  console, FormData: FormDataMock, Date, JSON, URL, URLSearchParams, Blob,
  addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(handler); },
  setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; },
  clearTimeout(id) { timers.delete(id); },
  document: {
    body: node('body'), activeElement: node('active'),
    getElementById: node,
    querySelector: selector => selectors.get(selector) || null,
    querySelectorAll: selector => lists.get(selector) || [],
    addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(handler); },
    createElement: tag => node('created-' + tag),
  },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(match[1], sandbox);
const evaluationModules=['workshop-evaluation-seed.js','workshop-evaluation.js','workshop-evaluation-versions.js','workshop-evaluation-dashboard.js','workshop-evaluation-tasks.js','workshop-evaluation-assets.js','workshop-evaluation-evaluators.js','workshop-evaluation-experiment-engine.js','workshop-evaluation-reports.js','workshop-evaluation-experiments.js','workshop-evaluation-issues.js','workshop-evaluation-copilot.js'];
const evaluationScriptTags=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)];
let previousEvaluationScriptIndex=-1;
for (const file of evaluationModules) {
  const script=evaluationScriptTags.find(match=>match[1].split('?')[0]===file);
  assert(script,file+' must be loaded by the real entry point');
  assert(script.index>previousEvaluationScriptIndex,'entry point must load evaluation assets, experiment engine/UI, and Copilot in dependency order');
  previousEvaluationScriptIndex=script.index;
  vm.runInContext(fs.readFileSync('dist/' + file, 'utf8'), sandbox, {filename: file});
}
const run = code => vm.runInContext(code, sandbox);
const snapshot = code => JSON.parse(run('JSON.stringify(' + code + ')'));
const primaryTabCounts=markup=>{
  const nav=markup.match(/<nav\b[^>]*aria-label="评测页签"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert(nav,'resource lists expose the five primary evaluation tabs');
  return Object.fromEntries([...nav.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(m=>{
    const count=m[1].match(/<span\b[^>]*class="[^"]*\bont-count\b[^"]*"[^>]*>(\d+)<\/span>/);assert(count,'each primary evaluation tab exposes its count');
    return [m[1].replace(count[0],'').replace(/<[^>]*>/g,'').trim(),Number(count[1])];
  }));
};
const flushTimers = (limit = 2000) => {
  let count = 0;
  while (timers.size) {
    assert(++count <= limit, 'timer loop must finish');
    const [id, fn] = timers.entries().next().value;
    timers.delete(id); fn();
  }
};
const dimensions = values => lists.set('#ev-task-dimensions [data-ev-dimension]', values.map(value => ({
  querySelector(selector) { return {value: selector === '[data-dimension-name]' ? value.name : selector === '[data-dimension-description]' ? value.description : value.values.join('、')}; }
})));
const taskForm = draft => ({values: {
  name: draft.name, agentId: draft.agentId, prompt: sandbox.evTaskPrompt(draft)
}});

// First-run Mock data is complete, scoped, cross-referenced, and mutable without reseeding.
const seedCopyA=run('evSeedScene("sales")'),seedCopyB=run('evSeedScene("sales")');
const pristineSeed=JSON.parse(JSON.stringify(seedCopyB));
assert.notEqual(seedCopyA,seedCopyB);
if(typeof seedCopyA.tasks[0].prompt==='string')seedCopyA.tasks[0].prompt='仅修改这个副本';
else seedCopyA.tasks[0].prompt.description='仅修改这个副本';
seedCopyA.tasks[0].dimensions[0].values.push('仅副本枚举值');
seedCopyA.suites[0].taskIds.length=0;
seedCopyA.cases[0].tags.push('仅副本标签');
assert.deepEqual(JSON.parse(JSON.stringify(seedCopyB)),pristineSeed,'seed calls must not share mutable nested fields');
assert.deepEqual(snapshot('evSeedScene("sales")'),pristineSeed,'later seed calls must return fresh pristine records');
const seededIds=new Set();
for(const scene of ['sales','procurement']) {
  run("currentSection='studio';studio.scene="+JSON.stringify(scene)+";workbenchOpen('评测')");
  const data=snapshot('evData()');
  assert.deepEqual([data.tasks.length,data.suites.length,data.cases.length],[4,3,8]);
  assert.deepEqual(data.sequence,{task:4,suite:3,case:8});
  assert.equal(data.cases.filter(c=>c.enabled).length,6);
  assert.equal(data.cases.filter(c=>!c.enabled).length,2);
  assert(data.cases.every(c=>!c.archived&&c.name&&c.input&&c.expected&&c.version&&Array.isArray(c.tags)));
  const agentIds=new Set(snapshot('evAgents().map(a=>a.id)'));
  assert(data.tasks.every(t=>agentIds.has(t.agentId)));
  assert(data.tasks.some(t=>t.agentId===scene+'-app-agent'));
  assert(data.tasks.some(t=>t.agentId===scene+'-agent-1'));
  for(const task of data.tasks) {
    assert(sandbox.evTaskPrompt(task).trim(),'seed task prompts must remain readable in plain and legacy formats');
    assert(task.dimensions.length>0&&task.dimensions.every(d=>d.name&&d.description&&d.values.length>=2));
    assert.equal(new Set(task.dimensions.map(d=>d.name)).size,task.dimensions.length);
  }
  const taskIds=new Set(data.tasks.map(t=>t.id)),caseIds=new Set(data.cases.map(c=>c.id));
  assert(data.suites.every(s=>s.name&&s.target&&agentIds.has(s.agentId)&&s.taskIds.length&&s.caseIds.length));
  assert(data.suites.every(s=>s.taskIds.every(id=>taskIds.has(id))&&s.caseIds.every(id=>caseIds.has(id))));
  assert(data.suites.every(s=>s.taskIds.every(id=>data.tasks.find(t=>t.id===id).agentId===s.agentId)),'every seeded suite must have one Agent and only that Agent\'s tasks');
  for(const item of [...data.tasks,...data.suites,...data.cases]) {
    assert(item.id.startsWith(scene==='sales'?'SAL-':'PUR-'));
    assert(!seededIds.has(item.id),'seed identifiers must be unique across scenes and resource kinds');
    seededIds.add(item.id);
  }
  assert.equal(run('evFilteredTasks().length'),4);
  assert(run('evTasksView().includes(evData().tasks[0].name)'));
  assert(run('evSuitesView().includes(evData().suites[0].name)'));
  assert(run('evCasesView().includes(evData().cases[0].name)'));
  assert.deepEqual(primaryTabCounts(run('evScreen()')),{'业务任务':4,'评测集':3,'评测实验':3,'离线评估器':3});
}
assert.equal(seededIds.size,30);
// Experiment references identify saved drafts without relabelling published content as the same version.
sandbox.referenceDraft={id:'reference-case',version:'V3',name:'待发布修改',publicationStatus:'draft',input:'新输入',publishedSnapshot:{version:'V3',input:'发布输入'}};
const referenceDraftCopy=JSON.stringify(sandbox.referenceDraft);
assert.equal(run('evVersionExperimentSnapshot(referenceDraft).version'),'V3 修改稿');
assert.equal(run('evVersionExperimentSnapshot(referenceDraft).sourceVersion'),'V3');
assert.equal(run('evVersionExperimentSnapshot(referenceDraft).input'),'新输入');
assert.equal(JSON.stringify(sandbox.referenceDraft),referenceDraftCopy,'capturing draft provenance never mutates the live source');
assert.equal(run('evVersionExperimentSnapshot({version:"V1",publicationStatus:"draft"}).version'),'V1 未发布');
assert.equal(run('evVersionExperimentSnapshot({version:"V2",publicationStatus:"published"}).version'),'V2');
assert.equal(run('evVersionExperimentSnapshot({version:"V3"}).version'),'V3','legacy published versions retain their labels');

run("studio.scene='sales';evData()");
// Opening a suite replaces the primary navigation with its own title and three detail tabs.
const detailSuite=pristineSeed.suites[0],detailTabs=markup=>[...markup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(m=>({
  name:m[1].replace(/<span\b[^>]*class="[^"]*\bont-count\b[^"]*"[^>]*>[\s\S]*?<\/span>/g,'').replace(/<[^>]*>/g,'').trim(),
  count:Number(m[1].match(/<span\b[^>]*class="[^"]*\bont-count\b[^"]*"[^>]*>(\d+)<\/span>/)?.[1]??NaN)
}));
run('evOpenSuite('+JSON.stringify(detailSuite.id)+')');assert.equal(run('evState.suiteTab'),'评测用例');
let suiteDetailScreen=run('evScreen()');
assert(!suiteDetailScreen.includes('aria-label="评测页签"')&&!suiteDetailScreen.includes('<h2>评测</h2>'));
assert.equal((suiteDetailScreen.match(/<h2\b/g)||[]).length,1,'detail pages have a single lifted title');
assert.equal(suiteDetailScreen.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)?.[1],detailSuite.name);assert(suiteDetailScreen.indexOf('ont-crumb')<suiteDetailScreen.indexOf('<h2'));
assert.deepEqual(detailTabs(run('evSuiteDetailTabs(evData().suites[0])')),[{name:'评测用例',count:detailSuite.caseIds.length},{name:'评测集配置',count:NaN}]);
run('evSuiteSelectTab("评测集配置")');assert(run('evSuiteView(evData().suites[0])').includes(detailSuite.target));assert(!run('evSuiteView(evData().suites[0]).includes("版本记录")'),'suite overview no longer embeds a version history table');
run('evSuiteSelectTab("评测用例")');assert(run('evSuiteView(evData().suites[0]).includes("SAL-EC-001")'));
run('evSuiteSelectTab("评测集配置")');const taskDetailBody=run('evSuiteView(evData().suites[0])');
assert(detailSuite.taskIds.every(id=>taskDetailBody.includes(id)));assert(!taskDetailBody.includes('SAL-EC-001'));
run('evOpenSuite('+JSON.stringify(detailSuite.id)+')');assert.equal(run('evState.suiteTab'),'评测用例','reopening a suite starts at its overview');
run('evOpenSuite("PUR-ES-001")');assert.equal(run('evState.suiteId'),detailSuite.id,'foreign-scene suite IDs cannot replace the current detail');
run('evSuiteBack()');assert.equal(run('evState.suiteId'),null);assert.equal(run('evState.tab'),'评测集');assert.equal(Object.keys(primaryTabCounts(run('evScreen()'))).length,4);
const seededTask=snapshot('evData().tasks[0]');
seededTask.name='已编辑的内置 Mock 业务任务';
run('evEditTask('+JSON.stringify(seededTask.id)+')');
dimensions(seededTask.dimensions);
sandbox.testForm=taskForm(seededTask);
run('evSaveTask(testForm,'+JSON.stringify(seededTask.id)+')');
assert.equal(run('evData().tasks.find(t=>t.id==='+JSON.stringify(seededTask.id)+').name'),seededTask.name);
const deletedSeedSuite=run('evData().suites[0].id');
run('evConfirmDeleteSuite('+JSON.stringify(deletedSeedSuite)+')');
assert.equal(run('evData().suites.length'),2);
assert.equal(primaryTabCounts(run('evScreen()'))['评测集'],2,'deletion updates the primary suite count');
const mutatedSeed=snapshot('evData()');
run("studio.scene='procurement';evData();studio.scene='sales';evData();workbenchOpen('评测')");
assert.deepEqual(snapshot('evData()'),mutatedSeed,'reopening a scene must retain seed edits and deletions');
assert(!run('evData().suites.some(s=>s.id==='+JSON.stringify(deletedSeedSuite)+')'));
// New identifiers continue after seeded records, and newly created suites still begin empty.
sandbox.taskDraft=run('evBuildTaskDraft({name:"种子后的新业务任务"})');
run("evEditTask('',taskDraft)");
dimensions(sandbox.taskDraft.dimensions);
sandbox.testForm=taskForm(sandbox.taskDraft);
run('evSaveTask(testForm)');
assert.equal(run('evData().tasks[0].id'),'SAL-BT-005');
sandbox.testForm={values:{name:'种子后的新评测集',target:'验证新增时仍从空用例开始',agentId:'sales-agent-1',taskIds:['SAL-BT-005']}};
run('evSaveSuite(testForm)');
assert.equal(run('evData().suites[0].id'),'SAL-ES-004');
assert.equal(run('evData().suites[0].caseIds.length'),0);
sandbox.testForm={values:{name:'种子后的新用例',input:'测试输入',expected:'测试预期',tags:'新建',enabled:'true'}};
run('evSaveCase(testForm)');
assert.equal(run('evData().cases[0].id'),'SAL-EC-009');
run('evData().suites.slice().forEach(s=>evConfirmDeleteSuite(s.id))');
assert.equal(run('evData().suites.length'),0,'deleting all seeded suites must keep the list empty');
run('evData().tasks.slice().forEach(t=>evConfirmDeleteTask(t.id,"sales"))');
assert.equal(run('evData().tasks.length'),0,'deleting all seeded tasks must keep the list empty');
run('evData().cases.slice().forEach(c=>evConfirmArchiveCase(c.id))');
assert.equal(run('evVisibleCases().length'),0,'archiving seed cases must not recreate visible samples');
assert.equal(run('evVisibleCases().length'),0,'archived cases are excluded from the visible case count');
assert.equal(run('evData().cases.length'),9,'archived seed cases remain the original records');

// Isolate the remaining CRUD and empty-new-suite checks from the first-run examples.
run("for(const data of Object.values(evCatalog)){data.tasks=[];data.suites=[];data.cases=[];data.sequence={task:0,suite:0,case:0};}studio.scene='sales';evData();evState.suiteId=null;evState.copilot=null");

// Real route, scene defaults, five requested tabs, and parent-application Agent scope.
run("currentSection='studio';studio.scene='sales';workbenchOpen('评测')");
assert.equal(run('workbenchData().active'), '评测');
assert.equal(run('evState.tab'), '评测实验');
assert(run("workbenchPages.includes('评测')&&!workbenchPages.includes('测试')"));
assert.deepEqual(Object.keys(primaryTabCounts(run('evScreen()'))),['评测实验','评测集','业务任务','离线评估器'],'primary navigation follows the requested evaluation workflow order');
assert(!run('evScreen().includes("wt-agent-select")'));
assert(run('studioGui().includes("ev-screen")'));
assert.equal(run('evState.agentIds.length+evState.objectIds.length'), 0);
assert.equal(run('evData().suites.length+evData().cases.length'), 0);
assert(run("evAgents().some(a=>a.id==='sales-agent-1'&&a.scope==='scene')"));
assert(run("evAgents().some(a=>a.id==='sales-app-agent'&&a.scope==='application')"));
assert(!run("evAgents().some(a=>a.id.includes('procurement'))"));
assert(run('evWorkspace.applications.length>1'));
const createTask = (name, agentId) => {
  sandbox.taskDraft = run('evBuildTaskDraft(' + JSON.stringify({name, agentId}) + ')');
  run("evEditTask('',taskDraft)");
  dimensions(sandbox.taskDraft.dimensions);
  sandbox.testForm = taskForm(sandbox.taskDraft);
  run('evSaveTask(testForm)');
  return run('evData().tasks[0].id');
};
const taskA = createTask('销售规则与结果质量', 'sales-agent-1');
const taskB = createTask('应用级销售协同', 'sales-app-agent');
assert.equal(run('evData().tasks.length'), 2);
assert.equal(run('evData().tasks[0].version'), 'V1');
assert.equal(run('typeof evData().tasks[0].prompt'),'string');
assert(run('evTaskPrompt(evData().tasks[0]).trim().length>0'));
const legacyTask={prompt:{description:'旧版任务描述',inScope:'旧版包含范围',outScope:'旧版排除范围',input:'旧版输入',completion:'旧版完成标准',excellence:'旧版优秀标准',positive:'旧版正例',negative:'旧版反例'}};
sandbox.legacyTask=legacyTask;
assert(run("['旧版任务描述','旧版包含范围','旧版排除范围','旧版输入','旧版完成标准','旧版优秀标准','旧版正例','旧版反例'].every(x=>evTaskPrompt(legacyTask).includes(x))"),'legacy structured prompts must remain readable');
// Only identity and a valid scoped Agent are required; prompts and dimensions are optional.
run("evEditTask('',evBuildTaskDraft())");
sandbox.testForm = taskForm(sandbox.taskDraft);
sandbox.testForm.values.agentId = 'procurement-agent-1';
run('evSaveTask(testForm)');
assert.equal(run('evData().tasks.length'), 2);
sandbox.testForm.values.agentId = 'sales-agent-1';
sandbox.testForm.values.name = '  ';
run('evSaveTask(testForm)');
assert.equal(run('evData().tasks.length'), 2);
dimensions([]);
sandbox.testForm={values:{name:'稍后补充提示词',agentId:'sales-agent-1',prompt:''}};
run('evSaveTask(testForm)');
assert.equal(run('evData().tasks.length'), 3);
assert.equal(run('evData().tasks[0].prompt'),'');
assert.equal(run('evData().tasks[0].dimensions.length'),0);
run('evConfirmDeleteTask(evData().tasks[0].id,"sales");evEditTask()');
dimensions([{name:'仅填写维度名',description:'',values:[]}]);
sandbox.testForm={values:{name:'自由格式业务任务',agentId:'sales-agent-1',prompt:' 只核对这批订单，先不要生成最终方案。\n'}};
run('evSaveTask(testForm)');
assert.equal(run('evData().tasks[0].prompt'),' 只核对这批订单，先不要生成最终方案。\n');
assert.equal(run('evData().tasks[0].dimensions[0].name'),'仅填写维度名');
assert.equal(run('evData().tasks[0].dimensions[0].description'),'');
run('evConfirmDeleteTask(evData().tasks[0].id,"sales")');
assert.equal(run('evData().tasks.length'), 2);
run('evEditTask()');
const promptControl={value:'先保留这段自由输入。',focus(){}};
selectors.set('#ev-form textarea[name="prompt"]',promptControl);
run('evApplyTaskTemplate()');
const templatedPrompt=promptControl.value;
assert(templatedPrompt.startsWith('先保留这段自由输入。'));
for(const label of ['任务描述','包含什么','不包含什么','输入','完成标准','优秀标准','正例','反例'])assert(templatedPrompt.includes(label));
run('evApplyTaskTemplate()');
assert.equal(promptControl.value,templatedPrompt,'template action must not duplicate or replace existing text');
promptControl.value='';
run('evApplyTaskTemplate()');
assert.equal(promptControl.value,run('evTaskTemplate()'),'cleared prompts can receive the template again');
selectors.delete('#ev-form textarea[name="prompt"]');
assert.equal((node('overlay').innerHTML.match(/name="prompt"/g)||[]).length,1);
assert(!/name="prompt"[^>]*\brequired\b/.test(node('overlay').innerHTML),'the single free-form prompt is optional');
const dimensionMarkup=run('evTaskDimensionHTML({name:"",description:"",values:[]},0)');
assert.equal((dimensionMarkup.match(/<input\b/g)||[]).length,3);
assert(!/\brequired\b/.test(dimensionMarkup),'all dimension columns are optional');
dimensions([{name:'',description:'',values:[]}]);
run('evTaskDimensionRemove(0)');
assert.equal(run('evTaskEditor.dimensions.length'),0,'the last optional dimension can be removed');
run('evEditTask(' + JSON.stringify(taskA) + ')');
const edited = snapshot('evData().tasks.find(t=>t.id===' + JSON.stringify(taskA) + ')');
edited.name = '销售规则与结果质量 V2';
dimensions(edited.dimensions);
sandbox.testForm = taskForm(edited);
run('evSaveTask(testForm,' + JSON.stringify(taskA) + ')');
assert.equal(run('evData().tasks.find(t=>t.id===' + JSON.stringify(taskA) + ').version'), 'V1','saving a task never increments its version');
assert.equal(run('evData().tasks.find(t=>t.id===' + JSON.stringify(taskA) + ').publicationStatus'),'draft');
run('evPublishResource("task",'+JSON.stringify(taskA)+')');
assert.equal(run('evData().tasks.find(t=>t.id===' + JSON.stringify(taskA) + ').version'),'V1','the first publication establishes V1');
const publishedTask=snapshot('evData().tasks.find(t=>t.id===' + JSON.stringify(taskA) + ').publishedSnapshot');
run('evEditTask('+JSON.stringify(taskA)+')');
sandbox.testForm.values.name='销售规则与结果质量 发布新版';
run('evSaveTask(testForm,'+JSON.stringify(taskA)+')');
assert.deepEqual(snapshot('evData().tasks.find(t=>t.id===' + JSON.stringify(taskA) + ').publishedSnapshot'),publishedTask,'saved task changes preserve the published content');
run('evPublishResource("task",'+JSON.stringify(taskA)+')');
assert.equal(run('evData().tasks.find(t=>t.id===' + JSON.stringify(taskA) + ').version'),'V2','only publishing an already published task creates its next version');
assert.deepEqual(snapshot('evData().tasks.find(t=>t.id===' + JSON.stringify(taskA) + ').history[0]'),publishedTask);
assert(run('Object.isFrozen(evData().tasks.find(t=>t.id===' + JSON.stringify(taskA) + ').history[0].dimensions)'));
run("evScopeToggle('agentIds','procurement-agent-1',true)");
assert.equal(run('evState.agentIds.length'), 0);
run("evScopeToggle('agentIds','sales-app-agent',true)");
assert.deepEqual(snapshot('evFilteredTasks().map(t=>t.id)'), [taskB]);
run('evState.agentIds=[]');

// A suite belongs to one Agent; only that Agent's tasks can be selected or saved.
assert(run('evSuitesView().includes("暂无评测集")'));
const taskC=createTask('销售结果依据核对','sales-agent-1');
assert.deepEqual(snapshot('evSuiteTasks("sales-agent-1").map(t=>t.id)'),[taskC,taskA]);
assert.deepEqual(snapshot('evSuiteTasks("sales-app-agent").map(t=>t.id)'),[taskB]);
assert.equal(run('evSuiteTasks("procurement-agent-1").length'),0);
run('evEditSuite();evSuiteAgentChange("sales-agent-1")');
assert(node('ev-suite-task-options').innerHTML.includes('销售结果依据核对'));
assert(!node('ev-suite-task-options').innerHTML.includes('应用级销售协同'));
run('evSuitePickTask('+JSON.stringify(taskA)+',true);evSuitePickTask('+JSON.stringify(taskC)+',true)');
assert.deepEqual(snapshot('evSuiteEditor.taskIds'),[taskA,taskC]);
run('evSuiteAgentChange("sales-app-agent")');
assert.equal(run('evSuiteEditor.taskIds.length'),0,'switching Agent clears prior task choices');
assert(node('ev-suite-task-options').innerHTML.includes('应用级销售协同'));
assert(!node('ev-suite-task-options').innerHTML.includes('销售结果依据核对'));
run('evSuitePickTask('+JSON.stringify(taskA)+',true)');
assert.equal(run('evSuiteEditor.taskIds.length'),0,'foreign task selection is ignored');
sandbox.testForm={values:{name:'禁止跨 Agent 混选',target:'目标',agentId:'sales-agent-1',taskIds:[taskA,taskB]}};
assert.equal(run('evSaveSuite(testForm)'),false);
assert.equal(run('evData().suites.length'),0);
sandbox.testForm.values.taskIds=[taskA,'PUR-BT-001'];
assert.equal(run('evSaveSuite(testForm)'),false);
sandbox.testForm.values.agentId='procurement-agent-1';
assert.equal(run('evSaveSuite(testForm)'),false);
sandbox.testForm = {values: {name:'销售业务验收',target:'检查规则遵循、完整性与异常处理',agentId:'sales-agent-1',taskIds:[taskA,taskC]}};
assert.equal(run('evSaveSuite(testForm)'), true);
const suiteA = run('evData().suites[0].id');
assert.deepEqual(snapshot('evData().suites[0].taskIds'), [taskA,taskC]);
assert.equal(run('evData().suites[0].agentId'),'sales-agent-1');
assert.equal(run('evData().suites[0].caseIds.length'), 0);
assert.equal(run('evData().suites[0].publicationStatus'),'draft');
run('evPublishResource("suite",'+JSON.stringify(suiteA)+')');
assert.equal(run('evData().suites[0].version'),'V1');
assert.equal(run('evData().suites[0].publicationStatus'),'published');
assert.equal(run('evState.suiteTab'),'评测用例','creation opens the empty-case workflow directly');
assert(run('evSuiteView(evData().suites[0]).includes("暂无评测用例")'));
assert(run("['从用例库选择','手动录入','Copilot 生成','上传导入'].every(x=>evSuiteView(evData().suites[0]).includes(x))"));
// Referenced tasks cannot move to another Agent and silently invalidate existing suites.
run('evEditTask('+JSON.stringify(taskA)+')');
const referencedTask=snapshot('evData().tasks.find(t=>t.id==='+JSON.stringify(taskA)+')');
dimensions(referencedTask.dimensions);
sandbox.testForm=taskForm(referencedTask);
sandbox.testForm.values.agentId='sales-app-agent';
sandbox.testForm.values.prompt+='\n保留套件归属的普通提示词编辑。';
run('evSaveTask(testForm,'+JSON.stringify(taskA)+')');
assert.deepEqual(snapshot('evData().tasks.find(t=>t.id==='+JSON.stringify(taskA)+')'),referencedTask,'rejected ownership changes must leave the entire task unchanged');
sandbox.testForm.values.agentId='sales-agent-1';
run('evSaveTask(testForm,'+JSON.stringify(taskA)+')');
assert(run('evData().tasks.find(t=>t.id==='+JSON.stringify(taskA)+').prompt.includes("普通提示词编辑")'));
assert(run('evData().suites.every(s=>s.taskIds.every(id=>evData().tasks.find(t=>t.id===id).agentId===s.agentId))'));
run('evDeleteTask(' + JSON.stringify(taskA) + ')');
assert(nodes.get('overlay').innerHTML.includes('业务任务仍被使用'));
run('evConfirmDeleteTask(' + JSON.stringify(taskA) + ",'sales')");
assert.equal(run('evData().tasks.length'), 3);

// Shared case library: validation, state changes, versions, and suite attachment.
run('evEditCase()');
assert(!node('overlay').innerHTML.includes('name="enabled"'),'case creation does not ask the user to choose status');
const coverageValues=suiteId=>{const tasks=snapshot('evSuiteLinkedTasks(evData().suites.find(s=>s.id==='+JSON.stringify(suiteId)+'))');return {coverageTaskIds:tasks.slice(0,1).map(t=>t.id),coverageDimensions:tasks.slice(0,1).flatMap(t=>t.dimensions.map(d=>JSON.stringify([t.id,d.name])))};};
const createCase = (name, enabled, suiteId='') => {
  sandbox.testForm = {values:{name,input:'需求 100 件，可供库存 80 件。',expected:'分配 80 件，说明缺口 20 件与规则依据。',tags:'边界条件，库存不足，边界条件',enabled:String(enabled)}};
  if(suiteId)Object.assign(sandbox.testForm.values,coverageValues(suiteId));
  assert.equal(run('evSaveCase(testForm,"",' + JSON.stringify(suiteId) + ')'), true);
  const id=run('evData().cases[0].id');
  assert.equal(run('evData().cases[0].enabled'),true,'manual case creation always enables the case, ignoring submitted status');
  if(!enabled)run('evToggleCase('+JSON.stringify(id)+')');
  return id;
};
const caseA = createCase('库存不足正常分货',true,suiteA);node('ev-form').values=coverageValues(suiteA);
const caseB = createCase('待确认异常数据',false);
assert.equal(run('evData().cases.length'), 2);
const enabledCase=snapshot('evData().cases.find(c=>c.id==='+JSON.stringify(caseA)+')');
sandbox.enabledCaseForm={values:{name:enabledCase.name,input:enabledCase.input,expected:enabledCase.expected,tags:enabledCase.tags.join('，'),enabled:'false'}};
run('evSaveCase(enabledCaseForm,'+JSON.stringify(caseA)+')');
assert.equal(run('evData().cases.find(c=>c.id==='+JSON.stringify(caseA)+').enabled'),true,'editing also preserves an enabled case when a false status is submitted');
assert.equal(run('evData().cases.find(c=>c.id==='+JSON.stringify(caseA)+').version'),'V1');
assert.deepEqual(snapshot('evData().cases[0].tags'), ['边界条件','库存不足']);
assert.deepEqual(snapshot('evData().suites[0].caseIds'), [caseA]);
assert.equal(run('evData().cases.find(c=>c.id==='+JSON.stringify(caseB)+').version'),'V1');
run('evEditCase('+JSON.stringify(caseB)+')');
assert(!node('overlay').innerHTML.includes('name="version"'),'versions are managed by the system');
assert(!node('overlay').innerHTML.includes('name="enabled"'),'status changes belong to the list actions, not the editor');
run('evSaveCase(testForm,'+JSON.stringify(caseB)+')');
assert.equal(run('evData().cases.find(c=>c.id==='+JSON.stringify(caseB)+').version'),'V1','no-op save must not create a version');
run('evPublishResource("case",'+JSON.stringify(caseB)+')');
sandbox.testForm.values.input+=' 增加关键字段缺失的边界条件。';
sandbox.testForm.values.version='V999';
run('evSaveCase(testForm,'+JSON.stringify(caseB)+')');
assert.equal(run('evData().cases.find(c=>c.id==='+JSON.stringify(caseB)+').version'), 'V1','changed case saves retain the current version');
assert.equal(run('evData().cases.find(c=>c.id==='+JSON.stringify(caseB)+').history.length'),0,'unpublished edits do not create history');
assert(!run('evData().cases.find(c=>c.id==='+JSON.stringify(caseB)+').publishedSnapshot.input.includes("关键字段缺失")'),'saving preserves the published snapshot');
run('evPublishResource("case",'+JSON.stringify(caseB)+')');
assert.equal(run('evData().cases.find(c=>c.id==='+JSON.stringify(caseB)+').version'),'V2');
assert.equal(run('evData().cases.find(c=>c.id==='+JSON.stringify(caseB)+').history.length'),1);
assert.equal(run('evData().cases.find(c=>c.id==='+JSON.stringify(caseB)+').history[0].version'),'V1');
assert(!run('evData().cases.find(c=>c.id==='+JSON.stringify(caseB)+').history[0].input.includes("关键字段缺失")'),'history preserves the prior content');
run('evSaveCase(testForm,'+JSON.stringify(caseB)+')');
assert.equal(run('evData().cases.find(c=>c.id==='+JSON.stringify(caseB)+').version'),'V2');
sandbox.testForm.values.enabled='true';
run('evSaveCase(testForm,'+JSON.stringify(caseB)+')');
assert.equal(run('evData().cases.find(c=>c.id==='+JSON.stringify(caseB)+').enabled'),false,'editing ignores a submitted status and preserves the existing case status');
assert.equal(run('evData().cases.find(c=>c.id==='+JSON.stringify(caseB)+').version'),'V2','ignored status submissions must not create a version');
sandbox.testForm.values.enabled='false';
sandbox.testForm.values.tags='库存不足，边界条件';
run('evSaveCase(testForm,'+JSON.stringify(caseB)+')');
assert.equal(run('evData().cases.find(c=>c.id==='+JSON.stringify(caseB)+').version'),'V2','tag reordering must not create a version');
run('evToggleCase('+JSON.stringify(caseB)+')');
assert.equal(run('evData().cases.find(c=>c.id==='+JSON.stringify(caseB)+').enabled'), true);
run('evToggleCase('+JSON.stringify(caseB)+')');
assert.equal(run('evData().cases.find(c=>c.id==='+JSON.stringify(caseB)+').version'),'V2','enable/disable actions must not create a version');
const caseCells=markup=>[...markup.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(m=>m[1]);
const cellText=markup=>markup.replace(/<[^>]*>/g,'').trim();
for(const [id,name,status] of [[caseA,'库存不足正常分货','已启用'],[caseB,'待确认异常数据','已停用']]) {
  const cells=caseCells(run('evCaseRow(evData().cases.find(c=>c.id==='+JSON.stringify(id)+'))'));
  assert.equal(cells.length,8,'case rows have separate status and action columns');
  assert.equal(cellText(cells[1]),name,'the name cell contains only the case name');
  assert.equal(cellText(cells[6]),status,'the separate status cell reflects the list action');
}
for(const markup of [run('evCasesView()'),run('evSuiteView(evData().suites[0])')]) {
  const headers=[...markup.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map(m=>cellText(m[1].match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/)?.[1]||m[1]));
  assert.deepEqual(headers,['编号','名称','输入','预期结果',...(markup.includes('<th>评估维度</th>')?['业务任务','评估维度']:[]),'标签','版本','状态','操作'],'suite rows additionally show their explicit coverage');
}
run("evAssetState.caseStatus='disabled'");
assert.deepEqual(snapshot('evVisibleCases().map(c=>c.id)'), [caseB]);
run("evAssetState.caseStatus='active';evAssetState.caseSearch='库存不足正常'");
assert.deepEqual(snapshot('evVisibleCases().map(c=>c.id)'), [caseA]);
run("evAssetState.caseSearch='';evOpenCasePicker("+JSON.stringify(suiteA)+')');
run('evPickCase('+JSON.stringify(caseB)+',true)');
run("evAssetState.picker.search='不存在';evRefreshCasePicker()");
assert(run('evAssetState.picker.selected.has('+JSON.stringify(caseB)+')'));
run("evAssetState.picker.search='待确认';evAssetState.picker.status='disabled';evRefreshCasePicker()");
assert(nodes.get('ev-picker-results').innerHTML.includes('待确认异常数据'));
run('evApplyCasePicker()');
assert.deepEqual(snapshot('evData().suites[0].caseIds'), [caseA,caseB]);
assert.equal(run('evData().suites[0].version'),'V1','case membership edits retain the suite version');
assert.equal(run('evData().suites[0].publicationStatus'),'draft','case membership edits mark the suite as unpublished');
assert.deepEqual(snapshot('evData().suites[0].publishedSnapshot.caseIds'),[],'membership edits preserve the published suite snapshot');
run('evPublishResource("suite",'+JSON.stringify(suiteA)+')');
assert.equal(run('evData().suites[0].version'),'V2');
assert.deepEqual(snapshot('evData().suites[0].publishedSnapshot.caseIds'),[caseA,caseB]);
assert.deepEqual(snapshot('evData().suites[0].history[0].caseIds'),[],'publishing retains prior suite membership');

run('evOpenCasePicker('+JSON.stringify(suiteA)+');evPickCase('+JSON.stringify(caseB)+',true);evApplyCasePicker()');
assert.equal(run('evData().suites[0].caseIds.length'), 2);

// CSV parsing must preserve user content, and validation prevents partial import.
sandbox.csv='\uFEFF名称,输入,预期结果,标签,版本,状态\r\n"逗号,与引号","输入第一行\n第二行含""引号""","预期,结果","正常流程;导入",V3,停用\r\n';
const parsed = snapshot('evParseCsv(csv)');
assert.equal(parsed[0].名称, '逗号,与引号');
assert.equal(parsed[0].输入, '输入第一行\n第二行含"引号"');
assert.equal(run('evValidateImportRows(evParseCsv(csv)).errors.length'), 0);
assert.equal(run('evValidateImportRows(evParseCsv(csv)).rows[0].enabled'), false);
assert.throws(()=>run('evParseCsv(\'名称,输入\\n"未闭合,输入\')'), /未闭合/);
assert.throws(()=>run('evValidateImportRows({})'), /数组/);
assert.throws(()=>run('evValidateImportRows([])'), /没有用例/);
assert.throws(()=>run('evValidateImportRows(Array(1001).fill({}))'), /1,000/);
assert.equal(run('evValidateImportRows([{name:"missing",input:"x"}]).errors.length'),1);
assert.equal(run('evValidateImportRows([{name:"a",input:"x",expected:"y",enabled:"unknown"}]).errors.length'),1);
run('evImportCases('+JSON.stringify(suiteA)+');evAssetState.import.rows=evValidateImportRows(evParseCsv(csv)).rows;evImportApply()');
assert.equal(run('evData().cases.length'), 3);
assert.equal(run('evData().suites[0].caseIds.length'), 3);
assert.equal(run('evData().cases[0].source'), '上传导入');
assert.equal(run('evData().cases[0].enabled'),false,'historical imported statuses remain supported');
assert.equal(run('evData().cases[0].version'),'V3','historical imported versions remain supported');
run('evConfirmArchiveCase('+JSON.stringify(caseA)+')');
assert.equal(run('evData().cases.find(c=>c.id==='+JSON.stringify(caseA)+').archived'),true);
assert(!run('evVisibleCases().some(c=>c.id==='+JSON.stringify(caseA)+')'));
assert(!run('evSuiteView(evData().suites[0]).includes("库存不足正常分货")'));
assert.deepEqual(detailTabs(run('evSuiteDetailTabs(evData().suites[0])')).filter(t=>!Number.isNaN(t.count)),[{name:'评测用例',count:2}],'detail tab counts exclude archived cases and retain linked tasks');

const copilotText=(kind,name,options={})=>{
  const agentId=options.agentId||'sales-agent-1';
  const agent=run('evAgentName('+JSON.stringify(agentId)+')');
  if(kind==='task')return '请创建业务任务「'+name+'」，使用 Agent「'+agent+'」。任务描述：「'+(options.description||'按照用户填写的销售任务描述生成方案')+'」。补充要求：必须展示审核依据。';
  if(kind==='suite')return '请创建评测集「'+name+'」，使用 Agent「'+agent+'」。测试目标是「'+(options.target||'只检查用户指定业务任务')+'」，关联'+(options.taskIds||[taskA]).map(id=>'业务任务「'+run('evData().tasks.find(t=>t.id==='+JSON.stringify(id)+')?.name')+'」').join('、')+'。';
  return '请创建评测用例「'+name+'」。输入是「'+(options.input||'用户指定输入 123')+'」，预期结果是「'+(options.expected||'用户指定预期结果')+'」。标签：Copilot，正常流程。';
};

// Natural suite requests cannot bypass the same single-Agent task boundary as the editor.
run("evCopilot('suite')");
const crossAgentRequest=copilotText('suite','禁止跨 Agent 的 Copilot 评测集',{agentId:'sales-agent-1',taskIds:[taskB]});
run('evCopilotSend('+JSON.stringify(crossAgentRequest)+')');
assert.equal(run('evState.copilot.phase'),'input');
assert.equal(run('evState.copilot.draft'),null);
assert(run('evState.copilot.error.includes("所选 Agent")'));
assert.equal(run('evState.copilot.input'),crossAgentRequest,'a rejected request remains editable');
assert.equal(run('evData().suites.length'),1);

// Every auto-filled paragraph can be sent directly without re-entering structured fields.
for(const kind of ['task','suite','case']) {
  run('evCopilot('+JSON.stringify(kind)+')');
  const prefill=run('evState.copilot.input');
  const counts=snapshot('[evData().tasks.length,evData().suites.length,evData().cases.length]');
  run('evCopilotSend('+JSON.stringify(prefill)+')');
  assert.equal(run('evState.copilot.phase'),'review');
  assert.equal(run('evState.copilot.draft.sourceRequest'),prefill);
  assert.deepEqual(snapshot('[evData().tasks.length,evData().suites.length,evData().cases.length]'),counts);
  if(kind==='task') assert(run('evState.copilot.draft.dimensions.length>0&&evState.copilot.draft.dimensions.every(d=>d.name&&d.description&&d.values.length>=2)'),'the requested suggested dimensions are available for optional review');
  if(kind==='suite') {
    assert(run('evState.copilot.draft.taskIds.length>0'));
    assert(run('evState.copilot.draft.taskIds.every(id=>evData().tasks.find(t=>t.id===id).agentId===evState.copilot.draft.agentId)'));
  }
}
run('evCopilot("task",{fields:{name:"延续已有任务",agentId:"sales-app-agent",description:"保留已有业务说明"}})');
assert(run('evState.copilot.input.includes("延续已有任务")&&evState.copilot.input.includes("销售管理应用 Agent")&&evState.copilot.input.includes("保留已有业务说明")'));

// Copilot uses one natural-language composer with an automatically selected Skill.
for (const kind of ['task','suite','case']) {
  run('evCopilot('+JSON.stringify(kind)+','+JSON.stringify({suiteId:suiteA})+')');
  assert.equal(run('studio.panels.chat'),true);
  assert.equal(run('evState.copilot.kind'),kind);
  const chat=run('studioChat()');
  assert(chat.includes('Skill')&&chat.includes(run('evSkills['+JSON.stringify(kind)+'].name')));
  assert.equal((chat.match(/<textarea\b/g)||[]).length,1,'Copilot must have one natural-language composer');
  assert(!/<(?:input|select)\b/.test(chat),'Copilot must not repeat the editor fields');
  assert(chat.includes('aria-label="Copilot 对话输入"'));
  assert(run('typeof evState.copilot.input==="string"&&evState.copilot.input.trim().length>0'),'context must prefill a natural-language request');
  const before = snapshot('[evData().tasks.length,evData().suites.length,evData().cases.length]');
  const request=copilotText(kind,'Copilot '+kind);
  sandbox.testForm={values:{request}};
  run('evCopilotGenerate(testForm)');
  assert.equal(run('evState.copilot.phase'),'review');
  assert.deepEqual(snapshot('[evData().tasks.length,evData().suites.length,evData().cases.length]'),before);
  assert.equal(run('evState.copilot.draft.name'),'Copilot '+kind);
  assert.equal(run('evState.copilot.request'),request,'the full user request must remain inspectable');
  if(kind==='task') assert(run('evTaskPrompt(evState.copilot.draft).includes("按照用户填写的销售任务描述")'));
  if(kind==='suite') assert.deepEqual(snapshot('evState.copilot.draft.taskIds'),[taskA]);
  if(kind==='suite') assert.equal(run('evState.copilot.draft.agentId'),'sales-agent-1');
  if(kind==='case') assert.equal(run('evState.copilot.draft.input'),'用户指定输入 123');
  run('evCopilotReview()');
  assert(nodes.get('overlay').innerHTML.includes(kind==='task'?'新建业务任务':kind==='suite'?'评测集草案':'用例草案'));
  run('evCloseModal()');
  run('evCopilotRevise()');
  assert.equal(run('evState.copilot.phase'),'input');
  assert.equal(run('evState.copilot.input'),request,'revising returns to the original natural-language request');
}

// Agent trial snapshots the task, streams progressively, and cancels on stop/close/scene change.
run('evState.copilot=null;evTestTask('+JSON.stringify(taskA)+')');
assert.equal(run('evTaskTest.busy'),false);
run('evTestRun()');
assert.equal(run('evTaskTest.busy'),true);
assert.equal(run('evTaskTest.messages.length'),2);
assert(run('evTaskTest.messages[1].text.length>0&&evTaskTest.messages[1].text.length<evTaskTest.response.length'));
run('evTestRun()');
assert.equal(run('evTaskTest.messages.length'),2);
flushTimers();
assert.equal(run('evTaskTest.busy'),false);
assert.equal(run('evTaskTest.messages[1].text'),run('evTaskTest.response'));
assert(run('evTaskTest.response.includes("Mock")'));
run('evTestRun();evTestStop()');
assert.equal(run('evTaskTest.busy'),false);
assert(run('evTaskTest.messages.at(-1).text.includes("已停止生成")'));
flushTimers();
run('evTestRun();evCloseModal()');
assert.equal(run('evTaskTest'),null);
flushTimers();
run('evTestTask('+JSON.stringify(taskA)+');evTestRun()');
const sales = snapshot('evData()');
run("studio.scene='procurement';evData()");
assert.equal(run('evTaskTest'),null);
assert.equal(run('evState.copilot'),null);
assert.equal(run('evState.agentIds.length+evState.objectIds.length'),0);
assert.equal(run('evData().tasks.length+evData().suites.length+evData().cases.length'),0);
assert(!run("evAgents().some(a=>a.id.startsWith('sales'))"));
flushTimers();
// A pending upload from another scene cannot append to the new scene.
run("evAssetState.import={scene:'sales',suiteId:'',rows:[{name:'wrong scene',input:'x',expected:'y',tags:[],version:'V1',enabled:true}],errors:[],loading:false};evImportApply()");
assert.equal(run('evData().cases.length'),0);
run("studio.scene='sales';evData()");
assert.deepEqual(snapshot('evData()'),sales);
run('evConfirmDeleteSuite('+JSON.stringify(suiteA)+')');
assert.equal(run('evData().suites.length'),0);
assert.equal(run('evData().cases.length'),3);
run('evConfirmDeleteTask('+JSON.stringify(taskA)+",'sales')");
run('evConfirmDeleteTask('+JSON.stringify(taskC)+",'sales')");
assert.equal(run('evData().tasks.length'),1);

// The file reader uses the selected file contents, shows validation errors, and guards stale reads.
(async () => {
  run('evImportCases()');
  sandbox.testFile = {name:'quoted-cases.csv',size:200,text:async()=>sandbox.csv};
  await run('evReadImport(testFile)');
  assert.equal(run('evAssetState.import.errors.length'),0);
  assert.equal(run('evAssetState.import.rows.length'),1);
  assert.equal(run('evAssetState.import.rows[0].input'),'输入第一行\n第二行含"引号"');
  assert.equal(node('ev-import-apply').disabled,false);
  const before = run('evData().cases.length');
  run('evImportApply()');
  assert.equal(run('evData().cases.length'),before+1);
  run('evImportCases()');
  sandbox.testFile = {name:'invalid.json',size:200,text:async()=>JSON.stringify([{name:'valid',input:'x',expected:'y'},{name:'invalid',input:'x'}])};
  await run('evReadImport(testFile)');
  assert.equal(run('evAssetState.import.errors.length'),1);
  assert.equal(node('ev-import-apply').disabled,true);
  run('evImportApply()');
  assert.equal(run('evData().cases.length'),before+1);
  sandbox.testFile = {name:'file.xlsx',size:200,text:async()=>{throw Error('unsupported file must not be read');}};
  await run('evReadImport(testFile)');
  assert(run('evAssetState.import.errors[0].includes(".csv")'));
  sandbox.testFile = {name:'large.json',size:6*1024*1024,text:async()=>{throw Error('oversized file must not be read');}};
  await run('evReadImport(testFile)');
  assert(run('evAssetState.import.errors[0].includes("5 MB")'));
  run('evImportCases()');
  let release;
  sandbox.testFile={name:'late.json',size:80,text:()=>new Promise(resolve=>{release=resolve;})};
  const pending=run('evReadImport(testFile)');
  run("studio.scene='procurement';evData()");
  release('[{"name":"late","input":"x","expected":"y"}]');
  await pending;
  assert.equal(run('evData().cases.length'),0);
  run("studio.scene='sales';evData()");

  // Closing the import dialog invalidates an in-flight read and prevents later apply.
  run('evImportCases()');
  const casesBeforeClose=run('evData().cases.length');
  sandbox.testFile={name:'closed.json',size:80,text:()=>new Promise(resolve=>{release=resolve;})};
  const closedRead=run('evReadImport(testFile)');
  run('evCloseModal()');
  assert.equal(run('evAssetState.import'),null);
  release('[{"name":"closed","input":"x","expected":"y"}]');
  await closedRead;
  run('evImportApply()');
  assert.equal(run('evData().cases.length'),casesBeforeClose);
  assert.equal(run('evAssetState.import'),null);

  // Unsent natural-language requests survive ordinary right-panel rerenders.
  for (const kind of ['task','suite','case']) {
    run('evCopilot('+JSON.stringify(kind)+')');
    const request='尚未提交的 '+kind+'：保留这整段自然语言需求，以及用户临时补充的业务约束。';
    run('evCopilotRemember('+JSON.stringify(request)+');evState.scopeOpen=true;evRender()');
    assert.equal(run('evState.copilot.phase'),'input');
    assert.equal(run('evState.copilot.input'),request);
    assert(run('studioChat()').includes(request));
    assert.equal((run('studioChat()').match(/<textarea\b/g)||[]).length,1);
  }

  // Saving generated drafts changes the result card to the saved-record action.
  for (const kind of ['task','suite','case']) {
    run('evCopilot('+JSON.stringify(kind)+')');
    const request=copilotText(kind,'已保存 Copilot '+kind,{agentId:kind==='suite'?'sales-app-agent':'sales-agent-1',taskIds:[taskB],description:'Copilot 生命周期任务',target:'Copilot 生命周期目标',input:'Copilot 生命周期输入',expected:'Copilot 生命周期预期'});
    node('studio-message-input').value=request;
    run('evCopilotSend();evCopilotReview()');
    const draft=snapshot('evState.copilot.draft');
    const key=kind==='task'?'tasks':kind==='suite'?'suites':'cases';
    const count=run('evData().'+key+'.length');
    if(kind==='task') {
      dimensions(draft.dimensions);
      sandbox.testForm=taskForm(draft);
      run('evSaveTask(testForm)');
    } else if(kind==='suite') {
      assert(node('overlay').innerHTML.includes('name="copilot" value="true"'));
      sandbox.testForm={values:{name:draft.name,target:draft.target,agentId:draft.agentId,taskIds:draft.taskIds,copilot:'true',scene:'sales'}};
      run('evSaveSuite(testForm)');
    } else {
      assert(node('overlay').innerHTML.includes('name="copilot" value="true"'));
      sandbox.testForm={values:{name:draft.name,input:draft.input,expected:draft.expected,tags:draft.tags.join('，'),enabled:'false',copilot:'true',scene:'sales'}};
      run('evSaveCase(testForm)');
    }
    assert.equal(run('evState.copilot.phase'),'saved');
    assert.equal(run('evData().'+key+'.length'),count+1);
    assert(run('studioChat().includes("evCopilotOpenSaved()")'));
    assert(!run('studioChat()').includes('onclick="evCopilotReview()"'));
    const savedId=run('evState.copilot.savedId');
    assert.equal(run('evData().'+key+'.find(record=>record.id==='+JSON.stringify(savedId)+').sourceRequest'),request,'saved records retain the full natural-language source request');
    run('evCopilotOpenSaved()');
    assert.equal(run('evData().'+key+'.length'),count+1);
    if(kind==='task') assert(node('overlay').innerHTML.includes('业务任务详情'));
    if(kind==='suite') assert.equal(run('evState.suiteId'),savedId);
    if(kind==='case') {
      assert(node('overlay').innerHTML.includes('编辑评测用例'));
      assert(!node('overlay').innerHTML.includes('name="enabled"'));
      assert.equal(run('evData().cases.find(c=>c.id==='+JSON.stringify(savedId)+').source'),'Copilot 生成');
      assert.equal(run('evData().cases.find(c=>c.id==='+JSON.stringify(savedId)+').enabled'),true,'Copilot cases are enabled when first saved');
    }
    run('evCloseModal()');
  }

  // A manual creation while a different Copilot draft is open must not mark that draft saved.
  run("evCopilot('task')");
  run('evCopilotSend('+JSON.stringify(copilotText('task','仍待保存的草稿',{description:'不要被手动任务的保存覆盖'}))+')');
  createTask('独立手动任务','sales-agent-1');
  assert.equal(run('evState.copilot.phase'),'review');
  assert.equal(run('evState.copilot.draft.name'),'仍待保存的草稿');
  run("evCopilot('suite')");
  run('evCopilotSend('+JSON.stringify(copilotText('suite','仍待保存的评测集草稿',{agentId:'sales-app-agent',taskIds:[taskB],target:'不要被手动评测集覆盖'}))+');evEditSuite()');
  assert(node('overlay').innerHTML.includes('name="copilot" value="false"'));
  sandbox.testForm={values:{name:'独立手动评测集',target:'手动目标',agentId:'sales-app-agent',taskIds:[taskB],copilot:'false'}};
  run('evSaveSuite(testForm)');
  assert.equal(run('evState.copilot.phase'),'review');
  run("evCopilot('case')");
  run('evCopilotSend('+JSON.stringify(copilotText('case','仍待保存的用例草稿',{input:'草稿输入',expected:'草稿预期'}))+');evEditCase()');
  assert(node('overlay').innerHTML.includes('name="copilot" value="false"'));
  createCase('独立手动用例',true);
  assert.equal(run('evState.copilot.phase'),'review');

  // Replacing the test dialog cancels its timer, just as closing it does.
  run('evTestTask('+JSON.stringify(taskB)+');evTestRun()');
  const trialTimer=run('evTaskTest.timer');
  assert(timers.has(trialTimer));
  run('evEditCase()');
  assert.equal(run('evTaskTest'),null);
  assert(!timers.has(trialTimer));
  flushTimers();

  // Scene switching clears all asset filters, picker/import state, and pending Copilot context.
  run("evAssetState.suiteSearch='销售';evAssetState.caseSearch='库存';evAssetState.caseTag='销售专属标签';evAssetState.caseStatus='disabled';evAssetState.picker={scene:'sales'};evAssetState.import={scene:'sales'};studio.scene='procurement';evData()");
  assert.deepEqual(snapshot('evAssetState'),{suiteSearch:'',caseSearch:'',caseTag:'',caseStatus:'active',picker:null,import:null});
  assert.equal(run('evState.copilot'),null);
  run("studio.scene='sales';evData()");

  // Compile all generated UI handlers to catch quoting mistakes in nested templates.
  const assertHandlers = markup => {
    for (const match of markup.matchAll(/(?:onclick|onchange|onsubmit|oninput|ondrop|ondragover)="([^"]*)"/g)) {
      const code = match[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
      assert.doesNotThrow(()=>new Function('event',code),code);
    }
  };
  for (const tab of ['业务任务','评测集','评测用例库','评测实验','离线评估器']) {
    run('evTab('+JSON.stringify(tab)+')');
    assertHandlers(run('evScreen()'));
  }
  for (const kind of ['task','suite','case']) {
    run('evCopilot('+JSON.stringify(kind)+')');
    assertHandlers(run('studioChat()'));
  }
  for(const edit of ['evEditTask()','evEditSuite()','evEditCase()']) {
    run(edit);
    const markup=node('overlay').innerHTML;
    assertHandlers(markup);
    // Ontology-style drawers place Save in the header; it must retain native form submission.
    const header=markup.match(/<header>([\s\S]*?)<\/header>/)?.[1]||'';
    assert(/<button\b(?=[^>]*\bform="ev-form")(?=[^>]*\btype="submit")[^>]*>/.test(header),'header Save must submit the editor form');
    assert.equal((markup.match(/\bid="ev-form"/g)||[]).length,1,'each editor has one associated form');
    assert(/value="publish"[^>]*>发布<\/button>/.test(header),'each versioned editor exposes explicit Publish');
    assert(/<form\b[^>]*\bid="ev-form"[^>]*\bonsubmit="event\.preventDefault\(\);evSave/.test(markup),'editor form must retain its save handler');
  }
  console.log('Passed: seeded 4 tasks / 3 single-Agent suites / 8 cases per scene; fresh copies, valid references, unique continued IDs and no reseeding; optional plain/legacy task prompts, safe template append and optional dimensions; Agent-scoped suite task selection and switch reset; enabled-by-default cases, status-free editors and separate list status columns; explicit save/publish versions with immutable published content, history and no-op/status stability; historical CSV/JSON import and cancellation; one natural-language Copilot composer, selected Skill, sendable context prefills, Agent boundary, request retention and review/save lifecycle; streamed trials and modal cancellation; scene isolation; native header form submission and generated handler syntax.');
})().catch(error=>{console.error(error);process.exitCode=1;});
