/* AgentOS · 智能体工坊：列表、创建、配置、调试与版本发布 */
(function (root) {
  const AOS = root.AOS;
  const { ui, svc, store, policy: P } = AOS;
  const { esc, icon } = ui;
  const TEMPLATES = [
    { id: 'qa', name: '问答型', icon: 'message-square', desc: '检索资料后直接回答并标注引用', tools: ['doc_search'] },
    { id: 'report', name: '报告型', icon: 'file-text', desc: '先确认大纲，再分章节检索撰写并导出', tools: ['doc_search', 'web_search', 'web_fetch', 'report_export'] },
    { id: 'workflow', name: '工作流型', icon: 'workflow', desc: '按固定步骤处理输入，输出结构化结果', tools: ['doc_search', 'report_export'] }
  ];
  const tplName = id => (TEMPLATES.find(t => t.id === id) || TEMPLATES[0]).name;
  const GROUP = { internal: '读取厂内资料', public: '读取公开资料', none: '不读取资料' };

  function versionSummary(a) {
    const vs = a.versions || [];
    const on = vs.find(v => v.status === 'online'), tr = vs.find(v => v.status === 'trial');
    const parts = [];
    if (on) parts.push('线上 ' + on.id);
    if (tr) parts.push('试用 ' + tr.id);
    return parts.join(' · ') || '未发布';
  }

  AOS.views.studio = function (el) {
    AOS.setCrumbs([{ name: '智能体工坊' }]);
    const agents = store.state.agents;
    el.innerHTML = '<div class="page"><div class="page-head"><div><h1>智能体工坊</h1><p>配置提示词、模型和 MCP，调试后发布试用，再正式上线。</p></div><button class="btn primary" id="newAgent">' + icon('plus') + '新建智能体</button></div>' +
      '<div class="panel table-wrap"><table class="tbl"><thead><tr><th>智能体</th><th>分类</th><th>模板</th><th>批次</th><th>状态</th><th>版本</th><th>更新时间</th><th></th></tr></thead><tbody>' +
      agents.map(a => {
        const c = a.draft;
        const st = svc.portalStatus(a);
        const res = svc.resolve(a, svc.currentUser());
        return '<tr class="clickable" data-href="#/studio/' + a.id + '"><td><div class="row"><div class="agent-icon" style="width:28px;height:28px;border-radius:7px">' + icon(c.icon) + '</div><div><div style="font-weight:500;color:var(--ink)">' + esc(c.name) + '</div>' + (a.core ? '<span class="badge dark">核心场景</span>' : '') + (a.custom ? '<span class="badge info">自建</span>' : '') + '</div></div></td><td class="nowrap">' + esc(svc.category(c.category).name) + '</td><td>' + tplName(c.template) + '</td><td>' + svc.PHASE_LABEL[a.batch] + '</td><td>' + ui.status(st) + '</td><td class="nowrap">' + esc(versionSummary(a)) + '</td><td class="nowrap muted">' + esc(a.updatedAt) + '</td><td class="nowrap"><a class="btn sm" href="#/studio/' + a.id + '">编辑配置</a> ' + (res.ok ? '<a class="btn sm ghost" href="#/chat/' + a.id + '">对话</a>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    el.querySelectorAll('tr[data-href]').forEach(tr => tr.addEventListener('click', e => { if (!e.target.closest('a')) location.hash = tr.dataset.href; }));
    el.querySelector('#newAgent').addEventListener('click', createAgent);
  };

  function createAgent() {
    ui.modal({
      title: '新建智能体', okText: '创建并配置',
      body: '<div class="stack"><div class="field"><label for="naName">名称</label><input class="input" id="naName" placeholder="例如：高炉炉况周报助手"><span class="err" id="naErr" hidden>请填写名称</span></div>' +
        '<div class="field"><label for="naCat">分类</label><select class="select" id="naCat">' + AOS.data.categories.map(c => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('') + '</select></div>' +
        '<div class="field"><span class="field-label">模板</span><div class="template-pick">' + TEMPLATES.map((t, i) => '<label><input type="radio" name="naTpl" value="' + t.id + '"' + (i === 0 ? ' checked' : '') + '><b>' + icon(t.icon) + t.name + '</b><span>' + t.desc + '</span></label>').join('') + '</div></div></div>',
      onMount(el, close) {
        el.querySelector('[data-ok]').addEventListener('click', () => {
          const name = el.querySelector('#naName').value.trim();
          if (!name) { el.querySelector('#naErr').hidden = false; el.querySelector('#naName').focus(); return; }
          const tpl = TEMPLATES.find(t => t.id === el.querySelector('input[name=naTpl]:checked').value);
          const a = {
            id: store.uid('custom'), custom: true, name, category: el.querySelector('#naCat').value, icon: tpl.icon, template: tpl.id, batch: svc.phase(),
            desc: '自建' + tpl.name + '智能体', prompt: '你是' + name + '。只依据检索到的资料回答，每个结论标注引用来源。',
            allowedModels: ['internal', 'external'], defaultModel: 'internal', defaultScope: 'internal', tools: tpl.tools.slice(), toolParams: {},
            opening: '你好，我是' + name + '。', suggestions: [], versions: [], updatedAt: svc.now()
          };
          a.draft = svc.pickConfig(a);
          store.state.agents.push(a); store.save(); close();
          location.hash = '#/studio/' + a.id;
          ui.toast('已创建“' + name + '”，配置完成后可发布试用');
        });
      }
    });
  }

  AOS.views.studioEdit = function (el, route) {
    const agent = svc.agent(route.agentId);
    if (!agent) { el.innerHTML = '<div class="empty">找不到这个智能体。<a href="#/studio">返回工坊</a></div>'; return; }
    let form = svc.copy(agent.draft);
    let dirty = false, panel = null;
    const planned = () => agent.batch > svc.phase();
    AOS.setCrumbs([{ name: '智能体工坊', href: '#/studio' }, { name: form.name }]);

    el.innerHTML = '<div class="studio"><section class="studio-form" id="sform"></section><section class="studio-preview" id="spreview"></section></div>';
    const formEl = el.querySelector('#sform');

    function errors() {
      const e = {};
      if (!form.name.trim()) e.name = '请填写名称';
      if (!form.allowedModels.length) e.models = '至少开放一种模型';
      return e;
    }

    function toolRow(t) {
      const on = form.tools.includes(t.id);
      const params = (form.toolParams && form.toolParams[t.id]) || {};
      return '<div class="tool-pick-row"><label class="check" style="margin-top:2px"><input type="checkbox" data-tool="' + t.id + '"' + (on ? ' checked' : '') + '><span class="sr-only">' + esc(t.name) + '</span></label><div class="info"><div class="name">' + icon(t.icon) + esc(t.name) + '<span class="badge ' + (t.source === 'custom' ? 'info' : 'outline') + '">' + (t.source === 'custom' ? '已安装' : GROUP[t.group]) + '</span>' + (t.phase > svc.phase() ? '<span class="badge warn">' + svc.PHASE_LABEL[t.phase] + '提供</span>' : '') + '</div><div class="desc">' + esc(t.capability) + '</div>' +
        (on ? '<div class="tool-params">' + t.params.map(p => '<div class="field"><label for="tp-' + t.id + '-' + p.key + '">' + esc(p.label) + '</label>' + (p.type === 'select' ? '<select class="select" id="tp-' + t.id + '-' + p.key + '" data-param="' + t.id + '.' + p.key + '">' + p.options.map(o => '<option' + ((params[p.key] || p.default) === o ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>' : '<input class="input" type="number" min="' + p.min + '" max="' + p.max + '" id="tp-' + t.id + '-' + p.key + '" data-param="' + t.id + '.' + p.key + '" value="' + esc(params[p.key] || p.default) + '">') + '</div>').join('') + '</div>' : '') + '</div></div>';
    }

    function drawForm() {
      const st = svc.portalStatus(agent);
      const err = errors();
      const vs = agent.versions || [];
      formEl.innerHTML = '<div class="studio-bar"><div class="agent-icon" style="width:28px;height:28px;border-radius:7px">' + icon(form.icon) + '</div><div class="grow"><h2>' + esc(form.name || '未命名') + '</h2><div class="row small muted">' + ui.status(st) + '<span>' + esc(versionSummary(agent)) + '</span>' + (dirty ? '<span class="badge warn">有未保存的修改</span>' : '') + '</div></div>' +
        '<button class="btn sm" id="histBtn">' + icon('history') + '版本历史</button><button class="btn sm" id="saveBtn">保存草稿</button>' +
        '<button class="btn sm" id="trialBtn"' + (planned() ? ' disabled title="计划在' + svc.PHASE_LABEL[agent.batch] + '上线"' : '') + '>发布试用</button>' +
        '<button class="btn sm primary" id="onlineBtn"' + (planned() ? ' disabled' : '') + '>上线</button>' +
        (vs.some(v => v.status === 'online') ? '<button class="btn sm ghost danger" id="offBtn">下线</button>' : '') + '</div>' +
        (planned() ? '<div class="form-sec" style="padding-bottom:0"><div class="note info">' + icon('calendar-clock') + '<span>该智能体计划在' + svc.PHASE_LABEL[agent.batch] + '上线。可以先完成配置和调试。</span></div></div>' : '') +
        '<div class="form-sec"><h3>基本信息</h3><div class="stack"><div class="grid-2"><div class="field"><label for="fName">名称</label><input class="input" id="fName" data-f="name" value="' + esc(form.name) + '">' + (err.name ? '<span class="err">' + err.name + '</span>' : '') + '</div>' +
        '<div class="field"><label for="fCat">分类</label><select class="select" id="fCat" data-f="category">' + AOS.data.categories.map(c => '<option value="' + c.id + '"' + (c.id === form.category ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></div></div>' +
        '<div class="field"><label for="fDesc">描述</label><input class="input" id="fDesc" data-f="desc" value="' + esc(form.desc) + '"></div>' +
        '<div class="field"><span class="field-label">模板</span><div class="template-pick">' + TEMPLATES.map(t => '<label><input type="radio" name="fTpl" value="' + t.id + '"' + (t.id === form.template ? ' checked' : '') + '><b>' + icon(t.icon) + t.name + '</b><span>' + t.desc + '</span></label>').join('') + '</div>' + (agent.flow && !agent.custom ? '<span class="hint">内置智能体使用专属流程，修改模板只影响新建时的默认配置。</span>' : '') + '</div></div></div>' +
        '<div class="form-sec"><h3>角色提示词</h3><textarea class="textarea" data-f="prompt" aria-label="角色提示词" style="min-height:110px">' + esc(form.prompt) + '</textarea></div>' +
        '<div class="form-sec"><h3>模型与资料范围</h3><div class="stack"><div class="field"><span class="field-label">开放给用户的模型</span><div class="row">' + P.ZONES.map(z => '<label class="check"><input type="checkbox" data-model="' + z.id + '"' + (form.allowedModels.includes(z.id) ? ' checked' : '') + '>' + z.label + '</label>').join('') + '</div>' + (err.models ? '<span class="err">' + err.models + '</span>' : '<span class="hint">' + (P.isLocked(form) ? '只开放内网模型：用户无法切换到外网模型（锁定内网模型）。' : '用户可在对话中切换；只勾选内网模型即为“锁定内网模型”。') + '</span>') + '</div>' +
        '<div class="grid-2"><div class="field"><span class="field-label">默认模型</span><div class="seg">' + P.ZONES.map(z => '<button data-defmodel="' + z.id + '" class="' + (form.defaultModel === z.id ? 'on' : '') + '"' + (form.allowedModels.includes(z.id) ? '' : ' disabled') + '>' + z.label + '</button>').join('') + '</div></div>' +
        '<div class="field"><span class="field-label">默认资料范围</span><div class="seg">' + P.SCOPES.map(s => '<button data-defscope="' + s.id + '" class="' + (form.defaultScope === s.id ? 'on' : '') + '">' + s.label + '</button>').join('') + '</div></div></div></div></div>' +
        '<div class="form-sec"><h3>MCPs<span class="muted small" style="font-weight:400">已勾选 ' + form.tools.length + ' 个 · 资料范围决定每轮对话实际可调用的 MCP</span></h3><div class="tool-pick">' + svc.toolsCatalog().map(toolRow).join('') + '</div></div>' +
        '<div class="form-sec"><h3>开场白与推荐问题</h3><div class="stack"><textarea class="textarea" data-f="opening" aria-label="开场白" style="min-height:60px">' + esc(form.opening) + '</textarea><div class="list-edit">' + form.suggestions.map((s, i) => '<div class="row"><input class="input" data-sugg="' + i + '" value="' + esc(s) + '" aria-label="推荐问题 ' + (i + 1) + '"><button class="btn icon sm ghost" data-delsugg="' + i + '" aria-label="删除">' + icon('trash-2') + '</button></div>').join('') + '<button class="btn sm" id="addSugg" style="align-self:flex-start">' + icon('plus') + '添加推荐问题</button></div></div></div>';
      bindForm();
      ui.icons();
    }

    function touch() { dirty = true; const bar = formEl.querySelector('.studio-bar .row'); if (bar && !bar.querySelector('.badge.warn')) bar.insertAdjacentHTML('beforeend', '<span class="badge warn">有未保存的修改</span>'); }

    function bindForm() {
      formEl.querySelectorAll('[data-f]').forEach(i => i.addEventListener('input', () => { form[i.dataset.f] = i.value; touch(); if (i.dataset.f === 'name') formEl.querySelector('.studio-bar h2').textContent = i.value || '未命名'; }));
      formEl.querySelectorAll('select[data-f]').forEach(i => i.addEventListener('change', () => { form[i.dataset.f] = i.value; touch(); }));
      formEl.querySelectorAll('input[name=fTpl]').forEach(i => i.addEventListener('change', () => { form.template = i.value; touch(); }));
      formEl.querySelectorAll('[data-model]').forEach(i => i.addEventListener('change', () => {
        const z = i.dataset.model;
        form.allowedModels = i.checked ? P.ZONES.map(x => x.id).filter(id => id === z || form.allowedModels.includes(id)) : form.allowedModels.filter(x => x !== z);
        if (!form.allowedModels.includes(form.defaultModel) && form.allowedModels.length) form.defaultModel = form.allowedModels[0];
        touch(); drawForm();
      }));
      formEl.querySelectorAll('[data-defmodel]').forEach(b => b.addEventListener('click', () => { form.defaultModel = b.dataset.defmodel; touch(); drawForm(); }));
      formEl.querySelectorAll('[data-defscope]').forEach(b => b.addEventListener('click', () => { form.defaultScope = b.dataset.defscope; touch(); drawForm(); }));
      formEl.querySelectorAll('[data-tool]').forEach(i => i.addEventListener('change', () => {
        const id = i.dataset.tool;
        form.tools = i.checked ? svc.toolsCatalog().map(t => t.id).filter(t => t === id || form.tools.includes(t)) : form.tools.filter(t => t !== id);
        touch(); drawForm();
      }));
      formEl.querySelectorAll('[data-param]').forEach(i => i.addEventListener('change', () => {
        const [tid, key] = i.dataset.param.split('.');
        form.toolParams = form.toolParams || {}; form.toolParams[tid] = form.toolParams[tid] || {};
        form.toolParams[tid][key] = i.type === 'number' ? Number(i.value) : i.value; touch();
      }));
      formEl.querySelectorAll('[data-sugg]').forEach(i => i.addEventListener('input', () => { form.suggestions[Number(i.dataset.sugg)] = i.value; touch(); }));
      formEl.querySelectorAll('[data-delsugg]').forEach(b => b.addEventListener('click', () => { form.suggestions.splice(Number(b.dataset.delsugg), 1); touch(); drawForm(); }));
      formEl.querySelector('#addSugg').addEventListener('click', () => { form.suggestions.push(''); touch(); drawForm(); const last = formEl.querySelectorAll('[data-sugg]'); last[last.length - 1].focus(); });
      formEl.querySelector('#saveBtn').addEventListener('click', () => save() && ui.toast('已保存草稿'));
      formEl.querySelector('#histBtn').addEventListener('click', showHistory);
      const tb = formEl.querySelector('#trialBtn'); if (tb) tb.addEventListener('click', publishTrial);
      const ob = formEl.querySelector('#onlineBtn'); if (ob) ob.addEventListener('click', goOnline);
      const off = formEl.querySelector('#offBtn'); if (off) off.addEventListener('click', goOffline);
    }

    function clean() { form.suggestions = form.suggestions.map(s => s.trim()).filter(Boolean); }
    function save() {
      clean();
      const err = errors();
      if (Object.keys(err).length) { drawForm(); ui.toast('请先修正表单中的问题', 'warn'); return false; }
      agent.draft = svc.copy(form); agent.updatedAt = svc.now(); dirty = false;
      store.save(); drawForm(); mountPreview();
      AOS.setCrumbs([{ name: '智能体工坊', href: '#/studio' }, { name: form.name }]);
      return true;
    }

    function publishTrial() {
      if (!save()) return;
      const next = svc.nextVersion(agent);
      ui.modal({
        title: '发布试用版 ' + next, okText: '发布试用',
        body: '<div class="stack"><div class="field"><label for="vNote">版本说明</label><input class="input" id="vNote" placeholder="例如：增加工序筛选提示"></div><div class="field"><span class="field-label">试用人员</span><div class="stack" style="gap:6px">' + svc.users().map(u => '<label class="check"><input type="checkbox" value="' + esc(u.name) + '"' + (u.id === svc.currentUser().id ? ' checked' : '') + '>' + esc(u.name + ' · ' + u.dept) + '</label>').join('') + '</div><span class="hint">只有试用人员能看到并使用试用版；其他用户继续使用线上版本。</span></div></div>',
        onMount(el, close) {
          el.querySelector('[data-ok]').addEventListener('click', () => {
            const people = Array.from(el.querySelectorAll('input[type=checkbox]:checked')).map(i => i.value);
            if (!people.length) { ui.toast('至少选择一位试用人员', 'warn'); return; }
            agent.versions.forEach(v => { if (v.status === 'trial') v.status = 'archived'; });
            agent.versions.push({ id: next, status: 'trial', createdAt: svc.now(), note: el.querySelector('#vNote').value.trim() || '发布试用', trialUsers: people, config: svc.copy(agent.draft) });
            store.save(); close(); drawForm(); ui.toast('已发布试用版 ' + next);
          });
        }
      });
    }

    function goOnline() {
      if (!save()) return;
      const trial = agent.versions.slice().reverse().find(v => v.status === 'trial');
      const next = svc.nextVersion(agent);
      ui.modal({
        title: '上线', okText: '确认上线',
        body: '<div class="stack">' + (trial ? '<label class="check"><input type="radio" name="onSrc" value="trial" checked>将试用版 ' + esc(trial.id) + ' 上线（' + esc(trial.note) + '）</label>' : '') + '<label class="check"><input type="radio" name="onSrc" value="draft"' + (trial ? '' : ' checked') + '>将当前草稿直接上线为 ' + next + '（跳过试用）</label><div class="note">' + icon('info') + '<span>上线后对所有有权限的用户开放；原线上版本归档，历史会话保留原版本号。</span></div></div>',
        onMount(el, close) {
          el.querySelector('[data-ok]').addEventListener('click', () => {
            const src = el.querySelector('input[name=onSrc]:checked').value;
            agent.versions.forEach(v => { if (v.status === 'online' || v.status === 'offline') v.status = 'archived'; });
            let id;
            if (src === 'trial') { trial.status = 'online'; trial.onlineAt = svc.now(); id = trial.id; }
            else { agent.versions.push({ id: next, status: 'online', createdAt: svc.now(), note: '草稿直接上线', trialUsers: [], config: svc.copy(agent.draft) }); id = next; }
            store.save(); close(); drawForm(); ui.toast(form.name + ' ' + id + ' 已上线');
          });
        }
      });
    }

    async function goOffline() {
      const ok = await ui.confirm({ title: '下线智能体', okText: '确认下线', body: '<p>下线后用户无法再与“' + esc(form.name) + '”对话，历史会话和导出不受影响。可以随时重新上线。</p>' });
      if (!ok) return;
      agent.versions.forEach(v => { if (v.status === 'online') v.status = 'offline'; });
      store.save(); drawForm(); ui.toast('已下线');
    }

    function configSummary(c) {
      return '<dl class="kv"><dt>名称</dt><dd>' + esc(c.name) + '</dd><dt>模型</dt><dd>' + c.allowedModels.map(P.zoneLabel).join('、') + '（默认' + P.zoneLabel(c.defaultModel) + '）</dd><dt>默认资料范围</dt><dd>' + P.scopeLabel(c.defaultScope) + '</dd><dt>MCPs</dt><dd>' + c.tools.map(t => svc.tool(t).name).join('、') + '</dd><dt>提示词</dt><dd>' + esc(c.prompt) + '</dd></dl>';
    }

    function showHistory() {
      const vs = agent.versions.slice().reverse();
      ui.drawer({
        title: form.name + ' · 版本历史',
        body: vs.length ? vs.map(v => '<div class="ver-item"><div class="row"><b style="color:var(--ink)">' + esc(v.id) + '</b>' + ui.status(v.status) + '<span class="muted small grow">' + esc(v.createdAt) + '</span><button class="btn sm" data-view="' + v.id + '">查看配置</button><button class="btn sm" data-load="' + v.id + '">载入到草稿</button></div><p class="small" style="margin-top:6px">' + esc(v.note) + '</p>' + (v.trialUsers && v.trialUsers.length ? '<p class="small muted">试用人员：' + esc(v.trialUsers.join('、')) + '</p>' : '') + '</div>').join('') : '<div class="empty">' + icon('history') + '还没有发布过版本。完成配置后点击“发布试用”。</div>',
        onMount(el, close) {
          el.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { const v = agent.versions.find(x => x.id === b.dataset.view); ui.modal({ title: v.id + ' 配置快照', body: configSummary(v.config), foot: '<button class="btn" data-close>关闭</button>' }); }));
          el.querySelectorAll('[data-load]').forEach(b => b.addEventListener('click', () => {
            const v = agent.versions.find(x => x.id === b.dataset.load);
            form = svc.copy(v.config); dirty = true; close(); drawForm(); mountPreview();
            ui.toast('已将 ' + v.id + ' 的配置载入草稿，保存并发布后生效');
          }));
        }
      });
    }

    function mountPreview() {
      if (panel) panel.destroy();
      const host = el.querySelector('#spreview');
      const cfg = Object.assign({ id: agent.id, flow: agent.flow, constraint: agent.constraint, batch: agent.batch }, svc.copy(form));
      if (!cfg.allowedModels.length) { host.innerHTML = '<div class="empty">' + icon('server-off') + '至少开放一种模型后才能调试。</div>'; ui.icons(); return; }
      panel = AOS.chatPanel(host, {
        agent, config: cfg, version: null, source: 'debug',
        head: '<div class="chat-head"><div class="grow"><h2>调试预览</h2><div class="small muted">使用当前表单配置，调试会话不计入会话记录</div></div><button class="btn sm" id="applyCfg">' + icon('refresh-cw') + '应用最新配置</button></div>'
      });
      host.querySelector('#applyCfg').addEventListener('click', () => { mountPreview(); ui.toast('已按最新配置重新开始调试'); });
    }

    drawForm();
    mountPreview();
    return () => { if (panel) panel.destroy(); };
  };
})(window);
