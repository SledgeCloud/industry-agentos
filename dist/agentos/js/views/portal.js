/* AgentOS · 智能体广场 */
(function (root) {
  const AOS = root.AOS;
  const { ui, svc, store, policy: P } = AOS;
  const { esc, icon } = ui;
  const filters = { q: '', cat: '' };

  function card(a) {
    const st = svc.portalStatus(a);
    const cfg = a.draft || a;
    const user = svc.currentUser();
    const res = svc.resolve(a, user);
    const tools = (cfg.tools || []).map(id => svc.tool(id)).filter(Boolean);
    const action = res.ok
      ? '<a class="btn sm primary" href="#/chat/' + a.id + '">' + icon('message-square') + '开始对话</a>'
      : st === 'planned' ? '<span class="badge outline">' + svc.PHASE_LABEL[a.batch] + '上线</span>' : '<span class="muted small">' + esc(res.status === 'trial' ? '仅限试用人员' : ui.STATUS[res.status]) + '</span>';
    const verLabel = res.ok ? res.version.id + (res.status === 'trial' ? ' 试用' : '') : '';
    return '<article class="agent-card' + (a.core ? ' core' : '') + (st === 'planned' ? ' planned' : '') + '">' +
      '<div class="agent-top"><div class="agent-icon">' + icon(cfg.icon || a.icon) + '</div><div class="grow"><div class="agent-name">' + esc(cfg.name) + '</div><div class="agent-meta">' + ui.status(st) + (a.core ? '<span class="badge dark">核心场景</span>' : '') + (P.isLocked(cfg) ? '<span class="badge">' + icon('lock') + '锁定内网模型</span>' : '') + (verLabel ? '<span class="badge outline">' + esc(verLabel) + '</span>' : '') + '</div></div></div>' +
      '<p class="agent-desc">' + esc(cfg.desc) + '</p>' +
      '<div class="agent-foot"><div class="tool-icons" aria-label="勾选的内置工具">' + tools.map(t => '<span class="' + (t.phase > svc.phase() ? 'off' : '') + '" title="' + esc(t.name + (t.phase > svc.phase() ? '（' + svc.PHASE_LABEL[t.phase] + '提供）' : '')) + '">' + icon(t.icon) + '</span>').join('') + '</div>' + action + '</div>' +
      '</article>';
  }

  AOS.views.portal = function (el) {
    AOS.setCrumbs([{ name: '智能体广场' }]);
    const user = svc.currentUser();
    const agents = store.state.agents;
    const count = s => agents.filter(a => svc.portalStatus(a) === s).length;
    const recent = store.state.sessions.filter(s => s.userId === user.id).slice(0, 4);

    function draw() {
      const q = filters.q.trim();
      const list = agents.filter(a => (!filters.cat || (a.draft || a).category === filters.cat) && (!q || ((a.draft || a).name + (a.draft || a).desc).includes(q)));
      const groups = AOS.data.categories.map(c => ({ c, items: list.filter(a => (a.draft || a).category === c.id) })).filter(g => g.items.length);
      el.querySelector('#portalGroups').innerHTML = groups.length ? groups.map(g => '<section class="cat-section"><h2 class="cat-title">' + icon(g.c.icon) + esc(g.c.name) + '<span class="muted">' + g.items.length + ' 个</span></h2><div class="agent-grid">' + g.items.map(card).join('') + '</div></section>').join('') : '<div class="empty">' + icon('search-x') + '没有匹配的智能体，换个关键词试试。</div>';
      el.querySelectorAll('[data-cat]').forEach(b => b.classList.toggle('on', b.dataset.cat === filters.cat));
      ui.icons();
    }

    el.innerHTML = '<div class="page"><div class="page-head"><div><h1>智能体广场</h1><p>围绕科研技术管理全流程的 ' + agents.length + ' 个智能体，按资料权限和密级为你提供服务。</p></div>' +
      '<div class="portal-summary"><span><b>' + count('online') + '</b>已上线</span><span><b>' + count('trial') + '</b>试用中</span><span><b>' + count('planned') + '</b>规划中</span>' + (count('draft') ? '<span><b>' + count('draft') + '</b>草稿</span>' : '') + '</div></div>' +
      (recent.length ? '<div class="recent" aria-label="最近对话">' + recent.map(s => '<a href="#/chat/' + s.agentId + '/' + s.id + '">' + icon('history') + '<span>' + esc(s.agentName + '：' + s.title) + '</span></a>').join('') + '</div>' : '') +
      '<div class="toolbar" style="margin-top:18px"><label class="search"><span class="sr-only">搜索智能体</span>' + icon('search') + '<input class="input" id="portalQ" placeholder="搜索智能体名称或用途" value="' + esc(filters.q) + '"></label>' +
      '<div class="chips"><button class="chip" data-cat="">全部</button>' + AOS.data.categories.map(c => '<button class="chip" data-cat="' + c.id + '">' + esc(c.name) + '</button>').join('') + '</div></div>' +
      '<div id="portalGroups"></div></div>';
    el.querySelector('#portalQ').addEventListener('input', e => { filters.q = e.target.value; draw(); });
    el.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { filters.cat = b.dataset.cat; draw(); }));
    draw();
  };
})(window);
