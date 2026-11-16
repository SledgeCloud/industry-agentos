/* AgentOS · 智能体工坊：列表、创建、配置、调试与版本发布 */
(function (root) {
  const AOS = root.AOS;
  const { ui, svc, store, policy: P } = AOS;
  const { esc, icon } = ui;
  const GROUP = { internal: '读取厂内资料', public: '读取公开资料', none: '不读取资料' };
  const AGENT_ICONS = ['sparkles', 'bot', 'library', 'flask-conical', 'radar', 'award', 'file-text', 'activity', 'lightbulb', 'search-check', 'clipboard-check', 'chart-line', 'scale', 'boxes'];
  const ICON_MAX = 256 * 1024;

  function iconPickHtml(radioName, current) {
    const cur = current || AGENT_ICONS[0];
    const customOn = ui.isImageIcon(cur);
    const builtinOn = !customOn;
    return '<div class="icon-pick" role="radiogroup" aria-label="图标" data-icon-pick>' +
      AGENT_ICONS.map(i => '<label class="icon-pick-item" title="' + i + '"><input type="radio" name="' + radioName + '" value="' + i + '"' + (builtinOn && i === cur ? ' checked' : '') + '><span class="agent-icon">' + icon(i) + '</span></label>').join('') +
      '<label class="icon-pick-item" title="自定义上传"><input type="radio" name="' + radioName + '" value="__custom__"' + (customOn ? ' checked' : '') + (customOn ? '' : ' disabled') + '><span class="agent-icon" data-custom-preview>' + icon(customOn ? cur : 'image-plus') + '</span></label>' +
      '<button type="button" class="icon-pick-upload" data-icon-upload>' + icon('upload') + '上传图片</button>' +
      '<input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" hidden data-icon-file>' +
      '</div><span class="hint">支持 PNG / JPG / WebP / SVG，不超过 256KB。</span>';
  }

  function readIconPick(root, radioName) {
    const pick = root.querySelector('[data-icon-pick]');
    if (!pick) return AGENT_ICONS[0];
    const checked = pick.querySelector('input[name="' + radioName + '"]:checked');
    if (!checked) return AGENT_ICONS[0];
    if (checked.value === '__custom__') return pick._customIcon || AGENT_ICONS[0];
    return checked.value;
  }

  function bindIconPick(root, radioName, onChange, initial) {
    const pick = root.querySelector('[data-icon-pick]');
    if (!pick) return;
    const file = pick.querySelector('[data-icon-file]');
    const upload = pick.querySelector('[data-icon-upload]');
    const customRadio = pick.querySelector('input[value="__custom__"]');
    const preview = pick.querySelector('[data-custom-preview]');
    if (ui.isImageIcon(initial)) {
      pick._customIcon = initial;
      if (customRadio) customRadio.disabled = false;
    }
    if (upload && file) upload.addEventListener('click', () => file.click());
    if (file) file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      file.value = '';
      if (!f) return;
      if (!/^image\//.test(f.type)) { ui.toast('请选择图片文件', 'warn'); return; }
      if (f.size > ICON_MAX) { ui.toast('图片不能超过 256KB', 'warn'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const data = String(reader.result || '');
        pick._customIcon = data;
        customRadio.disabled = false;
        customRadio.checked = true;
        preview.innerHTML = icon(data);
        if (onChange) onChange(data);
      };
      reader.readAsDataURL(f);
    });
    pick.querySelectorAll('input[name="' + radioName + '"]').forEach(r => r.addEventListener('change', () => {
      if (onChange) onChange(readIconPick(root, radioName));
    }));
  }

  function versionSummary(a) {
    const vs = a.versions || [];
    const on = vs.find(v => v.status === 'online');
    const off = vs.slice().reverse().find(v => v.status === 'offline');
    if (on) return '线上 ' + on.id;
    if (off) return '已下线 ' + off.id;
    return '未发布';
  }

  function releaseActionsHtml(agent, opts) {
    opts = opts || {};
    const prefix = opts.prefix || '';
    if (agent.batch > svc.phase()) {
      return '<button class="btn sm primary" disabled title="计划在' + svc.PHASE_LABEL[agent.batch] + '上线">发布</button>';
    }
    const vs = agent.versions || [];
    const hasPublished = vs.length > 0;
    const online = vs.some(v => v.status === 'online');
    const offline = !online && vs.some(v => v.status === 'offline');
    let html = '<button class="btn sm primary" type="button" data-' + prefix + 'publish="' + esc(agent.id) + '">' + (hasPublished ? '发布新版本' : '发布') + '</button>';
    if (online) html += '<button class="btn sm ghost danger" type="button" data-' + prefix + 'offline="' + esc(agent.id) + '">下线</button>';
    else if (offline) html += '<button class="btn sm" type="button" data-' + prefix + 'online="' + esc(agent.id) + '">上线</button>';
    return html;
  }

  function listOpsHtml(agent) {
    const vs = agent.versions || [];
    const planned = agent.batch > svc.phase();
    const hasPublished = vs.length > 0;
    const online = vs.some(v => v.status === 'online');
    const offline = !online && vs.some(v => v.status === 'offline');
    let html = '<a class="btn sm" href="#/studio/' + agent.id + '">编辑</a>';
    if (planned) {
      html += '<button class="btn sm primary" disabled title="计划在' + svc.PHASE_LABEL[agent.batch] + '上线">发布</button>';
    } else {
      html += '<button class="btn sm primary" type="button" data-list-publish="' + esc(agent.id) + '">' + (hasPublished ? '发布新版本' : '发布') + '</button>';
      if (offline) html += '<button class="btn sm" type="button" data-list-online="' + esc(agent.id) + '">上线</button>';
    }
    const moreItems = [];
    if (!planned && online) {
      moreItems.push('<button type="button" role="menuitem" data-list-offline="' + esc(agent.id) + '">' + icon('power-off') + '下线</button>');
    }
    moreItems.push('<button type="button" role="menuitem" class="danger" data-list-delete="' + esc(agent.id) + '">' + icon('trash-2') + '删除</button>');
    html += '<details class="card-more"><summary class="card-more-btn" aria-label="更多操作">' + icon('ellipsis') + '</summary><div class="card-more-menu" role="menu">' + moreItems.join('') + '</div></details>';
    return html;
  }

  function publishAgent(agent, onDone) {
    if (!agent.draft || !String(agent.draft.name || '').trim()) {
      ui.toast('请先完善智能体名称', 'warn');
      return;
    }
    if (!(agent.draft.allowedModels || []).length) {
      ui.toast('请先在编辑页至少开放一种模型', 'warn');
      return;
    }
    const next = svc.nextVersion(agent);
    const hasPublished = (agent.versions || []).length > 0;
    const name = agent.draft.name;
    ui.modal({
      title: (hasPublished ? '发布新版本 ' : '发布 ') + next,
      okText: hasPublished ? '发布新版本' : '发布',
      body: '<div class="stack"><div class="field"><label for="vNote">版本说明</label><input class="input" id="vNote" placeholder="例如：增加工序筛选提示"></div><div class="note">' + icon('info') + '<span>发布后对广场用户开放。若当前有线上或已下线版本，将被归档，历史会话保留原版本号。</span></div></div>',
      onMount(el, close) {
        el.querySelector('[data-ok]').addEventListener('click', () => {
          agent.versions = agent.versions || [];
          agent.versions.forEach(v => { if (v.status === 'online' || v.status === 'offline') v.status = 'archived'; });
          agent.versions.push({
            id: next, status: 'online', createdAt: svc.now(), onlineAt: svc.now(),
            note: el.querySelector('#vNote').value.trim() || (hasPublished ? '发布新版本' : '首次发布'),
            config: svc.copy(agent.draft)
          });
          agent.updatedAt = svc.now();
          store.save(); close();
          ui.toast(name + ' ' + next + ' 已发布');
          if (onDone) onDone();
        });
      }
    });
  }

  function onlineAgent(agent, onDone) {
    const off = (agent.versions || []).slice().reverse().find(v => v.status === 'offline');
    if (!off) { ui.toast('没有可恢复的下线版本', 'warn'); return; }
    const name = (agent.draft && agent.draft.name) || agent.name || '智能体';
    ui.modal({
      title: '上线', okText: '确认上线',
      body: '<div class="stack"><p>将恢复下线前的版本 <b>' + esc(off.id) + '</b>' + (off.note ? '（' + esc(off.note) + '）' : '') + '，智能体重新对广场开放。</p><div class="note">' + icon('info') + '<span>如需使用当前草稿内容，请先「发布新版本」。</span></div></div>',
      onMount(el, close) {
        el.querySelector('[data-ok]').addEventListener('click', () => {
          (agent.versions || []).forEach(v => { if (v.status === 'online') v.status = 'archived'; });
          off.status = 'online';
          off.onlineAt = svc.now();
          agent.updatedAt = svc.now();
          store.save(); close();
          ui.toast(name + ' ' + off.id + ' 已上线');
          if (onDone) onDone();
        });
      }
    });
  }

  async function offlineAgent(agent, onDone) {
    const name = (agent.draft && agent.draft.name) || agent.name || '智能体';
    const ok = await ui.confirm({ title: '下线智能体', okText: '确认下线', body: '<p>下线后“' + esc(name) + '”不可在广场使用。历史会话不受影响；可随时上线恢复当前版本，或发布新版本。</p>' });
    if (!ok) return;
    (agent.versions || []).forEach(v => { if (v.status === 'online') v.status = 'offline'; });
    agent.updatedAt = svc.now();
    store.save();
    ui.toast('已下线');
    if (onDone) onDone();
  }

  async function deleteAgent(agent, onDone) {
    const name = (agent.draft && agent.draft.name) || agent.name || '智能体';
    const online = (agent.versions || []).some(v => v.status === 'online');
    const ok = await ui.confirm({
      title: '删除智能体',
      okText: '确认删除',
      body: '<p>将永久删除“' + esc(name) + '”及其版本配置。历史会话仍会保留，但无法再进入编辑。</p>' +
        (online ? '<div class="note warn">' + icon('triangle-alert') + '<span>该智能体当前已上线，删除后广场将立即不可用。</span></div>' : '')
    });
    if (!ok) return;
    store.state.agents = store.state.agents.filter(a => a.id !== agent.id);
    store.state.schedules = (store.state.schedules || []).filter(s => s.agentId !== agent.id);
    store.save();
    ui.toast('已删除“' + name + '”');
    if (onDone) onDone();
  }

  AOS.views.studio = function (el) {
    AOS.setCrumbs([{ name: '智能体工坊' }]);

    function draw() {
      const agents = store.state.agents;
      el.innerHTML = '<div class="page"><div class="page-head"><div><h1>智能体工坊</h1><p>配置提示词、模型和 MCP，调试后发布；可随时下线或发布新版本。</p></div><div class="row"><button class="btn" id="manageCats">' + icon('tags') + '分类管理</button><button class="btn primary" id="newAgent">' + icon('plus') + '新建智能体</button></div></div>' +
        '<div class="panel table-wrap"><table class="tbl"><thead><tr><th>智能体</th><th>分类</th><th>批次</th><th>状态</th><th>版本</th><th>更新时间</th><th></th></tr></thead><tbody>' +
        agents.map(a => {
          const c = a.draft;
          const st = svc.portalStatus(a);
          return '<tr class="clickable" data-href="#/studio/' + a.id + '"><td><div class="row"><div class="agent-icon" style="width:28px;height:28px;border-radius:7px">' + icon(c.icon) + '</div><div><div style="font-weight:500;color:var(--ink)">' + esc(c.name) + '</div>' + (a.custom ? '<span class="badge info">自建</span>' : '') + '</div></div></td><td class="nowrap">' + esc(svc.category(c.category).name) + '</td><td>' + svc.PHASE_LABEL[a.batch] + '</td><td>' + ui.status(st) + '</td><td class="nowrap">' + esc(versionSummary(a)) + '</td><td class="nowrap muted">' + esc(a.updatedAt) + '</td><td class="nowrap"><div class="row wrap studio-ops" style="justify-content:flex-end;gap:6px">' +
            listOpsHtml(a) +
            '</div></td></tr>';
        }).join('') + '</tbody></table></div></div>';
      el.querySelectorAll('tr[data-href]').forEach(tr => tr.addEventListener('click', e => {
        if (e.target.closest('a,button,input,label,details,summary')) return;
        location.hash = tr.dataset.href;
      }));
      el.querySelectorAll('.card-more').forEach(d => {
        d.addEventListener('click', e => e.stopPropagation());
        d.addEventListener('toggle', () => {
          if (!d.open) return;
          el.querySelectorAll('.card-more[open]').forEach(o => { if (o !== d) o.open = false; });
        });
      });
      el.querySelector('#manageCats').addEventListener('click', manageCategories);
      el.querySelector('#newAgent').addEventListener('click', createAgent);
      el.querySelectorAll('[data-list-publish]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const agent = svc.agent(b.dataset.listPublish);
        if (agent) publishAgent(agent, draw);
      }));
      el.querySelectorAll('[data-list-online]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const agent = svc.agent(b.dataset.listOnline);
        if (agent) onlineAgent(agent, draw);
      }));
      el.querySelectorAll('[data-list-offline]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const agent = svc.agent(b.dataset.listOffline);
        if (agent) offlineAgent(agent, draw);
      }));
      el.querySelectorAll('[data-list-delete]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const agent = svc.agent(b.dataset.listDelete);
        if (agent) deleteAgent(agent, draw);
      }));
      ui.icons();
    }

    draw();
  };

  function catOptions(selected) {
    return svc.categories().map(c => '<option value="' + c.id + '"' + (c.id === selected ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
  }

  function agentCountByCat(id) {
    return store.state.agents.filter(a => (a.draft || a).category === id).length;
  }

  function manageCategories() {
    function bodyHtml() {
      const cats = svc.categories();
      return '<div class="stack" id="catManageBody"><div class="list-edit" id="catList">' + cats.map(c => {
        const n = agentCountByCat(c.id);
        return '<div class="row cat-edit-row" data-id="' + esc(c.id) + '">' +
          '<span class="type-ico">' + icon(c.icon || 'box') + '</span>' +
          '<input class="input grow" data-rename value="' + esc(c.name) + '" aria-label="分类名称">' +
          '<span class="muted small nowrap">' + n + ' 个智能体</span>' +
          '<button class="btn icon sm ghost" type="button" data-delcat="' + esc(c.id) + '" aria-label="删除" title="' + (n ? '有智能体使用，无法删除' : '删除') + '"' + (n ? ' disabled' : '') + '>' + icon('trash-2') + '</button>' +
          '</div>';
      }).join('') + '</div>' +
        '<div class="row"><input class="input grow" id="newCatName" placeholder="新分类名称"><button class="btn sm" type="button" id="addCat">' + icon('plus') + '添加</button></div>' +
        '<span class="hint">修改名称后点「保存」生效。有智能体占用的分类不可删除。</span></div>';
    }
    ui.modal({
      title: '分类管理', okText: '保存',
      body: bodyHtml(),
      onMount(m, close) {
        function paint() {
          const host = m.querySelector('#catManageBody');
          if (!host) return;
          host.outerHTML = bodyHtml();
          bind();
          ui.icons();
        }
        function bind() {
          m.querySelectorAll('[data-delcat]').forEach(b => b.addEventListener('click', () => {
            const id = b.dataset.delcat;
            if (agentCountByCat(id)) { ui.toast('该分类下还有智能体，无法删除', 'warn'); return; }
            if (svc.categories().length <= 1) { ui.toast('至少保留一个分类', 'warn'); return; }
            store.state.categories = store.state.categories.filter(c => c.id !== id);
            store.save();
            paint();
            ui.toast('已删除分类');
          }));
          const addBtn = m.querySelector('#addCat');
          const input = m.querySelector('#newCatName');
          if (addBtn) addBtn.addEventListener('click', () => {
            const name = input.value.trim();
            if (!name) { input.focus(); return; }
            if (svc.categories().some(c => c.name.trim() === name)) { ui.toast('已有同名分类', 'warn'); return; }
            store.state.categories.push({ id: store.uid('cat'), name, icon: 'box' });
            store.save();
            paint();
            ui.toast('已添加分类');
          });
          if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') addBtn && addBtn.click(); });
        }
        bind();
        m.querySelector('[data-ok]').addEventListener('click', () => {
          const rows = Array.from(m.querySelectorAll('.cat-edit-row'));
          const names = rows.map(r => r.querySelector('[data-rename]').value.trim());
          if (names.some(n => !n)) { ui.toast('分类名称不能为空', 'warn'); return; }
          const seen = new Set();
          for (const n of names) {
            if (seen.has(n)) { ui.toast('分类名称不能重复', 'warn'); return; }
            seen.add(n);
          }
          rows.forEach(r => {
            const c = store.state.categories.find(x => x.id === r.dataset.id);
            if (c) c.name = r.querySelector('[data-rename]').value.trim();
          });
          store.save();
          close();
          ui.toast('分类已保存');
          AOS.render();
        });
      }
    });
  }

  function createAgent() {
    const cats = svc.categories();
    if (!cats.length) { ui.toast('请先在分类管理中添加分类', 'warn'); return; }
    ui.modal({
      title: '新建智能体', okText: '创建并配置',
      body: '<div class="stack"><div class="field"><label for="naName">名称</label><input class="input" id="naName" placeholder="例如：高炉炉况周报助手"><span class="err" id="naErr" hidden>请填写名称</span></div>' +
        '<div class="field"><label for="naCat">分类</label><select class="select" id="naCat">' + catOptions() + '</select></div>' +
        '<div class="field"><span class="field-label">图标</span>' + iconPickHtml('naIcon', 'sparkles') + '</div></div>',
      onMount(el, close) {
        bindIconPick(el, 'naIcon', null, 'sparkles');
        ui.icons();
        el.querySelector('[data-ok]').addEventListener('click', () => {
          const name = el.querySelector('#naName').value.trim();
          if (!name) { el.querySelector('#naErr').hidden = false; el.querySelector('#naName').focus(); return; }
          const a = {
            id: store.uid('custom'), custom: true, name, category: el.querySelector('#naCat').value, icon: readIconPick(el, 'naIcon'), batch: svc.phase(),
            desc: '自建智能体', prompt: '你是' + name + '。只依据检索到的资料回答，每个结论标注引用来源。',
            allowedModels: ['internal', 'external'], defaultModel: 'internal', defaultScope: 'internal',
            tools: ['doc_search'], toolDisabled: [], toolParams: {}, skills: [], skillDisabled: [],
            opening: '你好，我是' + name + '。', suggestions: [], versions: [], updatedAt: svc.now()
          };
          a.draft = svc.pickConfig(a);
          store.state.agents.push(a); store.save(); close();
          location.hash = '#/studio/' + a.id;
          ui.toast('已创建“' + name + '”，配置完成后可发布');
        });
      }
    });
  }

  AOS.views.studioEdit = function (el, route) {
    const agent = svc.agent(route.agentId);
    if (!agent) { el.innerHTML = '<div class="empty">找不到这个智能体。<a href="#/studio">返回工坊</a></div>'; return; }
    let form = svc.copy(agent.draft);
    form.tools = Array.isArray(form.tools) ? form.tools : [];
    form.toolDisabled = Array.isArray(form.toolDisabled) ? form.toolDisabled : [];
    form.toolParams = form.toolParams || {};
    form.skills = Array.isArray(form.skills) ? form.skills : [];
    form.skillDisabled = Array.isArray(form.skillDisabled) ? form.skillDisabled : [];
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

    function isToolOn(id) { return !(form.toolDisabled || []).includes(id); }
    function isSkillOn(id) { return !(form.skillDisabled || []).includes(id); }

    function mcpRow(id) {
      const t = svc.tool(id) || { id, name: id, icon: 'wrench', capability: '（MCP 已不存在）', params: [], group: 'none', source: 'missing', phase: 1 };
      const on = isToolOn(id);
      const params = (form.toolParams && form.toolParams[id]) || {};
      return '<div class="tool-pick-row' + (on ? '' : ' is-off') + '" data-mcp-row="' + esc(id) + '"><div class="agent-icon" style="width:28px;height:28px;border-radius:7px">' + icon(t.icon || 'wrench') + '</div><div class="info"><div class="name">' + esc(t.name) + '<span class="badge ' + (t.source === 'custom' ? 'info' : 'outline') + '">' + (t.source === 'custom' ? '已安装' : (GROUP[t.group] || 'MCP')) + '</span>' + (t.phase > svc.phase() ? '<span class="badge warn">' + svc.PHASE_LABEL[t.phase] + '提供</span>' : '') + (!on ? '<span class="badge">已停用</span>' : '') + '</div><div class="desc">' + esc(t.capability || t.desc || '') + '</div>' +
        ((t.params || []).length ? '<div class="tool-params">' + t.params.map(p => '<div class="field"><label for="tp-' + t.id + '-' + p.key + '">' + esc(p.label) + '</label>' + (p.type === 'select' ? '<select class="select" id="tp-' + t.id + '-' + p.key + '" data-param="' + t.id + '.' + p.key + '"' + (on ? '' : ' disabled') + '>' + p.options.map(o => '<option' + ((params[p.key] || p.default) === o ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>' : '<input class="input" type="number" min="' + p.min + '" max="' + p.max + '" id="tp-' + t.id + '-' + p.key + '" data-param="' + t.id + '.' + p.key + '" value="' + esc(params[p.key] || p.default) + '"' + (on ? '' : ' disabled') + '>') + '</div>').join('') + '</div>' : '') +
        '</div><div class="attach-actions"><label class="row small"><span class="switch"><input type="checkbox" data-toggle-mcp="' + esc(id) + '"' + (on ? ' checked' : '') + ' aria-label="启用 ' + esc(t.name) + '"><span></span></span>' + (on ? '启用' : '停用') + '</label><button class="btn icon sm ghost" type="button" data-remove-mcp="' + esc(id) + '" aria-label="移除">' + icon('trash-2') + '</button></div></div>';
    }

    function skillRow(id) {
      const s = svc.skill(id) || { id, name: id, icon: 'sparkles', desc: '（Skill 已不存在）', category: '自定义', source: 'missing' };
      const on = isSkillOn(id);
      return '<div class="tool-pick-row' + (on ? '' : ' is-off') + '" data-skill-row="' + esc(id) + '"><div class="agent-icon" style="width:28px;height:28px;border-radius:7px">' + icon(s.icon || 'sparkles') + '</div><div class="info"><div class="name">' + esc(s.name) + '<span class="badge outline">' + esc(s.category || '自定义') + '</span>' + (s.source === 'custom' ? '<span class="badge info">已安装</span>' : '') + (!on ? '<span class="badge">已停用</span>' : '') + '</div><div class="desc">' + esc(s.desc || '') + '</div></div><div class="attach-actions"><label class="row small"><span class="switch"><input type="checkbox" data-toggle-skill="' + esc(id) + '"' + (on ? ' checked' : '') + ' aria-label="启用 ' + esc(s.name) + '"><span></span></span>' + (on ? '启用' : '停用') + '</label><button class="btn icon sm ghost" type="button" data-remove-skill="' + esc(id) + '" aria-label="移除">' + icon('trash-2') + '</button></div></div>';
    }

    function mcpSection() {
      const enabled = form.tools.filter(isToolOn).length;
      return '<div class="form-sec"><div class="form-sec-head"><h3>MCPs<span class="muted small" style="font-weight:400;margin-left:8px">已添加 ' + form.tools.length + ' 个 · 启用 ' + enabled + ' 个 · 资料范围决定实际可调用的 MCP</span></h3><button class="btn sm" type="button" id="addMcpBtn">' + icon('plus') + '添加 MCP</button></div>' +
        '<div class="tool-pick">' + (form.tools.length ? form.tools.map(mcpRow).join('') : '<div class="attach-empty">尚未添加 MCP，点击右上角添加。</div>') + '</div></div>';
    }

    function skillSection() {
      const enabled = form.skills.filter(isSkillOn).length;
      return '<div class="form-sec"><div class="form-sec-head"><h3>Skills<span class="muted small" style="font-weight:400;margin-left:8px">已添加 ' + form.skills.length + ' 个 · 启用 ' + enabled + ' 个</span></h3><button class="btn sm" type="button" id="addSkillBtn">' + icon('plus') + '添加 Skill</button></div>' +
        '<div class="tool-pick">' + (form.skills.length ? form.skills.map(skillRow).join('') : '<div class="attach-empty">尚未添加 Skill，点击右上角添加。</div>') + '</div></div>';
    }

    function openAddMcp() {
      const available = svc.toolsCatalog().filter(t => !form.tools.includes(t.id));
      if (!available.length) { ui.toast('没有可添加的 MCP', 'warn'); return; }
      ui.modal({
        title: '添加 MCP', okText: false, foot: '<button class="btn" data-close>关闭</button>',
        body: '<div class="install-grid attach-pick">' + available.map(t => '<button type="button" class="install-pick" data-pick-mcp="' + esc(t.id) + '"><span class="agent-icon">' + icon(t.icon || 'wrench') + '</span><span class="grow"><b>' + esc(t.name) + '</b><span class="muted small">' + esc(t.capability || t.appliesTo || '') + '</span></span></button>').join('') + '</div>',
        onMount(m, close) {
          ui.icons();
          m.querySelectorAll('[data-pick-mcp]').forEach(b => b.addEventListener('click', () => {
            const id = b.dataset.pickMcp;
            if (!form.tools.includes(id)) form.tools.push(id);
            form.toolDisabled = (form.toolDisabled || []).filter(x => x !== id);
            touch(); close(); drawForm(); ui.toast('已添加 MCP');
          }));
        }
      });
    }

    function openAddSkill() {
      const available = svc.skillsCatalog().filter(s => !form.skills.includes(s.id));
      if (!available.length) { ui.toast('没有可添加的 Skill', 'warn'); return; }
      ui.modal({
        title: '添加 Skill', okText: false, foot: '<button class="btn" data-close>关闭</button>',
        body: '<div class="install-grid attach-pick">' + available.map(s => '<button type="button" class="install-pick" data-pick-skill="' + esc(s.id) + '"><span class="agent-icon">' + icon(s.icon || 'sparkles') + '</span><span class="grow"><b>' + esc(s.name) + '</b><span class="muted small">' + esc(s.desc || '') + '</span></span></button>').join('') + '</div>',
        onMount(m, close) {
          ui.icons();
          m.querySelectorAll('[data-pick-skill]').forEach(b => b.addEventListener('click', () => {
            const id = b.dataset.pickSkill;
            if (!form.skills.includes(id)) form.skills.push(id);
            form.skillDisabled = (form.skillDisabled || []).filter(x => x !== id);
            touch(); close(); drawForm(); ui.toast('已添加 Skill');
          }));
        }
      });
    }

    function afterRelease() {
      dirty = false;
      drawForm();
      mountPreview();
      AOS.setCrumbs([{ name: '智能体工坊', href: '#/studio' }, { name: form.name }]);
    }

    function drawForm() {
      const st = svc.portalStatus(agent);
      const err = errors();
      formEl.innerHTML = '<div class="studio-bar"><div class="agent-icon" style="width:28px;height:28px;border-radius:7px">' + icon(form.icon) + '</div><div class="grow"><h2>' + esc(form.name || '未命名') + '</h2><div class="row small muted">' + ui.status(st) + '<span>' + esc(versionSummary(agent)) + '</span>' + (dirty ? '<span class="badge warn">有未保存的修改</span>' : '') + '</div></div>' +
        '<button class="btn sm" id="histBtn">' + icon('history') + '版本历史</button><button class="btn sm" id="saveBtn">保存草稿</button>' +
        releaseActionsHtml(agent, { prefix: 'edit-' }) + '</div>' +
        (planned() ? '<div class="form-sec" style="padding-bottom:0"><div class="note info">' + icon('calendar-clock') + '<span>该智能体计划在' + svc.PHASE_LABEL[agent.batch] + '上线。可以先完成配置和调试。</span></div></div>' : '') +
        '<div class="form-sec"><h3>基本信息</h3><div class="stack"><div class="grid-2"><div class="field"><label for="fName">名称</label><input class="input" id="fName" data-f="name" value="' + esc(form.name) + '">' + (err.name ? '<span class="err">' + err.name + '</span>' : '') + '</div>' +
        '<div class="field"><label for="fCat">分类</label><select class="select" id="fCat" data-f="category">' + catOptions(form.category) + '</select></div></div>' +
        '<div class="field"><span class="field-label">图标</span>' + iconPickHtml('fIcon', form.icon) + '</div>' +
        '<div class="field"><label for="fDesc">描述</label><input class="input" id="fDesc" data-f="desc" value="' + esc(form.desc) + '"></div></div></div>' +
        '<div class="form-sec"><h3>角色提示词</h3><textarea class="textarea" data-f="prompt" aria-label="角色提示词" style="min-height:110px">' + esc(form.prompt) + '</textarea></div>' +
        '<div class="form-sec"><h3>模型与资料范围</h3><div class="stack"><div class="field"><span class="field-label">开放给用户的模型</span><div class="row">' + P.ZONES.map(z => '<label class="check"><input type="checkbox" data-model="' + z.id + '"' + (form.allowedModels.includes(z.id) ? ' checked' : '') + '>' + z.label + '</label>').join('') + '</div>' + (err.models ? '<span class="err">' + err.models + '</span>' : '<span class="hint">' + (P.isLocked(form) ? '只开放内网模型：用户无法切换到外网模型（锁定内网模型）。' : '用户可在对话中切换；只勾选内网模型即为“锁定内网模型”。') + '</span>') + '</div>' +
        '<div class="grid-2"><div class="field"><span class="field-label">默认模型</span><div class="seg">' + P.ZONES.map(z => '<button data-defmodel="' + z.id + '" class="' + (form.defaultModel === z.id ? 'on' : '') + '"' + (form.allowedModels.includes(z.id) ? '' : ' disabled') + '>' + z.label + '</button>').join('') + '</div></div>' +
        '<div class="field"><span class="field-label">默认资料范围</span><div class="seg">' + P.SCOPES.map(s => '<button data-defscope="' + s.id + '" class="' + (form.defaultScope === s.id ? 'on' : '') + '">' + s.label + '</button>').join('') + '</div></div></div></div></div>' +
        mcpSection() + skillSection() +
        '<div class="form-sec"><h3>开场白与推荐问题</h3><div class="stack"><textarea class="textarea" data-f="opening" aria-label="开场白" style="min-height:60px">' + esc(form.opening) + '</textarea><div class="list-edit">' + form.suggestions.map((s, i) => '<div class="row"><input class="input" data-sugg="' + i + '" value="' + esc(s) + '" aria-label="推荐问题 ' + (i + 1) + '"><button class="btn icon sm ghost" data-delsugg="' + i + '" aria-label="删除">' + icon('trash-2') + '</button></div>').join('') + '<button class="btn sm" id="addSugg" style="align-self:flex-start">' + icon('plus') + '添加推荐问题</button></div></div></div>';
      bindForm();
      ui.icons();
    }

    function touch() { dirty = true; const bar = formEl.querySelector('.studio-bar .row'); if (bar && !bar.querySelector('.badge.warn')) bar.insertAdjacentHTML('beforeend', '<span class="badge warn">有未保存的修改</span>'); }

    function bindForm() {
      formEl.querySelectorAll('[data-f]').forEach(i => i.addEventListener('input', () => { form[i.dataset.f] = i.value; touch(); if (i.dataset.f === 'name') formEl.querySelector('.studio-bar h2').textContent = i.value || '未命名'; }));
      formEl.querySelectorAll('select[data-f]').forEach(i => i.addEventListener('change', () => { form[i.dataset.f] = i.value; touch(); }));
      bindIconPick(formEl, 'fIcon', val => {
        form.icon = val;
        touch();
        const mark = formEl.querySelector('.studio-bar .agent-icon');
        if (mark) { mark.innerHTML = icon(val); ui.icons(); }
      }, form.icon);
      formEl.querySelectorAll('[data-model]').forEach(i => i.addEventListener('change', () => {
        const z = i.dataset.model;
        form.allowedModels = i.checked ? P.ZONES.map(x => x.id).filter(id => id === z || form.allowedModels.includes(id)) : form.allowedModels.filter(x => x !== z);
        if (!form.allowedModels.includes(form.defaultModel) && form.allowedModels.length) form.defaultModel = form.allowedModels[0];
        touch(); drawForm();
      }));
      formEl.querySelectorAll('[data-defmodel]').forEach(b => b.addEventListener('click', () => { form.defaultModel = b.dataset.defmodel; touch(); drawForm(); }));
      formEl.querySelectorAll('[data-defscope]').forEach(b => b.addEventListener('click', () => { form.defaultScope = b.dataset.defscope; touch(); drawForm(); }));
      const addMcp = formEl.querySelector('#addMcpBtn'); if (addMcp) addMcp.addEventListener('click', openAddMcp);
      const addSkill = formEl.querySelector('#addSkillBtn'); if (addSkill) addSkill.addEventListener('click', openAddSkill);
      formEl.querySelectorAll('[data-toggle-mcp]').forEach(i => i.addEventListener('change', () => {
        const id = i.dataset.toggleMcp;
        form.toolDisabled = form.toolDisabled || [];
        if (i.checked) form.toolDisabled = form.toolDisabled.filter(x => x !== id);
        else if (!form.toolDisabled.includes(id)) form.toolDisabled.push(id);
        touch(); drawForm();
      }));
      formEl.querySelectorAll('[data-remove-mcp]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.removeMcp;
        form.tools = form.tools.filter(x => x !== id);
        form.toolDisabled = (form.toolDisabled || []).filter(x => x !== id);
        if (form.toolParams) delete form.toolParams[id];
        touch(); drawForm();
      }));
      formEl.querySelectorAll('[data-toggle-skill]').forEach(i => i.addEventListener('change', () => {
        const id = i.dataset.toggleSkill;
        form.skillDisabled = form.skillDisabled || [];
        if (i.checked) form.skillDisabled = form.skillDisabled.filter(x => x !== id);
        else if (!form.skillDisabled.includes(id)) form.skillDisabled.push(id);
        touch(); drawForm();
      }));
      formEl.querySelectorAll('[data-remove-skill]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.removeSkill;
        form.skills = form.skills.filter(x => x !== id);
        form.skillDisabled = (form.skillDisabled || []).filter(x => x !== id);
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
      const pb = formEl.querySelector('[data-edit-publish]');
      if (pb) pb.addEventListener('click', () => { if (!save()) return; publishAgent(agent, afterRelease); });
      const ob = formEl.querySelector('[data-edit-online]');
      if (ob) ob.addEventListener('click', () => onlineAgent(agent, afterRelease));
      const off = formEl.querySelector('[data-edit-offline]');
      if (off) off.addEventListener('click', () => offlineAgent(agent, afterRelease));
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

    function configSummary(c) {
      return '<dl class="kv"><dt>名称</dt><dd>' + esc(c.name) + '</dd><dt>模型</dt><dd>' + c.allowedModels.map(P.zoneLabel).join('、') + '（默认' + P.zoneLabel(c.defaultModel) + '）</dd><dt>默认资料范围</dt><dd>' + P.scopeLabel(c.defaultScope) + '</dd><dt>MCPs</dt><dd>' + c.tools.map(t => svc.tool(t).name).join('、') + '</dd><dt>提示词</dt><dd>' + esc(c.prompt) + '</dd></dl>';
    }

    function showHistory() {
      const vs = agent.versions.slice().reverse();
      ui.drawer({
        title: form.name + ' · 版本历史',
        body: vs.length ? vs.map(v => '<div class="ver-item"><div class="row"><b style="color:var(--ink)">' + esc(v.id) + '</b>' + ui.status(v.status) + '<span class="muted small grow">' + esc(v.createdAt) + '</span><button class="btn sm" data-view="' + v.id + '">查看配置</button><button class="btn sm" data-load="' + v.id + '">载入到草稿</button></div><p class="small" style="margin-top:6px">' + esc(v.note) + '</p></div>').join('') : '<div class="empty">' + icon('history') + '还没有发布过版本。完成配置后点击“发布”。</div>',
        onMount(el, close) {
          el.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { const v = agent.versions.find(x => x.id === b.dataset.view); ui.modal({ title: v.id + ' 配置快照', body: configSummary(v.config), foot: '<button class="btn" data-close>关闭</button>' }); }));
          el.querySelectorAll('[data-load]').forEach(b => b.addEventListener('click', () => {
            const v = agent.versions.find(x => x.id === b.dataset.load);
            form = svc.copy(v.config);
            form.tools = Array.isArray(form.tools) ? form.tools : [];
            form.toolDisabled = Array.isArray(form.toolDisabled) ? form.toolDisabled : [];
            form.skills = Array.isArray(form.skills) ? form.skills : [];
            form.skillDisabled = Array.isArray(form.skillDisabled) ? form.skillDisabled : [];
            dirty = true; close(); drawForm(); mountPreview();
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
