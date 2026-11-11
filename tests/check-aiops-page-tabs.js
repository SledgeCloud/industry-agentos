const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const listeners = new Map(), nodes = new Map(), captured = [], restored = [], navigated = [], resets = [];
let current = '工作台', live = { route: '工作台', scrollTop: 0, search: '', detail: null }, icons = 0;
function element(id) {
  if (!nodes.has(id)) {
    const attributes = new Map();
    nodes.set(id, { id, innerHTML: '', hidden: false, focusCount: 0, scrollCount: 0,
      setAttribute(key, value) { attributes.set(key, String(value)); }, getAttribute(key) { return attributes.get(key) ?? null; },
      contains(target) { return !!target.inTabStrip; },
      focus() { this.focusCount++; }, scrollIntoView() { this.scrollCount++; }
    });
  }
  return nodes.get(id);
}
const nav = element('aiopsPageTabs');
const context = { console, Map, document: { getElementById: element, addEventListener(type, handler) { const list = listeners.get(type) || []; list.push(handler); listeners.set(type, list); } } };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('dist/aiops/page-tabs.js', 'utf8'), context, { filename: 'page-tabs.js' });
const tabs = context.AIOpsPageTabs;
const clone = value => JSON.parse(JSON.stringify(value));
function go(page, options = {}) {
  navigated.push({ page, options });
  const pending = tabs.beforeNavigate(page, { resume: options.pageTabNewLocation ? false : undefined, capture: options.pageTabNewLocation ? false : undefined });
  current = page; live = { route: page, scrollTop: 0, search: '', detail: null };
  tabs.restoreView(page);
  tabs.afterRender(page);
  return pending;
}
tabs.configure({
  currentPage: () => current, navigate: go,
  capture(page) { captured.push({ page, snapshot: clone(live) }); return clone(live); },
  restore(page, snapshot) { restored.push({ page, snapshot: clone(snapshot) }); live = clone(snapshot); },
  reset(page) { resets.push(page); },
  label(page) { return page === '评测集' ? '评测集 <A&B>' : page; },
  icon(page) { return '<i data-lucide="' + (page === '评测实验' ? 'flask-conical' : 'file-text') + '" aria-hidden="true"></i>'; },
  icons() { icons++; }
});
function list() { return Array.from(tabs.list()); }
function idFor(page) { return [...nav.innerHTML.matchAll(/id="([^"]+)" role="tab"[^>]*data-page-tab="([^"]+)"/g)].find(match => match[2] === page)?.[1]; }
function button(page, close = false, inTabStrip = true) {
  const attribute = close ? 'data-page-tab-close' : 'data-page-tab';
  const node = { inTabStrip, getAttribute(key) { return key === attribute ? page : null; } };
  node.closest = selector => selector === '[' + attribute + ']' ? node : null;
  return node;
}
function event(type, target, extra = {}) {
  const evt = { target, prevented: false, preventDefault() { this.prevented = true; }, ...extra };
  for (const handler of listeners.get(type) || []) handler(evt);
  return evt;
}

tabs.afterRender('工作台');
assert.deepEqual(list(), ['工作台']);
assert.equal(tabs.active(), '工作台');
const homeId = idFor('工作台');
assert(homeId);
assert.equal(nav.getAttribute('role'), 'tablist');
assert.equal(nav.getAttribute('aria-label'), '已打开的功能');
assert(nav.innerHTML.includes('aria-selected="true" tabindex="0"'));
assert(nav.innerHTML.includes('aria-label="关闭工作台"'));
assert.equal(element(homeId).scrollCount, 1);
const detachedList = tabs.list(); detachedList.push('不应污染内部状态');
assert.deepEqual(list(), ['工作台'], 'list returns a detached copy');

// Previously rendered views resume from sidebar and tab-strip navigation alike.
live = { route: '工作台', scrollTop: 180, search: '保留工作台筛选', detail: 'overview' };
assert.equal(go('评测实验'), null, 'a fresh module starts without a saved view');
live = { route: '评测实验', scrollTop: 240, search: 'SAL-EX', detail: 'SAL-EX-001' };
go('评测集');
assert.deepEqual(list(), ['工作台', '评测实验', '评测集']);
assert(nav.innerHTML.includes('评测集 &lt;A&amp;B&gt;'), 'tab labels are escaped');
const experimentId = idFor('评测实验');
const beforeRestore = restored.length;
const experimentClick = event('click', button('评测实验'));
assert(experimentClick.prevented);
assert.equal(navigated.at(-1).options.pageTabResume, true);
assert.equal(current, '评测实验');
assert.deepEqual(live, { route: '评测实验', scrollTop: 240, search: 'SAL-EX', detail: 'SAL-EX-001' });
assert.equal(restored.length, beforeRestore + 1);
assert.equal(tabs.restoreView('评测实验'), false, 'pending restoration applies only once');
assert.equal(idFor('评测实验'), experimentId, 'tab IDs survive repaints and switching');
assert(element(experimentId).focusCount > 0);
go('工作台');
assert.equal(live.search, '保留工作台筛选', 'ordinary sidebar navigation also auto-resumes existing modules');
assert.equal(idFor('工作台'), homeId);

// Internal cross-module actions open their intended new location without overwriting the clean source view.
go('评测实验');
live = { route: '评测实验', scrollTop: 340, search: '原实验筛选', detail: '实验结果页' };
tabs.afterRender('评测实验');
live = { route: '评测实验', scrollTop: 0, search: '已被跨模块动作改写', detail: '目标评测集' };
const captureCount = captured.length;
assert.equal(tabs.beforeNavigate('评测集', { resume: false, capture: false }), null);
assert.equal(captured.length, captureCount, 'internal actions keep the last rendered source snapshot');
current = '评测集'; live = { route: '评测集', scrollTop: 0, search: '', detail: '目标评测集' };
assert.equal(tabs.restoreView('评测集'), false, 'resume:false preserves the requested destination detail');
tabs.afterRender('评测集');
go('评测实验');
assert.equal(live.detail, '实验结果页');
assert.equal(live.search, '原实验筛选');

// Existing operational modules and all evaluation modules use this one registry.
for (const page of ['定时任务', '线上会话', '产出物', '成本分析', '健康度分析', '用户行为分析', '本体知识运营', '自定义看板', '业务任务', '离线评估器', '在线评估器', '分析任务', '消息通知', 'Agent评测']) go(page);
assert.equal(list().length, 17);
for (const page of ['评测实验', '评测集', '业务任务', '离线评估器', '在线评估器']) assert(list().includes(page));
go('产出物详情');
assert.equal(tabs.active(), '产出物');
assert.equal(list().filter(page => page === '产出物').length, 1);
assert(!list().includes('产出物详情'), 'resource details stay under their owning module tab');
assert.equal(tabs.owner('workspace-chat-123'), null);
const known = list();
go('workspace-chat-123');
assert.deepEqual(list(), known, 'unregistered workspace sessions do not invent module tabs');
assert.equal(tabs.active(), null);
assert.equal([...nav.innerHTML.matchAll(/role="tab"[^>]*tabindex="0"/g)].length, 1, 'tab strip remains keyboard-reachable on an unregistered route');

// Roving focus supports keyboard switching and preserves browser shortcuts.
go('工作台');
const right = event('keydown', button('工作台'), { key: 'ArrowRight' });
assert(right.prevented); assert.equal(current, '评测实验');
event('keydown', button('评测实验'), { key: 'End' });
assert.equal(current, list().at(-1));
event('keydown', button(current), { key: 'Home' });
assert.equal(current, '工作台');
event('keydown', button('工作台'), { key: 'ArrowLeft' });
assert.equal(current, list().at(-1), 'left arrow wraps');
const shortcutNavigations = navigated.length;
assert.equal(event('keydown', button(current), { key: 'w', ctrlKey: true }).prevented, false);
assert.equal(event('keydown', button(current), { key: 'ArrowRight', metaKey: true }).prevented, false);
assert.equal(event('keydown', button(current), { key: 'Escape' }).prevented, false);
assert.equal(event('click', button('工作台', false, false)).prevented, false, 'matching data attributes outside the strip are ignored');
assert.equal(navigated.length, shortcutNavigations);

// Closing an inactive tab resets only that module and repaints its icons without navigating.
const navCount = navigated.length, iconsBefore = icons;
assert(event('click', button('评测集', true)).prevented);
assert(!list().includes('评测集'));
assert.equal(navigated.length, navCount);
assert.equal(resets.at(-1), '评测集');
assert(icons > iconsBefore, 'standalone strip repaints refresh their icons');

// Closing the active module resumes an adjacent tab, and never resurrects the closed snapshot.
go('业务任务');
live = { route: '业务任务', scrollTop: 510, search: '关闭前的旧任务筛选', detail: 'old' };
tabs.afterRender('业务任务');
const oldIndex = list().indexOf('业务任务');
const expectedNext = list()[oldIndex + 1] || list()[oldIndex - 1];
const capturesBeforeClose = captured.length;
event('keydown', button('业务任务'), { key: 'Delete' });
assert.equal(current, expectedNext);
assert(!list().includes('业务任务'));
assert(!captured.slice(capturesBeforeClose).some(item => item.page === '业务任务'), 'navigation skips capture for the closed current tab');
assert.equal(go('业务任务'), null, 'reopening a closed module starts a clean view');
assert.equal(live.search, '');

// Global scope changes invalidate saved views without losing the opened-module strip.
go('评测实验'); live.search = '旧场景实验'; tabs.afterRender('评测实验');
go('工作台');
const tabsBeforeScope = list();
tabs.clearViews();
assert.deepEqual(list(), tabsBeforeScope);
assert.equal(go('评测实验'), null);
assert.equal(live.search, '', 'stale scene-specific views never restore after clearViews');

// Closing the final tab falls back to a fresh Workbench tab with one active keyboard target.
for (const page of list().filter(page => page !== current)) tabs.close(page);
assert.deepEqual(list(), [current]);
tabs.close(current);
assert.deepEqual(list(), ['工作台']);
assert.equal(current, '工作台');
assert.equal(tabs.active(), '工作台');
assert.equal([...nav.innerHTML.matchAll(/role="tab"[^>]*tabindex="0"/g)].length, 1);
live.search = '仅剩工作台的旧视图'; tabs.afterRender('工作台');
tabs.close('工作台');
assert.deepEqual(list(), ['工作台']);
assert.equal(live.search, '', 'closing the last Workbench tab never recaptures its just-disposed view');
assert.equal(tabs.close('不存在的模块'), false);

console.log('PASS AIOps page tabs: all modules, state resume, internal links, stable ARIA/focus, keyboard, close/fallback, scope invalidation');
