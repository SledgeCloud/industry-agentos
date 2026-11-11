/* AgentOS · 管理控制台：出网策略、模型网关、审计日志、定时运行、演示设置 */
(function (root) {
  const AOS = root.AOS;
  const { ui, svc, store, policy: P } = AOS;
  const { esc, icon } = ui;
  const isAdmin = () => svc.currentUser().id === 'u-chen';

  function adminNote() {
    return isAdmin() ? '' : '<div class="note warn" style="margin-bottom:14px">' + icon('lock') + '<span>当前用户不是平台管理员，只能查看。<button class="link-btn" data-be-admin>切换为平台管理员（陈晓）</button></span></div>';
  }
  function bindBeAdmin(el) {
    const b = el.querySelector('[data-be-admin]');
    if (b) b.addEventListener('click', () => { store.state.settings.userId = 'u-chen'; store.save(); document.getElementById('userSelect').value = 'u-chen'; ui.toast('已切换为平台管理员 陈晓'); AOS.render(); });
  }

  /* ---------- 出网策略 ---------- */
  AOS.views.policy = function (el) {
    AOS.setCrumbs([{ name: '管理' }, { name: '出网策略' }]);
    const pol = store.state.policy;
    const admin = isAdmin();
    function draw() {
      const allowedOrgs = Object.keys(pol.internalToExternal).filter(o => pol.internalToExternal[o]);
      el.innerHTML = '<div class="page"><div class="page-head"><div><h1>出网策略</h1><p>外网模型与厂内资料组合使用时，按资料密级决定能否发送。所有出网请求经出口网关审计。</p></div></div>' + adminNote() +
        '<div class="panel" style="margin-bottom:14px"><div class="panel-head"><h3>密级与模型</h3></div><div class="table-wrap"><table class="tbl matrix"><thead><tr><th>资料密级</th><th>发给内网模型</th><th>发给外网模型</th></tr></thead><tbody>' +
        '<tr><td>' + ui.lv('public') + '</td><td><span class="badge ok">允许</span></td><td><span class="badge ok">允许</span></td></tr>' +
        '<tr><td>' + ui.lv('internal') + '</td><td><span class="badge ok">允许</span></td><td><span class="badge warn">按部门配置</span> <span class="small muted">' + (allowedOrgs.length ? esc(allowedOrgs.join('、')) + ' 允许' : '全部禁止') + '</span></td></tr>' +
        '<tr><td>' + ui.lv('secret') + '</td><td><span class="badge ok">允许</span></td><td><span class="badge danger">' + icon('lock') + '禁止</span></td></tr>' +
        '<tr><td>' + ui.lv('confidential') + '</td><td><span class="badge ok">允许</span></td><td><span class="badge danger">' + icon('lock') + '禁止</span></td></tr></tbody></table></div><div class="panel-body" style="padding-top:0"><span class="muted small">秘密及以上资料任何配置都不能发往外网模型。</span></div></div>' +
        '<div class="grid-2" style="align-items:start"><div class="panel"><div class="panel-head"><h3>“内部”密级资料按部门配置</h3><span class="muted small">默认禁止</span></div><div class="table-wrap"><table class="tbl"><thead><tr><th>部门</th><th>允许发往外网模型</th></tr></thead><tbody>' +
        Object.keys(pol.internalToExternal).map(o => '<tr><td>' + esc(o) + '</td><td><label class="switch"><input type="checkbox" data-org="' + esc(o) + '"' + (pol.internalToExternal[o] ? ' checked' : '') + (admin ? '' : ' disabled') + ' aria-label="' + esc(o) + ' 允许内部资料发往外网模型"><span></span></label></td></tr>').join('') + '</tbody></table></div></div>' +
        '<div class="panel"><div class="panel-head"><h3>敏感词</h3><span class="muted small">外网模型请求或联网检索命中即拦截</span></div><div class="panel-body"><div class="tag-edit">' + pol.sensitiveWords.map((w, i) => '<span class="tag">' + esc(w) + (admin ? '<button data-delword="' + i + '" aria-label="删除 ' + esc(w) + '">' + icon('x') + '</button>' : '') + '</span>').join('') + '</div>' +
        (admin ? '<div class="row" style="margin-top:12px"><input class="input" id="newWord" placeholder="添加敏感词，回车确认" style="max-width:260px"><button class="btn sm" id="addWord">添加</button></div>' : '') + '</div></div></div></div>';
      bindBeAdmin(el);
      el.querySelectorAll('[data-org]').forEach(i => i.addEventListener('change', () => { pol.internalToExternal[i.dataset.org] = i.checked; store.save(); ui.toast(i.dataset.org + '：内部资料' + (i.checked ? '允许' : '禁止') + '发往外网模型'); draw(); }));
      el.querySelectorAll('[data-delword]').forEach(b => b.addEventListener('click', () => { pol.sensitiveWords.splice(Number(b.dataset.delword), 1); store.save(); draw(); }));
      const add = () => { const i = el.querySelector('#newWord'); const w = i.value.trim(); if (!w) return; if (!pol.sensitiveWords.includes(w)) pol.sensitiveWords.push(w); store.save(); draw(); el.querySelector('#newWord').focus(); };
      const ab = el.querySelector('#addWord'); if (ab) { ab.addEventListener('click', add); el.querySelector('#newWord').addEventListener('keydown', e => { if (e.key === 'Enter') add(); }); }
      ui.icons();
    }
    draw();
  };

  /* ---------- 模型网关 ---------- */
  AOS.views.models = function (el) {
    AOS.setCrumbs([{ name: '管理' }, { name: '模型网关' }]);
    const admin = isAdmin();
    function calls(name) {
      const today = svc.now().slice(0, 10);
      let all = 0, t = 0;
      store.state.sessions.forEach(s => s.messages.forEach(m => { if (m.role === 'assistant' && m.turn.model === name) { all++; if (m.at.startsWith(today)) t++; } }));
      return [t, all];
    }
    function draw() {
      el.innerHTML = '<div class="page"><div class="page-head"><div><h1>模型网关</h1><p>所有模型调用的唯一入口。对话中选择“内网模型 / 外网模型”后，由网关路由到该区域第一个正常运行的模型。</p></div></div>' + adminNote() +
        '<div class="panel table-wrap"><table class="tbl"><thead><tr><th>模型</th><th>区域</th><th>部署</th><th>状态</th><th>限流（次/分钟）</th><th>今日调用</th><th>累计调用</th></tr></thead><tbody>' +
        store.state.models.map(m => { const [t, all] = calls(m.name); return '<tr><td style="font-weight:500;color:var(--ink)">' + esc(m.name) + '</td><td>' + ui.zoneBadge(m.zone) + '</td><td class="muted">' + esc(m.host) + '</td><td><label class="row"><span class="switch"><input type="checkbox" data-model="' + m.id + '"' + (m.status === 'up' ? ' checked' : '') + (admin ? '' : ' disabled') + ' aria-label="启用 ' + esc(m.name) + '"><span></span></span><span class="small">' + (m.status === 'up' ? '正常' : '已停用') + '</span></label></td><td><input class="input" type="number" min="1" style="width:100px;height:28px" data-qpm="' + m.id + '" value="' + m.qpm + '"' + (admin ? '' : ' disabled') + ' aria-label="限流"></td><td>' + t + '</td><td>' + all + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<div class="note" style="margin-top:12px">' + icon('info') + '<span>停用某区域的全部模型后，用户选择该区域时会收到“暂不可用，可以切换到内网模型”的提示。外网模型请求先经过密级检查和敏感词拦截。</span></div></div>';
      bindBeAdmin(el);
      el.querySelectorAll('[data-model]').forEach(i => i.addEventListener('change', () => { const m = store.state.models.find(x => x.id === i.dataset.model); m.status = i.checked ? 'up' : 'down'; store.save(); ui.toast(m.name + (i.checked ? ' 已启用' : ' 已停用')); draw(); }));
      el.querySelectorAll('[data-qpm]').forEach(i => i.addEventListener('change', () => { const m = store.state.models.find(x => x.id === i.dataset.qpm); m.qpm = Math.max(1, Number(i.value) || 1); store.save(); ui.toast('已更新限流'); }));
      ui.icons();
    }
    draw();
  };

  /* ---------- 审计日志 ---------- */
  AOS.views.audit = function (el) {
    AOS.setCrumbs([{ name: '管理' }, { name: '审计日志' }]);
    const f = { result: '', kind: '' };
    function draw() {
      const list = store.state.audit.filter(a => (!f.result || a.result === f.result) && (!f.kind || a.kind === f.kind));
      el.querySelector('#aBody').innerHTML = list.length ? list.map(a => '<tr' + (a.sessionId ? ' class="clickable" data-sid="' + a.sessionId + '"' : '') + '><td class="nowrap muted">' + esc(a.time) + '</td><td class="nowrap">' + esc(a.userName) + '<div class="small muted">' + esc(a.dept) + '</div></td><td class="nowrap">' + esc(a.agentName) + '</td><td class="nowrap">' + esc(a.kind) + '</td><td class="nowrap">' + esc(a.target) + '</td><td class="clip" title="' + esc(a.content) + '">' + esc(a.content) + '</td><td class="small">' + (a.docs && a.docs.length ? esc(a.docs.join('；')) : '<span class="muted">无</span>') + '</td><td><span class="badge ' + (a.result === '拦截' ? 'danger' : 'ok') + '">' + esc(a.result) + '</span></td><td class="small muted">' + esc(a.reason) + '</td></tr>').join('') : '<tr><td colspan="9"><div class="empty">' + icon('scroll-text') + '没有符合条件的出网记录。</div></td></tr>';
      el.querySelector('#aCount').textContent = '共 ' + list.length + ' 条';
      ui.icons();
    }
    el.innerHTML = '<div class="page"><div class="page-head"><div><h1>审计日志</h1><p>出口网关记录每一次外网模型调用、联网搜索，以及实际发出的资料清单。</p></div></div>' +
      '<div class="toolbar"><select class="select" id="aRes" aria-label="结果"><option value="">全部结果</option><option>放行</option><option>拦截</option></select><select class="select" id="aKind" aria-label="类型"><option value="">全部类型</option><option>模型调用</option><option>联网搜索</option></select><span class="muted small" id="aCount"></span></div>' +
      '<div class="panel table-wrap"><table class="tbl"><thead><tr><th>时间</th><th>用户</th><th>智能体</th><th>类型</th><th>目标</th><th>内容摘要</th><th>发出资料</th><th>结果</th><th>说明</th></tr></thead><tbody id="aBody"></tbody></table></div></div>';
    el.querySelector('#aRes').addEventListener('change', e => { f.result = e.target.value; draw(); });
    el.querySelector('#aKind').addEventListener('change', e => { f.kind = e.target.value; draw(); });
    el.querySelector('#aBody').addEventListener('click', e => { const tr = e.target.closest('tr[data-sid]'); if (tr) location.hash = '#/sessions/' + tr.dataset.sid; });
    draw();
  };

  /* ---------- 定时运行 ---------- */
  AOS.views.schedules = function (el) {
    AOS.setCrumbs([{ name: '管理' }, { name: '定时运行' }]);
    const ready = svc.phase() >= 3;
    const freqText = s => s.frequency === '每月' ? '每月 ' + s.day + ' 日 ' + s.time : s.frequency === '每周' ? '每周' + '一二三四五六日'[(s.day || 1) - 1] + ' ' + s.time : '每天 ' + s.time;
    function run(sch) {
      const agent = svc.agent(sch.agentId);
      const owner = svc.users().find(u => u.id === sch.ownerId) || svc.currentUser();
      const res = svc.resolve(agent, owner);
      const at = svc.now();
      if (!res.ok) { sch.runs.unshift({ at, status: '失败', reason: res.reason }); store.save(); draw(); ui.toast('运行失败，已通知创建者 ' + owner.name + '：' + res.reason, 'warn'); return; }
      const cfg = svc.configFor(agent, res.version);
      const session = svc.newSession(agent, res.version, owner, 'schedule');
      const o = { zone: cfg.defaultModel, scope: cfg.defaultScope, user: owner };
      svc.run(session, sch.input, o);
      if (session.flowState && session.flowState.stage && session.flowState.stage !== 'done') svc.run(session, '#confirm', o);
      sch.runs.unshift({ at, status: '成功', sessionId: session.id });
      store.save(); draw();
      ui.toast('已生成并推送给：' + sch.subscribers.join('、'));
    }
    function draw() {
      const list = store.state.schedules;
      el.innerHTML = '<div class="page"><div class="page-head"><div><h1>定时运行</h1><p>按计划以创建者的身份和权限运行智能体，每次产生一条独立会话，结果推送给订阅人；失败时通知创建者，不自动重试。</p></div><button class="btn primary" id="newSch"' + (ready ? '' : ' disabled') + '>' + icon('plus') + '新建计划</button></div>' +
        (ready ? '' : '<div class="note info" style="margin-bottom:14px">' + icon('calendar-clock') + '<span>定时运行在三期提供，当前为' + svc.PHASE_LABEL[svc.phase()] + '演示。可以在 <a href="#/admin/settings">演示设置</a> 中切换到三期体验。</span></div>') +
        '<div class="stack">' + (list.length ? list.map(s => { const a = svc.agent(s.agentId); return '<div class="panel"><div class="panel-head"><div class="row"><div class="agent-icon" style="width:28px;height:28px;border-radius:7px">' + icon(a.draft.icon) + '</div><div><h3>' + esc(s.name) + '</h3><div class="small muted">' + esc(a.draft.name) + ' · ' + esc(freqText(s)) + ' · 创建者 ' + esc((svc.users().find(u => u.id === s.ownerId) || {}).name) + '</div></div></div><div class="row"><label class="row small"><span class="switch"><input type="checkbox" data-en="' + s.id + '"' + (s.enabled ? ' checked' : '') + (ready ? '' : ' disabled') + ' aria-label="启用计划"><span></span></span>' + (s.enabled ? '已启用' : '已停用') + '</label><button class="btn sm" data-run="' + s.id + '"' + (ready ? '' : ' disabled') + '>' + icon('play') + '立即运行</button></div></div>' +
          '<div class="panel-body"><dl class="kv"><dt>固定输入</dt><dd>' + esc(s.input) + '</dd><dt>订阅人</dt><dd>' + esc(s.subscribers.join('、')) + '</dd><dt>运行记录</dt><dd>' + (s.runs.length ? s.runs.slice(0, 5).map(r => '<div class="row small"><span class="badge ' + (r.status === '成功' ? 'ok' : 'danger') + '">' + r.status + '</span><span class="muted">' + esc(r.at) + '</span>' + (r.sessionId ? '<a href="#/sessions/' + r.sessionId + '">查看会话</a>' : '<span class="muted">' + esc(r.reason || '') + '</span>') + '</div>').join('') : '<span class="muted">尚未运行</span>') + '</dd></dl></div></div>'; }).join('') : '<div class="empty">' + icon('calendar-clock') + '还没有运行计划。</div>') + '</div></div>';
      el.querySelectorAll('[data-en]').forEach(i => i.addEventListener('change', () => { const s = list.find(x => x.id === i.dataset.en); s.enabled = i.checked; store.save(); draw(); }));
      el.querySelectorAll('[data-run]').forEach(b => b.addEventListener('click', () => run(list.find(x => x.id === b.dataset.run))));
      const nb = el.querySelector('#newSch'); if (nb) nb.addEventListener('click', create);
      ui.icons();
    }
    function create() {
      const agents = store.state.agents.filter(a => a.batch <= svc.phase() && (a.versions || []).some(v => v.status === 'online' || v.status === 'trial'));
      ui.modal({
        title: '新建运行计划', okText: '创建计划',
        body: '<div class="stack"><div class="field"><label for="scName">名称</label><input class="input" id="scName" placeholder="例如：每周烧结技术动态"></div><div class="field"><label for="scAgent">智能体</label><select class="select" id="scAgent">' + agents.map(a => '<option value="' + a.id + '">' + esc(a.draft.name) + '</option>').join('') + '</select></div>' +
          '<div class="grid-3"><div class="field"><label for="scFreq">重复</label><select class="select" id="scFreq"><option>每天</option><option>每周</option><option selected>每月</option></select></div><div class="field"><label for="scDay">日期</label><input class="input" id="scDay" type="number" min="1" max="28" value="1"></div><div class="field"><label for="scTime">时间</label><input class="input" id="scTime" type="time" value="08:00"></div></div>' +
          '<div class="field"><label for="scInput">固定输入</label><textarea class="textarea" id="scInput" style="min-height:60px">跟踪上月烧结烟气治理技术动态</textarea></div><div class="field"><span class="field-label">订阅人</span><div class="row wrap">' + svc.users().map(u => '<label class="check"><input type="checkbox" class="scSub" value="' + esc(u.name) + '"' + (u.id === svc.currentUser().id ? ' checked' : '') + '>' + esc(u.name) + '</label>').join('') + '</div></div><span class="err" id="scErr" hidden></span></div>',
        onMount(m, close) {
          m.querySelector('[data-ok]').addEventListener('click', () => {
            const name = m.querySelector('#scName').value.trim(), input = m.querySelector('#scInput').value.trim();
            const subs = Array.from(m.querySelectorAll('.scSub:checked')).map(i => i.value);
            const err = !name ? '请填写名称' : !input ? '请填写固定输入' : !subs.length ? '至少选择一位订阅人' : '';
            if (err) { const e = m.querySelector('#scErr'); e.textContent = err; e.hidden = false; return; }
            store.state.schedules.push({ id: store.uid('sch'), agentId: m.querySelector('#scAgent').value, name, frequency: m.querySelector('#scFreq').value, day: Number(m.querySelector('#scDay').value) || 1, time: m.querySelector('#scTime').value || '08:00', input, subscribers: subs, enabled: true, ownerId: svc.currentUser().id, runs: [] });
            store.save(); close(); draw(); ui.toast('已创建运行计划“' + name + '”');
          });
        }
      });
    }
    draw();
  };

  /* ---------- 演示设置 ---------- */
  AOS.views.settings = function (el) {
    AOS.setCrumbs([{ name: '管理' }, { name: '演示设置' }]);
    const PHASES = [
      { n: 1, items: ['工坊、发布、会话记录与导出、权限与密级、模型网关', '内置工具：文档检索、联网搜索、网页读取、报告导出', '智能体：科研资料助手、调研报告助手、立项查新助手、技术情报简报助手（手动版）'] },
      { n: 2, items: ['内置工具：图纸检索、代码检索、数据查询', '课题申报书、结题验收、工艺问题诊断、试验方案设计等 9 个智能体'] },
      { n: 3, items: ['内置工具：数据分析', '定时运行', '试验数据分析助手、技术情报简报（定时版）'] }
    ];
    function draw() {
      const cur = svc.phase();
      const me = svc.currentUser();
      el.innerHTML = '<div class="page"><div class="page-head"><div><h1>演示设置</h1><p>切换演示阶段和演示用户。阶段决定哪些内置工具和智能体可用。</p></div></div>' +
        '<div class="panel" style="margin-bottom:14px"><div class="panel-head"><h3>演示阶段</h3><span class="muted small">按设计方案的分期计划解锁能力</span></div><div class="panel-body"><div class="phase-cards">' + PHASES.map(p => '<button class="phase-card' + (p.n === cur ? ' on' : '') + '" data-phase="' + p.n + '"><b>' + svc.PHASE_LABEL[p.n] + (p.n === cur ? ' · 当前' : '') + '</b><ul>' + p.items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul></button>').join('') + '</div></div></div>' +
        '<div class="panel" style="margin-bottom:14px"><div class="panel-head"><h3>演示用户</h3><span class="muted small">不同部门和密级会看到不同的资料，出网策略也按部门执行</span></div><div class="table-wrap"><table class="tbl"><thead><tr><th>用户</th><th>职务</th><th>部门</th><th>密级</th><th>“内部”资料可发往外网模型</th><th></th></tr></thead><tbody>' +
        svc.users().map(u => '<tr><td><div class="row"><span class="avatar' + (u.id === me.id ? '' : ' light') + '">' + esc(u.name.slice(0, 1)) + '</span>' + esc(u.name) + '</div></td><td>' + esc(u.title) + '</td><td>' + esc(u.dept) + '</td><td>' + ui.lv(u.clearance) + '</td><td>' + (P.egressAllowed('internal', u.dept, store.state.policy) ? '<span class="badge ok">允许</span>' : '<span class="badge">禁止</span>') + '</td><td>' + (u.id === me.id ? '<span class="muted small">当前用户</span>' : '<button class="btn sm" data-user="' + u.id + '">切换</button>') + '</td></tr>').join('') + '</tbody></table></div></div>' +
        '<div class="panel"><div class="panel-head"><h3>演示数据</h3></div><div class="panel-body row"><span class="grow muted">配置、资料、会话和审计记录保存在当前浏览器中。重置后恢复初始示例。</span><button class="btn danger" id="resetBtn">' + icon('rotate-ccw') + '重置演示数据</button></div></div></div>';
      el.querySelectorAll('[data-phase]').forEach(b => b.addEventListener('click', () => { svc.setPhase(Number(b.dataset.phase)); ui.toast('已切换到' + svc.PHASE_LABEL[svc.phase()] + '演示，本阶段智能体已按计划上线'); AOS.render(); }));
      el.querySelectorAll('[data-user]').forEach(b => b.addEventListener('click', () => { store.state.settings.userId = b.dataset.user; store.save(); document.getElementById('userSelect').value = b.dataset.user; ui.toast('已切换为 ' + svc.currentUser().name); AOS.render(); }));
      el.querySelector('#resetBtn').addEventListener('click', async () => {
        const ok = await ui.confirm({ title: '重置演示数据', okText: '确认重置', body: '<p>将清除新建的智能体、版本、上传的资料、会话、审计记录和策略修改，恢复初始示例。</p>' });
        if (!ok) return;
        store.reset(); document.getElementById('userSelect').value = store.state.settings.userId; ui.toast('已重置演示数据'); location.hash = '#/';
        AOS.render();
      });
      ui.icons();
    }
    draw();
  };
})(window);
