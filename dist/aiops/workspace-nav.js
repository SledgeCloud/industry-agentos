/* Workspace sidebar, menus, and forms; uses the Workbench modal primitives. */
(function (global) {
  'use strict';
  var host, spaces = [], menu = null, dialog = null, returnFocus = null, serial = 0;
  var applications = [
    { id: 'app-audit', name: '审核管理' },
    { id: 'app-analysis', name: '运营分析' }
  ];
  var scopes = [
    { id: 'audit', name: '关联审核', parentId: 'app-audit', agents: ['关联审核智能体', '规则核验 Agent'], objects: ['核验项', '规则变更记录', '审核报告'] },
    { id: 'manufacturing', name: '制造业规则审核', parentId: 'app-audit', agents: ['制造业规则审核 Agent', '规则优化 Agent'], objects: ['制造业规则', '审核会话', '规则优化建议'] },
    { id: 'cost', name: '成本与性能分析', parentId: 'app-analysis', agents: ['成本分析 Agent', '性能分析 Agent'], objects: ['模型调用记录', '成本与性能日报', '会话指标'] }
  ];
  function scopeCatalog() {
    return scopes.map(function (s) { return { id: s.id, name: s.name, kind: 'business', parentId: s.parentId, items: ['agents', 'objects'].reduce(function (all, kind) {
      return all.concat(s[kind].map(function (name, i) { return { id: s.id + ':' + kind + ':' + i, name: name, type: kind === 'agents' ? 'Agent' : '本体对象集' }; }));
    }, []) }; });
  }
  function sceneTree() {
    var business = scopeCatalog();
    return applications.map(function (app) { return { id: app.id, name: app.name, kind: 'application', children: business.filter(function (s) { return s.parentId === app.id; }) }; });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function text(zh, en) { return host.lang() === 'en' ? en : zh; }
  function icon(name) { return '<i data-lucide="' + name + '" aria-hidden="true"></i>'; }
  function space(id) { return spaces.filter(function (w) { return w.id === id; })[0]; }
  function child(id) {
    var found = null;
    spaces.forEach(function (w) { w.items.forEach(function (c) { if (c.id === id) found = { workspace: w, item: c }; }); });
    return found;
  }
  function label(c) { return c.label || host.t(c.id); }
  function displayLabel(c) { return c.kind === 'schedule' && host.scheduleLabel ? host.scheduleLabel(c) || label(c) : label(c); }
  function scopeItems() {
    var out = [];
    scopes.forEach(function (s) {
      ['agents', 'objects'].forEach(function (kind) {
        s[kind].forEach(function (name, i) { out.push({ id: s.id + ':' + kind + ':' + i, name: name, scene: s.name }); });
      });
    });
    return out;
  }
  function scopeItem(id) { return scopeItems().filter(function (s) { return s.id === id; })[0]; }
  function refresh() { host.render(); }
  function actionButton(action, id, title, glyph) {
    return '<button type="button" class="ws-nav-action" data-wsn="' + action + '" data-id="' + esc(id) + '" aria-label="' + esc(title) + '" title="' + esc(title) + '"' + (action.indexOf('menu') >= 0 ? ' aria-haspopup="menu" aria-expanded="false"' : '') + '>' + icon(glyph) + '</button>';
  }
  function childRow(c) {
    var active = host.page() === c.id;
    var name = displayLabel(c);
    return '<div class="ws-nav-row is-child-row"><button type="button" class="aiops-nav-item is-child' + (active ? ' is-active' : '') + '" data-page="' + esc(c.id) + '" title="' + esc(name) + '"' + (active ? ' aria-current="page"' : '') + '><span class="aiops-nav-label">' + esc(name) + '</span>' +
      (c.kind === 'schedule' ? '<span class="ws-nav-clock" title="' + text('定时任务', 'Schedule') + '">' + icon('clock') + '</span>' : '') + '</button><div class="ws-nav-actions">' + actionButton('task-menu', c.id, text('任务更多操作：', 'Task actions: ') + name, 'ellipsis') + '</div></div>';
  }
  function markup() {
    return spaces.map(function (w) {
      return '<div class="ws-nav-row is-folder-row"><button type="button" class="aiops-nav-item is-folder' + (w.open ? ' is-open' : '') + '" data-wsn="toggle" data-id="' + esc(w.id) + '" aria-expanded="' + w.open + '" title="' + esc(w.name) + '"><span class="ico">' + icon(w.open ? 'folder-open' : 'folder-closed') + '</span><span class="aiops-nav-label">' + esc(host.t(w.name)) + '</span></button><div class="ws-nav-actions">' + actionButton('new-task', w.id, text('新任务', 'New task'), 'square-pen') + actionButton('workspace-menu', w.id, text('工作区更多操作：', 'Workspace actions: ') + host.t(w.name), 'ellipsis') + '</div></div>' +
        (w.open ? (w.items.length ? w.items.map(childRow).join('') : '<div class="aiops-nav-empty">' + esc(host.t('暂无任务')) + '</div>') : w.items.filter(function (c) { return c.id === host.page(); }).map(childRow).join(''));
    }).join('');
  }
  function closeMenu() {
    if (menu && menu.anchor && menu.anchor.isConnected) menu.anchor.setAttribute('aria-expanded', 'false');
    var el = document.getElementById('wsNavMenu');
    if (el) el.remove();
    menu = null;
  }
  function openMenu(button, kind, id) {
    if (menu && menu.id === id && menu.kind === kind) { closeMenu(); return; }
    closeMenu();
    host.closeMenus();
    menu = { id: id, kind: kind, anchor: button };
    button.setAttribute('aria-expanded', 'true');
    var el = document.createElement('div');
    el.id = 'wsNavMenu'; el.className = 'ws-nav-menu'; el.setAttribute('role', 'menu');
    el.innerHTML = '<button type="button" role="menuitem" data-wsn="' + (kind === 'workspace' ? 'edit-workspace' : 'rename-task') + '" data-id="' + esc(id) + '">' + icon('pencil') + esc(kind === 'workspace' ? text('编辑', 'Edit') : text('重命名', 'Rename')) + '</button><button type="button" role="menuitem" class="is-danger" data-wsn="ask-delete-' + kind + '" data-id="' + esc(id) + '">' + icon('trash-2') + esc(text('删除', 'Delete')) + '</button>';
    document.body.appendChild(el);
    var r = button.getBoundingClientRect();
    var width = 156;
    el.style.left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)) + 'px';
    el.style.top = Math.min(r.bottom + 5, window.innerHeight - el.offsetHeight - 8) + 'px';
    host.icons();
    el.querySelector('button').focus({ preventScroll: true });
  }
  function closeDialog() {
    var root = document.getElementById('wsNavDialog');
    if (root) root.remove();
    dialog = null;
    if (returnFocus && returnFocus.isConnected) returnFocus.focus();
    returnFocus = null;
  }
  function openDialog(kind, id) {
    returnFocus = menu ? menu.anchor : document.activeElement;
    closeMenu();
    host.closeMenus();
    var w = space(id), c = child(id);
    dialog = { kind: kind, id: id, name: kind === 'edit' ? w.name : kind === 'rename' ? label(c.item) : '', scope: kind === 'edit' ? w.scope.slice() : [], scene: scopes[0].id, picker: false };
    renderDialog();
    var input = document.getElementById('wsNavName');
    if (input) { input.focus(); input.select(); }
    else document.querySelector('#wsNavDialog [data-wsn="cancel"]').focus();
  }
  function sceneIds(scene) {
    var ids = [];
    ['agents', 'objects'].forEach(function (kind) {
      scene[kind].forEach(function (_name, i) { ids.push(scene.id + ':' + kind + ':' + i); });
    });
    return ids;
  }
  function scopeTags() {
    var tags = [];
    scopes.forEach(function (scene) {
      var ids = sceneIds(scene);
      var selected = ids.filter(function (id) { return dialog.scope.indexOf(id) >= 0; });
      if (selected.length === ids.length) tags.push({ id: 'scene:' + scene.id, name: scene.name, title: scene.name });
      else selected.forEach(function (id) {
        var item = scopeItem(id);
        tags.push({ id: id, name: item.name, title: item.scene + ' / ' + item.name });
      });
    });
    return tags;
  }
  function alignPicker() {
    var panel = document.getElementById('wsScopePanel');
    var control = document.querySelector('.ws-scope-control');
    if (!panel || !control || !dialog || !dialog.picker) return;
    var r = control.getBoundingClientRect();
    var below = window.innerHeight - r.bottom - 16;
    var above = r.top - 16;
    var openAbove = below < 260 && above > below;
    var height = Math.max(80, Math.min(260, openAbove ? above : below));
    panel.style.width = Math.min(r.width, window.innerWidth - 24) + 'px';
    panel.style.left = Math.max(12, Math.min(r.left, window.innerWidth - panel.offsetWidth - 12)) + 'px';
    panel.style.maxHeight = height + 'px';
    panel.style.top = (openAbove ? r.top - panel.offsetHeight - 8 : r.bottom + 8) + 'px';
  }
  function pickerMarkup(selection, activeScene) {
    var s = scopes.filter(function (row) { return row.id === activeScene; })[0] || scopes[0];
    return '<div class="ws-scope-panel" id="wsScopePanel"><div class="ws-scope-scenes" role="group" aria-label="' + text('场景', 'Scenarios') + '"><div class="ws-scope-heading">' + text('场景', 'Scenarios') + '</div>' + scopes.map(function (scene) {
      var ids = sceneIds(scene);
      var all = ids.every(function (id) { return selection.indexOf(id) >= 0; });
      return '<div class="ws-scope-scene' + (activeScene === scene.id ? ' is-active' : '') + '"><label class="ws-scope-scene-check ws-scope-check"><input type="checkbox" data-wsn-scene="' + scene.id + '" aria-label="' + esc(text('全选场景：', 'Select scenario: ') + scene.name) + '"' + (all ? ' checked' : '') + '></label><button type="button" data-wsn="scene" data-id="' + scene.id + '" aria-expanded="' + (activeScene === scene.id) + '"><span>' + esc(scene.name) + '</span>' + icon('chevron-right') + '</button></div>';
    }).join('') + '</div><div class="ws-scope-options" role="group" aria-label="' + esc(s.name) + '">' + ['agents', 'objects'].map(function (kind) {
      return '<div class="ws-scope-heading">' + (kind === 'agents' ? 'Agent' : text('本体对象集', 'Ontology object sets')) + '</div>' + s[kind].map(function (name, i) {
        var id = s.id + ':' + kind + ':' + i;
        return '<label class="ws-scope-option ws-scope-check"><input type="checkbox" data-wsn-scope="' + id + '"' + (selection.indexOf(id) >= 0 ? ' checked' : '') + '><span>' + esc(name) + '</span></label>';
      }).join('');
    }).join('') + '</div></div>';
  }
  function pickerHtml() { return pickerMarkup(dialog.scope, dialog.scene); }
  function renderPicker() {
    var wrap = document.getElementById('wsScope');
    if (!wrap) return;
    var oldPanel = document.getElementById('wsScopePanel');
    if (oldPanel) oldPanel.remove();
    wrap.innerHTML = '<div class="ws-scope-control' + (dialog.picker ? ' is-open' : '') + '" data-wsn="picker"><div class="ws-scope-tags">' + scopeTags().map(function (item) {
      return '<span class="ws-scope-tag" title="' + esc(item.title) + '"><span>' + esc(item.name) + '</span><button type="button" data-wsn="remove-scope" data-id="' + item.id + '" aria-label="' + esc(text('移除 ', 'Remove ') + item.name) + '">' + icon('x') + '</button></span>';
    }).join('') + '<button type="button" class="ws-scope-trigger" data-wsn="picker" aria-label="' + text('选择工作区范围', 'Select workspace scope') + '" aria-expanded="' + dialog.picker + '" aria-controls="wsScopePanel">' + (dialog.scope.length ? text('添加范围', 'Add scope') : text('请选择场景、Agent 或本体对象集', 'Choose scenarios, agents, or ontology object sets')) + '</button></div><button type="button" class="ws-scope-arrow" data-wsn="picker" aria-label="' + text('展开工作区范围', 'Expand scope') + '" aria-expanded="' + dialog.picker + '">' + icon('chevron-down') + '</button></div>';
    if (dialog.picker) {
      document.getElementById('wsNavDialog').insertAdjacentHTML('beforeend', pickerHtml());
      scopes.forEach(function (scene) {
        var count = sceneIds(scene).filter(function (id) { return dialog.scope.indexOf(id) >= 0; }).length;
        document.querySelector('[data-wsn-scene="' + scene.id + '"]').indeterminate = count > 0 && count < sceneIds(scene).length;
      });
    }
    host.icons();
    alignPicker();
    requestAnimationFrame(alignPicker);
  }
  function renderDialog() {
    var old = document.getElementById('wsNavDialog'); if (old) old.remove();
    var deleting = dialog.kind.indexOf('delete-') === 0;
    var isWorkspace = dialog.kind === 'create' || dialog.kind === 'edit';
    var w = space(dialog.id), c = child(dialog.id);
    var title = dialog.kind === 'create' ? text('新建工作区', 'New workspace') : dialog.kind === 'edit' ? text('编辑工作区', 'Edit workspace') : dialog.kind === 'rename' ? text('重命名任务', 'Rename task') : dialog.kind === 'delete-workspace' ? text('删除工作区', 'Delete workspace') : text('删除任务', 'Delete task');
    var root = document.createElement('div'); root.id = 'wsNavDialog'; root.className = 'sm is-open ws-nav-modal'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'wsNavTitle');
    var body;
    if (deleting) {
      var name = dialog.kind === 'delete-workspace' ? host.t(w.name) : label(c.item);
      body = '<p class="ws-delete-copy">' + esc(text('确定删除“', 'Delete “') + name + text('”？', '”?')) + '</p><p class="ws-delete-note">' + (dialog.kind === 'delete-workspace' ? esc(text('工作区中的任务和产出物将移至“', 'Tasks and artifacts will move to “') + destination(w.id).name + text('”，内容会保留。', '” and remain available.')) : esc(text('删除后，该任务将从列表中移除，已有产出物会保留。', 'The task will be removed. Existing artifacts will be kept.'))) + '</p>';
    } else {
      body = '<label class="sm-label" for="wsNavName">' + (isWorkspace ? text('工作区名称', 'Workspace name') : text('任务名称', 'Task name')) + '<span class="sm-req">*</span></label><div class="sm-input"><input id="wsNavName" name="name" maxlength="50" autocomplete="off" value="' + esc(dialog.name) + '" placeholder="' + (isWorkspace ? text('请输入工作区名称', 'Enter workspace name') : text('请输入任务名称', 'Enter task name')) + '" required aria-describedby="wsNavError"></div>' +
        (isWorkspace ? '<div class="ws-scope-field"><div class="sm-label" id="wsScopeLabel">' + text('工作区范围', 'Workspace scope') + '<span class="sm-req">*</span></div><div id="wsScope" class="ws-scope" role="group" aria-labelledby="wsScopeLabel"></div></div>' : '') + '<p class="ws-form-error" id="wsNavError" role="alert" hidden></p>';
    }
    root.innerHTML = '<div class="sm-backdrop" data-wsn="cancel"></div><section class="sm-dialog' + (!isWorkspace ? ' is-compact' : '') + '"><header class="sm-head"><h2 class="sm-title" id="wsNavTitle">' + esc(title) + '</h2><button type="button" class="sm-close" data-wsn="cancel" aria-label="' + text('关闭', 'Close') + '">' + icon('x') + '</button></header><form id="wsNavForm"><div class="sm-body">' + body + '</div><footer class="sm-foot"><div class="sm-actions"><button type="button" class="sm-btn sm-btn-ghost" data-wsn="cancel">' + text('取消', 'Cancel') + '</button><button type="submit" data-wsn="save" class="sm-btn sm-btn-primary' + (deleting ? ' is-danger' : '') + '">' + (deleting ? text('删除', 'Delete') : dialog.kind === 'create' ? text('创建', 'Create') : text('保存', 'Save')) + '</button></div></footer></form></section>';
    document.body.appendChild(root);
    if (isWorkspace) renderPicker();
    host.icons();
  }
  function destination(id) {
    return spaces.filter(function (w) { return w.id === 'default' && w.id !== id; })[0] || spaces.filter(function (w) { return w.id !== id; })[0] || { id: 'default', name: '默认工作区', scope: [], items: [], open: true };
  }
  function clearError() {
    var el = document.getElementById('wsNavError'); if (el) el.hidden = true;
    var name = document.getElementById('wsNavName'); if (name) name.removeAttribute('aria-invalid');
  }
  function error(message, isScope) {
    var el = document.getElementById('wsNavError'); el.textContent = message; el.hidden = false;
    if (!isScope) document.getElementById('wsNavName').setAttribute('aria-invalid', 'true');
  }
  function save() {
    var kind = dialog.kind, w = space(dialog.id), c = child(dialog.id);
    if (kind.indexOf('delete-') !== 0) {
      var name = document.getElementById('wsNavName').value.trim();
      if (!name) { error(text('请填写名称。', 'Enter a name.')); document.getElementById('wsNavName').focus(); return; }
      if ((kind === 'create' || kind === 'edit') && spaces.some(function (row) { return row.id !== dialog.id && row.name === name; })) { error(text('工作区名称已存在，请使用其他名称。', 'A workspace with this name exists.')); return; }
      if (kind === 'rename' && spaces.some(function (row) { return row.items.some(function (item) { return item.id !== c.item.id && label(item) === name; }); })) { error(text('任务名称已存在，请使用其他名称。', 'A task with this name exists.')); return; }
      if ((kind === 'create' || kind === 'edit') && !dialog.scope.length) { error(text('请至少选择一个 Agent 或本体对象集。', 'Select at least one agent or object set.'), true); return; }
      if (kind === 'create') {
        serial += 1;
        var created = { id: 'workspace-' + Date.now() + '-' + serial, name: name, scope: dialog.scope.slice(), items: [], open: true };
        spaces.push(created);
        if (dialog.selectAfterCreate) host.pickWorkspace(created.id);
      }
      if (kind === 'edit') { host.moveWorkspace(w.name, name); w.name = name; w.scope = dialog.scope.slice(); }
      if (kind === 'rename') { host.renameTask(c.item, name); c.item.label = name; }
    } else if (kind === 'delete-workspace') {
      var target = destination(w.id);
      if (!space(target.id)) spaces.push(target);
      target.items = target.items.concat(w.items); target.open = true;
      host.moveWorkspace(w.name, target.name);
      spaces = spaces.filter(function (row) { return row !== w; });
      if (host.currentWorkspace() === w.id) host.pickWorkspace(target.id);
    } else {
      host.deleteTask(c.item);
      c.workspace.items = c.workspace.items.filter(function (item) { return item !== c.item; });
      if (host.page() === c.item.id) host.goHome();
    }
    closeDialog(); refresh(); host.toast(text('已保存', 'Saved'));
  }
  document.addEventListener('input', function (e) { if (e.target.id === 'wsNavName') clearError(); }, true);
  document.addEventListener('submit', function (e) { if (e.target.id !== 'wsNavForm') return; e.preventDefault(); e.stopImmediatePropagation(); save(); }, true);
  document.addEventListener('change', function (e) {
    var id = e.target.getAttribute('data-wsn-scope');
    var sceneId = e.target.getAttribute('data-wsn-scene');
    if ((!id && !sceneId) || !dialog) return;
    e.stopImmediatePropagation();
    clearError();
    if (sceneId) {
      var ids = sceneIds(scopes.filter(function (scene) { return scene.id === sceneId; })[0]);
      dialog.scope = dialog.scope.filter(function (value) { return ids.indexOf(value) < 0; });
      if (e.target.checked) dialog.scope = dialog.scope.concat(ids);
      dialog.scene = sceneId;
    } else if (e.target.checked) {
      if (dialog.scope.indexOf(id) < 0) dialog.scope.push(id);
    } else dialog.scope = dialog.scope.filter(function (v) { return v !== id; });
    renderPicker();
    var selector = sceneId ? '[data-wsn-scene="' + sceneId + '"]' : '[data-wsn-scope="' + id + '"]';
    var box = document.querySelector(selector); if (box) box.focus({ preventScroll: true });
  }, true);
  document.addEventListener('click', function (e) {
    if (!host) return;
    var button = e.target.closest('[data-wsn]');
    if (!button) {
      if (menu && !e.target.closest('#wsNavMenu')) closeMenu();
      if (dialog && dialog.picker && !e.target.closest('#wsScope, #wsScopePanel')) { dialog.picker = false; renderPicker(); }
      return;
    }
    e.preventDefault(); e.stopImmediatePropagation();
    var action = button.getAttribute('data-wsn'), id = button.getAttribute('data-id');
    if (action === 'create') openDialog('create');
    if (action === 'toggle') { space(id).open = !space(id).open; host.renderNav(); }
    if (action === 'new-task') { closeMenu(); host.pickWorkspace(id); host.newTask(); }
    if (action === 'workspace-menu' || action === 'task-menu') openMenu(button, action === 'workspace-menu' ? 'workspace' : 'task', id);
    if (action === 'edit-workspace') openDialog('edit', id);
    if (action === 'rename-task') openDialog('rename', id);
    if (action === 'ask-delete-workspace') openDialog('delete-workspace', id);
    if (action === 'ask-delete-task') openDialog('delete-task', id);
    if (action === 'cancel') closeDialog();
    if (action === 'save') save();
    if (action === 'picker') { dialog.picker = !dialog.picker; renderPicker(); }
    if (action === 'scene') { dialog.scene = id; renderPicker(); document.querySelector('[data-wsn="scene"][data-id="' + id + '"]').focus(); }
    if (action === 'remove-scope') {
      var scene = scopes.filter(function (row) { return 'scene:' + row.id === id; })[0];
      var removed = scene ? sceneIds(scene) : [id];
      dialog.scope = dialog.scope.filter(function (v) { return removed.indexOf(v) < 0; });
      clearError(); renderPicker(); document.querySelector('.ws-scope-trigger').focus({ preventScroll: true });
    }
  }, true);
  document.addEventListener('keydown', function (e) {
    if (menu) {
      var buttons = Array.from(document.querySelectorAll('#wsNavMenu button'));
      if (e.key === 'Escape') { var anchor = menu.anchor; closeMenu(); anchor.focus(); e.preventDefault(); e.stopImmediatePropagation(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { var next = (buttons.indexOf(document.activeElement) + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length; buttons[next].focus(); e.preventDefault(); }
    }
    if (!dialog) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (dialog.picker) { dialog.picker = false; renderPicker(); document.querySelector('.ws-scope-trigger').focus(); } else closeDialog(); }
    if (e.key === 'Tab') {
      var nodes = Array.from(document.querySelectorAll('#wsNavDialog button, #wsNavDialog input')).filter(function (el) { return !el.disabled && el.getClientRects().length; });
      if (e.shiftKey && document.activeElement === nodes[0]) { nodes[nodes.length - 1].focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === nodes[nodes.length - 1]) { nodes[0].focus(); e.preventDefault(); }
    }
  }, true);
  document.addEventListener('scroll', function (e) { if (menu && !e.target.closest?.('#wsNavMenu')) closeMenu(); }, true);
  document.addEventListener('scroll', alignPicker, true);
  window.addEventListener('resize', function () { closeMenu(); alignPicker(); });
  global.AIOpsWorkspaces = {
    configure: function (next, initial) { host = next; spaces = initial; },
    markup: markup,
    create: function (trigger) { openDialog('create'); dialog.selectAfterCreate = true; if (trigger) returnFocus = trigger; },
    scopeCatalog: scopeCatalog,
    registerEvaluationScenes: function (entries) {
      entries.forEach(function (entry) {
        if (!applications.some(function (app) { return app.id === entry.id; })) applications.push({ id: entry.id, name: entry.name });
        if (!scopes.some(function (scene) { return scene.id === entry.scene.id; })) scopes.push(Object.assign({}, entry.scene, { parentId: entry.id }));
      });
    },
    sceneTree: sceneTree,
    scopePickerMarkup: pickerMarkup,
    names: function () { return spaces.map(function (w) { return w.name; }); },
    defaultName: function () { var w = space('default') || spaces[0]; return w ? w.name : '默认工作区'; },
    children: function () { return spaces.reduce(function (all, w) { return all.concat(w.items); }, []); },
    choices: function () { return spaces.map(function (w) { return { id: w.id, label: host.t(w.name) }; }); },
    name: function (id) { var w = space(id); return w ? host.t(w.name) : ''; },
    pick: function (id) { var w = space(id); if (w) { host.pickWorkspace(id); w.open = true; } },
    addTask: function (id, item) { var w = space(id) || spaces[0]; w.items.unshift(item); w.open = true; },
    taskLabel: function (id) { var c = child(id); return c ? label(c.item) : host.t(id); },
    syncTask: function (task) {
      var c = spaces.reduce(function (found, w) { return found || w.items.filter(function (item) { return item.taskId === task.id || (item.kind === 'schedule' && item.id === task.name); })[0]; }, null);
      var target = spaces.filter(function (w) { return w.name === task.workspace || (w.id === 'audit' && task.workspace === '关账审核智能体'); })[0] || space('default') || spaces[0];
      if (c) {
        c.label = task.name; c.taskId = task.id;
        if (target.items.indexOf(c) >= 0) return;
        spaces.forEach(function (w) { w.items = w.items.filter(function (item) { return item !== c; }); });
      }
      else c = { id: 'schedule:' + task.id, label: task.name, kind: 'schedule', taskId: task.id };
      target.items.push(c);
    },
    removeTask: function (task) { spaces.forEach(function (w) { w.items = w.items.filter(function (item) { return item.taskId !== task.id && !(item.kind === 'schedule' && item.id === task.name); }); }); },
    taskName: function (id) { var c = child(id); return c && c.item.kind === 'schedule' ? c.item.label || c.item.id : id; }
  };
})(window);
