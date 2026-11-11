const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const changes = [];
const context = { console, document: { addEventListener() {}, getElementById() { return null; }, querySelector() { return null; } }, addEventListener() {} };
context.window = context;
vm.createContext(context);
for (const file of ['workspace-nav.js', 'resource-ui.js', 'analysis-boards.js']) vm.runInContext(fs.readFileSync('dist/aiops/' + file, 'utf8'), context);
const resources = context.AIOpsResources;
resources.configure({ lang: () => 'zh', changed: reason => changes.push(reason), render() {}, icons() {} });
context.AIOpsBoards.configure({ getRange: () => 7 });
const total = () => context.AIOpsBoards.metricSummary('total')[0];

assert.equal(resources.sceneId(), 'all');
assert.equal(resources.sceneLabel(), '企业全景');
assert.equal(resources.sceneChoices().length, 6);
const tree = context.AIOpsWorkspaces.sceneTree();
assert.equal(tree.length, 2);
assert(tree.every(app => app.kind === 'application' && app.children.length));
assert(tree.every(app => app.children.every(scene => scene.kind === 'business' && scene.parentId === app.id)));
assert.equal(new Set(tree.flatMap(app => app.children.map(scene => scene.id))).size, 3);
assert.equal(resources.scopeIds().length, 15);
assert.equal(total(), '95.4M');
for (const scene of ['audit', 'manufacturing', 'cost']) assert(resources.scopeHasScene(scene));
const enterpriseMarkup = resources.scopeOptionsMarkup();
assert.equal((enterpriseMarkup.match(/type="checkbox"/g) || []).length, 15);
assert(enterpriseMarkup.includes('aria-label="Agent"'));
assert(enterpriseMarkup.includes('aria-label="本体对象集"'));
assert(!enterpriseMarkup.includes('data-scope-scene'));
assert(!enterpriseMarkup.includes('ws-scope-scenes'));
const menu = resources.sceneMenuMarkup();
assert.equal((menu.match(/aria-checked="true"/g) || []).length, 1);
assert.equal((menu.match(/data-kind="app"/g) || []).length, 2);
assert.equal((menu.match(/data-kind="biz"/g) || []).length, 3);
assert.equal((menu.match(/class="ov-menu-children"/g) || []).length, 2);
assert(!menu.match(/data-mode="overview">([\s\S]*?)<\/button>/)[1].includes('ov-menu-kind'));

resources.selectScene('audit');
assert.equal(resources.sceneLabel(), '关联审核');
assert.equal(resources.scopeSelected().length, 0);
assert.equal(resources.scopeIds().length, 5);
assert(resources.scopeIds().every(id => id.startsWith('audit:')));
assert(resources.scopeHasScene('audit'));
assert(!resources.scopeHasScene('cost'));
assert(parseFloat(total()) > 0 && parseFloat(total()) < 95.4);
const auditMarkup = resources.scopeOptionsMarkup();
assert.equal((auditMarkup.match(/type="checkbox"/g) || []).length, 5);
assert(auditMarkup.includes('关联审核智能体'));
assert(!auditMarkup.includes('制造业规则审核 Agent'));

resources.selectScopes(['audit:agents:0', 'cost:agents:0', 'audit:agents:0', '<script>']);
assert.deepEqual(Array.from(resources.scopeSelected()), ['audit:agents:0']);
assert.equal(resources.scopeIds().length, 1);
assert(resources.scopeHasAgent('audit', '关联审核智能体'));
assert(resources.scopeHasAgent('audit', '关账审核智能体'));
assert(!resources.scopeHasAgent('audit', '规则核验 Agent'));
assert(!resources.scopeHasAgent('cost', '成本分析智能体'));
assert(resources.scopeTrigger(true).includes('已选 1 项'));

resources.selectScopes(['audit:objects:0']);
assert.equal(resources.scopeSelected().length, 1);
assert.equal(resources.scopeIds().length, 3, 'Object analysis retains its scene agents as the metric source');
assert(resources.scopeHasAgent('audit', '关联审核智能体'));
resources.selectScopes([]);
assert.equal(resources.sceneId(), 'audit', 'Clearing resource filters must retain the selected scene');
assert.equal(resources.scopeIds().length, 5);

resources.selectScopes(['audit:agents:0']);
resources.selectScene('manufacturing');
assert.equal(resources.scopeSelected().length, 0, 'Scene changes reset stale resource filters');
assert(resources.scopeIds().every(id => id.startsWith('manufacturing:')));
assert(resources.scopeHasAgent('manufacturing', '制造业规则审核智能体'));
assert(!resources.scopeHasScene('audit'));
resources.selectScene('unrecognized');
assert.equal(resources.sceneId(), 'manufacturing');
resources.selectScene('cost');
assert(resources.scopeHasAgent('cost', '成本分析智能体'));
resources.selectScene('all');
assert.equal(resources.scopeIds().length, 15);
assert.equal(total(), '95.4M', 'Enterprise overview restores all scene metrics');
assert.equal(changes.filter(reason => reason === 'scene').length, 4);

// Applications aggregate their business scenes without duplicating resources or metrics.
const childIds = [];
let childTokens = 0;
for (const child of tree[0].children) {
  resources.selectScene(child.id);
  childIds.push(...resources.scopeIds());
  childTokens += parseFloat(total());
}
resources.selectScene('app-audit');
assert.deepEqual(Array.from(resources.scopeIds()).sort(), [...new Set(childIds)].sort());
assert.equal(resources.scopeIds().length, 10);
assert(resources.scopeHasScene('audit'));
assert(resources.scopeHasScene('manufacturing'));
assert(!resources.scopeHasScene('cost'));
assert(Math.abs(parseFloat(total()) - childTokens) < 0.02);
assert(resources.scopeOptionsMarkup().includes('制造业规则审核 Agent'));
assert(!resources.scopeOptionsMarkup().includes('成本分析 Agent'));
resources.selectScopes(['manufacturing:agents:0']);
assert(resources.scopeHasAgent('manufacturing', '制造业规则审核智能体'));
assert(!resources.scopeHasScene('audit'));
resources.selectScene('app-analysis');
assert.equal(resources.scopeSelected().length, 0);
assert(resources.scopeIds().every(id => id.startsWith('cost:')));
resources.selectScene('all');
assert.equal(total(), '95.4M');

const entry = fs.readFileSync('dist/new-aiops.html', 'utf8');
assert(entry.includes('data-i18n-aria="切换场景"'));
assert(entry.includes('id="teamName">企业全景<'));
assert(!entry.includes('data-team='));
assert(!entry.includes('id="teamAvatar"'));
assert(entry.includes('class="brand-picker aiops-scene-picker"'));
console.log('Passed: default overview; tagged application/business hierarchy; parent resource/metric aggregation without duplicates; business and Agent filters; stale selection reset; clear within scene; invalid inputs; all-scene restoration; reference button/menu structure.');
