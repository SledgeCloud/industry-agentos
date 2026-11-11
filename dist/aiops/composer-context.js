/* @ references: shared Workplace palette chrome, real local pickers and project data. */
(function (global) {
  'use strict';
  var host = {}, field = null, menu = null, pending = null, actions = [], active = 0;
  var limits = { session: 5, artifact: 5 }, query = '', picker = null, multi = null;
  var documents = Object.create(null), serial = 0;
  var nativePicker = Promise.resolve(false);
  var TYPES = [['agent','Agent','bot'], ['ontology','本体','atom'], ['knowledge','知识库','book-minus'], ['skill','Skill','container'], ['mcp','MCP','tools']];
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function svg(body) { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>'; }
  function icon(name) {
    if (name === 'container') return global.ComposerSlashSkills.icon();
    // Tabler tools: https://github.com/tabler/tabler-icons/blob/main/icons/outline/tools.svg
    if (name === 'tools') return svg('<path d="M3 21h4l13 -13a1.5 1.5 0 0 0 -4 -4l-13 13v4"/><path d="M14.5 5.5l4 4"/><path d="M12 8l-5 -5l-4 4l5 5"/><path d="M7 8l-1.5 1.5"/><path d="M16 12l5 5l-4 4l-5 -5"/><path d="M16 17l-1.5 1.5"/>');
    return '<i data-lucide="' + esc(name) + '" aria-hidden="true"></i>';
  }
  function typeInfo(key) { return TYPES.filter(function (type) { return type[0] === key; })[0] || TYPES[0]; }
  function referenceIcon(ref) {
    if (ref.kind === 'capability') return icon(typeInfo(ref.capabilityType)[2]);
    if (ref.kind === 'local-folder') return icon('folder');
    if (ref.kind !== 'artifact' && ref.kind !== 'local-file') return icon('messages-square');
    var name = ref.name;
    if (ref.kind === 'artifact' && /数据表|Table/.test(ref.type || '')) name += '.xlsx';
    return global.FileTypeIcons ? global.FileTypeIcons.markup(name, 16) : icon('file-text');
  }
  function stamp(item) { return String(item.updatedAt || item.time || ''); }
  function recent(kind) {
    return (kind === 'session' ? host.sessions() : host.artifacts()).slice().sort(function (a, b) { return stamp(b).localeCompare(stamp(a)); });
  }
  function catalog(type) {
    var rows = (global.WorkbenchAtomicCatalog && global.WorkbenchAtomicCatalog[type] || []).slice();
    if (type === 'agent' || type === 'ontology') {
      global.AIOpsWorkspaces.scopeCatalog().forEach(function (scope) {
        scope.items.filter(function (item) { return type === 'agent' ? item.type === 'Agent' : item.type !== 'Agent'; }).forEach(function (item) { rows.unshift({ id: item.id, name: item.name, desc: scope.name }); });
      });
    }
    if (type === 'skill') rows = global.ComposerSlashSkills.skills;
    var seen = {};
    return rows.filter(function (row) { var name = row.name || row.title; if (seen[name]) return false; seen[name] = true; return true; }).map(function (row, index) {
      var name = row.name || row.title;
      return { id: 'cap:' + type + ':' + (row.id || row.slug || index), kind: 'capability', capabilityType: type, name: name, path: 'DJI Innovations / ' + typeInfo(type)[1], description: row.desc || row.role || [row.source, row.chunks, row.sync].filter(Boolean).join(' · ') || name };
    });
  }
  function matches(ref, value) {
    var words = String(value || '').toLowerCase().replace(/\s*\/\s*/g, '/').trim().split(/\s+/).filter(Boolean);
    var text = [ref.name, ref.id, ref.path, ref.description, ref.user, ref.agent, ref.time].join(' ').toLowerCase().replace(/\s*\/\s*/g, '/');
    return words.every(function (word) { return text.indexOf(word) >= 0; });
  }
  function snapshot(trigger) {
    var parts = global.AIOpsComposer.parts(field);
    if (trigger) {
      var prefix = trigger.range.cloneRange(); prefix.selectNodeContents(field); prefix.setEnd(trigger.range.startContainer, trigger.range.startOffset);
      var from = global.AIOpsComposer.textOf(global.AIOpsComposer.parts(prefix.cloneContents())), start = from.length, end = start + trigger.query.length + 1, position = 0;
      parts = parts.map(function (part) {
        var value = global.AIOpsComposer.textOf([part]), next = position + value.length, copy = Object.assign({}, part);
        if (part.type === 'text' && next > start && position < end) copy.text = value.slice(0, Math.max(0, start - position)) + value.slice(Math.max(0, end - position));
        position = next; return copy;
      }).filter(function (part) { return part.type !== 'text' || part.text; });
    }
    return { owner: host.owner(), parts: parts, prompt: global.AIOpsComposer.textOf(parts) };
  }
  function close() {
    if (menu) menu.hidden = true;
    if (multi) multi.reset();
    if (field && menu && field.getAttribute('aria-controls') === menu.id) { field.setAttribute('aria-expanded', 'false'); field.removeAttribute('aria-activedescendant'); }
  }
  function commit(refs, context) {
    refs.forEach(function (ref) { if (ref.kind === 'capability') documents[ref.id] = Object.assign({}, ref); });
    close(); host.attach(refs, context || pending);
  }
  function isDisabled(action) { return !!(action && multi && multi.active() && (action.type === 'file' || action.type === 'capability')); }
  function option(action, name, mark, meta, extraClass) {
    var index = actions.push(action) - 1;
    return '<button type="button" role="option" aria-selected="' + (index === active) + '" class="slash-row context-row ' + (extraClass || '') + (index === active ? ' is-active' : '') + '" id="cui-context-option-' + index + '" data-context-index="' + index + '"' + (isDisabled(action) ? ' disabled aria-disabled="true"' : '') + '>' + (mark ? '<span class="context-row-icon">' + mark + '</span>' : '') + '<span class="slash-row-name">' + esc(name) + '</span>' + (meta ? '<span class="context-row-meta" title="' + esc(meta) + '">' + esc(meta) + '</span>' : '') + '</button>';
  }
  function heading(name) { return '<div class="slash-group context-section-title">' + esc(name) + '</div>'; }
  function paint() {
    if (!menu || menu.hidden) return;
    var top = menu.scrollTop, previousKey = actions[active] && actionKey(actions[active]); actions = [];
    var html = '', addHtml = '';
    if (!query) addHtml += option({ type: 'file' }, '文件和文件夹', icon('paperclip'), '', 'context-add-files');
    TYPES.forEach(function (type) {
      var matched = catalog(type[0]).filter(function (row) { return matches(row, query); });
      if (query && !matched.length && type[1].toLowerCase().indexOf(query.toLowerCase()) < 0) return;
      addHtml += option({ type: 'capability', category: type[0] }, type[1], icon(type[2]), query ? matched.length + ' 项匹配' : '', 'context-capability');
    });
    if (addHtml) html += heading('添加') + addHtml;
    [['session','线上会话'], ['artifact','产出物']].forEach(function (group) {
      var list = recent(group[0]).filter(function (row) { return matches(row, query); });
      if (query && !list.length) return;
      html += heading(group[1]);
      if (!list.length) html += '<div class="slash-empty">暂无匹配' + group[1] + '</div>';
      list.slice(0, limits[group[0]]).forEach(function (row) { html += option({ type: 'reference', ref: row }, row.name, referenceIcon(row), group[0] === 'artifact' ? row.path : row.time); });
      var remaining = Math.max(0, list.length - limits[group[0]]);
      if (group[0] === 'session') html += option({ type: 'session-picker' }, host.lang() === 'en' ? 'Choose from all sessions' : '在全部会话里选择', '', '', 'context-show-more');
      else if (remaining) html += option({ type: 'more', group: group[0] }, (host.lang() === 'en' ? 'Show more ' : '查看更多 ') + remaining, '', '', 'context-show-more');
    });
    if (!html) html = '<div class="slash-empty" role="status">没有匹配的内容</div>';
    if (actions.length) html += global.ComposerSlashSkills.hint();
    menu.innerHTML = html;
    var previousIndex = actions.findIndex(function (action) { return !isDisabled(action) && actionKey(action) === previousKey; });
    active = previousIndex >= 0 ? previousIndex : Math.min(Math.max(0, active), actions.length - 1);
    if (active < 0 || isDisabled(actions[active])) active = actions.findIndex(function (action) { return !isDisabled(action); });
    if (multi) multi.refresh();
    host.icons(); global.AIOpsComposer.position(menu, field, 420); menu.scrollTop = top; highlight(false);
  }
  function highlight(scroll) {
    if (!menu) return;
    menu.querySelectorAll('[data-context-index]').forEach(function (row) { var selected = !row.disabled && Number(row.dataset.contextIndex) === active; row.classList.toggle('is-active', selected); if (row.disabled || !multi || !multi.wants()) row.setAttribute('aria-selected', String(selected)); });
    if (field) { if (active >= 0 && actions.length) field.setAttribute('aria-activedescendant', 'cui-context-option-' + active); else field.removeAttribute('aria-activedescendant'); }
    var selected = menu.querySelector('[data-context-index="' + active + '"]'); if (scroll && selected) selected.scrollIntoView({ block: 'nearest' });
  }
  function show(trigger) {
    if (!field) return;
    var value = trigger ? trigger.query.trim() : '';
    var reset = value !== query || !menu || menu.hidden;
    if (reset) limits = { session: 5, artifact: 5 };
    query = value; pending = snapshot(trigger); active = 0;
    if (!menu) {
      menu = document.createElement('div'); menu.id = 'cui-context-menu'; menu.className = 'slash-menu cui-slash-menu cui-context-menu'; menu.setAttribute('role', 'listbox'); menu.setAttribute('aria-label', '添加引用');
      document.body.appendChild(menu);
      multi = global.ComposerSlashSkills.createMulti({ menu: menu, input: field,
        rows: function () { return Array.from(menu.querySelectorAll('[data-context-index]')).filter(function (element) { return actions[+element.dataset.contextIndex].type === 'reference'; }).map(function (element) { return { element: element, key: actionKey(actions[+element.dataset.contextIndex]) }; }); },
        modeChange: paint,
        activate: function (row, event) { choose(+row.dataset.contextIndex, event); },
        confirm: function (values) { var refs = []; values.forEach(function (value) { refs = refs.concat(value.refs || [value]); }); var unique = new Map(); refs.forEach(function (ref) { unique.set(ref.id, ref); }); commit(Array.from(unique.values()), pending); },
        cancel: function () { multi.reset(); field.focus(); }, position: function () { if (field) global.AIOpsComposer.position(menu, field, 420); }
      });
      menu.addEventListener('mousedown', function (event) { event.preventDefault(); });
      menu.addEventListener('mousemove', function (event) { var row = event.target.closest('[data-context-index]'); if (row && !row.disabled) { active = Number(row.dataset.contextIndex); highlight(false); } });
      menu.addEventListener('click', function (event) { event.stopPropagation(); var row = event.target.closest('[data-context-index]'); if (row) choose(Number(row.dataset.contextIndex), event); });
    }
    menu.hidden = false; field.setAttribute('aria-expanded', 'true'); field.setAttribute('aria-controls', menu.id); if (reset) menu.scrollTop = 0; paint();
  }
  function detect(event) {
    if (!field || event && event.isComposing) return;
    var current = global.AIOpsComposer.trigger(field, '@');
    if (current) show(current); else close();
  }
  function actionKey(action) { return action.type === 'reference' ? action.ref.id : action.type + ':' + (action.category || 'local'); }
  function choose(index, event) {
    var action = actions[index]; if (!action || isDisabled(action)) return;
    if (action.type === 'more') { limits[action.group] += 20; paint(); return; }
    if (action.type === 'reference' && multi && multi.wants(event)) { multi.toggle(actionKey(action), action.ref); return; }
    var context = pending; close();
    if (action.type === 'session-picker') global.AIOpsRailPicker.open('ses', field, {
      onConfirm: function (ids) { commit(host.sessions().filter(function (row) { return ids.indexOf('ses:' + row.id) >= 0; }), context); }
    });
    else if (action.type === 'file') chooseLocal(context);
    else if (action.type === 'capability') openPicker(action.category, context, query);
    else commit([action.ref], context);
  }
  function nativeDocument(item) {
    var ref = { id: 'native:' + item.token, kind: item.kind === 'directory' ? 'local-folder' : 'local-file', name: item.name, path: item.path, size: item.size, mime: item.mime, updatedAt: new Date(item.modified).toISOString() };
    documents[ref.id] = Object.assign({ localURL: '/__local_picker/items/' + item.token }, ref);
    return ref;
  }
  function browserFilePicker(context, onSelect) {
    var input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.hidden = true;
    input.setAttribute('aria-label', '选择本地文件'); document.body.appendChild(input);
    input.addEventListener('cancel', function () { input.remove(); if (onSelect) onSelect([]); });
    input.addEventListener('change', function () {
      var refs = Array.from(input.files || []).map(function (file) {
        var ref = { id: 'local:' + (++serial), kind: 'local-file', name: file.name, path: file.name, size: file.size, mime: file.type, updatedAt: new Date(file.lastModified).toISOString() };
        documents[ref.id] = Object.assign({ file: file }, ref); return ref;
      });
      input.remove(); if (onSelect) onSelect(refs); else if (refs.length) commit(refs, context);
    });
    input.click();
  }
  function chooseLocal(context, onSelect) {
    nativePicker.then(function (available) {
      if (!available) { if (host.toast) host.toast('当前浏览器仅支持选择文件；本地预览选择器支持文件和文件夹混选。'); browserFilePicker(context, onSelect); return; }
      fetch('/__local_picker/pick', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(function (response) {
        if (!response.ok) throw new Error('picker'); return response.json();
      }).then(function (result) { var refs = result.items.map(nativeDocument); if (onSelect) onSelect(refs); else if (refs.length) commit(refs, context); }).catch(function () { if (host.toast) host.toast('无法打开本地选择器，请重试。'); if (onSelect) onSelect([]); });
    });
  }
  function closePicker(restore) {
    if (!picker) return;
    var previous = picker.field, onSelect = picker.onSelect; picker.element.remove(); picker = null;
    document.querySelector('.aiops-app').inert = false;
    if (restore && previous && previous.isConnected) { if (onSelect) onSelect([]); else global.AIOpsComposer.focusEnd(previous); }
  }
  function paintPicker(focusTab) {
    if (!picker) return;
    var rows = catalog(picker.type).filter(function (row) { return matches(row, picker.query); });
    picker.element.querySelectorAll('[data-context-tab]').forEach(function (button) { var on = button.dataset.contextTab === picker.type; button.setAttribute('aria-selected', String(on)); button.tabIndex = on ? 0 : -1; });
    picker.element.querySelector('#contextCapabilitySearch').placeholder = '搜索' + typeInfo(picker.type)[1];
    picker.element.querySelector('.context-capability-list').innerHTML = rows.length ? rows.map(function (row) {
      return '<label class="context-capability-item"><span class="cap-check context-capability-check"><input type="checkbox" data-context-capability="' + esc(row.id) + '"' + (picker.selected[row.id] ? ' checked' : '') + '></span><span class="context-capability-icon">' + referenceIcon(row) + '</span><strong title="' + esc(row.name) + '">' + esc(row.name) + '</strong><small title="' + esc(row.description) + '">' + esc(row.description) + '</small></label>';
    }).join('') : '<div class="slash-empty">没有匹配的原子能力</div>';
    var count = Object.keys(picker.selected).length, submit = picker.element.querySelector('[data-context-confirm]');
    submit.disabled = !count; submit.textContent = '添加' + (count ? '（' + count + '）' : '');
    picker.element.querySelector('[role="status"]').textContent = '已选择 ' + count + ' 项';
    host.icons(); if (global.WorkbenchSegmentedTabs) global.WorkbenchSegmentedTabs.refresh();
    if (focusTab) { var tab = picker.element.querySelector('[data-context-tab="' + focusTab + '"]'); tab.focus(); tab.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }
  function openPicker(type, context, initialQuery, onSelect) {
    closePicker();
    var overlay = document.createElement('div'); overlay.className = 'context-picker-overlay';
    overlay.innerHTML = '<section class="context-picker" role="dialog" aria-modal="true" aria-labelledby="contextPickerTitle"><header><h2 id="contextPickerTitle">选择原子能力</h2><button type="button" class="ws-btn" data-context-cancel aria-label="关闭原子能力选择">' + icon('x') + '</button></header><div class="context-picker-tabs wb-segmented-tabs" role="tablist" aria-label="原子能力类型">' + TYPES.map(function (item) { return '<button type="button" role="tab" data-context-tab="' + item[0] + '" aria-controls="contextCapabilityList">' + icon(item[2]) + esc(item[1]) + '</button>'; }).join('') + '</div><div class="context-picker-search"><label for="contextCapabilitySearch">' + icon('search') + '</label><input id="contextCapabilitySearch" type="search" aria-label="搜索原子能力" autocomplete="off"></div><div class="context-capability-list" id="contextCapabilityList" role="tabpanel"></div><footer><span role="status" aria-live="polite"></span><button type="button" class="btn-soft" data-context-cancel>取消</button><button type="button" class="btn-ink" data-context-confirm disabled>添加</button></footer></section>';
    picker = { element: overlay, type: type, query: initialQuery || '', selected: {}, context: context, field: field, onSelect: onSelect };
    overlay.querySelector('#contextCapabilitySearch').value = picker.query;
    document.body.appendChild(overlay); document.querySelector('.aiops-app').inert = true;
    overlay.addEventListener('click', function (event) {
      event.stopPropagation();
      if (event.target === overlay || event.target.closest('[data-context-cancel]')) { closePicker(true); return; }
      var tab = event.target.closest('[data-context-tab]');
      if (tab) { picker.type = tab.dataset.contextTab; picker.query = ''; overlay.querySelector('#contextCapabilitySearch').value = ''; paintPicker(picker.type); return; }
      if (event.target.closest('[data-context-confirm]')) { var refs = Object.keys(picker.selected).map(function (key) { return picker.selected[key]; }), saved = picker.context, callback = picker.onSelect; closePicker(); if (callback) callback(refs); else commit(refs, saved); }
    });
    overlay.addEventListener('input', function (event) { if (event.target.id === 'contextCapabilitySearch') { picker.query = event.target.value; paintPicker(); } });
    overlay.addEventListener('change', function (event) { if (!event.target.hasAttribute('data-context-capability')) return; var id = event.target.dataset.contextCapability; if (event.target.checked) picker.selected[id] = catalog(picker.type).filter(function (row) { return row.id === id; })[0]; else delete picker.selected[id]; paintPicker(); var replacement = overlay.querySelector('[data-context-capability="' + id + '"]'); if (replacement) replacement.focus(); });
    overlay.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closePicker(true); }
      if (event.key === 'Tab') {
        var nodes = Array.from(overlay.querySelectorAll('button,input')).filter(function (node) { return !node.disabled && node.tabIndex >= 0 && node.getClientRects().length; }), first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }, true);
    paintPicker(); overlay.querySelector('#contextCapabilitySearch').focus();
  }
  function onKeydown(event) {
    if (!menu || menu.hidden || event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter' && event.ctrlKey && multi.active()) { event.preventDefault(); event.stopImmediatePropagation(); multi.confirm(); return; }
    if (event.key === 'Tab' && multi.active() && !event.ctrlKey) return;
    if (!actions.length && event.key === 'Tab') { close(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); event.stopImmediatePropagation(); var enabled = actions.map(function (action, index) { return isDisabled(action) ? -1 : index; }).filter(function (index) { return index >= 0; }); if (enabled.length) { var current = enabled.indexOf(active); active = enabled[(current + (event.key === 'ArrowDown' ? 1 : enabled.length - 1)) % enabled.length]; highlight(true); } }
    else if ((event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey) { event.preventDefault(); event.stopImmediatePropagation(); choose(active, event); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
  }
  function unbind() {
    closePicker(); close(); if (multi) multi.destroy(); multi = null; if (menu) menu.remove(); menu = null;
    if (field) { field.removeEventListener('input', detect); field.removeEventListener('click', detect); field.removeEventListener('compositionend', detect); field.removeEventListener('keydown', onKeydown, true); }
    field = null;
  }
  function bind(input) { field = input; input.addEventListener('input', detect); input.addEventListener('click', detect); input.addEventListener('compositionend', detect); input.addEventListener('keydown', onKeydown, true); }
  function sizeLabel(size) { return size < 1024 ? size + ' B' : size < 1048576 ? (size / 1024).toFixed(1) + ' KB' : (size / 1048576).toFixed(1) + ' MB'; }
  function detail(id) {
    var doc = documents[id]; if (!doc) return '';
    var html = '<section class="context-detail" data-context-detail="' + esc(id) + '"><header><span class="context-detail-icon">' + referenceIcon(doc) + '</span><div><h1>' + esc(doc.name) + '</h1><p>' + esc(doc.path || '') + '</p></div></header>';
    if (doc.kind === 'capability') return html + '<dl><dt>类型</dt><dd>' + esc(typeInfo(doc.capabilityType)[1]) + '</dd><dt>说明</dt><dd>' + esc(doc.description) + '</dd></dl></section>';
    if (doc.kind === 'local-folder' && !doc.children) {
      if (!doc.loading && !doc.loadError) { doc.loading = true; fetch(doc.localURL).then(function (response) { if (!response.ok) throw new Error('folder'); return response.json(); }).then(function (result) { doc.children = result.items.map(nativeDocument); doc.loading = false; host.refresh(doc.id); }).catch(function () { doc.loadError = true; host.refresh(doc.id); }); }
      return html + '<p>' + (doc.loadError ? '无法读取文件夹，请重新添加。' : '正在读取文件夹…') + '</p></section>';
    }
    if (doc.kind === 'local-folder') return html + '<p>' + doc.children.length + ' 个项目</p><div class="context-folder-list">' + doc.children.map(function (child) { return '<button type="button" data-context-doc="' + esc(child.id) + '">' + referenceIcon(child) + '<span>' + esc(child.path) + '</span></button>'; }).join('') + '</div></section>';
    if (!doc.url) doc.url = doc.localURL || URL.createObjectURL(doc.file);
    html += '<div class="context-file-meta"><span>' + sizeLabel(doc.size) + ' · ' + esc(doc.mime || '文件') + '</span><a class="btn-soft" href="' + doc.url + '" download="' + esc(doc.name) + '">下载</a></div>';
    if (/^image\//.test(doc.mime)) html += '<img class="context-file-image" src="' + doc.url + '" alt="' + esc(doc.name) + '">';
    else if (doc.mime === 'application/pdf') html += '<iframe class="context-file-pdf" title="' + esc(doc.name) + '" src="' + doc.url + '"></iframe>';
    else if (/^text\//.test(doc.mime) || /\.(md|txt|csv|json|js|ts|py|log|html|xml|yaml|yml)$/i.test(doc.name)) {
      if (doc.content == null && !doc.loading) { doc.loading = true; (doc.localURL ? fetch(doc.localURL + '?text=1').then(function (response) { if (!response.ok) throw new Error('file'); return response.text(); }) : doc.file.slice(0, 200000).text()).then(function (value) { doc.content = value; host.refresh(doc.id); }).catch(function () { doc.content = '无法读取此文件。'; host.refresh(doc.id); }); }
      html += (doc.size > 200000 ? '<p>预览前 200 KB，可下载完整文件。</p>' : '') + '<pre>' + esc(doc.content == null ? '正在读取文件…' : doc.content) + '</pre>';
    } else html += '<div class="context-no-preview">' + referenceIcon(doc) + '<p>此格式暂不支持内容预览，可下载文件查看。</p></div>';
    return html + '</section>';
  }
  document.addEventListener('click', function (event) {
    var add = event.target.closest('[data-cui-context-open]'), upload = event.target.closest('[data-cui-upload]');
    if (add || upload) { event.preventDefault(); event.stopImmediatePropagation(); var input = event.target.closest('[data-cui-composer]').querySelector('.cui-input'); if (field !== input) field = input; pending = snapshot(null); if (upload) chooseLocal(pending); else { if (global.AIOpsComposer.closeSlash) global.AIOpsComposer.closeSlash(); show(null); } return; }
    var doc = event.target.closest('[data-context-doc]'); if (doc) { event.preventDefault(); host.open(doc.dataset.contextDoc); return; }
    if (menu && !menu.hidden && !menu.contains(event.target) && field && !field.contains(event.target)) close();
  });
  window.addEventListener('resize', function () { if (menu && !menu.hidden && field) global.AIOpsComposer.position(menu, field, 420); });
  window.addEventListener('scroll', function (event) { if (menu && !menu.hidden && field && !menu.contains(event.target)) global.AIOpsComposer.position(menu, field, 420); }, true);
  global.AIOpsContext = {
    configure: function (next) { host = next; }, bind: bind, unbind: unbind, icon: referenceIcon,
    documents: function () { return Object.keys(documents).map(function (id) { return documents[id]; }); },
    detail: detail
  };
})(window);
