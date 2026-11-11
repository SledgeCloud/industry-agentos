/**
 * Shared composer asset — type "/" to browse and insert a demo Skill command.
 * The palette is intentionally local/demo-only; selecting a row inserts the
 * command into the composer so the normal send flow remains unchanged.
 */
(function () {
  'use strict';

  var SKILLS = [
    { id: 'deep-research', name: '深度研究', desc: '检索并综合多个来源，输出带依据的研究结论', official: true },
    { id: 'document-review', name: '文档审阅', desc: '检查文档中的缺口、冲突和风险项', official: true },
    { id: 'data-analysis', name: '数据分析', desc: '分析表格数据并生成关键指标与洞察' },
    { id: 'workflow-planner', name: '任务规划', desc: '把目标拆成可执行任务、依赖和审核点' },
    { id: 'ontology-design', name: '本体设计', desc: '梳理业务对象、关系、属性与动作' },
    { id: 'prototype-review', name: '原型评审', desc: '检查核心流程、异常状态与交互完整性' },
    { id: 'meeting-summary', name: '会议纪要', desc: '提炼结论、待办、负责人和截止时间' },
    { id: 'web-search', name: '联网搜索', desc: '搜索最新公开资料并整理来源链接', official: true },
  ];

  function esc(value) {
    return String(value).replace(/[&<>"]/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char];
    });
  }

  function icon() {
    // Lucide container: https://github.com/lucide-icons/lucide/blob/main/icons/container.svg
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z"/>' +
      '<path d="M10 21.9V14L2.1 9.1"/><path d="m10 14 11.9-6.9"/><path d="M14 19.8v-8.1"/><path d="M18 17.5V9.4"/></svg>';
  }

  function hint() { return '<div class="slash-hint"><span>↑↓ 选择</span><span>Ctrl 多选</span><span>Enter 插入</span><span>Esc 关闭</span></div>'; }

  // Shared Ctrl selection state for both composer palettes.
  function createMulti(options) {
    var menu = options.menu, selected = new Map(), held = false, mode = false;
    function visible() { return !menu.hidden && menu.isConnected; }
    function count() { var ids = new Set(); selected.forEach(function (value) { (value.refs || [value]).forEach(function (item) { ids.add(item.id); }); }); return ids.size; }
    function refresh() {
      menu.classList.toggle('has-selection-controls', held || mode);
      menu.classList.toggle('is-multiselect', mode);
      menu.setAttribute('aria-multiselectable', String(held || mode));
      options.rows().forEach(function (row) {
        var check = row.element.querySelector('.palette-check');
        if (!check) {
          check = document.createElement('span'); check.className = 'cap-check palette-check';
          check.innerHTML = '<input type="checkbox" tabindex="-1" aria-hidden="true">'; row.element.prepend(check);
        }
        check.querySelector('input').checked = selected.has(row.key);
        row.element.setAttribute('aria-selected', String(held || mode ? selected.has(row.key) : row.element.classList.contains('is-active')));
      });
      var footer = menu.querySelector('.palette-selection-footer');
      if (!footer && mode) {
        footer = document.createElement('div'); footer.className = 'palette-selection-footer'; footer.setAttribute('role', 'group'); footer.setAttribute('aria-label', '多选操作');
        footer.innerHTML = '<span role="status" aria-live="polite"></span><button type="button" data-palette-cancel>取消</button><button type="button" data-palette-confirm>确认</button>'; menu.appendChild(footer);
      }
      if (footer) { footer.hidden = !mode; footer.querySelector('[role="status"]').textContent = '已选 ' + count() + ' 项'; footer.querySelector('[data-palette-confirm]').disabled = !selected.size; }
      if (visible() && options.position) options.position();
    }
    function reset() { var changed = mode; selected.clear(); held = false; mode = false; if (changed && options.modeChange) options.modeChange(); refresh(); }
    function modifier(event) {
      var next = event.type === 'keydown' ? event.ctrlKey || event.key === 'Control' : event.ctrlKey;
      if (next !== held) { held = next; if (visible()) refresh(); }
      if (!visible() || event.type !== 'keydown' || !mode) return;
      if (event.key === 'Tab' && (event.target === options.input || options.input.contains(event.target))) { event.preventDefault(); event.stopImmediatePropagation(); menu.querySelector('[data-palette-cancel]').focus(); }
      else if (event.key === 'Escape' && menu.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); options.cancel(); }
    }
    function release() { held = false; refresh(); }
    // macOS may translate Ctrl-click into contextmenu instead of click.
    var ctrlPointerTime = 0;
    function ctrlPointer(event) {
      if (!event.ctrlKey) return;
      var footerButton = event.target.closest('[data-palette-cancel], [data-palette-confirm]');
      if (footerButton) { event.preventDefault(); ctrlPointerTime = Date.now(); if (footerButton.hasAttribute('data-palette-cancel')) options.cancel(); else if (selected.size) options.confirm(Array.from(selected.values())); return; }
      var row = event.target.closest('[data-skill-index], [data-context-index]');
      if (!row) return;
      event.preventDefault(); ctrlPointerTime = Date.now(); options.activate(row, event);
    }
    function ctrlContext(event) { if (event.ctrlKey) event.preventDefault(); }
    function footerClick(event) {
      if (event.ctrlKey && Date.now() - ctrlPointerTime < 1000) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (event.target.closest('[data-palette-cancel]')) { event.preventDefault(); event.stopImmediatePropagation(); options.cancel(); }
      else if (event.target.closest('[data-palette-confirm]')) { event.preventDefault(); event.stopImmediatePropagation(); if (selected.size) options.confirm(Array.from(selected.values())); }
    }
    document.addEventListener('keydown', modifier, true); document.addEventListener('keyup', modifier, true); window.addEventListener('blur', release); menu.addEventListener('click', footerClick, true); menu.addEventListener('mousedown', ctrlPointer, true); menu.addEventListener('contextmenu', ctrlContext);
    return {
      refresh: refresh, reset: reset, active: function () { return mode; }, wants: function (event) { return mode || held || !!(event && event.ctrlKey); }, has: function (key) { return selected.has(key); },
      set: function (key, value) { var changed = !mode; mode = true; if (value) selected.set(key, value); else selected.delete(key); if (changed && options.modeChange) options.modeChange(); refresh(); },
      toggle: function (key, value) { this.set(key, selected.has(key) ? null : value); },
      confirm: function () { if (selected.size) options.confirm(Array.from(selected.values())); },
      destroy: function () { document.removeEventListener('keydown', modifier, true); document.removeEventListener('keyup', modifier, true); window.removeEventListener('blur', release); menu.removeEventListener('click', footerClick, true); menu.removeEventListener('mousedown', ctrlPointer, true); menu.removeEventListener('contextmenu', ctrlContext); }
    };
  }

  function create(options) {
    var input = options.input, dock = options.dock;
    var menu = document.createElement('div');
    menu.className = 'slash-menu' + (options.className ? ' ' + options.className : '');
    menu.id = options.menuId || 'composer-skill-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', '可调用的 Skills');
    dock.insertBefore(menu, dock.firstChild);

    var shown = [];
    var active = 0;
    var open = false;
    var range = null;
    var multi = createMulti({ menu: menu, input: input,
      rows: function () { return Array.from(menu.querySelectorAll('[data-skill-index]')).map(function (element) { var skill = shown[+element.dataset.skillIndex]; return { element: element, key: skill.id }; }); },
      activate: function (row, event) { pick(+row.dataset.skillIndex, event); },
      confirm: function (skills) { insertSkills(skills); }, cancel: function () { multi.reset(); input.focus(); },
      position: function () { if (options.position) options.position(menu); }
    });

    function render() {
      var html = '<div class="slash-group">Skills <span>输入名称可筛选</span></div>';
      if (!shown.length) {
        html += '<div class="slash-empty">没有匹配的 Skill</div>';
      } else {
        shown.forEach(function (skill, index) {
          html += '<button type="button" class="slash-row' + (index === active ? ' is-active' : '') + '"' +
            ' role="option" aria-selected="' + (index === active) + '" data-skill-index="' + index + '" id="' + menu.id + '-' + index + '">' +
            '<span class="slash-row-icon">' + icon() + '</span>' +
            '<span class="slash-row-name">/' + esc(skill.id) + '</span>' +
            '<span class="slash-tag' + (skill.official ? ' slash-tag-official' : '') + '">' + (skill.official ? '官方' : 'Skill') + '</span>' +
            '<span class="slash-row-desc">' + esc(skill.name) + ' · ' + esc(skill.desc) + '</span></button>';
        });
        html += hint();
      }
      menu.innerHTML = html;
      multi.refresh();
      input.setAttribute('aria-activedescendant', shown.length ? menu.id + '-' + active : '');
      if (options.position) options.position(menu);
      var current = menu.querySelector('.slash-row.is-active');
      if (current) current.scrollIntoView({ block: 'nearest' });
    }

    function show(query) {
      var normalized = String(query || '').toLowerCase();
      shown = SKILLS.filter(function (skill) {
        return !normalized ||
          skill.id.indexOf(normalized) >= 0 ||
          skill.name.toLowerCase().indexOf(normalized) >= 0 ||
          skill.desc.toLowerCase().indexOf(normalized) >= 0;
      });
      active = 0;
      open = true;
      menu.hidden = false;
      input.setAttribute('aria-controls', menu.id);
      input.setAttribute('aria-expanded', 'true');
      render();
    }

    function hide() {
      if (!open) return;
      open = false;
      range = null;
      menu.hidden = true;
      multi.reset();
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }

    function detect(event) {
      if (event && event.isComposing) return;
      if (options.trigger) {
        var trigger = options.trigger(input);
        if (!trigger) { hide(); return; }
        range = trigger; show(trigger.query); return;
      }
      var value = input.value;
      var caret = input.selectionStart == null ? value.length : input.selectionStart;
      var match = /(^|\s)\/([^\s/]{0,40})$/.exec(value.slice(0, caret));
      if (!match) {
        hide();
        return;
      }
      range = { from: caret - match[2].length - 1, to: caret };
      show(match[2]);
    }

    function insertSkills(skills) {
      if (!skills.length || !range) return;
      var selectedRange = range;
      if (options.insertMany || options.insert) {
        hide(); input.focus();
        if (options.insertMany) options.insertMany(input, skills, selectedRange);
        else options.insert(input, skills[0], selectedRange);
        input.dispatchEvent(new Event('input', { bubbles: true })); return;
      }
      var value = input.value, command = skills.map(function (skill) { return '/' + skill.id; }).join(' ') + ' ';
      input.value = value.slice(0, selectedRange.from) + command + value.slice(selectedRange.to);
      var caret = selectedRange.from + command.length; hide(); input.focus();
      try { input.setSelectionRange(caret, caret); } catch (error) { /* no-op */ }
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function pick(index, event) {
      var skill = shown[index]; if (!skill || !range) return;
      if (multi.wants(event)) { multi.toggle(skill.id, skill); return; }
      insertSkills([skill]);
    }

    input.setAttribute('aria-haspopup', 'listbox');
    input.setAttribute('aria-controls', menu.id);
    input.setAttribute('aria-expanded', 'false');
    input.addEventListener('input', detect);
    input.addEventListener('click', detect);
    input.addEventListener('compositionend', detect);
    var blurTimer;
    function onBlur() { blurTimer = setTimeout(function () { if (!menu.contains(document.activeElement)) hide(); }, 120); }
    input.addEventListener('blur', onBlur);
    function onKeydown(event) {
      if (!open || event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Enter' && event.ctrlKey && multi.active()) { event.preventDefault(); event.stopImmediatePropagation(); multi.confirm(); return; }
      if (event.key === 'Tab' && multi.active() && !event.ctrlKey) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (shown.length) {
          active = (active + (event.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length;
          render();
        }
      } else if ((event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey && !event.isComposing) {
        if (shown.length) {
          event.preventDefault();
          event.stopImmediatePropagation();
          pick(active, event);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        hide();
      }
    }
    input.addEventListener('keydown', onKeydown, true);

    menu.addEventListener('mousedown', function (event) { event.preventDefault(); });
    menu.addEventListener('mousemove', function (event) {
      var row = event.target.closest('[data-skill-index]');
      if (!row) return;
      var index = +row.getAttribute('data-skill-index');
      if (index !== active) {
        active = index;
        menu.querySelectorAll('[data-skill-index]').forEach(function (item) {
          item.classList.toggle('is-active', +item.getAttribute('data-skill-index') === active);
          if (!multi.wants()) item.setAttribute('aria-selected', +item.getAttribute('data-skill-index') === active ? 'true' : 'false');
        });
      }
    });
    menu.addEventListener('click', function (event) {
      var row = event.target.closest('[data-skill-index]');
      if (row) pick(+row.getAttribute('data-skill-index'), event);
    });
    function outside(event) { if (event.target !== input && !input.contains(event.target) && !menu.contains(event.target)) hide(); }
    function reposition(event) {
      if (open && input.isConnected && options.position && !menu.contains(event.target)) options.position(menu);
      else if (!input.isConnected) hide();
    }
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return { close: hide, destroy: function () {
      clearTimeout(blurTimer); hide(); multi.destroy(); menu.remove();
      input.removeEventListener('input', detect); input.removeEventListener('click', detect);
      input.removeEventListener('compositionend', detect); input.removeEventListener('blur', onBlur);
      input.removeEventListener('keydown', onKeydown, true);
      document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true);
    } };
  }
  window.ComposerSlashSkills = { create: create, skills: SKILLS, icon: icon, hint: hint, createMulti: createMulti };
  var input = document.getElementById('composer-input'), dock = document.querySelector('.composer-dock');
  if (input && dock) create({ input: input, dock: dock });
})();
