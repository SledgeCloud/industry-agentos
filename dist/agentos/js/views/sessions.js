/* AgentOS · 会话记录：筛选、导出与详情回放 */
(function (root) {
  const AOS = root.AOS;
  const { ui, svc, store, policy: P } = AOS;
  const { esc, icon } = ui;
  const f = { agent: '', version: '', user: '', time: '', feedback: '', zone: '', source: '' };

  function since(days) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - days);
    return svc.fmt(d);
  }

  function filtered() {
    const t = { today: since(0), '7d': since(6), '30d': since(29) }[f.time];
    return store.state.sessions.filter(s => {
      const st = svc.sessionStats(s);
      if (f.agent && s.agentId !== f.agent) return false;
      if (f.version && s.version !== f.version) return false;
      if (f.user && s.userId !== f.user) return false;
      if (t && s.updatedAt < t) return false;
      if (f.zone === 'external' && !st.external) return false;
      if (f.zone === 'internal' && st.external) return false;
      if (f.source && (s.source || 'portal') !== f.source) return false;
      if (f.feedback === 'up' && !st.up) return false;
      if (f.feedback === 'down' && !st.down) return false;
      if (f.feedback === 'text' && !st.hasText) return false;
      if (f.feedback === 'wrong' && !st.wrong) return false;
      return true;
    });
  }

  const blockText = b => {
    const strip = s => String(s).replace(/\s*\[(\d+)\]/g, '[$1]');
    if (b.t === 'p' || b.t === 'alert') return strip(b.text);
    if (b.t === 'ul' || b.t === 'outline') return b.items.map(x => '- ' + strip(x)).join('\n');
    if (b.t === 'table') return [b.head.join(' | ')].concat(b.rows.map(r => r.map(strip).join(' | '))).join('\n');
    if (b.t === 'report') return b.title + '\n' + b.sections.map(s => s.heading + '\n' + s.paras.map(strip).join('\n') + (s.table ? '\n' + s.table.rows.map(r => r.map(strip).join(' | ')).join('\n') : '')).join('\n');
    if (b.t === 'files') return b.items.map(x => '- ' + x.title).join('\n');
    if (b.t === 'code') return b.loc + '\n' + b.text;
    return '';
  };
  const answerText = turn => turn.blocks.map(blockText).filter(Boolean).join('\n');

  function toJsonl(list) {
    return list.map(s => JSON.stringify({
      session_id: s.id, agent: s.agentName, agent_id: s.agentId, version: s.version, user: s.userName, dept: s.dept, source: s.source || 'portal', created_at: s.createdAt, updated_at: s.updatedAt,
      messages: s.messages.map(m => m.role === 'user' ? { role: 'user', text: m.display || m.text, at: m.at } : {
        role: 'assistant', at: m.at, model_zone: m.zone, model: m.turn.model, data_scope: m.scope, mode: m.mode, answer: answerText(m.turn),
        tool_calls: m.turn.steps.map(x => ({ tool: x.tool, params: x.params, status: x.status, summary: x.summary, duration_ms: x.durationMs })),
        citations: m.turn.citations.map(c => ({ n: c.n, title: c.title, origin: c.origin, level: c.level, loc: c.loc, url: c.url || null })),
        sent_out: m.turn.sentOut, blocked: m.turn.blocked, tokens: m.turn.tokens, duration_ms: m.turn.durationMs,
        feedback: { rating: m.feedback.rating, text: m.feedback.text, wrong_citations: m.feedback.wrong }
      })
    })).join('\n');
  }

  function toCsv(list) {
    const cell = v => '"' + String(v === undefined || v === null ? '' : v).replace(/"/g, '""') + '"';
    const head = ['会话ID', '更新时间', '智能体', '版本', '用户', '部门', '来源', '模型', '资料范围', '轮次', 'Token', '耗时（秒）', '评价', '文字反馈', '来源有误', '首个问题', '最后回答', '发出资料'];
    const rows = list.map(s => {
      const st = svc.sessionStats(s);
      const ai = s.messages.filter(m => m.role === 'assistant');
      const last = ai[ai.length - 1];
      const firstQ = (s.messages.find(m => m.role === 'user') || {}).text || '';
      return [s.id, s.updatedAt, s.agentName, s.version, s.userName, s.dept, s.source === 'schedule' ? '定时运行' : '对话', Array.from(new Set(ai.map(m => P.zoneLabel(m.zone)))).join('、'), Array.from(new Set(ai.map(m => P.scopeLabel(m.scope)))).join('、'), st.rounds, st.tokens, (st.durationMs / 1000).toFixed(1),
        st.up ? '点赞' : st.down ? '点踩' : '', ai.map(m => m.feedback.text).filter(Boolean).join('；'), st.wrong ? '是' : '', firstQ, last ? answerText(last.turn).slice(0, 500) : '', st.sentOut.map(x => x.title).join('；')];
    });
    return '\ufeff' + [head].concat(rows).map(r => r.map(cell).join(',')).join('\r\n');
  }
  const stamp = () => svc.now().replace(/[-: ]/g, '').slice(0, 12);

  AOS.views.sessions = function (el) {
    AOS.setCrumbs([{ name: '会话记录' }]);
    const agents = store.state.agents;
    const versionsOf = id => { const a = svc.agent(id); return a ? Array.from(new Set(store.state.sessions.filter(s => s.agentId === id).map(s => s.version))) : []; };

    function draw() {
      const list = filtered();
      el.querySelector('#sCount').textContent = '共 ' + list.length + ' 条会话';
      el.querySelector('#sVersion').innerHTML = '<option value="">全部版本</option>' + (f.agent ? versionsOf(f.agent).map(v => '<option' + (v === f.version ? ' selected' : '') + '>' + esc(v) + '</option>').join('') : '');
      el.querySelector('#sVersion').disabled = !f.agent;
      el.querySelector('#sBody').innerHTML = list.length ? list.map(s => {
        const st = svc.sessionStats(s);
        return '<tr class="clickable" data-id="' + s.id + '"><td class="nowrap muted">' + esc(s.updatedAt) + '</td><td class="nowrap">' + esc(s.agentName) + (s.source === 'schedule' ? ' <span class="badge info">定时</span>' : '') + '</td><td><span class="badge outline">' + esc(s.version) + '</span></td><td class="nowrap">' + esc(s.userName) + '<div class="small muted">' + esc(s.dept) + '</div></td><td class="clip">' + esc(s.title) + '</td><td class="nowrap">' + (st.external ? ui.zoneBadge('external') : ui.zoneBadge('internal')) + ' <span class="small muted">' + esc(P.scopeLabel(s.scope)) + '</span></td><td>' + st.rounds + '</td><td class="nowrap">' + st.tokens + '</td><td class="nowrap">' + (st.up ? '<span class="badge ok">' + icon('thumbs-up') + '</span> ' : '') + (st.down ? '<span class="badge danger">' + icon('thumbs-down') + '</span> ' : '') + (st.hasText ? '<span class="badge">' + icon('message-square') + '</span> ' : '') + (st.wrong ? '<span class="badge warn">' + icon('flag') + '来源有误</span>' : '') + (st.sentOut.length ? '<span class="badge ext" title="发出资料">' + icon('send') + st.sentOut.length + '</span>' : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="9"><div class="empty">' + icon('message-square-dashed') + '没有符合条件的会话。调整筛选条件，或先去智能体广场发起对话。</div></td></tr>';
      ui.icons();
    }

    const sel = (id, label, opts, val) => '<select class="select" id="' + id + '" aria-label="' + label + '">' + opts.map(([v, t]) => '<option value="' + esc(v) + '"' + (v === val ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>';
    el.innerHTML = '<div class="page"><div class="page-head"><div><h1>会话记录</h1><p>记录每轮对话的模型、资料范围、工具调用、引用、发出资料和用户反馈。导出后用于线下人工评测和优化。</p></div><div class="row"><button class="btn" id="expCsv">' + icon('file-spreadsheet') + '导出 Excel</button><button class="btn" id="expJsonl">' + icon('file-json') + '导出 JSONL</button></div></div>' +
      '<div class="toolbar">' +
      sel('sAgent', '智能体', [['', '全部智能体']].concat(agents.map(a => [a.id, a.draft.name])), f.agent) +
      '<select class="select" id="sVersion" aria-label="版本"></select>' +
      sel('sUser', '用户', [['', '全部用户']].concat(svc.users().map(u => [u.id, u.name])), f.user) +
      sel('sTime', '时间', [['', '全部时间'], ['today', '今天'], ['7d', '近 7 天'], ['30d', '近 30 天']], f.time) +
      sel('sFb', '反馈', [['', '全部反馈'], ['up', '点赞'], ['down', '点踩'], ['text', '有文字反馈'], ['wrong', '标记来源有误']], f.feedback) +
      sel('sZone', '模型', [['', '全部模型'], ['internal', '仅内网模型'], ['external', '使用过外网模型']], f.zone) +
      sel('sSource', '来源', [['', '全部来源'], ['portal', '对话'], ['schedule', '定时运行']], f.source) +
      '<span class="muted small" id="sCount"></span></div>' +
      '<div class="panel table-wrap"><table class="tbl"><thead><tr><th>更新时间</th><th>智能体</th><th>版本</th><th>用户</th><th>首个问题</th><th>模型 / 资料范围</th><th>轮次</th><th>Token</th><th>反馈与出网</th></tr></thead><tbody id="sBody"></tbody></table></div></div>';
    const bind = (id, key, extra) => el.querySelector('#' + id).addEventListener('change', e => { f[key] = e.target.value; if (extra) extra(); draw(); });
    bind('sAgent', 'agent', () => { f.version = ''; });
    bind('sVersion', 'version'); bind('sUser', 'user'); bind('sTime', 'time'); bind('sFb', 'feedback'); bind('sZone', 'zone'); bind('sSource', 'source');
    el.querySelector('#sBody').addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) location.hash = '#/sessions/' + tr.dataset.id; });
    el.querySelector('#expCsv').addEventListener('click', () => { const l = filtered(); ui.download('会话记录_' + stamp() + '.csv', toCsv(l), 'text/csv;charset=utf-8'); ui.toast('已导出 ' + l.length + ' 条会话（Excel 可直接打开）'); });
    el.querySelector('#expJsonl').addEventListener('click', () => { const l = filtered(); ui.download('会话记录_' + stamp() + '.jsonl', toJsonl(l), 'application/x-ndjson;charset=utf-8'); ui.toast('已导出 ' + l.length + ' 条会话（JSONL）'); });
    draw();
  };

  AOS.views.sessionDetail = function (el, route) {
    const s = store.state.sessions.find(x => x.id === route.sessionId);
    if (!s) { el.innerHTML = '<div class="empty">找不到这条会话。<a href="#/sessions">返回会话记录</a></div>'; return; }
    AOS.setCrumbs([{ name: '会话记录', href: '#/sessions' }, { name: s.title || s.id }]);
    const st = svc.sessionStats(s);
    const ais = s.messages.filter(m => m.role === 'assistant');
    const audits = store.state.audit.filter(a => a.sessionId === s.id);
    const me = svc.currentUser();
    const canContinue = me.id === s.userId && s.source !== 'schedule';
    const listOrEmpty = (items, render, empty) => items.length ? '<ul class="side-list">' + items.map(render).join('') + '</ul>' : '<p class="muted small">' + empty + '</p>';
    el.innerHTML = '<div class="page wide" style="max-width:1320px"><div class="page-head"><div><h1>' + esc(s.title || s.id) + '</h1><p class="mono">' + esc(s.id) + '</p></div><div class="row"><button class="btn" id="expOne">' + icon('file-json') + '导出此会话</button>' + (canContinue ? '<a class="btn primary" href="#/chat/' + s.agentId + '/' + s.id + '">' + icon('message-square') + '继续对话</a>' : '') + '</div></div>' +
      '<div class="panel" style="margin-bottom:14px"><div class="meta-strip"><span><b>智能体</b>' + esc(s.agentName) + '</span><span><b>版本</b>' + esc(s.version) + '</span><span><b>用户</b>' + esc(s.userName + ' · ' + s.dept) + '</span><span><b>来源</b>' + (s.source === 'schedule' ? '定时运行' : '对话') + '</span><span><b>开始</b>' + esc(s.createdAt) + '</span><span><b>轮次</b>' + st.rounds + '</span><span><b>Token</b>' + st.tokens + '</span><span><b>耗时</b>' + (st.durationMs / 1000).toFixed(1) + ' 秒</span><span><b>模型</b>' + Array.from(new Set(ais.map(m => P.zoneLabel(m.zone) + '（' + (m.turn.model || '—') + '）'))).map(esc).join('、') + '</span></div></div>' +
      '<div class="detail-grid"><div class="panel"><div class="panel-head"><h3>对话回放</h3><span class="muted small">只读 · 展开工具调用可查看入参与返回</span></div><div class="panel-body" id="replay"><div class="chat-inner" style="padding:0;max-width:none">' + ui.messagesHtml(s, { readonly: true }) + '</div></div></div>' +
      '<div class="stack"><div class="panel"><div class="panel-head"><h3>' + icon('send') + ' 发出资料清单</h3><span class="badge ' + (st.sentOut.length ? 'ext' : '') + '">' + st.sentOut.length + '</span></div><div class="panel-body">' + listOrEmpty(st.sentOut, x => '<li>' + ui.lv(x.level) + '<span>' + esc(x.title) + '</span></li>', st.external ? '外网模型调用未携带厂内资料。' : '全程使用内网模型，没有资料发往外网。') + '</div></div>' +
      '<div class="panel"><div class="panel-head"><h3>' + icon('shield-alert') + ' 密级拦截</h3><span class="badge ' + (st.blocked.length ? 'warn' : '') + '">' + st.blocked.length + '</span></div><div class="panel-body">' + listOrEmpty(st.blocked, x => '<li>' + ui.lv(x.level) + '<span>' + esc(x.title) + '</span></li>', '没有资料被拦截。') + '</div></div>' +
      '<div class="panel"><div class="panel-head"><h3>' + icon('message-square') + ' 用户反馈</h3></div><div class="panel-body">' + listOrEmpty(ais.filter(m => m.feedback.rating || m.feedback.text || m.feedback.wrong.length), m => '<li><div>' + (m.feedback.rating ? '<span class="badge ' + (m.feedback.rating === 'up' ? 'ok' : 'danger') + '">' + (m.feedback.rating === 'up' ? '点赞' : '点踩') + '</span> ' : '') + (m.feedback.wrong.length ? '<span class="badge warn">来源有误：' + m.feedback.wrong.map(n => '[' + n + ']').join('') + '</span>' : '') + (m.feedback.text ? '<div style="margin-top:4px">' + esc(m.feedback.text) + '</div>' : '') + '<div class="muted small">' + esc(m.at) + '</div></div></li>', '暂无反馈。') + '</div></div>' +
      '<div class="panel"><div class="panel-head"><h3>' + icon('scroll-text') + ' 出网审计</h3><a class="small" href="#/admin/audit">全部审计日志</a></div><div class="panel-body">' + listOrEmpty(audits, a => '<li><span class="badge ' + (a.result === '拦截' ? 'danger' : 'ok') + '">' + esc(a.result) + '</span><div><div>' + esc(a.kind + ' · ' + a.target) + '</div><div class="muted small">' + esc(a.reason) + '</div></div></li>', '本会话没有出网请求。') + '</div></div></div></div></div>';
    el.querySelector('#expOne').addEventListener('click', () => { ui.download(s.id + '.jsonl', toJsonl([s]), 'application/x-ndjson;charset=utf-8'); ui.toast('已导出会话 ' + s.id); });
    el.querySelector('#replay').addEventListener('click', e => {
      const t = e.target.closest('[data-cite], [data-doc]');
      if (!t) return;
      if (t.dataset.doc) { ui.openDoc(t.dataset.doc); return; }
      const holder = t.closest('[data-msg]');
      const msg = holder && s.messages[Number(holder.dataset.msg)];
      const c = msg && msg.turn.citations.find(x => x.n === Number(t.dataset.cite));
      if (c) ui.openCitation(c);
    });
  };

  AOS.sessionExport = { toCsv, toJsonl, answerText };
})(window);
