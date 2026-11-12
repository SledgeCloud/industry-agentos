/* AgentOS · 状态存储、会话服务与通用界面组件 */
(function (root) {
  const AOS = root.AOS || (root.AOS = {});
  const P = AOS.policy, E = AOS.engine;
  const KEY = 'agentos.ironworks.v1';
  const copy = v => JSON.parse(JSON.stringify(v));
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  const now = () => fmt(new Date());

  const CONFIG_KEYS = ['name', 'category', 'desc', 'icon', 'template', 'prompt', 'allowedModels', 'defaultModel', 'defaultScope', 'tools', 'toolParams', 'opening', 'suggestions'];
  const pickConfig = a => { const o = {}; CONFIG_KEYS.forEach(k => { o[k] = copy(a[k] === undefined ? (k === 'toolParams' ? {} : k === 'suggestions' || k === 'tools' ? [] : '') : a[k]); }); return o; };

  /* ---------- Store ---------- */
  let state = null;
  let saveTimer = null;
  const store = {
    get state() { return state; },
    load() {
      try { const raw = root.localStorage && root.localStorage.getItem(KEY); if (raw) { state = JSON.parse(raw); ensurePhase3(); store.saveNow(); return; } } catch (e) { /* 浏览器禁用存储时使用内存数据 */ }
      state = seed();
      store.saveNow();
    },
    save() { clearTimeout(saveTimer); saveTimer = setTimeout(store.saveNow, 120); },
    saveNow() { try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 存储已满或被禁用 */ } },
    reset() { try { root.localStorage && root.localStorage.removeItem(KEY); } catch (e) { /* ignore */ } state = seed(); store.saveNow(); },
    uid(prefix) { state.seq = (state.seq || 1) + 1; return prefix + '-' + Date.now().toString(36).slice(-4) + state.seq; }
  };

  function seed() {
    const d = copy(AOS.data);
    d.agents.forEach(a => {
      a.toolParams = a.toolParams || {};
      a.draft = pickConfig(a);
      a.versions.forEach(v => { v.config = pickConfig(a); });
      a.updatedAt = a.versions.length ? a.versions[a.versions.length - 1].createdAt : '2026-11-01 09:00';
    });
    const ra = d.agents.find(a => a.id === 'research-assistant');
    ra.versions[1].config.prompt += ' 回答前提示用户可按工序（高炉、烧结、焦化、球团）缩小检索范围。';
    ra.draft = copy(ra.versions[1].config);
    state = { settings: { phase: 3, userId: 'u-wang' }, agents: d.agents, docs: d.docs, sessions: [], audit: [], policy: d.policy, models: d.models, schedules: d.schedules, customTools: [], customSkills: [], seq: 1 };
    ensurePhase3();
    d.seedSessions.forEach(s => {
      const agent = state.agents.find(a => a.id === s.agentId);
      const user = d.users.find(u => u.id === s.userId);
      const res = svc.resolve(agent, user);
      const session = svc.newSession(agent, res.version, user, 'portal', s.at);
      s.prompts.forEach(p => svc.run(session, p, { zone: s.zone, scope: s.scope, user, at: s.at }));
      const last = session.messages.filter(m => m.role === 'assistant').pop();
      if (last && s.feedback) {
        last.feedback = { rating: s.feedback.rating || null, text: s.feedback.text || '', wrong: s.feedback.wrongSource ? [s.feedback.wrongSource] : [] };
      }
    });
    state.sessions.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    state.audit.sort((a, b) => (a.time < b.time ? 1 : -1));
    return state;
  }

  function ensurePhase3() {
    if (!state.settings) state.settings = { userId: 'u-wang' };
    state.settings.phase = 3;
    if (!Array.isArray(state.customTools)) state.customTools = [];
    if (!Array.isArray(state.customSkills)) state.customSkills = [];
    state.customTools.forEach(t => {
      t.group = 'none';
      delete t.clearance;
      delete t.dataScope;
    });
    (state.agents || []).forEach(a => {
      if (!a.custom && a.batch <= 3 && !(a.versions || []).length) {
        a.versions = [{ id: 'v1.0', status: 'online', createdAt: now(), note: '三期演示上线', trialUsers: [], config: copy(a.draft) }];
        a.updatedAt = now();
      }
    });
  }

  /* ---------- Service ---------- */
  const users = () => AOS.data.users;
  const svc = {
    users,
    currentUser() { return users().find(u => u.id === state.settings.userId) || users()[0]; },
    agent(id) { return state.agents.find(a => a.id === id); },
    toolsCatalog() {
      const builtin = (AOS.data.tools || []).map(t => Object.assign({}, t, { source: 'builtin' }));
      const custom = (state.customTools || []).map(t => Object.assign({}, t, { source: 'custom' }));
      return builtin.concat(custom);
    },
    tool(id) { return svc.toolsCatalog().find(t => t.id === id); },
    skillsCatalog() {
      const builtin = (AOS.data.skills || []).map(s => Object.assign({}, s, { source: 'builtin' }));
      const custom = (state.customSkills || []).map(s => Object.assign({}, s, { source: 'custom' }));
      return builtin.concat(custom);
    },
    skill(id) { return svc.skillsCatalog().find(s => s.id === id); },
    installTool(tool) {
      if (!tool || !tool.id || !tool.name) return { ok: false, reason: '请填写 MCP 名称与标识' };
      if (svc.tool(tool.id)) return { ok: false, reason: '该 MCP 标识已存在：' + tool.id };
      const item = Object.assign({
        icon: 'wrench', group: 'none', phase: 3, appliesTo: '自定义', ingest: '无', capability: '',
        params: [], safety: ['用户自行安装，调用结果写入会话与审计'], endpoint: '', installedAt: now(), installedBy: svc.currentUser().name
      }, tool, { source: 'custom', group: 'none' });
      state.customTools.push(item);
      store.save();
      return { ok: true, item };
    },
    updateTool(id, patch) {
      const item = (state.customTools || []).find(t => t.id === id);
      if (!item) return { ok: false, reason: '只能修改自行安装的 MCP' };
      if (!patch || !patch.name) return { ok: false, reason: '请填写 MCP 名称' };
      Object.assign(item, {
        name: patch.name,
        icon: patch.icon || item.icon,
        endpoint: patch.endpoint != null ? patch.endpoint : item.endpoint,
        appliesTo: patch.appliesTo || item.appliesTo,
        capability: patch.capability || item.capability,
        group: 'none',
        updatedAt: now()
      });
      store.save();
      return { ok: true, item };
    },
    uninstallTool(id) {
      const i = (state.customTools || []).findIndex(t => t.id === id);
      if (i < 0) return { ok: false, reason: '只能卸载自行安装的 MCP' };
      state.customTools.splice(i, 1);
      state.agents.forEach(a => {
        if (a.draft && Array.isArray(a.draft.tools)) a.draft.tools = a.draft.tools.filter(t => t !== id);
        (a.versions || []).forEach(v => { if (v.config && Array.isArray(v.config.tools)) v.config.tools = v.config.tools.filter(t => t !== id); });
      });
      store.save();
      return { ok: true };
    },
    installSkill(skill) {
      if (!skill || !skill.id || !skill.name) return { ok: false, reason: '请填写 Skill 名称与标识' };
      if (svc.skill(skill.id)) return { ok: false, reason: '该 Skill 标识已存在：' + skill.id };
      const item = Object.assign({
        icon: 'sparkles', category: '自定义', desc: '', trigger: '通用', status: 'published',
        installedAt: now(), installedBy: svc.currentUser().name
      }, skill, { source: 'custom' });
      state.customSkills.push(item);
      store.save();
      return { ok: true, item };
    },
    updateSkill(id, patch) {
      const item = (state.customSkills || []).find(s => s.id === id);
      if (!item) return { ok: false, reason: '只能修改自行安装的 Skill' };
      if (!patch || !patch.name) return { ok: false, reason: '请填写 Skill 名称' };
      Object.assign(item, {
        name: patch.name,
        icon: patch.icon || item.icon,
        category: patch.category || item.category,
        trigger: patch.trigger || item.trigger,
        desc: patch.desc || item.desc,
        status: patch.status || item.status || 'published',
        updatedAt: now()
      });
      store.save();
      return { ok: true, item };
    },
    uninstallSkill(id) {
      const i = (state.customSkills || []).findIndex(s => s.id === id);
      if (i < 0) return { ok: false, reason: '只能卸载自行安装的 Skill' };
      state.customSkills.splice(i, 1);
      store.save();
      return { ok: true };
    },
    category(id) { return AOS.data.categories.find(c => c.id === id) || { id, name: '未分类', icon: 'box' }; },
    phase() { return 3; },
    PHASE_LABEL: ['', '一期', '二期', '三期'],
    portalStatus(agent) {
      if (agent.batch > svc.phase()) return 'planned';
      const vs = agent.versions || [];
      if (vs.some(v => v.status === 'online')) return 'online';
      if (vs.some(v => v.status === 'trial')) return 'trial';
      if (vs.some(v => v.status === 'offline')) return 'offline';
      return 'draft';
    },
    resolve(agent, user) {
      const phase = svc.phase();
      if (agent.batch > phase) return { ok: false, status: 'planned', reason: '该智能体计划在' + svc.PHASE_LABEL[agent.batch] + '上线' };
      const vs = agent.versions || [];
      const trial = vs.slice().reverse().find(v => v.status === 'trial');
      const online = vs.slice().reverse().find(v => v.status === 'online');
      if (trial && trial.trialUsers.includes(user.name)) return { ok: true, status: 'trial', version: trial };
      if (online) return { ok: true, status: 'online', version: online };
      if (trial) return { ok: false, status: 'trial', reason: '试用中，仅限试用人员使用：' + trial.trialUsers.join('、') };
      if (vs.some(v => v.status === 'offline')) return { ok: false, status: 'offline', reason: '该智能体已下线，历史会话仍可在会话记录中查看' };
      return { ok: false, status: 'draft', reason: '该智能体尚未发布' };
    },
    configFor(agent, version) {
      return Object.assign({ id: agent.id, flow: agent.flow, constraint: agent.constraint, batch: agent.batch, core: agent.core }, copy(version ? version.config : agent.draft));
    },
    modelFor(zone) { return state.models.find(m => m.zone === zone && m.status === 'up') || null; },
    newSession(agent, version, user, source, at) {
      const t = at || now();
      return { id: store.uid('S'), agentId: agent.id, agentName: agent.draft ? agent.draft.name : agent.name, version: version ? version.id : '调试', userId: user.id, userName: user.name, dept: user.dept, createdAt: t, updatedAt: t, title: '', messages: [], flowState: null, confirmedEgress: false, source, zone: null, scope: null };
    },
    display(text) { return { '#confirm': '确认，开始执行', '#include-low': '采用低可信来源并重新生成' }[text] || text; },
    compute(session, text, opts) {
      const agent = svc.agent(session.agentId);
      const config = opts.config || svc.configFor(agent, (agent.versions || []).find(v => v.id === session.version));
      const user = opts.user || svc.currentUser();
      const model = svc.modelFor(opts.zone);
      return E.respond({
        agent: config, text, zone: opts.zone, scope: opts.scope, mode: opts.mode || 'chat', user, policy: state.policy,
        docs: state.docs, web: AOS.data.web, toolsCatalog: svc.toolsCatalog(), phase: svc.phase(),
        modelName: model ? model.name : null, state: session.flowState ? copy(session.flowState) : null, now: opts.now
      });
    },
    commit(session, text, opts, result) {
      const user = opts.user || svc.currentUser();
      const at = opts.at || now();
      session.messages.push({ role: 'user', text, display: svc.display(text), at });
      const msg = { role: 'assistant', at, zone: opts.zone, scope: opts.scope, mode: opts.mode || 'chat', turn: result.turn, feedback: { rating: null, text: '', wrong: [] } };
      session.messages.push(msg);
      session.flowState = result.state || null;
      session.zone = opts.zone; session.scope = opts.scope;
      session.updatedAt = at;
      if (!session.title) session.title = svc.display(text).slice(0, 40);
      if (session.source !== 'debug') {
        if (!state.sessions.includes(session) && !state.sessions.find(s => s.id === session.id)) state.sessions.unshift(session);
        (result.turn.audit || []).forEach(a => state.audit.unshift(Object.assign({ id: store.uid('A'), time: at, userName: user.name, dept: user.dept, agentName: session.agentName, sessionId: session.id }, a)));
        store.save();
      }
      return msg;
    },
    run(session, text, opts) { return svc.commit(session, text, opts, svc.compute(session, text, opts)); },
    sessionStats(s) {
      const ai = s.messages.filter(m => m.role === 'assistant');
      return {
        rounds: ai.length,
        tokens: ai.reduce((a, m) => a + (m.turn.tokens || 0), 0),
        durationMs: ai.reduce((a, m) => a + (m.turn.durationMs || 0), 0),
        up: ai.some(m => m.feedback && m.feedback.rating === 'up'),
        down: ai.some(m => m.feedback && m.feedback.rating === 'down'),
        hasText: ai.some(m => m.feedback && m.feedback.text),
        wrong: ai.some(m => m.feedback && m.feedback.wrong && m.feedback.wrong.length),
        sentOut: uniqBy([].concat(...ai.map(m => m.turn.sentOut || [])), 'id'),
        blocked: uniqBy([].concat(...ai.map(m => m.turn.blocked || [])), 'id'),
        external: ai.some(m => m.zone === 'external')
      };
    },
    nextVersion(agent) {
      const last = (agent.versions || []).map(v => v.id).sort((a, b) => { const pa = a.slice(1).split('.').map(Number), pb = b.slice(1).split('.').map(Number); return pa[0] - pb[0] || pa[1] - pb[1]; }).pop();
      if (!last) return 'v1.0';
      const [maj, min] = last.slice(1).split('.').map(Number);
      return 'v' + maj + '.' + (min + 1);
    },
    now, fmt, copy, pickConfig
  };
  const uniqBy = (list, key) => { const seen = new Set(); return list.filter(x => (seen.has(x[key]) ? false : seen.add(x[key]))); };

  /* ---------- UI helpers ---------- */
  const esc = s => String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const icon = (name, cls) => '<i data-lucide="' + name + '"' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true"></i>';
  const lv = level => '<span class="lv lv-' + level + '">' + P.levelLabel(level) + '</span>';
  const STATUS = { online: '已上线', trial: '试用中', draft: '草稿', offline: '已下线', planned: '规划中', archived: '已归档' };
  const status = s => '<span class="status ' + s + '">' + (STATUS[s] || s) + '</span>';
  const zoneBadge = z => z === 'external' ? '<span class="badge ext">' + icon('globe') + '外网模型</span>' : '<span class="badge dark">' + icon('shield-check') + '内网模型</span>';
  const TYPE_ICON = { pdf: 'file-text', word: 'file-type', cad: 'drafting-compass', code: 'code', db: 'database' };
  const typeIcon = t => '<span class="type-ico">' + icon(TYPE_ICON[t] || 'file') + '</span>';
  const initials = name => esc(String(name || '?').slice(-2));

  function icons() { if (root.lucide) root.lucide.createIcons({ attrs: { 'stroke-width': 1.75 } }); }

  function toast(text, tone) {
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = 'toast' + (tone ? ' ' + tone : '');
    el.innerHTML = icon(tone === 'warn' ? 'triangle-alert' : 'check') + '<span>' + esc(text) + '</span>';
    box.appendChild(el); icons();
    setTimeout(() => el.remove(), 2600);
  }

  function overlay(html, kind, onMount) {
    const prev = document.activeElement;
    const ov = document.createElement('div');
    ov.className = 'overlay' + (kind === 'drawer' ? ' drawer-overlay' : '');
    ov.innerHTML = html;
    document.body.appendChild(ov);
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(); });
    ov.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    icons();
    const first = ov.querySelector('input:not([type=hidden]),select,textarea,button.primary');
    if (first) setTimeout(() => first.focus(), 30);
    if (onMount) onMount(ov, close);
    return close;
  }

  function modal(o) {
    return overlay('<div class="modal ' + (o.size || '') + '" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"><div class="modal-head"><h3>' + esc(o.title) + '</h3><button class="btn ghost icon sm" data-close aria-label="关闭">' + icon('x') + '</button></div><div class="modal-body">' + o.body + '</div>' + (o.foot === false ? '' : '<div class="modal-foot">' + (o.foot || '<button class="btn" data-close>取消</button><button class="btn primary" data-ok>' + esc(o.okText || '确定') + '</button>') + '</div>') + '</div>', 'modal', o.onMount);
  }

  function drawer(o) {
    return overlay('<aside class="drawer" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"><div class="drawer-head"><h3>' + esc(o.title) + '</h3><button class="btn ghost icon sm" data-close aria-label="关闭">' + icon('x') + '</button></div><div class="drawer-body">' + o.body + '</div>' + (o.foot ? '<div class="modal-foot">' + o.foot + '</div>' : '') + '</aside>', 'drawer', o.onMount);
  }

  function confirmBox(o) {
    return new Promise(resolve => {
      let done = false;
      const close = modal({ title: o.title, body: o.body, okText: o.okText, onMount(el, c) {
        el.querySelector('[data-ok]').addEventListener('click', () => { done = true; c(); resolve(true); });
        const obs = new MutationObserver(() => { if (!document.body.contains(el)) { obs.disconnect(); if (!done) resolve(false); } });
        obs.observe(document.body, { childList: true });
      } });
      return close;
    });
  }

  function download(name, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------- Visuals ---------- */
  function cadThumb(doc, w, h) {
    w = w || 300; h = h || 200;
    const seedNo = E.hash(doc.id + doc.title);
    const lines = [];
    for (let i = 0; i < 7; i++) {
      const r = (k) => ((seedNo >> (i * 3 + k)) & 31) / 31;
      const x1 = 0.1 * w + r(0) * 0.45 * w, y1 = 0.12 * h + r(1) * 0.55 * h;
      lines.push('<rect x="' + x1.toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + (0.08 * w + r(2) * 0.25 * w).toFixed(1) + '" height="' + (0.06 * h + r(3) * 0.2 * h).toFixed(1) + '" fill="none" stroke="#8c8c8c" stroke-width="0.8"/>');
    }
    lines.push('<circle cx="' + (0.62 * w) + '" cy="' + (0.38 * h) + '" r="' + (0.12 * h) + '" fill="none" stroke="#595959" stroke-width="0.8"/>');
    lines.push('<path d="M' + (0.08 * w) + ' ' + (0.78 * h) + ' H ' + (0.6 * w) + ' M' + (0.35 * w) + ' ' + (0.1 * h) + ' V ' + (0.85 * h) + '" stroke="#bfbfbf" stroke-width="0.6" stroke-dasharray="4 3"/>');
    const tb = doc.cad || {};
    const small = w < 120;
    return '<svg class="cad-thumb" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(doc.title) + ' 缩略图">' +
      '<rect x="3" y="3" width="' + (w - 6) + '" height="' + (h - 6) + '" fill="#fff" stroke="#262626" stroke-width="1"/>' + lines.join('') +
      '<rect x="' + (w * 0.64) + '" y="' + (h * 0.78) + '" width="' + (w * 0.34) + '" height="' + (h * 0.2) + '" fill="#fafafa" stroke="#262626" stroke-width="0.8"/>' +
      (small ? '' : '<text x="' + (w * 0.655) + '" y="' + (h * 0.86) + '" font-size="9" fill="#262626" font-family="sans-serif">' + esc(tb.drawingNo || '标题栏未识别') + '</text><text x="' + (w * 0.655) + '" y="' + (h * 0.94) + '" font-size="8" fill="#8c8c8c" font-family="sans-serif">' + esc((tb.version ? '版本 ' + tb.version : '') + (tb.designer ? ' · ' + tb.designer : '')) + '</text>') +
      '</svg>';
  }

  function chart(labels, series) {
    const W = 640, H = 200, L = 36, R = 12, T = 12, B = 26;
    const colors = ['#111111', '#3b5bdb', '#c2410c', '#2b8a3e'];
    const x = i => L + (labels.length === 1 ? 0 : i * (W - L - R) / (labels.length - 1));
    const paths = series.map((s, k) => {
      const min = Math.min(...s.points), max = Math.max(...s.points), span = max - min || 1;
      const y = v => T + (1 - (v - min) / span) * (H - T - B);
      return '<polyline fill="none" stroke="' + colors[k % 4] + '" stroke-width="1.8" points="' + s.points.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ') + '"/>' + s.points.map((v, i) => '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="2.4" fill="' + colors[k % 4] + '"><title>' + esc(s.name + ' ' + labels[i] + '：' + v) + '</title></circle>').join('');
    }).join('');
    const grid = [0, 0.5, 1].map(f => '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + (T + f * (H - T - B)) + '" y2="' + (T + f * (H - T - B)) + '" stroke="#f0f0f0"/>').join('');
    const xl = labels.map((l, i) => '<text x="' + x(i) + '" y="' + (H - 8) + '" font-size="10" text-anchor="middle" fill="#8c8c8c">' + esc(l) + '</text>').join('');
    return '<div class="chart-box"><div class="chart-legend">' + series.map((s, k) => '<span><i style="background:' + colors[k % 4] + '"></i>' + esc(s.name) + '</span>').join('') + '<span class="muted">各指标独立缩放</span></div><svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="趋势图">' + grid + paths + xl + '</svg></div>';
  }

  /* ---------- Turn rendering ---------- */
  const inline = (text, wrong) => esc(text).replace(/\s?\[(\d+)\]/g, (_, n) => '<button class="cite" data-cite="' + n + '" aria-label="查看引用 ' + n + '"' + (wrong && wrong.includes(Number(n)) ? ' style="text-decoration:line-through"' : '') + '>' + n + '</button>');

  function tableHtml(head, rows, wrong) {
    return '<div class="table-wrap"><table><thead><tr>' + head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + inline(c, wrong) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }

  function blockHtml(b, wrong) {
    switch (b.t) {
      case 'p': return '<p>' + inline(b.text, wrong) + '</p>';
      case 'ul': return '<ul>' + b.items.map(i => '<li>' + inline(i, wrong) + '</li>').join('') + '</ul>';
      case 'outline': return '<ol class="outline-list">' + b.items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ol>';
      case 'table': return tableHtml(b.head, b.rows, wrong);
      case 'alert': return '<div class="note ' + (b.tone || '') + '">' + icon(b.tone === 'warn' ? 'shield-alert' : 'info') + '<span>' + esc(b.text) + '</span></div>';
      case 'code': return '<div><div class="code-loc">' + esc(b.loc) + '</div><pre>' + esc(b.text) + '</pre></div>';
      case 'chart': return chart(b.labels, b.series);
      case 'files': return '<div class="files">' + b.items.map(f => {
        const doc = state.docs.find(d => d.id === f.id) || f;
        return '<div class="file-card" data-doc="' + f.id + '" tabindex="0" role="button"><div class="file-thumb">' + (doc.type === 'cad' ? cadThumb(doc, 54, 40) : icon(TYPE_ICON[doc.type] || 'file')) + '</div><div class="grow"><div class="t">' + esc(f.title) + ' <button class="cite" data-cite="' + f.n + '">' + f.n + '</button></div><div class="s">' + esc(f.type) + ' · ' + esc(f.process) + ' · ' + f.year + ' · ' + esc(f.summary) + '</div></div>' + lv(f.level) + '</div>';
      }).join('') + '</div>';
      case 'report': return '<article class="report"><div class="report-head"><h3>' + esc(b.title) + '</h3><div class="row">' + (b.verdict ? '<span class="badge ' + (b.verdict === '建议立项' ? 'ok' : b.verdict === '存在重复' ? 'danger' : 'warn') + '">' + esc(b.verdict) + '</span>' : '') + (b.level && b.level !== 'public' ? lv(b.level) : '') + '</div></div>' + b.sections.map(s => '<h4>' + esc(s.heading) + '</h4>' + s.paras.map(p => '<p>' + inline(p, wrong) + '</p>').join('') + (s.table ? tableHtml(s.table.head, s.table.rows, wrong) : '')).join('') + '</article>';
      default: return '';
    }
  }

  const STEP_ICON = { ok: 'check', empty: 'circle-dashed', blocked: 'shield-alert', running: 'loader-circle' };
  function stepsHtml(steps, opts) {
    if (!steps.length) return '';
    const total = steps.reduce((a, s) => a + s.durationMs, 0);
    const revealed = opts.revealed === undefined ? steps.length : opts.revealed;
    const shown = steps.slice(0, Math.min(steps.length, revealed + 1));
    const running = revealed < steps.length;
    return '<details class="steps"' + (opts.expand || running ? ' open' : '') + '><summary>' + icon('chevron-right', 'chev') + (running ? '正在调用 MCP…' : '调用了 ' + steps.length + ' 次 MCP · ' + (total / 1000).toFixed(1) + ' 秒') + '</summary>' +
      shown.map((s, i) => {
        const isRun = running && i === revealed;
        const st = isRun ? 'running' : s.status;
        return '<div class="step' + (isRun ? ' running' : '') + '"><div class="step-head">' + icon(STEP_ICON[st] || 'check', isRun ? 'spin' : '') + icon(s.icon) + '<span class="name">' + esc(s.name) + '</span><span class="sum">' + (isRun ? '执行中…' : esc(s.summary)) + '</span>' + (isRun ? '' : '<span class="dur">' + (s.durationMs / 1000).toFixed(1) + 's</span>') + '</div>' +
          (isRun ? '' : '<details' + (opts.expand ? ' open' : '') + '><summary>入参与返回</summary><pre>' + esc(JSON.stringify(s.params, null, 2)) + '</pre>' + (s.results.length ? '<ul class="step-results">' + s.results.map(r => '<li class="' + (r.blocked ? 'blocked' : '') + '">' + lv(r.level) + '<span>' + esc(r.title) + '</span><span class="muted">' + esc(r.loc) + '</span>' + (r.blocked ? '<span class="badge warn">未发送给外网模型</span>' : '') + '</li>').join('') + '</ul>' : '') + '</details>') + '</div>';
      }).join('') + '</details>';
  }

  function citesHtml(turn, fb, readonly) {
    if (!turn.citations.length) return '';
    const wrong = (fb && fb.wrong) || [];
    return '<div class="cites"><div class="cites-title">引用来源 ' + turn.citations.length + '</div>' + turn.citations.map(c => '<div class="cite-row' + (wrong.includes(c.n) ? ' wrong' : '') + '"><span class="n">' + c.n + '</span><span class="badge ' + (c.kind === 'web' ? 'ext' : 'outline') + '">' + esc(c.origin) + '</span>' + lv(c.level) + '<span class="title" data-cite="' + c.n + '" tabindex="0" role="button">' + esc(c.title) + '</span><span class="loc">' + esc(c.loc) + '</span>' + (c.credibility ? '<span class="muted small">可信度' + esc(c.credibility) + '</span>' : '') + (readonly ? (wrong.includes(c.n) ? '<span class="badge danger flag">来源有误</span>' : '') : '<button class="btn ghost sm flag" data-wrong="' + c.n + '" title="标记来源有误">' + icon('flag') + (wrong.includes(c.n) ? '已标记' : '来源有误') + '</button>') + '</div>').join('') + '</div>';
  }

  function turnHtml(msg, opts) {
    opts = opts || {};
    const turn = msg.turn;
    const fb = msg.feedback || {};
    const pending = msg.pending;
    let body = stepsHtml(turn.steps, { expand: opts.expandSteps, revealed: pending ? pending.revealed : undefined });
    if (pending) return body + '<div class="typing" aria-label="生成中"><i></i><i></i><i></i></div>';
    body += '<div class="prose">' + turn.blocks.map(b => blockHtml(b, fb.wrong)).join('') + '</div>';
    if (turn.notices.length) body += '<div class="notices">' + turn.notices.map(n => '<div class="note ' + n.tone + '">' + icon(n.tone === 'warn' ? 'shield-alert' : 'info') + '<span>' + esc(n.text) + '</span></div>').join('') + '</div>';
    body += citesHtml(turn, fb, opts.readonly);
    if (!opts.readonly && turn.actions.length && opts.isLast) body += '<div class="msg-actions">' + turn.actions.map(a => '<button class="btn ' + (a.type === 'confirm' ? 'primary' : '') + '" data-act="' + a.type + '" data-format="' + (a.format || '') + '">' + icon({ confirm: 'play', export: 'file-down', 'include-low': 'circle-alert', 'switch-internal': 'shield-check' }[a.type] || 'arrow-right') + esc(a.label) + '</button>').join('') + '</div>';
    else if (!opts.readonly && turn.actions.some(a => a.type === 'export')) body += '<div class="msg-actions">' + turn.actions.filter(a => a.type === 'export').map(a => '<button class="btn sm" data-act="export" data-format="' + a.format + '">' + icon('file-down') + esc(a.label) + '</button>').join('') + '</div>';
    body += '<div class="msg-foot">' + (msg.zone ? zoneBadge(msg.zone) : '') + '<span>' + esc(turn.model || '—') + '</span><span>' + P.scopeLabel(msg.scope) + '</span><span>' + turn.tokens + ' Token</span><span>' + (turn.durationMs / 1000).toFixed(1) + ' 秒</span>' +
      (opts.readonly ? (fb.rating ? '<span class="badge ' + (fb.rating === 'up' ? 'ok' : 'danger') + '">' + icon(fb.rating === 'up' ? 'thumbs-up' : 'thumbs-down') + (fb.rating === 'up' ? '点赞' : '点踩') + '</span>' : '') :
        '<span class="fb"><button class="btn ghost sm icon' + (fb.rating === 'up' ? ' on' : '') + '" data-fb="up" aria-label="点赞">' + icon('thumbs-up') + '</button><button class="btn ghost sm icon' + (fb.rating === 'down' ? ' on' : '') + '" data-fb="down" aria-label="点踩">' + icon('thumbs-down') + '</button><button class="btn ghost sm" data-fb="text">' + icon('message-square') + '反馈</button></span>') + '</div>';
    if (fb.text) body += '<div class="fb-text">' + icon('message-square') + ' 反馈：' + esc(fb.text) + '</div>';
    return body;
  }

  function messagesHtml(session, opts) {
    opts = opts || {};
    const ais = session.messages.filter(m => m.role === 'assistant');
    const lastAi = ais[ais.length - 1];
    return session.messages.map((m, i) => {
      if (m.role === 'user') {
        const isAction = m.text.startsWith('#');
        return '<div class="msg msg-user"><div class="bubble' + (isAction ? ' action' : '') + '">' + (isAction ? icon('play') : '') + esc(m.display || m.text) + '</div></div>';
      }
      return '<div class="msg msg-ai" data-msg="' + i + '"><div class="avatar">' + icon('bot') + '</div><div class="msg-body"><div class="msg-name">' + esc(opts.agentName || session.agentName) + '<span class="badge outline">' + esc(session.version) + '</span><span class="muted small">' + esc(m.at) + '</span></div>' + turnHtml(m, { readonly: opts.readonly, expandSteps: opts.expandSteps, isLast: m === lastAi }) + '</div></div>';
    }).join('');
  }

  /* ---------- Doc / citation drawers ---------- */
  function docDetailHtml(doc) {
    let extra = '';
    if (doc.type === 'cad') extra = '<div style="margin:14px 0">' + cadThumb(doc, 520, 300) + '</div>';
    if (doc.snippets && doc.snippets.length) extra += '<div class="field-label" style="margin:14px 0 6px">内容片段</div>' + doc.snippets.map(s => '<div class="note" style="margin-bottom:6px"><span class="mono muted">' + esc(s.loc) + '</span><span>' + esc(s.text) + '</span></div>').join('');
    if (doc.db) extra += doc.db.tables.map(t => '<div class="field-label" style="margin:14px 0 6px">数据字典 · ' + esc(t.name) + '（' + esc(t.desc) + '）</div><div class="table-wrap panel"><table class="tbl dict"><thead><tr><th>字段</th><th>含义</th><th>单位</th><th>示例值</th></tr></thead><tbody>' + t.fields.map(f => '<tr><td class="mono">' + esc(f.name) + '</td><td>' + esc(f.meaning) + '</td><td>' + esc(f.unit || '—') + '</td><td>' + esc(f.sample) + '</td></tr>').join('') + '</tbody></table></div>').join('');
    return '<dl class="kv">' +
      '<dt>类型</dt><dd>' + esc(E.TYPE_LABEL[doc.type]) + (doc.cad ? ' · ' + esc(doc.cad.format) : '') + '</dd>' +
      '<dt>资料库</dt><dd>' + esc(doc.library) + '</dd><dt>工序 / 课题</dt><dd>' + esc(doc.process) + ' / ' + esc(doc.topic) + '</dd>' +
      '<dt>年份</dt><dd>' + doc.year + '</dd><dt>作者 / 部门</dt><dd>' + esc(doc.author || '—') + ' / ' + esc(doc.dept) + '</dd>' +
      '<dt>密级</dt><dd>' + lv(doc.level) + '</dd><dt>可见范围</dt><dd>' + (doc.acl && doc.acl.length ? esc(doc.acl.join('、')) : '全部部门') + '</dd>' +
      (doc.cad ? '<dt>图号</dt><dd>' + esc(doc.cad.drawingNo || '待补录') + '</dd><dt>版本 / 设计</dt><dd>' + esc(doc.cad.version || '—') + ' / ' + esc(doc.cad.designer || '—') + '</dd>' : '') +
      (doc.code ? '<dt>仓库</dt><dd class="mono">' + esc(doc.code.repo) + ' @ ' + esc(doc.code.branch) + '</dd><dt>语言 / 文件</dt><dd>' + esc(doc.code.lang) + ' · ' + doc.code.files + ' 个文件</dd>' : '') +
      (doc.pages ? '<dt>页数</dt><dd>' + doc.pages + '</dd>' : '') +
      '</dl><p class="muted" style="margin-top:12px">' + esc(doc.summary) + '</p>' + extra;
  }

  function openDoc(id) {
    const doc = state.docs.find(d => d.id === id);
    if (!doc) return;
    if (!P.canView(svc.currentUser(), doc)) { toast('你没有权限查看这份资料', 'warn'); return; }
    drawer({ title: doc.title, body: docDetailHtml(doc) });
  }

  function openCitation(c, onWrong) {
    if (c.kind === 'doc') return openDoc(c.refId);
    const w = AOS.data.web.find(x => x.id === c.refId) || {};
    drawer({ title: c.title, body: '<dl class="kv"><dt>来源</dt><dd>' + esc(w.source) + '</dd><dt>发布时间</dt><dd>' + esc(w.date) + '</dd><dt>可信度</dt><dd>' + esc(w.credibility) + '</dd><dt>网址</dt><dd class="mono">' + esc(w.url) + '</dd></dl><p style="margin-top:12px">' + esc(w.summary) + '</p><div class="note" style="margin-top:12px">' + icon('info') + '<span>演示数据：网页内容为 Mock，地址不可访问。</span></div>', foot: onWrong ? '<button class="btn" data-wrong-here>' + icon('flag') + '标记来源有误</button>' : '', onMount(el, close) { const b = el.querySelector('[data-wrong-here]'); if (b) b.addEventListener('click', () => { onWrong(); close(); }); } });
  }

  function exportTurn(session, msg, format) {
    const report = msg.turn.blocks.find(b => b.t === 'report');
    const title = report ? report.title : session.title || session.agentName;
    const doc = { title, agentName: session.agentName + ' ' + session.version, time: msg.at, level: report ? report.level : maxLevel(msg.turn.citations), blocks: msg.turn.blocks, citations: msg.turn.citations };
    const safe = title.replace(/[\\/:*?"<>|]/g, '_');
    if (format === 'md') download(safe + '.md', E.toMarkdown(doc), 'text/markdown;charset=utf-8');
    else download(safe + '.doc', '\ufeff' + E.toWordHtml(doc), 'application/msword');
    toast('已导出' + (format === 'md' ? ' Markdown' : ' Word') + '：' + safe);
  }
  const maxLevel = cites => cites.reduce((best, c) => (P.levelRank(c.level) > P.levelRank(best) ? c.level : best), 'public');

  AOS.store = store;
  AOS.svc = svc;
  AOS.ui = { esc, icon, lv, status, STATUS, zoneBadge, typeIcon, TYPE_ICON, initials, icons, toast, modal, drawer, confirm: confirmBox, download, cadThumb, chart, inline, turnHtml, messagesHtml, openDoc, openCitation, docDetailHtml, exportTurn };
})(typeof window !== 'undefined' ? window : globalThis);
