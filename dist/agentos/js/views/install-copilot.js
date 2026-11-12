/* AgentOS · 安装入口下拉与 Copilot 右侧对话（对齐 AIOps 评测实验交互） */
(function (root) {
  const AOS = root.AOS;
  const { ui, svc } = AOS;
  const { esc, icon } = ui;

  function createMenuHtml(label) {
    return '<details class="create-menu"><summary class="btn primary">' + icon('plus') + esc(label) + icon('chevron-down') + '</summary>' +
      '<div class="create-menu-list" role="menu">' +
      '<button type="button" role="menuitem" data-install="manual">手动安装</button>' +
      '<button type="button" role="menuitem" data-install="copilot">通过 Copilot 安装</button>' +
      '</div></details>';
  }

  function bindCreateMenu(rootEl, handlers) {
    const menu = rootEl.querySelector('.create-menu');
    if (!menu) return;
    menu.querySelectorAll('[data-install]').forEach(b => b.addEventListener('click', e => {
      e.preventDefault();
      menu.removeAttribute('open');
      const mode = b.dataset.install;
      if (mode === 'manual' && handlers.onManual) handlers.onManual();
      if (mode === 'copilot' && handlers.onCopilot) handlers.onCopilot();
    }));
  }

  function field(text, labels) {
    for (let i = 0; i < labels.length; i++) {
      const re = new RegExp('(?:' + labels[i] + ')\\s*[:：]?\\s*[「“"]?([^」”"\\n，。；;]+)[」”"]?', 'i');
      const m = text.match(re);
      if (m && m[1]) return m[1].trim();
    }
    return '';
  }

  function parseMcpRequest(text) {
    const raw = String(text || '').trim();
    const name = field(raw, ['名称', '名字', '叫']) || (raw.match(/[「“"](.+?)[」”"]/) || [])[1] || '自定义 MCP';
    let id = field(raw, ['标识', 'ID', 'id']).replace(/\s+/g, '_');
    if (!id) id = 'mcp_' + Date.now().toString(36);
    const endpoint = (raw.match(/(mcp:\/\/[^\s，。；;]+|https?:\/\/[^\s，。；;]+)/i) || [])[1] || '';
    const appliesTo = field(raw, ['适用资料', '适用']) || '自定义';
    const capability = field(raw, ['能力', '用途', '功能']) || raw.slice(0, 120) || '用户通过 Copilot 安装的 MCP';
    const iconName = /标准|规范/.test(raw) ? 'scale' : /数据|库|SQL/i.test(raw) ? 'database' : /网|搜索|公开/.test(raw) ? 'globe' : /代码/.test(raw) ? 'code' : 'plug';
    return {
      id, name, icon: iconName, endpoint, appliesTo, capability,
      ingest: '按接入服务约定',
      params: [{ key: 'topK', label: '返回条数', type: 'number', min: 1, max: 20, default: 5 }],
      safety: ['用户通过 Copilot 安装，调用经出口策略与审计', '不做密级与资料范围限制']
    };
  }

  function parseSkillRequest(text) {
    const raw = String(text || '').trim();
    const name = field(raw, ['名称', '名字', '叫']) || (raw.match(/[「“"](.+?)[」”"]/) || [])[1] || '自定义 Skill';
    let id = field(raw, ['标识', 'ID', 'id']).replace(/\s+/g, '-');
    if (!id) id = 'skill-' + Date.now().toString(36);
    const category = field(raw, ['分类']) || (/安全|密级|出网/.test(raw) ? '安全合规' : /检索|范围/.test(raw) ? '检索策略' : /报告|大纲|纪要/.test(raw) ? '报告流程' : /分析|指标|图/.test(raw) ? '数据分析' : '自定义');
    const trigger = field(raw, ['适用场景', '场景', '用于']) || '通用';
    const desc = field(raw, ['说明', '描述', '行为']) || raw.slice(0, 160) || '用户通过 Copilot 安装的 Skill';
    const iconName = /表|对照/.test(raw) ? 'table' : /安全|护栏|密级/.test(raw) ? 'shield-check' : /检索|过滤/.test(raw) ? 'filter' : /报告|大纲/.test(raw) ? 'list-tree' : 'sparkles';
    return { id, name, category, icon: iconName, trigger, desc, status: 'published' };
  }

  function prefill(kind) {
    if (kind === 'mcp') {
      return '请帮我安装一个可查询厂内标准规范的 MCP，名称「标准规范接口」，标识 std_query_api，接入地址 mcp://ironworks.local/std-query，能力是按标准编号和关键词查询条款摘要。';
    }
    return '请帮我安装一个 Skill，名称「表格化作答」，标识 table-answer，分类回答规范，用于调研和查新：对比类问题优先输出 Markdown 表格，并在表下给出简要结论。';
  }

  function skillMeta(kind) {
    return kind === 'mcp'
      ? { title: 'MCP 安装助手', skill: 'MCP 安装编排', code: '/mcp-installer' }
      : { title: 'Skill 安装助手', skill: 'Skill 安装编排', code: '/skill-installer' };
  }

  function draftSummary(kind, draft) {
    if (kind === 'mcp') {
      return {
        title: draft.name,
        body: draft.capability,
        meta: (draft.endpoint ? draft.endpoint + ' · ' : '') + '标识 ' + draft.id + ' · 不做范围限制'
      };
    }
    return {
      title: draft.name,
      body: draft.desc,
      meta: draft.category + ' · ' + draft.trigger + ' · 标识 ' + draft.id
    };
  }

  function panelHtml(state) {
    const kind = state.kind;
    const meta = skillMeta(kind);
    const compact = state.phase === 'review' || state.phase === 'saved';
    let scroll = '<div class="aos-copilot-intro"><span class="aos-ai-dot">AI</span><h3>' + esc(meta.title) + '</h3>' +
      '<p>已选中「' + esc(meta.skill) + '」Skill。用自然语言描述要安装的' + (kind === 'mcp' ? ' MCP' : ' Skill') + '，我会生成安装草稿供你确认。</p></div>' +
      '<div class="aos-context-pill">AgentOS · 炼铁厂 · ' + (kind === 'mcp' ? 'MCPs' : 'Skills') + '</div>';
    if (state.phase === 'review' || state.phase === 'saved') {
      const sum = draftSummary(kind, state.draft);
      scroll += '<div class="aos-copilot-user">' + esc(state.request) + '</div>' +
        '<article class="aos-copilot-result"><span>' + (state.phase === 'saved' ? '已安装 · Mock' : '草稿已生成 · Mock') + '</span>' +
        '<h3>' + esc(sum.title) + '</h3><p>' + esc(sum.body) + '</p><small>' + esc(sum.meta) + '</small>';
      if (state.phase === 'review') {
        scroll += '<button type="button" class="btn primary" data-cp="confirm">确认安装' + (kind === 'mcp' ? ' MCP' : ' Skill') + '</button>' +
          '<button type="button" class="btn ghost" data-cp="revise">修改请求</button>';
      } else {
        scroll += '<button type="button" class="btn primary" data-cp="done">完成</button>' +
          '<button type="button" class="btn ghost" data-cp="again">继续安装</button>';
      }
      scroll += '</article>';
    }
    if (state.error) scroll += '<div class="note warn" style="margin-top:12px">' + icon('triangle-alert') + '<span>' + esc(state.error) + '</span></div>';
    return '<aside class="aos-copilot" aria-label="安装 Copilot">' +
      '<div class="aos-copilot-top"><span class="aos-spark">' + icon('sparkles') + '</span><b>Copilot</b><span class="aos-copilot-status">安装助手</span>' +
      '<button type="button" class="aos-copilot-close" data-cp="close" aria-label="关闭 Copilot">' + icon('x') + '</button></div>' +
      '<div class="aos-copilot-scroll" id="aosCopilotScroll">' + scroll + '</div>' +
      '<form class="aos-copilot-composer' + (compact ? ' is-compact' : '') + '" id="aosCopilotForm">' +
      '<div class="aos-selected-skill"><span>' + icon('sparkles') + ' ' + esc(meta.skill) + '</span><code>' + esc(meta.code) + '</code></div>' +
      '<textarea id="aosCopilotInput" aria-label="Copilot 对话输入" placeholder="描述要安装的内容…">' + esc(state.input || '') + '</textarea>' +
      '<div class="aos-copilot-foot"><span>Enter 发送 · Shift + Enter 换行</span><button class="btn primary sm" type="submit">发送</button></div>' +
      '</form></aside>';
  }

  function bindPanel(rootEl, state, api) {
    const close = () => api.onClose && api.onClose();
    rootEl.querySelectorAll('[data-cp="close"],[data-cp="done"]').forEach(b => b.addEventListener('click', close));
    const again = rootEl.querySelector('[data-cp="again"]');
    if (again) again.addEventListener('click', () => {
      api.onChange({ phase: 'input', input: prefill(state.kind), request: '', draft: null, error: '', kind: state.kind });
    });
    const revise = rootEl.querySelector('[data-cp="revise"]');
    if (revise) revise.addEventListener('click', () => {
      api.onChange({ phase: 'input', input: state.request || state.input, request: '', draft: null, error: '', kind: state.kind });
    });
    const confirm = rootEl.querySelector('[data-cp="confirm"]');
    if (confirm) confirm.addEventListener('click', () => {
      const res = api.onConfirm(state.draft);
      if (!res || !res.ok) {
        api.onChange(Object.assign({}, state, { error: (res && res.reason) || '安装失败' }));
        return;
      }
      api.onChange(Object.assign({}, state, { phase: 'saved', error: '' }));
      if (api.onSaved) api.onSaved(state.draft);
    });
    const form = rootEl.querySelector('#aosCopilotForm');
    const input = rootEl.querySelector('#aosCopilotInput');
    if (form && input) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) {
          api.onChange(Object.assign({}, state, { error: '请先描述要安装的内容' }));
          return;
        }
        const draft = state.kind === 'mcp' ? parseMcpRequest(text) : parseSkillRequest(text);
        if (state.kind === 'mcp' && svc.tool(draft.id)) {
          api.onChange(Object.assign({}, state, { input: text, error: '标识已存在：' + draft.id + '，请换一个标识' }));
          return;
        }
        if (state.kind === 'skill' && svc.skill(draft.id)) {
          api.onChange(Object.assign({}, state, { input: text, error: '标识已存在：' + draft.id + '，请换一个标识' }));
          return;
        }
        api.onChange({ phase: 'review', input: text, request: text, draft, error: '', kind: state.kind });
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          form.requestSubmit();
        }
      });
      setTimeout(() => { try { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } catch (err) { /* ignore */ } }, 0);
    }
    const scroll = rootEl.querySelector('#aosCopilotScroll');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
    ui.icons();
  }

  function openState(kind) {
    return { kind, phase: 'input', input: prefill(kind), request: '', draft: null, error: '' };
  }

  AOS.installCopilot = {
    createMenuHtml, bindCreateMenu, panelHtml, bindPanel, openState, parseMcpRequest, parseSkillRequest, prefill
  };
})(window);
