const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const protectedPaths=[...fs.readdirSync('dist').filter(name=>/^workshop.*\.(js|css)$/.test(name)).map(name=>'dist/'+name),'dist/index.html',...fs.readdirSync('dist/aiops').filter(name=>/^online-evaluators(?:-[\w-]+)?\.(js|css)$/.test(name)).map(name=>'dist/aiops/'+name)],protectedBytes=new Map(protectedPaths.map(path=>[path,fs.readFileSync(path)]));

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

function elements(markup,tag,predicate){
  const openings=new RegExp('<'+tag+'\\b[^>]*>','g'),result=[];let match;
  while((match=openings.exec(markup))){if(!predicate(match[0]))continue;const tags=new RegExp('<\\/?'+tag+'\\b[^>]*>','g');tags.lastIndex=openings.lastIndex;let depth=1,part;while(depth&&(part=tags.exec(markup)))depth+=part[0].startsWith('</')?-1:1;if(!depth){result.push({start:match.index,end:tags.lastIndex,html:markup.slice(match.index,tags.lastIndex)});openings.lastIndex=tags.lastIndex;}}
  return result;
}
const byClass=(markup,tag,name)=>elements(markup,tag,opening=>/\bclass="([^"]*)"/.exec(opening)?.[1].split(/\s+/).includes(name));
const byId=(markup,tag,id)=>elements(markup,tag,opening=>opening.includes('id="'+id+'"'))[0]?.html||'';
function withoutExpected(markup){const ranges=byClass(markup,'div','ev-result-hover').filter(item=>item.html.includes('ev-expected-output'));let output='',cursor=0;for(const range of ranges){output+=markup.slice(cursor,range.start);cursor=range.end;}return (output+markup.slice(cursor)).replace(/<div class="ev-result-conversation-heading">[\s\S]*?<\/div>/,'');}
function nativeResult(id,kind){context.layoutResultId=id;run('evExperimentCaseDetail(layoutResultId)');api.afterRender('评测实验');const markup=node('overlay').innerHTML;assert(markup.includes('data-aev-detail-kind="'+kind+'"'));return markup;}
function workshopResult(id){context.layoutResultId=id;context.AIOpsEvaluationDetails.reset();nativePage='智能体工作坊';run('evExperimentCaseDetail(layoutResultId)');const markup=node('overlay').innerHTML;run('evCloseModal()');nativePage='评测实验';return markup;}
function verifyResult(markup,original,expectedCount){
  const toolbar=byClass(markup,'div','aev-result-toolbar')[0]?.html||'',nav=elements(toolbar,'nav',opening=>opening.includes('class="ev-result-tabs"'))[0]?.html||'',actions=byClass(toolbar,'div','aev-result-expected-actions')[0]?.html||'';
  assert(toolbar&&nav&&actions);assert(nav.includes('>实际结果</button>'));assert(nav.includes('>Trace</button>'));assert(!nav.includes('ev-expected-output'),'the extra action is a sibling of the accessible tablist');assert(!markup.includes('>输入与输出</button>'));assert(!markup.includes('ev-result-conversation-heading'));assert(!markup.includes('对话记录'));assert(!markup.includes('一问一答'));
  const oldExpected=byClass(original,'div','ev-result-hover').filter(item=>item.html.includes('ev-expected-output')),moved=byClass(actions,'div','ev-result-hover');assert.equal(oldExpected.length,expectedCount);assert.equal(moved.length,expectedCount);assert.equal(byClass(markup,'div','ev-result-hover').filter(item=>item.html.includes('ev-expected-output')).length,expectedCount,'moving the reference never duplicates it');
  for(let index=0;index<expectedCount;index++){
    const oldButton=/<button\b[^>]*>/.exec(oldExpected[index].html)?.[0],newButton=/<button\b[^>]*>/.exec(moved[index].html)?.[0];assert.equal(newButton,oldButton,'the original button attributes, title and tooltip relationship are preserved');const reference=/aria-describedby="([^"]+)"/.exec(newButton)?.[1];assert(reference);assert.equal((markup.match(new RegExp('id="'+reference+'"','g'))||[]).length,1);assert.equal(byId(moved[index].html,'div',reference),byId(oldExpected[index].html,'div',reference),'the original tooltip and its full reference text move together');assert(moved[index].html.includes('role="tooltip"'));
  }
  assert.equal(byId(markup,'div','ev-result-conversation-panel'),withoutExpected(byId(original,'div','ev-result-conversation-panel')),'all messages, multi-turn summary, attachments and output annotations retain their original markup');assert.equal(byId(markup,'div','ev-result-trace-panel'),byId(original,'div','ev-result-trace-panel'),'Trace markup is untouched');assert.equal(elements(markup,'aside',opening=>opening.includes('class="ev-result-assessment"'))[0]?.html,elements(original,'aside',opening=>opening.includes('class="ev-result-assessment"'))[0]?.html,'the right-hand evaluation content is untouched by the host layout adapter');
  return {toolbar,actions};
}

open('评测实验');run('studio.scene="sales";evData()');
context.layoutPlan={name:'结果抽屉多轮布局回归',agentId:run('evData().suites[0].agentId'),version:'V3',suiteIds:[run('evData().suites[0].id')],evaluatorIds:run('evEvaluatorDefaultIds()'),execution:{mode:'scenario_simulation',scenarioPrompt:'当前场景：分货评审\n行为规则：持续追问直到轮次上限，不编造业务事实。',maxTurns:3,caseRuns:1,fullRuns:1,concurrency:2,modelId:'mock-eval-balanced',mcpIds:[]}};
context.layoutExperiment=run('evCreateExperiment(layoutPlan)');run('evExperimentOpen(layoutExperiment.id)');context.layoutRun=run('evExperimentNewExecution(layoutExperiment,layoutExperiment.id+"-LAYOUT",1,layoutExperiment.snapshot,{kind:"full",status:"运行中",supplements:[]})');run('layoutExperiment.runs.unshift(layoutRun);layoutRun.results=evExperimentResultRows(layoutExperiment,layoutRun.id);evExperimentCompleteResult(layoutExperiment,layoutRun,0,"通过");layoutRun.status="已完成";evExperimentSelectRun(layoutRun.id)');context.layoutResult=context.layoutRun.results[0];assert.equal(context.layoutResult.actualTurns,3);
const before=snapshot('layoutRun'),backups=snapshot('evEvaluatorStore().evaluators'),original=workshopResult(context.layoutResult.id);assert(original.includes('>输入与输出</button>'));assert(original.includes('对话记录'));assert(original.includes('3 轮 · 一问一答'));const native=nativeResult(context.layoutResult.id,'result');verifyResult(native,original,1);assert(native.includes('多轮执行'));assert(native.includes('实际 3 / 3 轮'));assert(native.includes('结束原因：'));assert(native.includes('evExperimentAnnotateOutput('));assert(native.includes('evExperimentAnnotateResult('));assert.deepEqual(snapshot('layoutRun'),before);assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),backups);
run('evExperimentCaseDetailTab(layoutResult.id,"trace")');api.afterRender('评测实验');const traceMarkup=node('overlay').innerHTML;assert(/id="ev-result-trace-tab"[^>]*aria-selected="true"/.test(traceMarkup));assert(byClass(traceMarkup,'div','aev-result-toolbar')[0].html.includes('ev-expected-output'),'the reference stays reachable from the Trace tab');
run('evExperimentCaseDetailTab(layoutResult.id,"conversation");layoutResult.messages.find(message=>message.role==="assistant"&&message.turn===2).expected="第二轮独立参考：仅核验用户刚补充的业务事实。"');const multiReferenceOriginal=workshopResult(context.layoutResult.id),multiReferenceNative=nativeResult(context.layoutResult.id,'result'),multi=verifyResult(multiReferenceNative,multiReferenceOriginal,2);assert(multi.actions.includes('第 1 轮预期输出'));assert(multi.actions.includes('第 2 轮预期输出'));assert(multi.actions.includes('第二轮独立参考：仅核验用户刚补充的业务事实。'));
context.layoutValidation=run('evExperimentPrepareRetryExecution(layoutExperiment,layoutRun,layoutResult.caseId,{validationIssueId:"LAYOUT-ISSUE",validationSequence:1})');run('layoutExperiment.validationRuns=[layoutValidation];evExperimentCompleteResult(layoutExperiment,layoutValidation,0,"通过");layoutValidation.status="已完成"');context.layoutValidationResult=context.layoutValidation.results[0];const validationBefore=snapshot('layoutValidation'),validationOriginal=workshopResult(context.layoutValidationResult.id),validationNative=nativeResult(context.layoutValidationResult.id,'validation');verifyResult(validationNative,validationOriginal,1);assert(validationNative.includes('验证结果'));assert(validationNative.includes('验证编号'));assert(validationNative.includes('验证执行'));assert(!validationNative.includes('evExperimentAnnotateOutput('));assert.deepEqual(snapshot('layoutValidation'),validationBefore);assert.deepEqual(snapshot('evEvaluatorStore().evaluators'),backups);

const css=fs.readFileSync('dist/aiops/evaluation.css','utf8'),sharedCSS=fs.readFileSync('dist/workshop-evaluation.css','utf8');assert(css.includes('width: min(1440px,calc(100vw - 24px))'));assert(css.includes('grid-template-columns: minmax(0,56fr) minmax(0,44fr)'));assert(css.includes('.aev-result-expected-actions')&&css.includes('margin-left: auto'));assert(css.includes('max-width: min(480px,calc(100vw - 64px))'),'a moved tooltip is not constrained to its small button width');assert(sharedCSS.includes('.ev-result-hover:is(:hover,:focus-within) > .ev-result-tooltip'),'the original hover and keyboard-focus interaction is retained');assert(sharedCSS.includes('@container (max-width: 680px)')&&sharedCSS.includes('.ev-result-columns { display: block; overflow: auto; }'),'the shared narrow-screen stacked and scrolling layout stays available');assert(!css.includes('.ev-result-columns { display: grid'),'the host does not override the narrow-screen stack');
for(const [path,bytes] of protectedBytes)assert(fs.readFileSync(path).equals(bytes),'workshop and backup file bytes stay unchanged: '+path);
console.log('New AIOps result layout: native-only wide drawer, unchanged messages/Trace/annotations, single and multi-turn reference relocation, accessible tabs and validation details passed.');
