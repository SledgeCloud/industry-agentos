/* AgentOS · 对话组件（正式对话与工坊调试共用）与对话页 */
(function (root) {
  const AOS = root.AOS;
  const { ui, svc, store, policy: P } = AOS;
  const { esc, icon } = ui;
  const SCOPE_ICON = { public: 'globe', internal: 'library', all: 'layers' };

  function flowHtml(zone, scope) {
    const user = svc.currentUser();
    const f = P.dataFlow(zone, scope, user.dept, store.state.policy);
    return '<div class="flow ' + f.tone + '" aria-label="数据去向"><span class="flow-node">' + icon(SCOPE_ICON[scope]) + esc(f.source) + '</span><span class="flow-line"></span>' +
      (f.egress ? '<span class="flow-gate">' + icon('shield-check') + '出口网关</span><span class="flow-line"></span>' : '') +
      '<span class="flow-node target">' + icon(zone === 'external' ? 'globe' : 'server') + esc(f.target) + '</span><span class="flow-note" title="' + esc(f.note) + '">' + esc(f.note) + '</span></div>';
  }

  function egressConfirm() {
    const user = svc.currentUser();
    const internalOk = P.egressAllowed('internal', user.dept, store.state.policy);
    const row = (lvId, ok) => '<tr><td>' + ui.lv(lvId) + '</td><td>' + (ok ? '<span class="badge ok">发送</span>' : '<span class="badge danger">不发送</span>') + '</td></tr>';
    return ui.confirm({
      title: '确认将厂内资料用于外网模型',
      okText: '确认并发送',
      body: '<p style="margin-bottom:10px">你选择了<b>外网模型</b>，且资料范围包含<b>厂内资料</b>。按“' + esc(user.dept) + '”的出网策略，检索到的资料按密级处理如下：</p>' +
        '<div class="panel table-wrap"><table class="tbl"><thead><tr><th>资料密级</th><th>发给外网模型</th></tr></thead><tbody>' + row('public', true) + row('internal', internalOk) + row('secret', false) + row('confidential', false) + '</tbody></table></div>' +
        '<p class="muted small" style="margin-top:10px">被拦截的资料不会进入外网模型；实际发出的资料清单会记录在会话记录和审计日志中。本次对话只确认一次。</p>'
    });
  }

  /* opts: { agent, config, version, source: 'portal'|'debug', session, onSession(session), head(html), compactWelcome } */
  function mountPanel(host, opts) {
    const user = svc.currentUser();
    const cfg = opts.config;
    const locked = P.isLocked(cfg);
    const st = {
      session: opts.session || null,
      zone: (opts.session && opts.session.zone) || (cfg.allowedModels.includes(cfg.defaultModel) ? cfg.defaultModel : cfg.allowedModels[0]),
      scope: (opts.session && opts.session.scope) || cfg.defaultScope || 'internal',
      mode: 'chat', busy: false, confirmed: opts.session ? opts.session.confirmedEgress : false, pending: null, timers: []
    };
    if (!cfg.allowedModels.includes(st.zone)) st.zone = cfg.allowedModels[0];

    host.innerHTML = '<div class="chat-main">' + (opts.head || '') +
      '<div class="chat-scroll" id="chatScroll"><div class="chat-inner" id="msgs"></div></div>' +
      '<div class="composer-wrap"><div class="composer"><label class="sr-only" for="chatInput">输入问题</label><textarea id="chatInput" rows="2" placeholder="输入问题，Enter 发送，Shift + Enter 换行"></textarea>' +
      '<div class="composer-bar"><div class="seg" role="group" aria-label="模型" id="zoneSeg"></div><div class="seg" role="group" aria-label="资料范围" id="scopeSeg"></div>' +
      (cfg.flow === 'research' ? '<div class="seg" role="group" aria-label="模式" id="modeSeg"><button data-mode="chat">' + icon('message-square') + '对话</button><button data-mode="files">' + icon('folder-open') + '资料检索</button></div>' : '') +
      (locked ? '<span class="lock">' + icon('lock') + '锁定内网模型</span>' : '') +
      '<button class="send" id="sendBtn" aria-label="发送">' + icon('arrow-up') + '</button></div></div><div id="flow"></div></div></div>';

    const $ = s => host.querySelector(s);
    const input = $('#chatInput');

    function drawControls() {
      $('#zoneSeg').innerHTML = P.ZONES.map(z => '<button data-zone="' + z.id + '" class="' + (st.zone === z.id ? 'on' : '') + '"' + (cfg.allowedModels.includes(z.id) ? '' : ' disabled title="该智能体未开放此模型"') + '>' + icon(z.id === 'external' ? 'globe' : 'shield-check') + z.label + '</button>').join('');
      $('#scopeSeg').innerHTML = P.SCOPES.map(s => '<button data-scope="' + s.id + '" class="' + (st.scope === s.id ? 'on' : '') + '">' + s.label + '</button>').join('');
      const ms = $('#modeSeg'); if (ms) ms.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.mode === st.mode));
      $('#flow').innerHTML = flowHtml(st.zone, st.scope);
      $('#sendBtn').disabled = st.busy;
      input.placeholder = st.mode === 'files' ? '输入关键词查找报告原件或图纸，例如“冷却壁 布置图”' : '输入问题，Enter 发送，Shift + Enter 换行';
      ui.icons();
    }

    function welcome() {
      return '<div class="chat-welcome"><h3>' + esc(cfg.name) + '</h3><p>' + esc(cfg.opening || cfg.desc) + '</p>' + (cfg.suggestions && cfg.suggestions.length ? '<div class="suggest">' + cfg.suggestions.map(s => '<button data-suggest="' + esc(s) + '">' + esc(s) + '</button>').join('') + '</div>' : '') + '</div>';
    }

    function drawMessages(scroll) {
      const box = $('#msgs');
      const s = st.session;
      let html = s && s.messages.length ? ui.messagesHtml(s, { agentName: cfg.name, expandSteps: opts.source === 'debug' }) : (st.pending ? '' : welcome());
      if (st.pending) {
        html += '<div class="msg msg-user"><div class="bubble' + (st.pending.text.startsWith('#') ? ' action' : '') + '">' + esc(svc.display(st.pending.text)) + '</div></div>';
        html += '<div class="msg msg-ai"><div class="avatar">' + icon('bot') + '</div><div class="msg-body"><div class="msg-name">' + esc(cfg.name) + '</div>' + ui.turnHtml({ turn: st.pending.result.turn, pending: { revealed: st.pending.revealed } }, { expandSteps: opts.source === 'debug' }) + '</div></div>';
      }
      box.innerHTML = html;
      ui.icons();
      if (scroll !== false) { const sc = $('#chatScroll'); sc.scrollTop = sc.scrollHeight; }
    }

    async function send(text) {
      text = String(text || '').trim();
      if (!text || st.busy) return;
      if (st.zone === 'external' && st.scope !== 'public' && !st.confirmed) {
        const ok = await egressConfirm();
        if (!ok) return;
        st.confirmed = true;
      }
      if (!st.session) {
        st.session = svc.newSession(opts.agent, opts.version, user, opts.source);
        if (opts.source === 'debug') st.session.agentName = cfg.name;
        if (opts.onSession) opts.onSession(st.session);
      }
      st.session.confirmedEgress = st.confirmed;
      const runOpts = { zone: st.zone, scope: st.scope, mode: st.mode, config: cfg };
      const result = svc.compute(st.session, text, runOpts);
      st.busy = true; st.pending = { text, result, revealed: 0 };
      input.value = ''; autosize(); drawControls(); drawMessages();
      const steps = result.turn.steps.length;
      const tick = () => {
        if (!st.pending) return;
        if (st.pending.revealed < steps) { st.pending.revealed++; drawMessages(); st.timers.push(setTimeout(tick, 420)); return; }
        st.timers.push(setTimeout(() => {
          svc.commit(st.session, text, runOpts, result);
          st.pending = null; st.busy = false;
          drawControls(); drawMessages();
          if (opts.onCommit) opts.onCommit(st.session);
        }, 520));
      };
      st.timers.push(setTimeout(tick, 380));
    }

    function msgAt(node) {
      const holder = node.closest('[data-msg]');
      return holder && st.session ? st.session.messages[Number(holder.dataset.msg)] : null;
    }

    function autosize() { input.style.height = 'auto'; input.style.height = Math.min(180, input.scrollHeight) + 'px'; }

    host.addEventListener('click', e => {
      const t = e.target.closest('button, [data-cite], [data-doc]');
      if (!t || !host.contains(t)) return;
      if (t.dataset.zone && !t.disabled) { st.zone = t.dataset.zone; drawControls(); return; }
      if (t.dataset.scope) { st.scope = t.dataset.scope; drawControls(); return; }
      if (t.dataset.mode) { st.mode = t.dataset.mode; drawControls(); return; }
      if (t.id === 'sendBtn') { send(input.value); return; }
      if (t.dataset.suggest) { send(t.dataset.suggest); return; }
      const msg = msgAt(t);
      if (t.dataset.cite && msg) {
        const c = msg.turn.citations.find(x => x.n === Number(t.dataset.cite));
        if (c) ui.openCitation(c, () => { toggleWrong(msg, c.n, true); });
        return;
      }
      if (t.dataset.doc) { ui.openDoc(t.dataset.doc); return; }
      if (t.dataset.wrong && msg) { toggleWrong(msg, Number(t.dataset.wrong)); return; }
      if (t.dataset.fb && msg) { feedback(msg, t.dataset.fb); return; }
      if (t.dataset.act && msg) {
        const a = t.dataset.act;
        if (a === 'confirm') send('#confirm');
        else if (a === 'include-low') send('#include-low');
        else if (a === 'export') ui.exportTurn(st.session, msg, t.dataset.format);
        else if (a === 'switch-internal') {
          if (!cfg.allowedModels.includes('internal')) { ui.toast('该智能体未开放内网模型', 'warn'); return; }
          st.zone = 'internal'; drawControls();
          const lastUser = st.session.messages.filter(m => m.role === 'user' && !m.text.startsWith('#')).pop();
          if (lastUser) send(lastUser.text);
        }
      }
    });
    host.addEventListener('keydown', e => {
      if (e.target === input && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-doc], .cite-row .title')) { e.preventDefault(); e.target.click(); }
    });
    input.addEventListener('input', autosize);

    function persist() { if (st.session && st.session.source !== 'debug') store.save(); }
    function toggleWrong(msg, n, forceOn) {
      const w = msg.feedback.wrong || (msg.feedback.wrong = []);
      const i = w.indexOf(n);
      if (i >= 0 && !forceOn) w.splice(i, 1); else if (i < 0) w.push(n);
      persist(); drawMessages(false);
      ui.toast(w.includes(n) ? '已标记引用 [' + n + '] 来源有误' : '已取消标记');
    }
    function feedback(msg, kind) {
      if (kind === 'text') {
        ui.modal({ title: '反馈这条回答', okText: '提交反馈', body: '<div class="field"><label for="fbText">你的意见会随会话记录导出，供线下评测和优化使用</label><textarea class="textarea" id="fbText" placeholder="例如：遗漏了 2023 年的攻关报告">' + esc(msg.feedback.text) + '</textarea></div>', onMount(el, close) {
          el.querySelector('[data-ok]').addEventListener('click', () => { msg.feedback.text = el.querySelector('#fbText').value.trim(); persist(); close(); drawMessages(false); ui.toast('反馈已提交'); });
        } });
        return;
      }
      msg.feedback.rating = msg.feedback.rating === kind ? null : kind;
      persist(); drawMessages(false);
    }

    drawControls(); drawMessages();
    return {
      destroy() { st.timers.forEach(clearTimeout); st.pending = null; },
      reset() { st.timers.forEach(clearTimeout); st.session = null; st.pending = null; st.busy = false; st.confirmed = false; drawControls(); drawMessages(); },
      get session() { return st.session; }
    };
  }
  AOS.chatPanel = mountPanel;

  AOS.views.chat = function (el, route) {
    const agent = svc.agent(route.agentId);
    if (!agent) { el.innerHTML = '<div class="chat-blocked">' + icon('bot-off') + '<h3>找不到这个智能体</h3><p><a href="#/">返回智能体广场</a></p></div>'; return; }
    const user = svc.currentUser();
    const res = svc.resolve(agent, user);
    const name = (agent.draft || agent).name;
    AOS.setCrumbs([{ name: '智能体广场', href: '#/' }, { name }]);
    if (!res.ok) {
      el.innerHTML = '<div class="chat-blocked">' + icon(res.status === 'planned' ? 'calendar-clock' : 'lock') + '<h3>' + esc(name) + '暂不可用</h3><p>' + esc(res.reason) + '。</p><p style="margin-top:14px" class="row" ><a class="btn" href="#/">返回智能体广场</a><a class="btn" href="#/studio/' + agent.id + '">在工坊中查看配置</a></p></div>';
      ui.icons(); return;
    }
    const cfg = svc.configFor(agent, res.version);
    let session = route.sessionId ? store.state.sessions.find(s => s.id === route.sessionId && s.userId === user.id && s.agentId === agent.id) : null;
    if (session && session.version !== res.version.id) {
      ui.toast('该会话基于 ' + session.version + '，继续对话将沿用当时的配置');
    }
    const useVersion = session ? (agent.versions.find(v => v.id === session.version) || res.version) : res.version;
    const useCfg = session ? svc.configFor(agent, useVersion) : cfg;

    el.innerHTML = '<div class="chat"><aside class="conv-list" aria-label="历史对话"><div class="conv-list-head"><a class="btn" style="width:100%" href="#/chat/' + agent.id + '">' + icon('plus') + '新对话</a></div><div class="conv-items" id="convItems"></div></aside><div class="grow" id="panel" style="display:flex;min-width:0"></div></div>';
    function drawList(activeId) {
      const mine = store.state.sessions.filter(s => s.agentId === agent.id && s.userId === user.id);
      el.querySelector('#convItems').innerHTML = mine.length ? mine.map(s => '<a class="conv-item' + (s.id === activeId ? ' active' : '') + '" href="#/chat/' + agent.id + '/' + s.id + '"><div class="t">' + esc(s.title || '新对话') + '</div><div class="m">' + esc(s.updatedAt) + ' · ' + esc(s.version) + '</div></a>').join('') : '<div class="muted small" style="padding:8px 10px">还没有对话记录</div>';
    }
    drawList(session && session.id);
    const head = '<div class="chat-head"><div class="agent-icon">' + icon(useCfg.icon) + '</div><div class="grow"><h2>' + esc(useCfg.name) + '</h2><div class="row small muted">' + ui.status(res.status) + '<span class="badge outline">' + esc(useVersion.id) + '</span>' + (P.isLocked(useCfg) ? '<span class="badge">' + icon('lock') + '锁定内网模型</span>' : '') + '<span>' + esc(svc.category(useCfg.category).name) + '</span></div></div><a class="btn sm ghost" href="#/studio/' + agent.id + '">' + icon('boxes') + '在工坊中查看</a></div>';
    const panel = mountPanel(el.querySelector('#panel'), {
      agent, config: useCfg, version: useVersion, source: 'portal', session, head,
      onSession(s) { history.replaceState(null, '', '#/chat/' + agent.id + '/' + s.id); },
      onCommit(s) { drawList(s.id); document.querySelector('.nav-item[href="#/sessions"] .count').textContent = store.state.sessions.length; }
    });
    return () => panel.destroy();
  };
})(window);
