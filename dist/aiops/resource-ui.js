/* Shared scope cascader and docked resource panels. */
(function (global) {
  'use strict';
  var host, selected = [], activeScene = 'all', scopeOpen = false, docks = {};
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function tr(zh, en) { return host && host.lang() === 'en' ? en : zh; }
  function icon(name) { return '<i data-lucide="' + name + '" aria-hidden="true"></i>'; }
  function sceneChoices() {
    var choices = [{ id: 'all', name: tr('企业全景', 'Enterprise overview'), kind: 'overview' }];
    global.AIOpsWorkspaces.sceneTree().forEach(function (app) {
      choices.push({ id: app.id, name: app.name, kind: app.kind });
      app.children.forEach(function (business) { choices.push({ id: business.id, name: business.name, kind: business.kind, parentId: app.id }); });
    });
    return choices;
  }
  function sceneMenuItem(scene) {
    var active = activeScene === scene.id, overview = scene.kind === 'overview', business = scene.kind === 'business';
    var kind = business ? tr('业务', 'Business') : tr('应用', 'Application');
    return '<button type="button" class="ov-menu-item' + (business ? ' ov-menu-item--biz' : '') + (active ? ' is-current' : '') + '" role="menuitemradio" aria-checked="' + active + '" aria-label="' + esc(overview ? scene.name : kind + ' · ' + scene.name) + '" data-scene="' + esc(scene.id) + '"' + (overview ? ' data-mode="overview"' : ' data-kind="' + (business ? 'biz' : 'app') + '"') + '>' +
      (overview ? '' : '<span class="ov-menu-kind">' + kind + '</span>') + '<span class="ov-menu-name">' + esc(scene.name) + '</span><span class="ov-menu-trail">' +
      (overview ? '' : '<span class="ov-menu-enter" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6h5.2M5.5 3.5 8.2 6 5.5 8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>') +
      '<svg class="ov-menu-check" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 6.3L5 8.8l4.5-5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>';
  }
  function sceneMenuMarkup() {
    return '<div class="ov-menu-sec">' + sceneMenuItem(sceneChoices()[0]) + '</div><div class="ov-menu-sep" role="separator"></div><div class="ov-menu-sec ov-menu-sec--scenes">' +
      global.AIOpsWorkspaces.sceneTree().map(function (app) {
        return '<div class="ov-menu-pack">' + sceneMenuItem(app) + '<div class="ov-menu-children" role="group" aria-label="' + esc(app.name + tr('的业务场景', ' business scenarios')) + '">' + app.children.map(sceneMenuItem).join('') + '</div></div>';
      }).join('') + '</div>';
  }
  function sceneLabel() { return sceneChoices().filter(function (s) { return s.id === activeScene; })[0].name; }
  function catalog() { return global.AIOpsWorkspaces.scopeCatalog().filter(function (s) { return activeScene === 'all' || s.id === activeScene || s.parentId === activeScene; }); }
  function allIds() { return catalog().reduce(function (all, s) { return all.concat(s.items.map(function (x) { return x.id; })); }, []); }
  function count() { return selected.length; }
  function hasScene(id) { return catalog().some(function (s) { return s.id === id; }) && (!selected.length || selected.some(function (x) { return x.indexOf(id + ':') === 0; })); }
  function hasAgent(sceneId, name) {
    if (!hasScene(sceneId)) return false;
    if (!selected.length || selected.some(function (id) { return id.indexOf(sceneId + ':objects:') === 0; })) return true;
    function normalize(value) { return value.replace(/\s|智能体|Agent/g, '').replace('关账审核', '关联审核'); }
    return catalog().some(function (scene) { return scene.id === sceneId && scene.items.some(function (item) { return item.type === 'Agent' && selected.indexOf(item.id) >= 0 && normalize(item.name) === normalize(name); }); });
  }
  function selectScene(id) {
    if (id === activeScene || !sceneChoices().some(function (s) { return s.id === id; })) return;
    activeScene = id;
    selected = [];
    closeScope();
    if (host) { host.changed('scene'); host.render(); }
  }
  function selectScopes(ids) {
    var allowed = allIds();
    selected = ids.filter(function (id, index) { return allowed.indexOf(id) >= 0 && ids.indexOf(id) === index; });
    updateScope();
  }
  function scopeOptionsMarkup() {
    return '<div class="ws-scope-panel global-scope-panel" id="globalScopePanel" role="dialog" aria-label="' + tr('选择 Agent 或本体对象集', 'Choose agents or ontology object sets') + '">' +
      '<header class="global-scope-head"><strong>' + tr('筛选范围', 'Filter scope') + '</strong><button type="button" data-scope-clear' + (!selected.length ? ' disabled' : '') + '>' + tr('清空', 'Clear') + '</button></header>' +
      ['Agent', '本体对象集'].map(function (type) {
        return '<div class="ws-scope-options global-scope-options" role="group" aria-label="' + type + '"><div class="ws-scope-heading">' + (type === 'Agent' ? 'Agent' : tr('本体对象集', 'Ontology object sets')) + '</div>' +
          catalog().map(function (s) { return s.items.filter(function (item) { return item.type === type; }).map(function (item) {
            return '<label class="ws-scope-option ws-scope-check"><input type="checkbox" data-scope-leaf="' + esc(item.id) + '"' + (selected.indexOf(item.id) >= 0 ? ' checked' : '') + '><span>' + esc(item.name) + '</span></label>';
          }).join(''); }).join('') + '</div>';
      }).join('') + '</div>';
  }
  function label() { return selected.length ? tr('已选 ' + count() + ' 项', count() + ' selected') : tr('全部范围', 'All scopes'); }
  function trigger(analysis) { return '<button type="button"' + (analysis ? ' id="analysis-picker-scope"' : '') + ' class="ov-scope" data-scope-trigger aria-label="' + tr('筛选范围', 'Filter scope') + '" aria-haspopup="dialog" aria-expanded="' + scopeOpen + '"><span>' + esc(label()) + '</span>' + icon('chevron-down') + '</button>'; }
  function closeScope(focus) {
    var p = document.getElementById('globalScopePanel'); if (p) p.remove(); scopeOpen = false;
    var button = document.querySelector('[data-scope-trigger]'); if (button) { button.setAttribute('aria-expanded', 'false'); if (focus) button.focus(); }
  }
  function paintScope() {
    var old = document.getElementById('globalScopePanel'); if (old) old.remove();
    if (!scopeOpen) return;
    var trigger = document.querySelector('[data-scope-trigger]'); if (!trigger) { closeScope(); return; }
    trigger.setAttribute('aria-expanded', 'true');
    document.body.insertAdjacentHTML('beforeend', scopeOptionsMarkup());
    var panel = document.getElementById('globalScopePanel');
    var r = trigger.getBoundingClientRect(); panel.style.width = Math.min(460, window.innerWidth - 24) + 'px'; panel.style.left = Math.max(12, Math.min(r.right - panel.offsetWidth, window.innerWidth - panel.offsetWidth - 12)) + 'px'; panel.style.top = r.bottom + 8 + 'px'; panel.style.maxHeight = Math.min(390, Math.max(160, window.innerHeight - r.bottom - 20)) + 'px';
    host.icons();
  }
  function updateScope(focus) { host.changed(); host.render(); paintScope(); var target = focus && document.querySelector(focus); if (target) target.focus({ preventScroll: true }); }
  function dock(kind) { return docks[kind] || (docks[kind] = { items: [], active: null, max: false }); }
  function rememberView() {
    var split = document.querySelector('.resource-split');
    if (!split) return;
    dock(split.dataset.kind).scrolls = Array.from(split.querySelectorAll('*')).map(function (node, index) {
      return { index: index, top: node.scrollTop, left: node.scrollLeft };
    }).filter(function (position) { return position.top || position.left; });
  }
  function restoreView() {
    var split = document.querySelector('.resource-split');
    if (!split) return;
    var nodes = split.querySelectorAll('*');
    (dock(split.dataset.kind).scrolls || []).forEach(function (position) {
      var node = nodes[position.index];
      if (node) { node.scrollTop = position.top; node.scrollLeft = position.left; }
    });
  }
  function open(kind, item) { var d = dock(kind); if (!d.items.some(function (x) { return x.id === item.id; })) d.items.push({ id: item.id, name: item.name }); d.items.forEach(function (x) { if (x.id === item.id) x.name = item.name; }); d.active = item.id; }
  function panelIcon(maximize, expanded) {
    var source = document.querySelector(maximize ? '#cuiRailMax ' + (expanded ? '.rail-min-ico' : '.rail-max-ico') : '#cuiRailClose .rail-close-ico');
    if (!source) return icon(maximize ? (expanded ? 'minimize' : 'maximize') : 'x');
    var clone = source.cloneNode(true); clone.removeAttribute('hidden'); return clone.outerHTML;
  }
  function fitListControls() {
    var split = document.querySelector('.resource-split');
    var controls = split && split.querySelector('.resource-list-controls');
    if (!controls) return;
    if (controls.querySelector('.session-search-field, .cap-search-field')) return;
    var width = Array.from(controls.children).reduce(function (n, item) { return n + item.getBoundingClientRect().width; }, 0) + Math.max(0, controls.children.length - 1) * 8 + 40;
    var kind = split.dataset.kind, data = dock(kind);
    data.minWidth = Math.max(kind === 'session' ? 300 : 260, Math.ceil(width));
    data.width = Math.max(data.minWidth, data.userWidth || 0);
    split.style.setProperty('--resource-list-width', data.width + 'px');
  }
  function tabsMarkup(kind, items, active, rail) {
    return items.map(function (item) {
      var itemKind = item.kind || kind;
      var select = rail ? ' data-rail-tab="' + esc(item.id) + '"' : ' data-resource="select" data-kind="' + kind + '"';
      var close = rail ? ' data-rail-x="' + esc(item.id) + '"' : ' data-resource="close" data-kind="' + kind + '"';
      return '<div class="resource-tab' + (active === item.id ? ' is-active' : '') + '"><button type="button" role="tab" aria-selected="' + (active === item.id) + '" data-id="' + esc(item.id) + '"' + select + ' title="' + esc(item.name) + '">' + (item.iconMarkup || icon(itemKind === 'session' ? 'messages-square' : 'file-text')) + '<span>' + esc(item.name) + '</span></button><button type="button" class="resource-icon" data-id="' + esc(item.id) + '"' + close + ' aria-label="' + esc(tr('关闭 ', 'Close ') + item.name) + '">' + icon('x') + '</button></div>';
    }).join('');
  }
  function shell(kind, left, body, options) {
    var d = dock(kind), workspace = options && options.workspace;
    return '<div data-kind="' + kind + '" style="--resource-list-width:' + (d.width || (kind === 'session' ? 300 : 260)) + 'px" class="resource-split' + (workspace ? ' is-task' : '') + (d.max ? ' is-max' : '') + '"><section class="' + (workspace ? 'resource-workspace' : 'resource-list') + '" aria-label="' + (workspace ? tr('新任务', 'New task') : tr('资源列表', 'Resource list')) + '">' + left + '</section><aside class="resource-panel" aria-label="' + tr('详情侧边栏', 'Detail panel') + '"><header class="resource-panel-head"><div class="resource-tabs" role="tablist" aria-label="' + tr('打开的详情', 'Open details') + '">' + tabsMarkup(kind, d.items, d.active) + '</div><div class="resource-panel-actions"><button type="button" class="ws-btn resource-panel-control" data-resource="maximize" data-kind="' + kind + '" aria-pressed="' + d.max + '" aria-label="' + (d.max ? tr('最小化侧边栏', 'Restore panel') : tr('最大化侧边栏', 'Maximize panel')) + '">' + panelIcon(true, d.max) + '</button><button type="button" class="ws-btn resource-panel-control" data-resource="dismiss" data-kind="' + kind + '" aria-label="' + tr('关闭侧边栏', 'Close panel') + '">' + panelIcon(false) + '</button></div></header><div class="resource-panel-body" role="tabpanel">' + body + '</div></aside></div>';
  }
  document.addEventListener('click', function (e) {
    var target = e.target.closest('[data-resource]');
    if (target) {
      e.preventDefault(); e.stopImmediatePropagation(); var kind = target.dataset.kind, d = dock(kind), id = target.dataset.id;
      if (target.dataset.resource === 'maximize') d.max = !d.max;
      else if (target.dataset.resource === 'select') { d.active = id; host.select(kind, id); }
      else if (target.dataset.resource === 'dismiss') { d.items = []; d.active = null; d.max = false; host.select(kind, null); }
      else { var i = d.items.findIndex(function (x) { return x.id === id; }); d.items = d.items.filter(function (x) { return x.id !== id; }); if (d.active === id) { d.active = d.items[Math.min(i, d.items.length - 1)] ? d.items[Math.min(i, d.items.length - 1)].id : null; if (!d.active) d.max = false; host.select(kind, d.active); } }
      host.render(); return;
    }
    var button = e.target.closest('[data-scope-trigger]');
    if (button) { e.preventDefault(); e.stopImmediatePropagation(); if (scopeOpen) closeScope(); else { scopeOpen = true; paintScope(); } return; }
    if (e.target.closest('[data-scope-clear]')) { selected = []; updateScope(); return; }
    if (!e.target.closest('#globalScopePanel')) closeScope();
  });
  document.addEventListener('change', function (e) {
    var leaf = e.target.closest('[data-scope-leaf]'); if (!leaf || allIds().indexOf(leaf.dataset.scopeLeaf) < 0) return;
    e.stopImmediatePropagation();
    selected = selected.filter(function (id) { return id !== leaf.dataset.scopeLeaf; }); if (e.target.checked) selected.push(leaf.dataset.scopeLeaf); updateScope('[data-scope-leaf="' + leaf.dataset.scopeLeaf + '"]');
  });
  document.addEventListener('keydown', function (e) {
    var tab = e.target.closest('.resource-tab [role="tab"]');
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) >= 0) {
      e.preventDefault(); var tabs = Array.from(tab.closest('.resource-tabs').querySelectorAll('[role="tab"]')), i = tabs.indexOf(tab);
      var next = e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[tabs.length - 1] : tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      var id = next.dataset.id; next.click(); var focus = document.querySelector('.resource-tab [role="tab"][data-id="' + id + '"]'); if (focus) focus.focus(); return;
    }
    if (e.key === 'Escape' && scopeOpen) { e.preventDefault(); closeScope(true); } });
  window.addEventListener('resize', function () { fitListControls(); paintScope(); });
  global.AIOpsResources = { configure: function (next) { host = next; }, active: function (kind) { return dock(kind).active; }, rememberView: rememberView, restoreView: restoreView, tabsMarkup: tabsMarkup, scopeTrigger: trigger, scopeCatalog: catalog, sceneChoices: sceneChoices, sceneMenuMarkup: sceneMenuMarkup, closeScope: closeScope, scopeHasAgent: hasAgent, sceneId: function () { return activeScene; }, sceneLabel: sceneLabel, selectScene: selectScene, selectScopes: selectScopes, scopeOptionsMarkup: scopeOptionsMarkup, scopeIds: function () { if (!selected.length) return allIds(); var ids = selected.slice(); catalog().forEach(function (s) { if (s.items.some(function (x) { return x.type !== 'Agent' && selected.indexOf(x.id) >= 0; })) s.items.filter(function (x) { return x.type === 'Agent'; }).forEach(function (x) { if (ids.indexOf(x.id) < 0) ids.push(x.id); }); }); return ids; }, scopeSelected: function () { return selected.slice(); }, scopeHasScene: hasScene, afterRender: function () { fitListControls(); paintScope(); }, open: open, shell: shell, columnLayout: function (kind) { var d = dock(kind); return { width: d.width || (kind === 'session' ? 300 : 260), min: d.minWidth || (kind === 'session' ? 300 : 260) }; }, resizeColumn: function (kind, width, remember) { var d = dock(kind); d.width = width; if (remember) d.userWidth = width; }, remove: function (kind, id) { var d = dock(kind); d.items = d.items.filter(function (x) { return x.id !== id; }); if (d.active === id) { d.active = d.items.length ? d.items[d.items.length - 1].id : null; host.select(kind, d.active); } }, dismiss: function (kind) { var d = dock(kind); d.items = []; d.active = null; d.max = false; } };
})(window);
