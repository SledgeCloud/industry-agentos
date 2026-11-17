/* AgentOS · 企业组织运营：通讯录与角色 */
(function (root) {
  const AOS = root.AOS;
  const { ui, svc, store } = AOS;
  const { esc, icon } = ui;
  const P = AOS.policy;

  const seedUsers = JSON.parse(JSON.stringify(AOS.data.users || []));

  function snapshotUsers(list) {
    const O = AOS.org;
    return (list || []).filter(Boolean).map(u => {
      const depts = O && O.userDepts ? O.userDepts(u) : (u.dept ? [u.dept] : []);
      return {
        id: u.id,
        name: u.name,
        title: u.title || '',
        dept: depts[0] || '',
        depts: depts.slice(),
        clearance: u.clearance || 'internal',
        roleIds: Array.isArray(u.roleIds) ? u.roleIds.slice() : [],
        dingId: u.dingId || undefined
      };
    });
  }

  function applyUsers(list) {
    const next = snapshotUsers(list);
    if (AOS.org && AOS.org.normalizeUser) next.forEach(AOS.org.normalizeUser);
    AOS.data.users.splice(0, AOS.data.users.length, ...next);
  }

  /* 用户只活在 AOS.data.users。另存一份 userDirectory，load 时在 ensureOrg 之后写回，避免种子 roleIds 覆盖已保存的角色。 */
  function persistUsers() {
    if (!store.state) return;
    store.state.userDirectory = snapshotUsers(AOS.data.users);
    store.save();
  }

  function restoreUsers() {
    const saved = store.state && store.state.userDirectory;
    if (!Array.isArray(saved)) return;
    applyUsers(saved);
  }

  const origLoad = store.load.bind(store);
  store.load = function () {
    origLoad();
    restoreUsers();
  };
  const origReset = store.reset.bind(store);
  store.reset = function () {
    applyUsers(seedUsers);
    origReset();
  };

  const PERM_DEFS = [
    { id: AOS.org.PERMS.ORG_MANAGE, name: '管理通讯录', hint: '新增、编辑、删除部门与用户' },
    { id: AOS.org.PERMS.ROLE_MANAGE, name: '管理角色', hint: '编辑角色及其功能权限' },
    { id: AOS.org.PERMS.KB_CREATE, name: '新建知识库', hint: '在知识库根目录创建知识库（kb.create）' }
  ];

  const Org = AOS.org;
  function departments() {
    if (!Array.isArray(store.state.departments)) store.state.departments = [];
    return store.state.departments;
  }
  function deptFlat() {
    return Org.flatOptions ? Org.flatOptions(departments()) : departments().map(d => ({ id: d.id, name: d.name, label: d.name, depth: 0 }));
  }
  function deptLabelOf(user) {
    return Org.userDeptLabel ? Org.userDeptLabel(user) : (user && user.dept) || '';
  }
  function usersInDept(dept) {
    if (!dept) return svc.users();
    const names = Org.descendantNames ? Org.descendantNames(departments(), dept.id) : [dept.name];
    const set = new Set(names);
    return svc.users().filter(u => Org.userBelongsToAny ? Org.userBelongsToAny(u, set) : set.has(u.dept));
  }
  function directUserCount(dept) {
    return svc.users().filter(u => {
      const list = Org.userDepts ? Org.userDepts(u) : (u.dept ? [u.dept] : []);
      return list.indexOf(dept.name) >= 0;
    }).length;
  }
  function roleList() {
    if (!Array.isArray(store.state.roles)) store.state.roles = [];
    return store.state.roles;
  }
  function permName(id) {
    const hit = PERM_DEFS.find(p => p.id === id);
    return hit ? hit.name : id;
  }
  function roleNames(ids) {
    return (ids || []).map(id => {
      const r = roleList().find(x => x.id === id);
      return r ? r.name : id;
    });
  }
  function pageOf(route) {
    const raw = route && typeof route === 'object' ? route.orgPage : route;
    if (raw === 'roles') return 'roles';
    if (raw === 'audit') return 'audit';
    return 'directory';
  }

  function pageMeta(page) {
    if (page === 'roles') {
      return { title: '角色管理', desc: '为角色勾选功能权限与数据范围。拥有「新建知识库」的账号才能在知识库根目录建库。' };
    }
    if (page === 'audit') {
      return { title: '审计日志', desc: '出口网关记录每一次外网模型调用、联网搜索，以及实际发出的资料清单。' };
    }
    return { title: '企业通讯录', desc: '维护多级部门与用户；可从钉钉同步组织架构，并多选人员批量绑定角色。' };
  }

  function renameDeptRefs(oldName, newName) {
    if (!oldName || oldName === newName) return;
    (AOS.data.users || []).forEach(u => {
      if (!u) return;
      const list = (Org.userDepts ? Org.userDepts(u) : (u.dept ? [u.dept] : [])).map(n => (n === oldName ? newName : n));
      if (Org.syncUserDeptFields) Org.syncUserDeptFields(u, list);
      else { u.dept = list[0] || ''; u.depts = list; }
    });
    (store.state.libraries || []).forEach(lib => {
      (lib.grants || []).forEach(g => { if (g && g.type === 'dept' && g.id === oldName) g.id = newName; });
    });
    (store.state.docs || []).forEach(d => {
      if (!d) return;
      if (d.dept === oldName) d.dept = newName;
      if (Array.isArray(d.acl)) d.acl = d.acl.map(n => (n === oldName ? newName : n));
    });
  }

  AOS.views.org = function (el, route) {
    const page = pageOf(route);
    const canOrg = svc.userHasPerm(AOS.org.PERMS.ORG_MANAGE);
    const canRole = svc.userHasPerm(AOS.org.PERMS.ROLE_MANAGE);
    let deptId = '';
    const collapsedDepts = new Set();
    const selectedUsers = new Set();
    document.body.classList.add('mode-org');

    function note(can, text) {
      if (can) return '';
      return '<div class="note" style="margin-bottom:14px">' + icon('lock') + '<span>' + text +
        ' <button class="link-btn" type="button" data-be-admin>切换为陈晓</button></span></div>';
    }

    const auditFilter = { result: '', kind: '' };

    function frame(body) {
      const meta = pageMeta(page);
      const nav = [
        { id: 'directory', href: '#/org/directory', ico: 'users', name: '企业通讯录' },
        { id: 'roles', href: '#/org/roles', ico: 'shield', name: '角色管理' },
        { id: 'audit', href: '#/org/audit', ico: 'scroll-text', name: '审计日志' }
      ];
      return '<div class="org-layout"><nav class="org-nav" aria-label="企业管理">' +
        '<a class="org-back" href="#/">' + icon('arrow-left') + '<span>返回工作台</span></a>' +
        '<div class="org-nav-label">企业管理</div>' +
        nav.map(it => '<a href="' + it.href + '"' + (it.id === page ? ' class="on" aria-current="page"' : '') + '>' +
          icon(it.ico) + '<span>' + it.name + '</span></a>').join('') +
        '</nav><div class="org-main"><div class="page"><div class="page-head"><div><h1>' + meta.title + '</h1><p>' +
        meta.desc + '</p></div></div>' + body + '</div></div></div>';
    }

    function ensureActiveVisible(depts) {
      if (!deptId || !Org.pathDepts) return;
      Org.pathDepts(depts, deptId).forEach(d => {
        if (d && d.id !== deptId) collapsedDepts.delete(d.id);
      });
    }

    function isHiddenByCollapse(depts, id) {
      if (!Org.pathDepts) return false;
      const path = Org.pathDepts(depts, id);
      for (let i = 0; i < path.length - 1; i++) {
        if (collapsedDepts.has(path[i].id)) return true;
      }
      return false;
    }

    function directoryHtml() {
      const depts = departments();
      const flat = deptFlat();
      const active = depts.some(d => d.id === deptId) ? deptId : '';
      deptId = active;
      ensureActiveVisible(depts);
      const activeDept = depts.find(d => d.id === active);
      const users = usersInDept(activeDept || null);
      const deptRows = '<div class="dept-row' + (active ? '' : ' on') + '"><button type="button" class="dept-pick" data-dept="">' +
        icon('layers') + '<span>全部部门</span></button></div>' +
        flat.map(row => {
          const d = depts.find(x => x.id === row.id);
          if (!d || isHiddenByCollapse(depts, d.id)) return '';
          const kids = Org.childrenOf ? Org.childrenOf(depts, d.id) : [];
          const hasKids = kids.length > 0;
          const open = !collapsedDepts.has(d.id);
          const n = usersInDept(d).length;
          const actions = canOrg
            ? '<button type="button" class="btn ghost sm icon" data-dept-edit="' + esc(d.id) + '" aria-label="编辑部门">' + icon('pencil') + '</button>' +
              '<button type="button" class="btn ghost sm icon" data-dept-del="' + esc(d.id) + '" aria-label="删除部门">' + icon('trash-2') + '</button>'
            : '';
          const twist = hasKids
            ? '<button type="button" class="dept-twist' + (open ? ' open' : '') + '" data-dept-twist="' + esc(d.id) +
              '" aria-expanded="' + (open ? 'true' : 'false') + '" aria-label="' + (open ? '收起下级' : '展开下级') + '">' +
              icon('chevron-right', 'chev') + '</button>'
            : '<span class="dept-twist-gap" aria-hidden="true"></span>';
          return '<div class="dept-row' + (d.id === active ? ' on' : '') + '" style="--dept-depth:' + (row.depth || 0) + '">' +
            twist +
            '<button type="button" class="dept-pick" data-dept="' + esc(d.id) + '"><span class="grow">' +
            esc(d.name) + '</span><span class="muted" title="含下级">' + n + '</span></button>' + actions + '</div>';
        }).join('');
      const addDept = canOrg ? '<button type="button" class="btn sm" data-dept-new>' + icon('plus') + '新建</button>' : '';
      const syncDing = canOrg
        ? '<button type="button" class="btn sm" data-ding-sync>' + icon('refresh-cw') + '从钉钉同步</button>'
        : '';
      const addUser = canOrg ? '<button type="button" class="btn sm primary" data-user-new>' + icon('plus') + '新建用户</button>' : '';
      const headTitle = activeDept
        ? (Org.pathDepts ? Org.pathDepts(depts, activeDept.id).map(x => x.name).join(' / ') : activeDept.name)
        : '全部用户';
      const visibleIds = users.map(u => u.id);
      const selectedVisible = visibleIds.filter(id => selectedUsers.has(id));
      const allVisibleSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
      const lastSync = store.state && store.state.dingSyncAt;
      const syncHint = lastSync ? '<span class="small muted dir-sync-hint">上次同步 ' + esc(lastSync) + '</span>' : '';
      const bulkBar = selectedUsers.size
        ? '<div class="dir-bulk"><span>已选 <strong>' + selectedUsers.size + '</strong> 人</span>' +
          '<button type="button" class="btn sm primary" data-bulk-roles>' + icon('shield') + '绑定角色</button>' +
          '<button type="button" class="btn sm ghost" data-bulk-clear>清除选择</button></div>'
        : '';
      const checkHead = canOrg
        ? '<th class="col-check"><label class="check" title="全选当前列表"><input type="checkbox" data-user-check-all' +
          (allVisibleSelected ? ' checked' : '') + (visibleIds.length ? '' : ' disabled') + ' aria-label="全选当前列表"></label></th>'
        : '';
      const userRows = users.length ? users.map(u => {
        const roles = roleNames(u.roleIds);
        const actions = canOrg
          ? '<button type="button" class="btn sm" data-user-edit="' + esc(u.id) + '">编辑</button> ' +
            '<button type="button" class="btn sm" data-user-reset="' + esc(u.id) + '">重置密码</button> ' +
            '<button type="button" class="btn sm danger" data-user-del="' + esc(u.id) + '">删除</button>'
          : '<span class="muted">只读</span>';
        const checkCell = canOrg
          ? '<td class="col-check"><label class="check"><input type="checkbox" class="user-check" value="' + esc(u.id) + '"' +
            (selectedUsers.has(u.id) ? ' checked' : '') + ' aria-label="选择 ' + esc(u.name) + '"></label></td>'
          : '';
        return '<tr' + (selectedUsers.has(u.id) ? ' class="is-selected"' : '') + '>' + checkCell +
          '<td><div class="row"><span class="avatar light">' + esc((u.name || '?').slice(0, 1)) + '</span>' + esc(u.name) + '</div></td>' +
          '<td>' + esc(u.title || '—') + '</td><td class="dir-dept-cell" title="' + esc(deptLabelOf(u) || '—') + '">' + esc(deptLabelOf(u) || '—') + '</td><td>' + ui.lv(u.clearance) + '</td>' +
          '<td>' + (roles.length ? esc(roles.join('、')) : '<span class="muted">未分配</span>') + '</td><td>' + actions + '</td></tr>';
      }).join('') : '<tr><td colspan="' + (canOrg ? 7 : 6) + '" class="muted">该部门下暂无用户</td></tr>';
      return note(canOrg, '当前账号没有通讯录管理权限，页面只读。') +
        '<div class="dir-split"><aside class="dir-depts"><div class="panel-head"><h3>部门</h3>' + addDept + '</div><div class="dir-dept-list">' + deptRows + '</div></aside>' +
        '<div class="dir-users"><div class="panel-head"><h3>' + esc(headTitle) + '</h3><div class="row wrap" style="gap:6px;align-items:center">' + syncHint + syncDing + addUser + '</div></div>' +
        bulkBar +
        '<div class="table-wrap"><table class="tbl"><thead><tr>' + checkHead + '<th>用户</th><th>职务</th><th>部门</th><th>密级</th><th>角色</th><th></th></tr></thead><tbody>' +
        userRows + '</tbody></table></div></div></div>';
    }

    function scopeLabel(scope) {
      return Org.dataScopeLabel ? Org.dataScopeLabel(scope) : '全部';
    }

    function rolesHtml() {
      const rows = roleList().length ? roleList().map(r => {
        const labels = (r.permissions || []).map(permName);
        const actions = canRole
          ? '<button type="button" class="btn sm" data-role-edit="' + esc(r.id) + '">编辑</button> ' +
            '<button type="button" class="btn sm danger" data-role-del="' + esc(r.id) + '">删除</button>'
          : '<span class="muted">只读</span>';
        return '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.description || '—') + '</td><td>' +
          (labels.length ? esc(labels.join('、')) : '<span class="muted">无功能权限</span>') +
          '</td><td>' + esc(scopeLabel(r.dataScope)) + '</td><td>' + actions + '</td></tr>';
      }).join('') : '<tr><td colspan="5" class="muted">还没有角色</td></tr>';
      const add = canRole ? '<button type="button" class="btn primary" data-role-new>' + icon('plus') + '新建角色</button>' : '';
      return note(canRole, '当前账号没有角色管理权限，页面只读。') +
        '<div class="panel"><div class="panel-head"><h3>角色</h3>' + add + '</div><div class="table-wrap"><table class="tbl"><thead><tr><th>名称</th><th>说明</th><th>功能权限</th><th>数据范围</th><th></th></tr></thead><tbody>' +
        rows + '</tbody></table></div></div>';
    }

    function auditRowsHtml() {
      const list = (store.state.audit || []).filter(a =>
        (!auditFilter.result || a.result === auditFilter.result) &&
        (!auditFilter.kind || a.kind === auditFilter.kind)
      );
      const rows = list.length
        ? list.map(a => '<tr' + (a.sessionId ? ' class="clickable" data-sid="' + esc(a.sessionId) + '"' : '') + '>' +
          '<td class="nowrap muted">' + esc(a.time) + '</td>' +
          '<td class="nowrap">' + esc(a.userName) + '<div class="small muted">' + esc(a.dept) + '</div></td>' +
          '<td class="nowrap">' + esc(a.agentName) + '</td>' +
          '<td class="nowrap">' + esc(a.kind) + '</td>' +
          '<td class="nowrap">' + esc(a.target) + '</td>' +
          '<td class="clip" title="' + esc(a.content) + '">' + esc(a.content) + '</td>' +
          '<td class="small">' + (a.docs && a.docs.length ? esc(a.docs.join('；')) : '<span class="muted">无</span>') + '</td>' +
          '<td><span class="badge ' + (a.result === '拦截' ? 'danger' : 'ok') + '">' + esc(a.result) + '</span></td>' +
          '<td class="small muted">' + esc(a.reason) + '</td></tr>').join('')
        : '<tr><td colspan="9"><div class="empty">' + icon('scroll-text') + '没有符合条件的出网记录。</div></td></tr>';
      return { rows, count: list.length };
    }

    function auditHtml() {
      const { rows, count } = auditRowsHtml();
      return '<div class="toolbar"><select class="select" id="aRes" aria-label="结果">' +
        '<option value=""' + (!auditFilter.result ? ' selected' : '') + '>全部结果</option>' +
        '<option' + (auditFilter.result === '放行' ? ' selected' : '') + '>放行</option>' +
        '<option' + (auditFilter.result === '拦截' ? ' selected' : '') + '>拦截</option></select>' +
        '<select class="select" id="aKind" aria-label="类型">' +
        '<option value=""' + (!auditFilter.kind ? ' selected' : '') + '>全部类型</option>' +
        '<option' + (auditFilter.kind === '模型调用' ? ' selected' : '') + '>模型调用</option>' +
        '<option' + (auditFilter.kind === '联网搜索' ? ' selected' : '') + '>联网搜索</option></select>' +
        '<span class="muted small" id="aCount">共 ' + count + ' 条</span></div>' +
        '<div class="panel table-wrap"><table class="tbl"><thead><tr><th>时间</th><th>用户</th><th>智能体</th><th>类型</th><th>目标</th><th>内容摘要</th><th>发出资料</th><th>结果</th><th>说明</th></tr></thead><tbody id="aBody">' +
        rows + '</tbody></table></div>';
    }

    function draw() {
      const meta = pageMeta(page);
      AOS.setCrumbs([{ name: '工作台', href: '#/' }, { name: '企业组织运营', href: '#/org' }, { name: meta.title }]);
      const body = page === 'roles' ? rolesHtml() : (page === 'audit' ? auditHtml() : directoryHtml());
      el.innerHTML = frame(body);
      const be = el.querySelector('[data-be-admin]');
      if (be) be.addEventListener('click', () => AOS.switchUser('u-chen'));
      if (page === 'roles') bindRoles();
      else if (page === 'audit') bindAudit();
      else bindDirectory();
      ui.icons();
    }

    function bindAudit() {
      const res = el.querySelector('#aRes');
      const kind = el.querySelector('#aKind');
      if (res) res.addEventListener('change', e => { auditFilter.result = e.target.value; draw(); });
      if (kind) kind.addEventListener('change', e => { auditFilter.kind = e.target.value; draw(); });
      const body = el.querySelector('#aBody');
      if (body) body.addEventListener('click', e => {
        const tr = e.target.closest('tr[data-sid]');
        if (tr) location.hash = '#/sessions/' + tr.dataset.sid;
      });
    }

    function bindDirectory() {
      el.querySelectorAll('[data-dept-twist]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const id = b.dataset.deptTwist;
        if (!id) return;
        if (collapsedDepts.has(id)) collapsedDepts.delete(id);
        else collapsedDepts.add(id);
        draw();
      }));
      el.querySelectorAll('[data-dept]').forEach(b => b.addEventListener('click', () => {
        deptId = b.dataset.dept || '';
        draw();
      }));
      const addDept = el.querySelector('[data-dept-new]');
      if (addDept) addDept.addEventListener('click', () => openDept(null));
      el.querySelectorAll('[data-dept-edit]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        openDept(departments().find(d => d.id === b.dataset.deptEdit));
      }));
      el.querySelectorAll('[data-dept-del]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        removeDept(b.dataset.deptDel);
      }));
      const addUser = el.querySelector('[data-user-new]');
      if (addUser) addUser.addEventListener('click', () => openUser(null));
      el.querySelectorAll('[data-user-edit]').forEach(b => b.addEventListener('click', () => {
        openUser(svc.users().find(u => u.id === b.dataset.userEdit));
      }));
      el.querySelectorAll('[data-user-reset]').forEach(b => b.addEventListener('click', () => resetUserPassword(b.dataset.userReset)));
      el.querySelectorAll('[data-user-del]').forEach(b => b.addEventListener('click', () => removeUser(b.dataset.userDel)));
      const dingSync = el.querySelector('[data-ding-sync]');
      if (dingSync) dingSync.addEventListener('click', () => syncFromDingTalk());
      el.querySelectorAll('.user-check').forEach(box => box.addEventListener('change', () => {
        if (box.checked) selectedUsers.add(box.value);
        else selectedUsers.delete(box.value);
        draw();
      }));
      const checkAll = el.querySelector('[data-user-check-all]');
      if (checkAll) checkAll.addEventListener('change', () => {
        const activeDept = departments().find(d => d.id === deptId) || null;
        const list = usersInDept(activeDept);
        if (checkAll.checked) list.forEach(u => selectedUsers.add(u.id));
        else list.forEach(u => selectedUsers.delete(u.id));
        draw();
      });
      const bulkRoles = el.querySelector('[data-bulk-roles]');
      if (bulkRoles) bulkRoles.addEventListener('click', () => openBulkRoles());
      const bulkClear = el.querySelector('[data-bulk-clear]');
      if (bulkClear) bulkClear.addEventListener('click', () => { selectedUsers.clear(); draw(); });
    }

    async function syncFromDingTalk() {
      if (!canOrg || !Org.applyDingTalkSync) return;
      const ok = await ui.confirm({
        title: '从钉钉同步通讯录',
        okText: '开始同步',
        body: '<p>将拉取钉钉组织架构与人员，按钉钉 ID / 姓名合并到本地。</p>' +
          '<p class="muted small">不会删除本地独有的部门或用户；新建人员默认分配「普通成员」。</p>'
      });
      if (!ok) return;
      const btn = el.querySelector('[data-ding-sync]');
      if (btn) { btn.disabled = true; btn.classList.add('is-busy'); }
      await new Promise(r => setTimeout(r, 650));
      const result = Org.applyDingTalkSync(departments(), AOS.data.users, Org.DINGTALK_MOCK, p => store.uid(p));
      store.state.departments = result.departments;
      applyUsers(result.users);
      store.state.dingSyncAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
      persistUsers();
      store.save();
      const s = result.stats || {};
      draw();
      ui.toast('钉钉同步完成：部门 +' + (s.addedDepts || 0) + '/更新 ' + (s.updatedDepts || 0) +
        '，人员 +' + (s.addedUsers || 0) + '/更新 ' + (s.updatedUsers || 0));
    }

    function openBulkRoles() {
      if (!canOrg) return;
      const ids = Array.from(selectedUsers);
      if (!ids.length) { ui.toast('请先勾选人员', 'warn'); return; }
      const picked = ids.map(id => svc.users().find(u => u.id === id)).filter(Boolean);
      if (!picked.length) { selectedUsers.clear(); draw(); return; }
      const roles = roleList();
      if (!roles.length) { ui.toast('请先在角色管理中创建角色', 'warn'); return; }
      const common = roles.filter(r => picked.every(u => (u.roleIds || []).indexOf(r.id) >= 0)).map(r => r.id);
      ui.modal({
        title: '批量绑定角色',
        okText: '应用到 ' + picked.length + ' 人',
        body: '<div class="stack"><p class="muted small">已选：' + esc(picked.map(u => u.name).join('、')) +
          '。勾选后将<strong>覆盖</strong>这些人的角色。</p>' +
          '<div class="field"><span class="field-label">角色</span><div class="org-perms">' +
          roles.map(r => '<label class="check"><input type="checkbox" class="bulk-role" value="' + esc(r.id) + '"' +
            (common.indexOf(r.id) >= 0 ? ' checked' : '') + '>' + esc(r.name) + '</label>').join('') +
          '</div></div><span class="err" id="bulkErr" hidden></span></div>',
        onMount(box, close) {
          box.querySelector('[data-ok]').addEventListener('click', () => {
            const roleIds = Array.from(box.querySelectorAll('.bulk-role:checked')).map(i => i.value);
            const err = box.querySelector('#bulkErr');
            if (!roleIds.length) { err.hidden = false; err.textContent = '至少选择一个角色'; return; }
            picked.forEach(u => { u.roleIds = roleIds.slice(); });
            selectedUsers.clear();
            persistUsers();
            close();
            draw();
            ui.toast('已为 ' + picked.length + ' 人更新角色');
          });
        }
      });
    }

    function bindRoles() {
      const add = el.querySelector('[data-role-new]');
      if (add) add.addEventListener('click', () => openRole(null));
      el.querySelectorAll('[data-role-edit]').forEach(b => b.addEventListener('click', () => {
        openRole(roleList().find(r => r.id === b.dataset.roleEdit));
      }));
      el.querySelectorAll('[data-role-del]').forEach(b => b.addEventListener('click', () => removeRole(b.dataset.roleDel)));
    }

    function openDept(existing) {
      if (!canOrg) return;
      const depts = departments();
      const defaultParent = existing
        ? Org.normId(existing.parentId)
        : (deptId || null);
      const parentOptions = '<option value="">无（顶级部门）</option>' + deptFlat().filter(row => {
        if (!existing) return true;
        return !Org.wouldCycle(depts, existing.id, row.id);
      }).map(row => '<option value="' + esc(row.id) + '"' + (row.id === defaultParent ? ' selected' : '') + '>' + esc(row.label) + '</option>').join('');
      ui.modal({
        title: existing ? '编辑部门' : '新建部门',
        okText: '保存',
        body: '<div class="stack">' +
          '<div class="field"><label for="odParent">上级部门</label><select class="select" id="odParent">' + parentOptions + '</select></div>' +
          '<div class="field"><label for="odName">部门名称</label><input class="input" id="odName" value="' +
          esc(existing ? existing.name : '') + '" placeholder="例如：炼铁技术中心"></div>' +
          '<span class="err" id="odErr" hidden></span></div>',
        onMount(box, close) {
          box.querySelector('[data-ok]').addEventListener('click', () => {
            const name = box.querySelector('#odName').value.trim();
            const parentId = Org.normId(box.querySelector('#odParent').value);
            const err = box.querySelector('#odErr');
            const show = msg => { err.hidden = false; err.textContent = msg; };
            if (!name) { show('请输入部门名称'); return; }
            if (existing && Org.wouldCycle(depts, existing.id, parentId)) { show('不能将部门挂到自身或其下级之下'); return; }
            if (Org.siblingNameTaken(depts, parentId, name, existing && existing.id)) { show('同级已有同名部门'); return; }
            if (existing) {
              const old = existing.name;
              existing.name = name;
              existing.parentId = parentId;
              renameDeptRefs(old, name);
            } else {
              departments().push({ id: store.uid('dept'), name, parentId: parentId });
            }
            persistUsers();
            store.save();
            close();
            draw();
            ui.toast(existing ? '已保存部门' : '已添加部门');
          });
        }
      });
    }

    async function removeDept(id) {
      if (!canOrg) return;
      const dept = departments().find(d => d.id === id);
      if (!dept) return;
      const kids = Org.childrenOf(departments(), id);
      if (kids.length) { ui.toast('请先删除或移走下级部门（' + kids.length + ' 个）', 'warn'); return; }
      const used = directUserCount(dept);
      if (used) { ui.toast('该部门下还有 ' + used + ' 名用户，请先调整后再删除', 'warn'); return; }
      const ok = await ui.confirm({ title: '删除部门', okText: '删除', body: '<p>删除部门「' + esc(dept.name) + '」。此操作仅影响通讯录。</p>' });
      if (!ok) return;
      const i = departments().findIndex(d => d.id === id);
      if (i >= 0) departments().splice(i, 1);
      if (deptId === id) deptId = '';
      store.save();
      draw();
      ui.toast('已删除部门');
    }

    function openUser(existing) {
      if (!canOrg) return;
      const flat = deptFlat();
      const selectedDepts = existing
        ? (Org.userDepts ? Org.userDepts(existing) : (existing.dept ? [existing.dept] : []))
        : (() => {
          const cur = departments().find(d => d.id === deptId);
          return cur ? [cur.name] : (flat[0] ? [flat[0].name] : []);
        })();
      const roleIds = existing && Array.isArray(existing.roleIds) ? existing.roleIds : ['role-member'];
      const deptChecks = flat.length
        ? flat.map(d => '<label class="check"><input type="checkbox" class="ou-dept" value="' + esc(d.name) + '"' +
          (selectedDepts.indexOf(d.name) >= 0 ? ' checked' : '') + '>' + esc(d.label) + '</label>').join('')
        : '<span class="muted">请先新建部门</span>';
      const level = existing ? existing.clearance : 'internal';
      ui.modal({
        title: existing ? '编辑用户' : '新建用户',
        okText: '保存',
        body: '<div class="stack"><div class="grid-2"><div class="field"><label for="ouName">姓名</label><input class="input" id="ouName" value="' +
          esc(existing ? existing.name : '') + '"></div><div class="field"><label for="ouTitle">职务</label><input class="input" id="ouTitle" value="' +
          esc(existing ? existing.title : '') + '"></div></div>' +
          '<div class="field"><label for="ouLevel">密级</label><select class="select" id="ouLevel">' +
          P.LEVELS.map(l => '<option value="' + l.id + '"' + (l.id === level ? ' selected' : '') + '>' + esc(l.label) + '</option>').join('') +
          '</select></div>' +
          '<div class="field"><span class="field-label">所属部门（可多选）</span><div class="org-perms ou-depts">' + deptChecks +
          '</div><p class="muted small" style="margin:6px 0 0">可归属多个部门；保留原主部门（若仍勾选）作为主部门，用于出网与权限判断。</p></div>' +
          '<div class="field"><span class="field-label">角色</span><div class="org-perms">' +
          roleList().map(r => '<label class="check"><input type="checkbox" class="ou-role" value="' + esc(r.id) + '"' +
            (roleIds.indexOf(r.id) >= 0 ? ' checked' : '') + '>' + esc(r.name) + '</label>').join('') +
          (roleList().length ? '' : '<span class="muted">还没有角色</span>') +
          '</div></div><span class="err" id="ouErr" hidden></span></div>',
        onMount(box, close) {
          box.querySelector('[data-ok]').addEventListener('click', () => {
            const name = box.querySelector('#ouName').value.trim();
            const err = box.querySelector('#ouErr');
            const show = msg => { err.hidden = false; err.textContent = msg; };
            if (!name) { show('请输入姓名'); return; }
            const checked = Array.from(box.querySelectorAll('.ou-dept:checked')).map(i => i.value);
            if (!checked.length) { show('请至少选择一个部门'); return; }
            let depts = checked;
            if (existing && Org.userDepts) {
              const prevPrimary = Org.userDepts(existing)[0];
              if (prevPrimary && checked.indexOf(prevPrimary) >= 0) {
                depts = [prevPrimary].concat(checked.filter(n => n !== prevPrimary));
              }
            }
            const next = {
              name,
              title: box.querySelector('#ouTitle').value.trim(),
              clearance: box.querySelector('#ouLevel').value || 'internal',
              roleIds: Array.from(box.querySelectorAll('.ou-role:checked')).map(i => i.value)
            };
            if (existing) {
              existing.name = next.name;
              existing.title = next.title;
              existing.clearance = next.clearance;
              existing.roleIds = next.roleIds;
              Org.syncUserDeptFields(existing, depts);
            } else {
              const nu = Object.assign({ id: store.uid('u') }, next);
              Org.syncUserDeptFields(nu, depts);
              AOS.data.users.push(nu);
            }
            persistUsers();
            close();
            draw();
            ui.toast(existing ? '已保存用户' : '已添加用户');
          });
        }
      });
    }

    async function resetUserPassword(id) {
      if (!canOrg) return;
      const user = svc.users().find(u => u.id === id);
      if (!user) return;
      const temp = 'Aos' + String(Math.floor(100000 + Math.random() * 900000));
      const ok = await ui.confirm({
        title: '重置密码',
        okText: '确认重置',
        body: '<p>将重置用户「' + esc(user.name) + '」的登录密码。</p>' +
          '<p class="muted small">确认后生成临时密码，请线下告知本人并提醒首次登录后修改。</p>'
      });
      if (!ok) return;
      user.passwordResetAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
      persistUsers();
      ui.modal({
        title: '密码已重置',
        okText: '知道了',
        foot: '<button class="btn primary" data-ok>知道了</button>',
        body: '<p>用户「' + esc(user.name) + '」的临时密码：</p>' +
          '<p class="mono" style="font-size:18px;font-weight:600;letter-spacing:.04em;margin:12px 0">' + esc(temp) + '</p>' +
          '<p class="muted small">请妥善传达；关闭后将不再展示明文密码。</p>',
        onMount(box, close) {
          box.querySelector('[data-ok]').addEventListener('click', () => { close(); ui.toast('已重置「' + user.name + '」的密码'); });
        }
      });
    }

    async function removeUser(id) {
      if (!canOrg) return;
      const user = svc.users().find(u => u.id === id);
      if (!user) return;
      if (svc.users().length <= 1) { ui.toast('至少保留一名用户', 'warn'); return; }
      if (svc.currentUser() && svc.currentUser().id === id) { ui.toast('不能删除当前登录用户', 'warn'); return; }
      const ok = await ui.confirm({ title: '删除用户', okText: '删除', body: '<p>删除用户「' + esc(user.name) + '」。</p>' });
      if (!ok) return;
      const i = AOS.data.users.findIndex(u => u.id === id);
      if (i >= 0) AOS.data.users.splice(i, 1);
      if (store.state.settings && store.state.settings.userId === id) {
        store.state.settings.userId = (AOS.data.users[0] && AOS.data.users[0].id) || store.state.settings.userId;
      }
      persistUsers();
      draw();
      ui.toast('已删除用户');
    }

    function openRole(existing) {
      if (!canRole) return;
      const selected = existing && Array.isArray(existing.permissions) ? existing.permissions : [];
      const scopes = Org.DATA_SCOPES || [
        { id: 'all', name: '全部' },
        { id: 'dept', name: '本部门' },
        { id: 'self', name: '仅本人' }
      ];
      const scope = Org.normDataScope
        ? Org.normDataScope(existing && existing.dataScope)
        : 'all';
      ui.modal({
        title: existing ? '编辑角色' : '新建角色',
        okText: '保存',
        body: '<div class="stack"><div class="field"><label for="orName">名称</label><input class="input" id="orName" value="' +
          esc(existing ? existing.name : '') + '"></div><div class="field"><label for="orDesc">说明</label><input class="input" id="orDesc" value="' +
          esc(existing ? existing.description || '' : '') + '"></div><div class="field"><span class="field-label">功能权限</span><div class="org-perms">' +
          PERM_DEFS.map(p => '<label class="check"><input type="checkbox" class="or-perm" value="' + esc(p.id) + '"' +
            (selected.indexOf(p.id) >= 0 ? ' checked' : '') + '><span>' + esc(p.name) + '<span class="hint" style="display:block">' + esc(p.hint) + '</span></span></label>').join('') +
          '</div></div><div class="field"><label for="orScope">数据范围</label><select class="select" id="orScope">' +
          scopes.map(s => '<option value="' + esc(s.id) + '"' + (s.id === scope ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') +
          '</select></div><span class="err" id="orErr" hidden></span></div>',
        onMount(box, close) {
          box.querySelector('[data-ok]').addEventListener('click', () => {
            const name = box.querySelector('#orName').value.trim();
            const err = box.querySelector('#orErr');
            const show = msg => { err.hidden = false; err.textContent = msg; };
            if (!name) { show('请输入角色名称'); return; }
            const taken = roleList().some(r => r !== existing && r.name === name);
            if (taken) { show('已有同名角色'); return; }
            const permissions = Array.from(box.querySelectorAll('.or-perm:checked')).map(i => i.value);
            const description = box.querySelector('#orDesc').value.trim();
            const dataScope = Org.normDataScope
              ? Org.normDataScope(box.querySelector('#orScope').value)
              : (box.querySelector('#orScope').value || 'all');
            if (existing) {
              existing.name = name;
              existing.description = description;
              existing.permissions = permissions;
              existing.dataScope = dataScope;
            } else {
              roleList().push({ id: store.uid('role'), name, description, permissions, dataScope });
            }
            store.save();
            close();
            draw();
            ui.toast(existing ? '已保存角色' : '已添加角色');
          });
        }
      });
    }

    async function removeRole(id) {
      if (!canRole) return;
      const role = roleList().find(r => r.id === id);
      if (!role) return;
      const ok = await ui.confirm({ title: '删除角色', okText: '删除', body: '<p>删除角色「' + esc(role.name) + '」。已分配该角色的用户会失去对应权限。</p>' });
      if (!ok) return;
      const i = roleList().findIndex(r => r.id === id);
      if (i >= 0) roleList().splice(i, 1);
      let touched = false;
      (AOS.data.users || []).forEach(u => {
        if (!u || !Array.isArray(u.roleIds)) return;
        const next = u.roleIds.filter(rid => rid !== id);
        if (next.length !== u.roleIds.length) { u.roleIds = next; touched = true; }
      });
      if (touched) persistUsers();
      else store.save();
      draw();
      ui.toast('已删除角色');
    }

    draw();
    return function () { document.body.classList.remove('mode-org'); };
  };
})(window);
