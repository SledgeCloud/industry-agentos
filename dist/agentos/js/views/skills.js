/* AgentOS · Skills */
(function (root) {
  const AOS = root.AOS;
  const { ui, svc } = AOS;
  const CP = AOS.installCopilot;
  const { esc, icon } = ui;
  const CATS = ['全部', '回答规范', '安全合规', '检索策略', '报告流程', '研发方法', '数据分析', '自定义'];
  const ICONS = ['sparkles', 'quote', 'shield-check', 'filter', 'list-tree', 'search-check', 'calendar-range', 'git-branch', 'chart-line', 'table', 'ruler', 'notebook-pen'];

  AOS.views.skills = function (el) {
    AOS.setCrumbs([{ name: 'Skills' }]);
    let tab = 'all';
    let cat = '全部';
    let q = '';
    let qRaw = '';
    let copilot = null;

    function card(s) {
      const builtin = s.source !== 'custom';
      return '<article class="tool-card"><div class="head"><div class="agent-icon">' + icon(s.icon || 'sparkles') + '</div><div class="grow"><h3>' + esc(s.name) + '</h3><div class="row small">' +
        '<span class="badge ' + (builtin ? 'dark' : 'info') + '">' + (builtin ? '内置' : '已安装') + '</span>' +
        '<span class="badge outline">' + esc(s.category || '自定义') + '</span>' +
        (s.status === 'published' || !s.status ? '<span class="badge ok">已发布</span>' : '<span class="badge warn">草稿</span>') +
        '</div></div>' +
        (builtin ? '' : '<details class="card-more"><summary class="card-more-btn" aria-label="更多操作">' + icon('ellipsis') + '</summary><div class="card-more-menu" role="menu">' +
          '<button type="button" role="menuitem" data-edit="' + esc(s.id) + '">' + icon('pencil') + '修改</button>' +
          '<button type="button" role="menuitem" class="danger" data-uninstall="' + esc(s.id) + '">' + icon('trash-2') + '卸载</button>' +
          '</div></details>') +
        '</div>' +
        '<p class="agent-desc" style="-webkit-line-clamp:4">' + esc(s.desc || '') + '</p>' +
        '<dl class="kv"><dt>适用场景</dt><dd>' + esc(s.trigger || '通用') + '</dd><dt>标识</dt><dd class="mono">' + esc(s.id) + '</dd>' +
        (s.installedBy ? '<dt>安装信息</dt><dd>' + esc(s.installedBy) + ' · ' + esc(s.installedAt || '') + '</dd>' : '') + '</dl></article>';
    }

    function openManual(existing) {
      const edit = !!existing;
      const curIcon = edit ? (existing.icon || ICONS[0]) : ICONS[0];
      const curCat = edit ? (existing.category || '自定义') : '自定义';
      ui.modal({
        title: edit ? '修改 Skill' : '安装 Skill', okText: edit ? '保存' : '安装', size: 'lg',
        body: '<div class="stack">' +
          '<div class="grid-2"><div class="field"><label for="skName">名称</label><input class="input" id="skName" placeholder="例如：表格化作答" value="' + esc(edit ? existing.name : '') + '"></div>' +
          '<div class="field"><label for="skId">标识</label><input class="input" id="skId" placeholder="例如：table-answer" value="' + esc(edit ? existing.id : '') + '"' + (edit ? ' disabled' : '') + '>' + (edit ? '<span class="hint">标识安装后不可修改</span>' : '') + '</div></div>' +
          '<div class="grid-2"><div class="field"><label for="skCat">分类</label><select class="select" id="skCat">' + CATS.filter(c => c !== '全部').map(c => '<option' + (c === curCat ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select></div>' +
          '<div class="field"><span class="field-label">图标</span><div class="icon-pick" role="radiogroup" aria-label="图标">' +
          ICONS.map(i => '<label class="icon-pick-item" title="' + i + '"><input type="radio" name="skIcon" value="' + i + '"' + (i === curIcon ? ' checked' : '') + '><span class="agent-icon">' + icon(i) + '</span></label>').join('') +
          '</div></div></div>' +
          '<div class="field"><label for="skTrigger">适用场景</label><input class="input" id="skTrigger" placeholder="例如：调研、查新" value="' + esc(edit ? (existing.trigger || '') : '') + '"></div>' +
          '<div class="field"><label for="skDesc">说明</label><textarea class="textarea" id="skDesc" style="min-height:72px" placeholder="描述该 Skill 的行为与约束">' + esc(edit ? (existing.desc || '') : '') + '</textarea></div>' +
          '<span class="err" id="skErr" hidden></span></div>',
        onMount(m, close) {
          ui.icons();
          m.querySelector('[data-ok]').addEventListener('click', () => {
            const name = m.querySelector('#skName').value.trim();
            let id = m.querySelector('#skId').value.trim().replace(/\s+/g, '-');
            if (!id && name) id = 'skill-' + Date.now().toString(36);
            const iconEl = m.querySelector('input[name="skIcon"]:checked');
            const payload = {
              id, name,
              category: m.querySelector('#skCat').value,
              icon: iconEl ? iconEl.value : ICONS[0],
              trigger: m.querySelector('#skTrigger').value.trim() || '通用',
              desc: m.querySelector('#skDesc').value.trim() || (edit ? existing.desc : '用户安装的自定义 Skill'),
              status: 'published'
            };
            const res = edit ? svc.updateSkill(existing.id, payload) : svc.installSkill(payload);
            const err = m.querySelector('#skErr');
            if (!res.ok) { err.textContent = res.reason; err.hidden = false; return; }
            close();
            ui.toast(edit ? '已保存 Skill「' + name + '」' : '已安装 Skill「' + name + '」');
            tab = 'custom';
            draw();
          });
        }
      });
    }

    function mainHtml() {
      const all = svc.skillsCatalog();
      const list = all.filter(s => {
        if (tab === 'builtin' && s.source === 'custom') return false;
        if (tab === 'custom' && s.source !== 'custom') return false;
        if (cat !== '全部' && (s.category || '自定义') !== cat) return false;
        if (q && !(s.name + s.desc + s.trigger + s.id).toLowerCase().includes(q)) return false;
        return true;
      });
      const nBuiltin = all.filter(s => s.source !== 'custom').length;
      const nCustom = all.filter(s => s.source === 'custom').length;
      return '<div class="page-head"><div><h1>Skills</h1><p>可复用的能力片段。内置 Skill 由平台提供；支持手动安装或通过 Copilot 安装。</p></div>' +
        CP.createMenuHtml('安装 Skill') + '</div>' +
        '<div class="toolbar"><div class="seg" role="tablist" aria-label="Skill 来源">' +
        [['all', '全部 · ' + all.length], ['builtin', '内置 · ' + nBuiltin], ['custom', '我的 · ' + nCustom]].map(([k, label]) =>
          '<button type="button" data-tab="' + k + '"' + (tab === k ? ' class="on" aria-selected="true"' : '') + '>' + label + '</button>'
        ).join('') + '</div>' +
        '<div class="search"><span>' + icon('search') + '</span><input class="input" id="skQ" placeholder="搜索 Skill 名称或用途" value="' + esc(qRaw) + '" aria-label="搜索 Skills"></div></div>' +
        '<div class="toolbar" style="margin-top:-4px"><div class="seg" role="tablist" aria-label="Skill 分类">' + CATS.map(c =>
          '<button type="button" data-cat="' + esc(c) + '"' + (c === cat ? ' class="on" aria-selected="true"' : '') + '>' + esc(c) + '</button>'
        ).join('') + '</div></div>' +
        (list.length
          ? '<div class="tool-grid">' + list.map(card).join('') + '</div>'
          : '<div class="empty">' + icon(tab === 'custom' ? 'sparkles' : 'search-x') + (tab === 'custom' ? '还没有自行安装的 Skill。可从右上角选择手动安装或通过 Copilot 安装。' : '没有匹配的 Skill，换个关键词试试。') + '</div>');
    }

    function draw() {
      el.innerHTML = '<div class="page-split' + (copilot ? ' has-copilot' : '') + '"><div class="page-split-main"><div class="page">' + mainHtml() + '</div></div>' +
        (copilot ? CP.panelHtml(copilot) : '') + '</div>';
      ui.icons();
      el.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; draw(); }));
      el.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { cat = b.dataset.cat; draw(); }));
      const sq = el.querySelector('#skQ');
      if (sq) {
        sq.addEventListener('input', e => { qRaw = e.target.value; q = qRaw.trim().toLowerCase(); draw(); });
        if (!copilot && qRaw) { sq.focus(); const n = sq.value.length; sq.setSelectionRange(n, n); }
      }
      CP.bindCreateMenu(el, {
        onManual: () => openManual(),
        onCopilot: () => { copilot = CP.openState('skill'); draw(); }
      });
      el.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
        const s = svc.skill(b.dataset.edit);
        if (s && s.source === 'custom') openManual(s);
      }));
      el.querySelectorAll('[data-uninstall]').forEach(b => b.addEventListener('click', async () => {
        const s = svc.skill(b.dataset.uninstall);
        const ok = await ui.confirm({ title: '卸载 Skill', okText: '确认卸载', body: '<p>将卸载「' + esc(s.name) + '」。</p>' });
        if (!ok) return;
        const res = svc.uninstallSkill(s.id);
        if (!res.ok) { ui.toast(res.reason, 'warn'); return; }
        ui.toast('已卸载「' + s.name + '」'); draw();
      }));
      if (copilot) {
        CP.bindPanel(el, copilot, {
          onClose: () => { copilot = null; draw(); },
          onChange: next => { copilot = next; draw(); },
          onConfirm: draft => svc.installSkill(draft),
          onSaved: draft => { tab = 'custom'; ui.toast('已安装 Skill「' + draft.name + '」'); }
        });
      }
    }

    draw();
  };
})(window);
