/* Directory launchers select resources before opening the current chat's tabs. */
(function (global) {
  'use strict';
  var host, picker;
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tr(zh, en) { return host.lang() === 'en' ? en : zh; }
  function icon(name) { return '<i data-lucide="' + name + '" aria-hidden="true"></i>'; }
  function close(restore) {
    if (!picker) return;
    closeScope(); if (host.closeDate) host.closeDate();
    var previous = picker.trigger, kind = picker.kind;
    picker.overlay.remove(); picker = null;
    document.querySelector('.aiops-app').inert = false;
    if (restore) {
      if (!previous || !previous.isConnected) previous = document.querySelector('[data-rail-section="' + kind + '"]');
      if (previous) previous.focus({ preventScroll: true });
    }
  }
  function matches() {
    var query = picker.query.toLowerCase();
    return picker.items.filter(function (row) {
      return (!query || [row.name, row.id, row.meta, row.folder, row.agent, row.user, row.path].join(' ').toLowerCase().indexOf(query) >= 0) &&
        (picker.kind !== 'ses' || ((!picker.range || row.time.slice(0,10) >= picker.range.start && row.time.slice(0,10) <= picker.range.end) && (!picker.scope.length || picker.scope.some(function (id) { return id.indexOf(host.sceneForSession(row) + ':') === 0; }))));
    });
  }
  function scopeLabel() {
    var count = 0;
    global.AIOpsWorkspaces.scopeCatalog().forEach(function (scene) { var selected = scene.items.filter(function (item) { return picker.scope.indexOf(item.id) >= 0; }).length; count += selected === scene.items.length ? 1 : selected; });
    return count ? tr('已选 ' + count + ' 项', count + ' selected') : tr('全部范围', 'All scopes');
  }
  function scopeControl() { return '<button type="button" class="ov-scope" data-picker-scope-open aria-label="' + tr('筛选范围', 'Filter scope') + '" aria-haspopup="dialog" aria-expanded="false"><span>' + scopeLabel() + '</span>' + icon('chevron-down') + '</button>'; }
  function closeScope(restore) {
    if (!picker) return;
    var panel = picker.overlay.querySelector('#railPickerScopePanel'); if (panel) panel.remove();
    var trigger = picker.overlay.querySelector('[data-picker-scope-open]'); if (trigger) { trigger.setAttribute('aria-expanded', 'false'); if (restore) trigger.focus({ preventScroll: true }); }
  }
  function paintScope(focus) {
    closeScope();
    var trigger = picker.overlay.querySelector('[data-picker-scope-open]'); trigger.setAttribute('aria-expanded', 'true');
    var html = global.AIOpsWorkspaces.scopePickerMarkup(picker.scope, picker.scene).replace('id="wsScopePanel"', 'id="railPickerScopePanel"').replace(/data-wsn-scene/g, 'data-picker-scope-parent').replace(/data-wsn-scope/g, 'data-picker-scope-leaf').replace(/data-wsn="scene"/g, 'data-picker-scope-scene');
    picker.overlay.insertAdjacentHTML('beforeend', html);
    var panel = picker.overlay.querySelector('#railPickerScopePanel'); panel.classList.add('global-scope-panel'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', tr('选择场景、Agent 或本体', 'Choose scenarios, agents or ontology'));
    panel.insertAdjacentHTML('afterbegin', '<header class="global-scope-head"><strong>' + tr('筛选范围', 'Filter scope') + '</strong><button type="button" data-picker-scope-clear' + (!picker.scope.length ? ' disabled' : '') + '>' + tr('清空', 'Clear') + '</button></header>');
    global.AIOpsWorkspaces.scopeCatalog().forEach(function (scene) { var count = scene.items.filter(function (item) { return picker.scope.indexOf(item.id) >= 0; }).length; panel.querySelector('[data-picker-scope-parent="' + scene.id + '"]').indeterminate = count > 0 && count < scene.items.length; });
    var rect = trigger.getBoundingClientRect(); panel.style.width = Math.min(460, global.innerWidth - 24) + 'px'; panel.style.left = Math.max(12, Math.min(rect.right - panel.offsetWidth, global.innerWidth - panel.offsetWidth - 12)) + 'px';
    var below = global.innerHeight - rect.bottom - 20, above = rect.top - 20, up = below < 200 && above > below;
    panel.style.maxHeight = Math.max(120, Math.min(330, up ? above : below)) + 'px'; panel.style.top = (up ? Math.max(12, rect.top - panel.offsetHeight - 8) : rect.bottom + 8) + 'px';
    host.icons(); var target = focus && panel.querySelector(focus); if (target) target.focus({ preventScroll: true });
  }
  function updateControls() {
    var date = picker.overlay.querySelector('[data-picker-date-control]'); if (date) date.innerHTML = host.dateControl();
    var scope = picker.overlay.querySelector('[data-picker-scope-open]'); if (scope) scope.querySelector('span').textContent = scopeLabel();
  }
  function applyDateRange(range) { if (!picker || picker.kind !== 'ses') return; picker.range = range; paint(); var trigger = picker.overlay.querySelector('[data-session-date-open]'); if (trigger) trigger.focus({ preventScroll: true }); }
  function checkbox(attributes, label) { return '<span class="cap-check rail-picker-check"><input type="checkbox" ' + attributes + (label ? ' aria-label="' + esc(label) + '"' : '') + '></span>'; }
  function rowHtml(row) {
    var mark = picker.kind === 'ses' ? icon('messages-square') : global.AIOpsContext.icon({ kind: 'artifact', name: row.name, type: row.type });
    var time = row.time || row.updatedAt || '';
    return '<li class="rail-picker-item"><label>' + checkbox('data-picker-item="' + esc(row.id) + '"', row.name + ' · ' + row.id.replace(/^(ses|art):/, '')) + '<span class="rail-picker-icon">' + mark + '</span><span class="rail-picker-copy"><strong title="' + esc(row.name) + '">' + esc(row.name) + '</strong>'  + '</span><span class="rail-picker-row-meta">' + (picker.kind === 'ses' ? '<time>' + esc(time) + '</time>' : '') + (host.opened().indexOf(row.id) >= 0 ? '<span class="rail-picker-opened">' + tr('已打开', 'Open') + '</span>' : '') + '</span></label></li>';
  }
  function treeHtml(rows) {
    var tree = { children: Object.create(null), rows: [] };
    rows.forEach(function (row) {
      var branch = tree;
      [row.folder || tr('默认工作区', 'Default workspace')].forEach(function (name) {
        branch = branch.children[name] || (branch.children[name] = { children: Object.create(null), rows: [] });
      });
      branch.rows.push(row);
    });
    function render(node, path) {
      return Object.keys(node.children).map(function (name) {
        var branch = node.children[name], key = path + '/' + name, index = picker.groups.length;
        function collect(current) { return Object.keys(current.children).reduce(function (rows, key) { return rows.concat(collect(current.children[key])); }, current.rows.slice()); }
        var groupRows = collect(branch); picker.groups.push(groupRows);
        var collapsed = !!picker.closed[key];
        return '<li class="rail-picker-folder"><div class="rail-picker-folder-head"><button type="button" class="rail-picker-folder-toggle" data-picker-folder="' + esc(key) + '" aria-label="' + esc(tr('展开或收起文件夹：', 'Expand or collapse folder: ') + name) + '" aria-expanded="' + !collapsed + '">' + icon('chevron-down') + '</button><label>' + checkbox('data-picker-group="' + index + '"', tr('选择文件夹：', 'Select folder: ') + name) + '<span class="rail-picker-icon">' + icon('folder') + '</span><span class="rail-picker-copy">' + esc(name) + '</span></label></div><ul' + (collapsed ? ' hidden' : '') + '>' + render(branch, key) + branch.rows.map(rowHtml).join('') + '</ul></li>';
      }).join('');
    }
    return render(tree, '');
  }
  function refreshSelection() {
    var count = Object.keys(picker.selected).length;
    picker.overlay.querySelector('[role="status"]').textContent = tr('已选 ' + count + ' 项', count + ' selected');
    picker.overlay.querySelector('[data-picker-confirm]').disabled = !count;
    var all = picker.overlay.querySelector('[data-picker-all]');
    if (all) {
      var visible = matches(), picked = visible.filter(function (row) { return picker.selected[row.id]; }).length;
      all.checked = !!visible.length && picked === visible.length;
      all.indeterminate = picked > 0 && picked < visible.length;
      global.AIOpsSelectionLimit.sync(all, count, picker.kind, all.closest('label'));
      if (!visible.length) { all.disabled = true; all.closest('label').removeAttribute('data-selection-limit'); all.closest('label').setAttribute('aria-disabled', 'true'); }
    }
    picker.overlay.querySelectorAll('[data-picker-item]').forEach(function (input) { input.checked = !!picker.selected[input.dataset.pickerItem]; global.AIOpsSelectionLimit.sync(input, count, picker.kind, input.closest('label')); });
    picker.overlay.querySelectorAll('[data-picker-group]').forEach(function (input) {
      var rows = picker.groups[Number(input.dataset.pickerGroup)];
      var selected = rows.filter(function (row) { return picker.selected[row.id]; }).length;
      input.checked = !!rows.length && selected === rows.length; input.indeterminate = selected > 0 && selected < rows.length; global.AIOpsSelectionLimit.sync(input, count, picker.kind, input.closest('label')); if (!rows.length) input.disabled = true;
    });
  }
  function paint() {
    var rows = matches(); picker.groups = [];
    picker.overlay.querySelector('.rail-picker-list').innerHTML = rows.length ? (picker.kind === 'ses' ? rows.map(rowHtml).join('') : treeHtml(rows)) : '<li class="rail-picker-empty">' + icon('search-x') + '<strong>' + tr('没有匹配的内容', 'No matching resources') + '</strong><span>' + tr('试试其他关键词或筛选条件', 'Try another keyword or filter') + '</span></li>';
    refreshSelection(); updateControls(); host.icons();
  }
  function selectionRows() {
    // The tree groups files by workspace; select in that same display order.
    return picker.kind === 'art' ? picker.groups.reduce(function (rows, group) { return rows.concat(group); }, []) : matches();
  }
  function selectRows(rows, checked) {
    var selected = global.AIOpsSelectionLimit.select(Object.keys(picker.selected), rows.map(function (row) { return row.id; }), checked, picker.kind);
    picker.selected = Object.create(null); selected.forEach(function (id) { picker.selected[id] = true; }); refreshSelection();
  }
  function open(kind, trigger, options) {
    options = options || {};
    close();
    var overlay = document.createElement('div'); overlay.className = 'context-picker-overlay rail-picker-overlay';
    picker = { onConfirm: options.onConfirm || host.open, kind: kind, overlay: overlay, trigger: trigger, owner: host.owner(), items: host.items(kind).map(function (row) { return Object.assign({}, row, { path: kind === 'art' ? [row.folder, row.name].filter(Boolean).join(' / ') : '' }); }).sort(function (a, b) { return String(b.time || b.updatedAt || '').localeCompare(String(a.time || a.updatedAt || '')); }), selected: Object.create(null), groups: [], closed: Object.create(null), query: '', range: null, scope: [], scene: 'audit' };
    var title = kind === 'ses' ? tr('选择线上会话', 'Select live sessions') : tr('选择产出物', 'Select artifacts');
    overlay.innerHTML = '<section class="cap-dialog rail-picker' + (kind === 'art' ? ' is-artifact' : '') + '" role="dialog" aria-modal="true" aria-labelledby="railPickerTitle"><header class="cap-dialog-head"><h2 id="railPickerTitle">' + title + '</h2><button type="button" class="cap-icon-btn" data-picker-cancel aria-label="' + tr('关闭选择弹窗', 'Close resource picker') + '">' + icon('x') + '</button></header><div class="rail-picker-controls' + (kind === 'art' ? ' rail-picker-art-controls' : ' rail-picker-session-controls') + '"><div class="search-field rail-picker-search">' + icon('search') + '<input type="search" aria-label="' + tr('搜索资源', 'Search resources') + '" placeholder="' + (kind === 'ses' ? tr('搜索会话名称、ID、用户', 'Search name, ID or user') : tr('搜索文件名称、路径', 'Search file name or path')) + '"></div>' + (kind === 'ses' ? '<span data-picker-date-control>' + host.dateControl() + '</span>' + scopeControl() : '') + '</div>' + '<ul class="rail-picker-list" aria-label="' + (kind === 'ses' ? tr('线上会话列表', 'Live session list') : tr('产出物文件树', 'Artifact file tree')) + '"></ul><footer class="cap-dialog-foot"><div class="rail-picker-selection"><label class="rail-picker-select-all">' + checkbox('data-picker-all', tr('全选', 'Select all')) + '<span>' + tr('全选', 'Select all') + '</span></label><span class="rail-picker-selection-divider" aria-hidden="true"></span><span role="status" aria-live="polite"></span></div><button type="button" class="btn-soft" data-picker-cancel>' + tr('取消', 'Cancel') + '</button><button type="button" class="btn-ink" data-picker-confirm disabled>' + tr('确认', 'Confirm') + '</button></footer></section>';
    document.body.appendChild(overlay); document.querySelector('.aiops-app').inert = true;
    overlay.addEventListener('input', function (event) { if (event.target.type === 'search') { closeScope(); if (host.closeDate) host.closeDate(); picker.query = event.target.value.trim(); picker.closed = Object.create(null); paint(); } });
    overlay.addEventListener('change', function (event) {
      var input = event.target;
      var leaf = input.hasAttribute('data-picker-scope-leaf'), parent = input.hasAttribute('data-picker-scope-parent');
      if (leaf || parent) {
        var ids = leaf ? [input.dataset.pickerScopeLeaf] : global.AIOpsWorkspaces.scopeCatalog().filter(function (scene) { return scene.id === input.dataset.pickerScopeParent; })[0].items.map(function (item) { return item.id; });
        picker.scope = picker.scope.filter(function (id) { return ids.indexOf(id) < 0; }); if (input.checked) picker.scope = picker.scope.concat(ids);
        var selector = leaf ? '[data-picker-scope-leaf="' + input.dataset.pickerScopeLeaf + '"]' : '[data-picker-scope-parent="' + input.dataset.pickerScopeParent + '"]'; paint(); paintScope(selector); return;
      }
      if (input.hasAttribute('data-picker-all')) selectRows(selectionRows(), input.checked);
      else if (input.hasAttribute('data-picker-item')) selectRows(picker.items.filter(function (row) { return row.id === input.dataset.pickerItem; }), input.checked);
      else if (input.hasAttribute('data-picker-group')) selectRows(picker.groups[Number(input.dataset.pickerGroup)], input.checked);
    });
    overlay.addEventListener('click', function (event) {
      if (event.target.closest('.session-date-picker, [data-session-date-open]')) { closeScope(); return; }
      event.stopPropagation();
      if (event.target.closest('.session-date-inline-clear')) { if (host.closeDate) host.closeDate(); applyDateRange(null); return; }
      if (host.closeDate) host.closeDate();
      if (event.target.closest('[data-picker-scope-open]')) { if (picker.overlay.querySelector('#railPickerScopePanel')) closeScope(true); else paintScope(); return; }
      if (event.target.closest('[data-picker-scope-clear]')) { picker.scope = []; paint(); paintScope('[data-picker-scope-clear]'); return; }
      var scene = event.target.closest('[data-picker-scope-scene]'); if (scene) { picker.scene = scene.dataset.id; paintScope(); return; }
      if (event.target.closest('#railPickerScopePanel')) return;
      closeScope();
      if (event.target === overlay || event.target.closest('[data-picker-cancel]')) { close(true); return; }
      var folder = event.target.closest('[data-picker-folder]');
      if (folder) { var key = folder.dataset.pickerFolder, list = folder.closest('li').querySelector('ul'); picker.closed[key] = !picker.closed[key]; folder.setAttribute('aria-expanded', String(!picker.closed[key])); list.hidden = picker.closed[key]; return; }
      if (event.target.closest('[data-picker-confirm]')) { var ids = picker.items.filter(function (row) { return picker.selected[row.id]; }).map(function (row) { return row.id; }), owner = picker.owner, onConfirm = picker.onConfirm; close(); onConfirm(ids, owner); }
    });
    overlay.addEventListener('keydown', function (event) {
      var datePanel = picker.overlay.querySelector('#sessionDatePicker'), scopePanel = picker.overlay.querySelector('#railPickerScopePanel');
      if (datePanel && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); host.closeDate(true); return; }
      if (scopePanel && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeScope(true); return; }
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(true); }
      else if (event.key === 'Tab') {
        var nodes = Array.from(overlay.querySelectorAll('button,input')).filter(function (node) { return !node.disabled && node.getClientRects().length; }), first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }, true);
    overlay.addEventListener('scroll', function (event) { if (picker && !event.target.closest('#railPickerScopePanel')) closeScope(); }, true);
    paint(); overlay.querySelector('input[type="search"]').focus();
  }
  global.addEventListener('resize', function () { closeScope(); });
  global.AIOpsRailPicker = { configure: function (options) { host = options; }, open: open, close: close, dateRange: function () { return picker && picker.range; }, applyDateRange: applyDateRange };
})(window);
