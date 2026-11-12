/* AgentOS · MCPs */
(function (root) {
  const AOS = root.AOS;
  const { ui, svc, store } = AOS;
  const CP = AOS.installCopilot;
  const { esc, icon } = ui;
  const ICONS = ['wrench', 'plug', 'database', 'globe', 'file-search', 'code', 'scale', 'clipboard-list', 'lightbulb'];

  AOS.views.mcps = function (el) {
    AOS.setCrumbs([{ name: 'MCPs' }]);
    let tab = 'all';
    let copilot = null;

    function usedBy(id) {
      return store.state.agents.filter(a => (a.draft.tools || []).includes(id));
    }

    function card(t) {
      const users = usedBy(t.id);
      const builtin = t.source !== 'custom';
      return '<article class="tool-card">' +
        '<div class="head"><div class="agent-icon">' + icon(t.icon || 'wrench') + '</div><div class="grow"><h3>' + esc(t.name) + '</h3><div class="row small">' +
        '<span class="badge ' + (builtin ? 'dark' : 'info') + '">' + (builtin ? '内置' : '已安装') + '</span>' +
        (t.phase > svc.phase() ? '<span class="badge warn">' + svc.PHASE_LABEL[t.phase] + '提供</span>' : '<span class="badge ok">已可用</span>') +
        '</div></div>' +
        (builtin ? '' : '<details class="card-more"><summary class="card-more-btn" aria-label="更多操作">' + icon('ellipsis') + '</summary><div class="card-more-menu" role="menu">' +
          '<button type="button" role="menuitem" data-edit="' + esc(t.id) + '">' + icon('pencil') + '修改</button>' +
          '<button type="button" role="menuitem" class="danger" data-uninstall="' + esc(t.id) + '">' + icon('trash-2') + '卸载</button>' +
          '</div></details>') +
        '</div>' +
        '<dl class="kv"><dt>适用资料</dt><dd>' + esc(t.appliesTo || '—') + '</dd><dt>入库处理</dt><dd>' + esc(t.ingest || '无') + '</dd><dt>调用能力</dt><dd>' + esc(t.capability || '—') + '</dd>' +
        (t.endpoint ? '<dt>接入地址</dt><dd class="mono">' + esc(t.endpoint) + '</dd>' : '') +
        '<dt>可配置参数</dt><dd>' + ((t.params || []).length ? t.params.map(p => esc(p.label) + '（默认 ' + esc(p.default) + '）').join('、') : '无') + '</dd></dl>' +
        ((t.safety || []).length ? '<div><div class="field-label" style="margin-bottom:4px">安全要求</div><ul>' + t.safety.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul></div>' : '') +
        '<div class="row wrap small"><span class="muted">' + users.length + ' 个智能体已勾选' + (t.installedBy ? ' · ' + esc(t.installedBy) + ' 安装于 ' + esc(t.installedAt || '') : '') + '</span></div></article>';
    }

    function openManual(existing) {
      const edit = !!existing;
      const curIcon = edit ? (existing.icon || ICONS[0]) : ICONS[0];
      ui.modal({
        title: edit ? '修改 MCP' : '安装 MCP', okText: edit ? '保存' : '安装', size: 'lg',
        body: '<div class="stack">' +
          '<div class="grid-2"><div class="field"><label for="mcpName">名称</label><input class="input" id="mcpName" placeholder="例如：标准规范接口" value="' + esc(edit ? existing.name : '') + '"></div>' +
          '<div class="field"><label for="mcpId">标识</label><input class="input" id="mcpId" placeholder="例如：std_query_api" value="' + esc(edit ? existing.id : '') + '"' + (edit ? ' disabled' : '') + '>' + (edit ? '<span class="hint">标识安装后不可修改</span>' : '') + '</div></div>' +
          '<div class="field"><span class="field-label" id="mcpIconLabel">图标</span><div class="icon-pick" role="radiogroup" aria-labelledby="mcpIconLabel">' +
          ICONS.map(i => '<label class="icon-pick-item" title="' + i + '"><input type="radio" name="mcpIcon" value="' + i + '"' + (i === curIcon ? ' checked' : '') + '><span class="agent-icon">' + icon(i) + '</span></label>').join('') +
          '</div></div>' +
          '<div class="field"><label for="mcpEndpoint">接入地址</label><input class="input" id="mcpEndpoint" placeholder="mcp://host/service 或 https://…" value="' + esc(edit ? (existing.endpoint || '') : '') + '"></div>' +
          '<div class="field"><label for="mcpApplies">适用资料</label><input class="input" id="mcpApplies" placeholder="例如：厂内 API / 互联网" value="' + esc(edit ? (existing.appliesTo || '') : '') + '"></div>' +
          '<div class="field"><label for="mcpCap">调用能力</label><textarea class="textarea" id="mcpCap" style="min-height:64px" placeholder="说明该 MCP 能做什么">' + esc(edit ? (existing.capability || '') : '') + '</textarea></div>' +
          '<span class="err" id="mcpErr" hidden></span></div>',
        onMount(m, close) {
          ui.icons();
          m.querySelector('[data-ok]').addEventListener('click', () => {
            const name = m.querySelector('#mcpName').value.trim();
            let id = m.querySelector('#mcpId').value.trim().replace(/\s+/g, '_');
            if (!id && name) id = 'mcp_' + Date.now().toString(36);
            const iconEl = m.querySelector('input[name="mcpIcon"]:checked');
            const payload = {
              id, name,
              icon: iconEl ? iconEl.value : ICONS[0],
              endpoint: m.querySelector('#mcpEndpoint').value.trim(),
              appliesTo: m.querySelector('#mcpApplies').value.trim() || '自定义',
              capability: m.querySelector('#mcpCap').value.trim() || (edit ? existing.capability : '用户安装的自定义 MCP'),
              ingest: edit ? (existing.ingest || '按接入服务约定') : '按接入服务约定',
              params: edit ? (existing.params || [{ key: 'topK', label: '返回条数', type: 'number', min: 1, max: 20, default: 5 }]) : [{ key: 'topK', label: '返回条数', type: 'number', min: 1, max: 20, default: 5 }],
              safety: edit ? (existing.safety || ['用户自行安装，调用经出口策略与审计', '不做密级与资料范围限制']) : ['用户自行安装，调用经出口策略与审计', '不做密级与资料范围限制']
            };
            const res = edit ? svc.updateTool(existing.id, payload) : svc.installTool(payload);
            const err = m.querySelector('#mcpErr');
            if (!res.ok) { err.textContent = res.reason; err.hidden = false; return; }
            close();
            ui.toast(edit ? '已保存 MCP「' + name + '」' : '已安装 MCP「' + name + '」');
            tab = 'custom';
            draw();
          });
        }
      });
    }

    function mainHtml() {
      const all = svc.toolsCatalog();
      const list = all.filter(t => tab === 'all' || (tab === 'builtin' ? t.source !== 'custom' : t.source === 'custom'));
      const nBuiltin = all.filter(t => t.source !== 'custom').length;
      const nCustom = all.filter(t => t.source === 'custom').length;
      return '<div class="page-head"><div><h1>MCPs</h1><p>智能体访问资料和外部能力的方式。内置 MCP 由平台提供；支持手动安装或通过 Copilot 安装。</p></div>' +
        CP.createMenuHtml('安装 MCP') + '</div>' +
        '<div class="toolbar"><div class="seg" role="tablist" aria-label="MCP 来源">' +
        [['all', '全部 · ' + all.length], ['builtin', '内置 · ' + nBuiltin], ['custom', '我的 · ' + nCustom]].map(([k, label]) =>
          '<button type="button" data-tab="' + k + '"' + (tab === k ? ' class="on" aria-selected="true"' : '') + '>' + label + '</button>'
        ).join('') + '</div></div>' +
        (list.length
          ? '<div class="tool-grid">' + list.map(card).join('') + '</div>'
          : '<div class="empty">' + icon(tab === 'custom' ? 'plug' : 'search-x') + (tab === 'custom' ? '还没有自行安装的 MCP。可从右上角选择手动安装或通过 Copilot 安装。' : '没有匹配的 MCP。') + '</div>');
    }

    function draw() {
      el.innerHTML = '<div class="page-split' + (copilot ? ' has-copilot' : '') + '"><div class="page-split-main"><div class="page">' + mainHtml() + '</div></div>' +
        (copilot ? CP.panelHtml(copilot) : '') + '</div>';
      ui.icons();
      el.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; draw(); }));
      CP.bindCreateMenu(el, {
        onManual: () => openManual(),
        onCopilot: () => { copilot = CP.openState('mcp'); draw(); }
      });
      el.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
        const t = svc.tool(b.dataset.edit);
        if (t && t.source === 'custom') openManual(t);
      }));
      el.querySelectorAll('[data-uninstall]').forEach(b => b.addEventListener('click', async () => {
        const t = svc.tool(b.dataset.uninstall);
        const ok = await ui.confirm({ title: '卸载 MCP', okText: '确认卸载', body: '<p>将卸载「' + esc(t.name) + '」，并从已勾选该 MCP 的智能体配置中移除。</p>' });
        if (!ok) return;
        const res = svc.uninstallTool(t.id);
        if (!res.ok) { ui.toast(res.reason, 'warn'); return; }
        ui.toast('已卸载「' + t.name + '」'); draw();
      }));
      if (copilot) {
        CP.bindPanel(el, copilot, {
          onClose: () => { copilot = null; draw(); },
          onChange: next => { copilot = next; draw(); },
          onConfirm: draft => svc.installTool(draft),
          onSaved: draft => { tab = 'custom'; ui.toast('已安装 MCP「' + draft.name + '」'); }
        });
      }
    }

    draw();
  };
})(window);
