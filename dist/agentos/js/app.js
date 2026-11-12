/* AgentOS · 应用外壳与路由 */
(function (root) {
  const AOS = root.AOS;
  const { ui, svc, store } = AOS;
  const { esc, icon } = ui;
  AOS.views = AOS.views || {};

  const NAV = [
    { label: '使用', items: [{ id: 'portal', name: '智能体广场', icon: 'layout-grid', href: '#/' }] },
    { label: '生产', items: [
      { id: 'studio', name: '智能体工坊', icon: 'boxes', href: '#/studio' },
      { id: 'mcps', name: 'MCPs', icon: 'wrench', href: '#/mcps' },
      { id: 'skills', name: 'Skills', icon: 'sparkles', href: '#/skills' }
    ] },
    { label: '资料', items: [{ id: 'knowledge', name: '知识库', icon: 'library', href: '#/knowledge' }] },
    { label: '运营', items: [{ id: 'sessions', name: '会话记录', icon: 'history', href: '#/sessions' }] },
    { label: '管理', items: [
      { id: 'policy', name: '出网策略', icon: 'shield-check', href: '#/admin/policy' },
      { id: 'models', name: '模型网关', icon: 'server', href: '#/admin/models' },
      { id: 'audit', name: '审计日志', icon: 'scroll-text', href: '#/admin/audit' },
      { id: 'schedules', name: '定时运行', icon: 'calendar-clock', href: '#/admin/schedules' }
    ] }
  ];

  function parse() {
    const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean).map(decodeURIComponent);
    const [a, b, c] = parts;
    if (!a) return { view: 'portal', nav: 'portal' };
    if (a === 'chat') return { view: 'chat', nav: 'portal', agentId: b, sessionId: c };
    if (a === 'studio') return b ? { view: 'studioEdit', nav: 'studio', agentId: b } : { view: 'studio', nav: 'studio' };
    if (a === 'mcps' || a === 'tools') return { view: 'mcps', nav: 'mcps' };
    if (a === 'skills') return { view: 'skills', nav: 'skills' };
    if (a === 'knowledge') return { view: 'knowledge', nav: 'knowledge' };
    if (a === 'sessions') return b ? { view: 'sessionDetail', nav: 'sessions', sessionId: b } : { view: 'sessions', nav: 'sessions' };
    if (a === 'admin') return { view: b || 'policy', nav: b || 'policy' };
    return { view: 'portal', nav: 'portal' };
  }

  function userEmail(u) {
    return (u.id.replace(/^u-/, '') + '@ironworks.demo');
  }

  function switchUser(id, keepMenu) {
    if (!svc.users().some(u => u.id === id)) return;
    store.state.settings.userId = id;
    store.save();
    const u = svc.currentUser();
    ui.toast('已切换为 ' + u.name + '（' + u.dept + '）');
    if (keepMenu) {
      closeAcctSwitch();
      paintAcctMenu();
      render();
      const menu = document.getElementById('acctMenu');
      const btn = document.getElementById('userBtn');
      if (menu && btn) {
        menu.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
      }
    } else {
      closeTopPopovers();
      render();
    }
  }
  AOS.switchUser = function (id) { switchUser(id, false); };

  const NOTICES = [
    { id: 'n1', title: '定时运行完成', body: '「每周烧结技术动态」已生成会话，已推送给订阅人。', time: '10 分钟前', href: '#/admin/schedules', unread: true, icon: 'calendar-clock' },
    { id: 'n2', title: '出网请求已拦截', body: '李敏 使用外网模型时，秘密级资料「高炉富氢喷吹工业试验方案」被出口网关拦截。', time: '1 小时前', href: '#/admin/audit', unread: true, icon: 'shield-alert' },
    { id: 'n3', title: '智能体已上线', body: '试验数据分析助手 v1.0 已按三期计划上线，可在智能体广场使用。', time: '昨天', href: '#/', unread: true, icon: 'rocket' },
    { id: 'n4', title: '模型网关限流提醒', body: 'Qwen3-72B-Instruct 近 1 小时调用接近 QPM 上限，请关注高峰时段。', time: '昨天', href: '#/admin/models', unread: false, icon: 'server' },
    { id: 'n5', title: '资料解析完成', body: '「2号高炉低硅冶炼技术攻关总结报告」已完成解析，可被文档检索使用。', time: '2 天前', href: '#/knowledge', unread: false, icon: 'file-check' }
  ];

  function unreadCount() { return NOTICES.filter(n => n.unread).length; }

  function closeAcctSwitch() {
    const panel = document.getElementById('acctSwitch');
    if (panel) panel.hidden = true;
    const item = document.querySelector('#acctMenu [data-acct-switch]');
    if (item) item.classList.remove('is-on');
  }

  function closeAcctMenu() {
    const menu = document.getElementById('acctMenu');
    const btn = document.getElementById('userBtn');
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
    closeAcctSwitch();
  }

  function closeNotifyPanel() {
    const panel = document.getElementById('notifyPanel');
    const btn = document.getElementById('notifyBtn');
    if (panel) panel.hidden = true;
    if (btn) {
      btn.setAttribute('aria-expanded', 'false');
      btn.classList.remove('is-open');
    }
  }

  function closeTopPopovers() {
    closeAcctMenu();
    closeNotifyPanel();
  }

  function paintNotifyBadge() {
    const badge = document.getElementById('notifyBadge');
    if (!badge) return;
    const n = unreadCount();
    badge.hidden = n === 0;
    badge.textContent = n > 9 ? '9+' : String(n);
  }

  function paintNotifyPanel() {
    const panel = document.getElementById('notifyPanel');
    if (!panel) return;
    const list = NOTICES.length
      ? '<div class="nt-list">' + NOTICES.map(n =>
        '<button type="button" class="nt-item' + (n.unread ? ' unread' : '') + '" data-nid="' + n.id + '">' +
        '<span class="nt-ico">' + icon(n.icon) + '</span>' +
        '<span class="nt-body"><span class="nt-row1"><span class="nt-name">' + esc(n.title) + '</span><span class="nt-time">' + esc(n.time) + '</span></span>' +
        '<span class="nt-act">' + esc(n.body) + '</span></span></button>'
      ).join('') + '</div>'
      : '<div class="nt-empty">暂无系统通知</div>';
    panel.innerHTML =
      '<div class="nt-head"><div class="nt-title">消息通知</div>' +
      (unreadCount() ? '<button type="button" class="nt-readall" data-readall>全部已读</button>' : '') +
      '</div>' + list;
    ui.icons();
  }

  function openNotifyPanel() {
    closeAcctMenu();
    const panel = document.getElementById('notifyPanel');
    const btn = document.getElementById('notifyBtn');
    if (!panel || !btn) return;
    paintNotifyPanel();
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    btn.classList.add('is-open');
    const r = btn.getBoundingClientRect();
    panel.style.top = Math.round(r.bottom + 8) + 'px';
    panel.style.right = Math.round(window.innerWidth - r.right) + 'px';
    panel.style.left = 'auto';
  }

  function paintAcctMenu() {
    const menu = document.getElementById('acctMenu');
    if (!menu) return;
    const user = svc.currentUser();
    const switchOpen = document.getElementById('acctSwitch') && !document.getElementById('acctSwitch').hidden;
    menu.innerHTML =
      '<div class="acct-top"><div class="acct-avatar" id="acctAvatar">' + esc(user.name.slice(0, 1)) + '</div><div class="acct-name" id="acctName">' + esc(user.name) + '</div><div class="acct-email" id="acctEmail">' + esc(userEmail(user)) + '</div></div>' +
      '<div class="acct-sep"></div>' +
      '<div class="acct-sec"><div class="acct-row"><span class="acct-ico">' + icon('languages') + '</span><span class="acct-grow">选择语言</span><div class="lang-seg" role="group" aria-label="选择语言"><button type="button" data-lang="zh" class="is-on">中</button><button type="button" data-lang="en">EN</button></div></div></div>' +
      '<div class="acct-sep"></div>' +
      '<div class="acct-sec">' +
      '<button class="acct-item" type="button" role="menuitem" data-demo="space">' + icon('building-2') + '<span>企业空间</span></button>' +
      '<button class="acct-item" type="button" role="menuitem" data-demo="org">' + icon('users-round') + '<span>企业组织运营</span></button>' +
      '<button class="acct-item" type="button" role="menuitem" data-demo="profile">' + icon('circle-user') + '<span>个人资料</span></button>' +
      '<button class="acct-item" type="button" role="menuitem" data-demo="version">' + icon('download') + '<span class="acct-grow">版本更新</span><span class="acct-dot" aria-label="有更新"></span></button>' +
      '<button class="acct-item' + (switchOpen ? ' is-on' : '') + '" type="button" role="menuitem" data-acct-switch aria-haspopup="menu" aria-expanded="' + (switchOpen ? 'true' : 'false') + '">' + icon('arrow-left-right') + '<span class="acct-grow">切换账号</span>' + icon('chevron-right') + '</button>' +
      '<div class="acct-sep acct-sep-in"></div>' +
      '<button class="acct-item" type="button" role="menuitem" data-demo="logout">' + icon('log-out') + '<span>退出登录</span></button>' +
      '</div>';
    ui.icons();
  }

  function paintAcctSwitch() {
    const panel = document.getElementById('acctSwitch');
    if (!panel) return;
    const user = svc.currentUser();
    panel.innerHTML =
      '<div class="acct-sec"><div class="acct-switch-title">切换账号</div></div>' +
      '<div class="acct-sep"></div>' +
      '<div class="acct-sec">' + svc.users().map(u =>
        '<button type="button" class="acct-item acct-user' + (u.id === user.id ? ' is-current' : '') + '" role="menuitem" data-switch="' + u.id + '">' +
        '<span class="avatar' + (u.id === user.id ? '' : ' light') + '">' + esc(u.name.slice(0, 1)) + '</span>' +
        '<span class="acct-user-meta"><span class="acct-user-name">' + esc(u.name) + '</span><span class="acct-user-sub">' + esc(u.title + ' · ' + u.dept + ' · ' + AOS.policy.levelLabel(u.clearance) + '级') + '</span></span>' +
        (u.id === user.id ? icon('check') : '') +
        '</button>'
      ).join('') + '</div>';
    ui.icons();
  }

  function positionAcctSwitch() {
    const menu = document.getElementById('acctMenu');
    const panel = document.getElementById('acctSwitch');
    if (!menu || !panel || panel.hidden || menu.hidden) return;
    const mr = menu.getBoundingClientRect();
    const gap = 8;
    const width = panel.offsetWidth || 300;
    let left = mr.left - width - gap;
    if (left < 8) left = 8;
    panel.style.top = Math.round(mr.top) + 'px';
    panel.style.left = Math.round(left) + 'px';
    panel.style.right = 'auto';
  }

  function openAcctSwitch() {
    const panel = document.getElementById('acctSwitch');
    const menu = document.getElementById('acctMenu');
    if (!panel || !menu || menu.hidden) return;
    paintAcctSwitch();
    panel.hidden = false;
    paintAcctMenu();
    positionAcctSwitch();
  }

  function toggleAcctSwitch() {
    const panel = document.getElementById('acctSwitch');
    if (!panel) return;
    if (panel.hidden) openAcctSwitch();
    else { closeAcctSwitch(); paintAcctMenu(); }
  }

  function openAcctMenu() {
    closeNotifyPanel();
    const menu = document.getElementById('acctMenu');
    const btn = document.getElementById('userBtn');
    if (!menu || !btn) return;
    closeAcctSwitch();
    paintAcctMenu();
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    const r = btn.getBoundingClientRect();
    menu.style.top = Math.round(r.bottom + 8) + 'px';
    menu.style.right = Math.round(window.innerWidth - r.right) + 'px';
    menu.style.left = 'auto';
  }

  function shell() {
    document.getElementById('app').innerHTML =
      '<div class="app"><aside class="side" aria-label="主导航"><div class="brand"><div class="brand-mark">' + icon('flame') + '</div><div><div class="brand-name">AgentOS</div><div class="brand-sub">炼铁厂智能体平台</div></div></div>' +
      '<nav class="nav" id="nav"></nav></aside>' +
      '<div class="main"><header class="topbar"><div class="crumbs" id="crumbs"></div><div class="spacer"></div>' +
      '<div class="topbar-actions">' +
      '<button class="icon-btn" id="notifyBtn" type="button" aria-label="消息通知" aria-haspopup="dialog" aria-expanded="false">' + icon('bell') + '<span class="notify-badge" id="notifyBadge" hidden></span></button>' +
      '<div class="user-menu"><button class="user-trigger" id="userBtn" type="button" aria-label="账号菜单" aria-haspopup="menu" aria-expanded="false"><span class="avatar" id="userAvatar"></span></button></div>' +
      '</div></header><main class="view" id="view" tabindex="-1"></main></div></div>' +
      '<div class="acct-menu" id="acctMenu" role="menu" hidden></div>' +
      '<div class="acct-menu acct-switch-panel" id="acctSwitch" role="menu" aria-label="切换账号" hidden></div>' +
      '<div class="notify-panel" id="notifyPanel" role="dialog" aria-label="消息通知" hidden></div>';

    document.getElementById('notifyBtn').addEventListener('click', e => {
      e.stopPropagation();
      const panel = document.getElementById('notifyPanel');
      if (panel.hidden) openNotifyPanel(); else closeNotifyPanel();
    });
    document.getElementById('notifyPanel').addEventListener('click', e => {
      e.stopPropagation();
      if (e.target.closest('[data-readall]')) {
        NOTICES.forEach(n => { n.unread = false; });
        paintNotifyBadge();
        paintNotifyPanel();
        return;
      }
      const item = e.target.closest('[data-nid]');
      if (!item) return;
      const n = NOTICES.find(x => x.id === item.dataset.nid);
      if (!n) return;
      n.unread = false;
      paintNotifyBadge();
      closeNotifyPanel();
      if (n.href) location.hash = n.href;
    });
    document.getElementById('userBtn').addEventListener('click', e => {
      e.stopPropagation();
      const menu = document.getElementById('acctMenu');
      if (menu.hidden) openAcctMenu(); else closeAcctMenu();
    });
    document.getElementById('acctMenu').addEventListener('click', e => {
      e.stopPropagation();
      const t = e.target.closest('[data-acct-switch],[data-demo],[data-lang]');
      if (!t) return;
      if (t.dataset.acctSwitch !== undefined) { toggleAcctSwitch(); return; }
      if (t.dataset.lang) {
        t.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('is-on', b === t));
        if (t.dataset.lang === 'en') ui.toast('演示环境暂仅提供中文');
        return;
      }
      const demo = t.dataset.demo;
      closeAcctMenu();
      if (demo === 'profile') { location.hash = '#/admin/settings'; return; }
      if (demo === 'logout') { ui.toast('演示环境无需退出登录'); return; }
      ui.toast('演示环境暂未接入该功能');
    });
    document.getElementById('acctSwitch').addEventListener('click', e => {
      e.stopPropagation();
      const t = e.target.closest('[data-switch]');
      if (t && t.dataset.switch) switchUser(t.dataset.switch, true);
    });
    document.addEventListener('click', closeTopPopovers);
    window.addEventListener('resize', () => {
      const menu = document.getElementById('acctMenu');
      if (menu && !menu.hidden) positionAcctSwitch();
      else closeTopPopovers();
    });
    window.addEventListener('hashchange', closeTopPopovers);
    paintNotifyBadge();
    ui.icons();
  }

  function renderNav(active) {
    const sessionsMine = store.state.sessions.length;
    document.getElementById('nav').innerHTML = NAV.map(g => '<div class="nav-group"><div class="nav-label">' + g.label + '</div>' + g.items.map(it => '<a class="nav-item' + (it.id === active ? ' active' : '') + '" href="' + it.href + '"' + (it.id === active ? ' aria-current="page"' : '') + '>' + icon(it.icon) + '<span>' + it.name + '</span>' + (it.id === 'sessions' ? '<span class="count">' + sessionsMine + '</span>' : '') + '</a>').join('') + '</div>').join('');
    const user = svc.currentUser();
    document.getElementById('userAvatar').textContent = user.name.slice(0, 1);
    paintNotifyBadge();
    const menu = document.getElementById('acctMenu');
    if (menu && !menu.hidden) paintAcctMenu();
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
