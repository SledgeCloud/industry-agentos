/* AgentOS · 应用外壳与路由 */
(function (root) {
  const AOS = root.AOS;
  const { ui, svc, store } = AOS;
  const { esc, icon } = ui;
  AOS.views = AOS.views || {};

  const NAV = [
    { label: '使用', items: [{ id: 'portal', name: '智能体广场', icon: 'layout-grid', href: '#/' }] },
    { label: '生产', items: [{ id: 'studio', name: '智能体工坊', icon: 'boxes', href: '#/studio' }, { id: 'tools', name: '内置工具', icon: 'wrench', href: '#/tools' }] },
    { label: '资料', items: [{ id: 'knowledge', name: '知识库', icon: 'library', href: '#/knowledge' }] },
    { label: '运营', items: [{ id: 'sessions', name: '会话记录', icon: 'history', href: '#/sessions' }] },
    { label: '管理', items: [
      { id: 'policy', name: '出网策略', icon: 'shield-check', href: '#/admin/policy' },
      { id: 'models', name: '模型网关', icon: 'server', href: '#/admin/models' },
      { id: 'audit', name: '审计日志', icon: 'scroll-text', href: '#/admin/audit' },
      { id: 'schedules', name: '定时运行', icon: 'calendar-clock', href: '#/admin/schedules' },
      { id: 'settings', name: '演示设置', icon: 'settings', href: '#/admin/settings' }
    ] }
  ];

  function parse() {
    const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean).map(decodeURIComponent);
    const [a, b, c] = parts;
    if (!a) return { view: 'portal', nav: 'portal' };
    if (a === 'chat') return { view: 'chat', nav: 'portal', agentId: b, sessionId: c };
    if (a === 'studio') return b ? { view: 'studioEdit', nav: 'studio', agentId: b } : { view: 'studio', nav: 'studio' };
    if (a === 'tools') return { view: 'tools', nav: 'tools' };
    if (a === 'knowledge') return { view: 'knowledge', nav: 'knowledge' };
    if (a === 'sessions') return b ? { view: 'sessionDetail', nav: 'sessions', sessionId: b } : { view: 'sessions', nav: 'sessions' };
    if (a === 'admin') return { view: b || 'settings', nav: b || 'settings' };
    return { view: 'portal', nav: 'portal' };
  }

  function shell() {
    const user = svc.currentUser();
    document.getElementById('app').innerHTML =
      '<div class="app"><aside class="side" aria-label="主导航"><div class="brand"><div class="brand-mark">' + icon('flame') + '</div><div><div class="brand-name">AgentOS</div><div class="brand-sub">炼铁厂智能体平台</div></div></div>' +
      '<nav class="nav" id="nav"></nav><div class="side-foot">演示环境 · 数据为 Mock</div></aside>' +
      '<div class="main"><header class="topbar"><div class="crumbs" id="crumbs"></div><div class="spacer"></div>' +
      '<button class="phase-chip" id="phaseChip" title="切换演示阶段"><span class="phase-dot"></span><span id="phaseText"></span></button>' +
      '<label class="user-switch"><span class="avatar" id="userAvatar"></span><span class="sr-only">切换演示用户</span><select id="userSelect">' + svc.users().map(u => '<option value="' + u.id + '"' + (u.id === user.id ? ' selected' : '') + '>' + esc(u.name + ' · ' + u.dept + ' · ' + AOS.policy.levelLabel(u.clearance) + '级') + '</option>').join('') + '</select></label>' +
      '</header><main class="view" id="view" tabindex="-1"></main></div></div>';
    document.getElementById('userSelect').addEventListener('change', e => {
      store.state.settings.userId = e.target.value; store.save();
      ui.toast('已切换为 ' + svc.currentUser().name + '（' + svc.currentUser().dept + '）');
      render();
    });
    document.getElementById('phaseChip').addEventListener('click', () => { location.hash = '#/admin/settings'; });
  }

  function renderNav(active) {
    const sessionsMine = store.state.sessions.length;
    document.getElementById('nav').innerHTML = NAV.map(g => '<div class="nav-group"><div class="nav-label">' + g.label + '</div>' + g.items.map(it => '<a class="nav-item' + (it.id === active ? ' active' : '') + '" href="' + it.href + '"' + (it.id === active ? ' aria-current="page"' : '') + '>' + icon(it.icon) + '<span>' + it.name + '</span>' + (it.id === 'sessions' ? '<span class="count">' + sessionsMine + '</span>' : '') + '</a>').join('') + '</div>').join('');
    const user = svc.currentUser();
    document.getElementById('userAvatar').textContent = user.name.slice(0, 1);
    document.getElementById('phaseText').textContent = '当前演示：' + svc.PHASE_LABEL[svc.phase()];
  }

  AOS.setCrumbs = function (items) {
    document.getElementById('crumbs').innerHTML = items.map((it, i) => i === items.length - 1 ? '<strong>' + esc(it.name) + '</strong>' : '<a href="' + it.href + '">' + esc(it.name) + '</a>' + icon('chevron-right')).join('');
    ui.icons();
  };

  let cleanup = null;
  function render() {
    const route = parse();
    if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
    renderNav(route.nav);
    const view = AOS.views[route.view] || AOS.views.portal;
    const el = document.getElementById('view');
    el.scrollTop = 0;
    cleanup = view(el, route) || null;
    ui.icons();
  }
  AOS.render = render;

  AOS.start = function () {
    store.load();
    shell();
    window.addEventListener('hashchange', render);
    render();
  };
})(window);
