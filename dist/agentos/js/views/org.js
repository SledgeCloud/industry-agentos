/* AgentOS · 企业组织运营：通讯录与角色 */
(function (root) {
  const AOS = root.AOS;
  const { ui, svc, store } = AOS;
  const { esc, icon } = ui;
  const P = AOS.policy;

  const seedUsers = JSON.parse(JSON.stringify(AOS.data.users || []));

  function snapshotUsers(list) {
    return (list || []).filter(Boolean).map(u => ({
      id: u.id,
      name: u.name,
      title: u.title || '',
      dept: u.dept || '',
      clearance: u.clearance || 'internal',
      roleIds: Array.isArray(u.roleIds) ? u.roleIds.slice() : []
    }));
  }

  function applyUsers(list) {
    const next = snapshotUsers(list);
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

  function departments() {
    if (!Array.isArray(store.state.departments)) store.state.departments = [];
    return store.state.departments;
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
    return raw === 'roles' ? 'roles' : 'directory';
  }

  function renameDeptRefs(oldName, newName) {
    if (!oldName || oldName === newName) return;
    (AOS.data.users || []).forEach(u => { if (u && u.dept === oldName) u.dept = newName; });
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
    document.body.classList.add('mode-org');

    function note(can, text) {
      if (can) return '';
      return '<div class="note" style="margin-bottom:14px">' + icon('lock') + '<span>' + text +
        ' <button class="link-btn" type="button" data-be-admin>切换为陈晓</button></span></div>';
    }

    function frame(body) {
      const title = page === 'roles' ? '角色管理' : '企业通讯录';
      const nav = [
        { id: 'directory', href: '#/org/directory', ico: 'users', name: '企业通讯录' },
        { id: 'roles', href: '#/org/roles', ico: 'shield', name: '角色管理' }
      ];
      return '<div class="org-layout"><nav class="org-nav" aria-label="企业管理">' +
        '<a class="org-back" href="#/">' + icon('arrow-left') + '<span>返回工作台</span></a>' +
        '<div class="org-nav-label">企业管理</div>' +
        nav.map(it => '<a href="' + it.href + '"' + (it.id === page ? ' class="on" aria-current="page"' : '') + '>' +
          icon(it.ico) + '<span>' + it.name + '</span></a>').join('') +
        '</nav><div class="org-main"><div class="page"><div class="page-head"><div><h1>' + title + '</h1><p>' +
        (page === 'roles'
          ? '为角色勾选功能权限。拥有「新建知识库」的账号才能在知识库根目录建库。'
          : '维护部门与用户。用户的部门、密级和角色决定其可见资料与可执行操作。') +
        '</p></div></div>' + body + '</div></div></div>';
    }

    function directoryHtml() {
      const depts = departments();
      const active = depts.some(d => d.id === deptId) ? deptId : '';
      deptId = active;
      const activeDept = depts.find(d => d.id === active);
      const users = svc.users().filter(u => !activeDept || u.dept === activeDept.name);
      const deptRows = '<div class="dept-row' + (active ? '' : ' on') + '"><button type="button" class="dept-pick" data-dept="">' +
        icon('layers') + '<span>全部部门</span></button></div>' +
        depts.map(d => {
          const n = svc.users().filter(u => u.dept === d.name).length;
          const actions = canOrg
            ? '<button type="button" class="btn ghost sm icon" data-dept-edit="' + esc(d.id) + '" aria-label="编辑部门">' + icon('pencil') + '</button>' +
              '<button type="button" class="btn ghost sm icon" data-dept-del="' + esc(d.id) + '" aria-label="删除部门">' + icon('trash-2') + '</button>'
            : '';
          return '<div class="dept-row' + (d.id === active ? ' on' : '') + '"><button type="button" class="dept-pick" data-dept="' + esc(d.id) + '"><span class="grow">' +
            esc(d.name) + '</span><span class="muted">' + n + '</span></button>' + actions + '</div>';
        }).join('');
      const addDept = canOrg ? '<button type="button" class="btn sm" data-dept-new>' + icon('plus') + '新建</button>' : '';
      const addUser = canOrg ? '<button type="button" class="btn sm primary" data-user-new>' + icon('plus') + '新建用户</button>' : '';
      const userRows = users.length ? users.map(u => {
        const roles = roleNames(u.roleIds);
        const actions = canOrg
          ? '<button type="button" class="btn sm" data-user-edit="' + esc(u.id) + '">编辑</button> ' +
            '<button type="button" class="btn sm danger" data-user-del="' + esc(u.id) + '">删除</button>'
          : '<span class="muted">只读</span>';
        return '<tr><td><div class="row"><span class="avatar light">' + esc((u.name || '?').slice(0, 1)) + '</span>' + esc(u.name) + '</div></td>' +
          '<td>' + esc(u.title || '—') + '</td><td>' + esc(u.dept || '—') + '</td><td>' + ui.lv(u.clearance) + '</td>' +
          '<td>' + (roles.length ? esc(roles.join('、')) : '<span class="muted">未分配</span>') + '</td><td>' + actions + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="muted">该部门下暂无用户</td></tr>';
      return note(canOrg, '当前账号没有通讯录管理权限，页面只读。') +
        '<div class="dir-split"><aside class="dir-depts"><div class="panel-head"><h3>部门</h3>' + addDept + '</div><div class="dir-dept-list">' + deptRows + '</div></aside>' +
        '<div class="dir-users"><div class="panel-head"><h3>' + esc(activeDept ? activeDept.name : '全部用户') + '</h3>' + addUser + '</div>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr><th>用户</th><th>职务</th><th>部门</th><th>密级</th><th>角色</th><th></th></tr></thead><tbody>' +
        userRows + '</tbody></table></div></div></div>';
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
          '</td><td>本企业</td><td>' + actions + '</td></tr>';
      }).join('') : '<tr><td colspan="5" class="muted">还没有角色</td></tr>';
      const add = canRole ? '<button type="button" class="btn primary" data-role-new>' + icon('plus') + '新建角色</button>' : '';
      return note(canRole, '当前账号没有角色管理权限，页面只读。') +
        '<div class="panel"><div class="panel-head"><h3>角色</h3>' + add + '</div><div class="table-wrap"><table class="tbl"><thead><tr><th>名称</th><th>说明</th><th>功能权限</th><th>数据范围</th><th></th></tr></thead><tbody>' +
        rows + '</tbody></table></div></div>';
    }

    function draw() {
      const title = page === 'roles' ? '角色管理' : '企业通讯录';
      AOS.setCrumbs([{ name: '工作台', href: '#/' }, { name: '企业组织运营', href: '#/org' }, { name: title }]);
      el.innerHTML = frame(page === 'roles' ? rolesHtml() : directoryHtml());
      const be = el.querySelector('[data-be-admin]');
      if (be) be.addEventListener('click', () => AOS.switchUser('u-chen'));
      if (page === 'roles') bindRoles();
      else bindDirectory();
      ui.icons();
    }

    function bindDirectory() {
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
      el.querySelectorAll('[data-user-del]').forEach(b => b.addEventListener('click', () => removeUser(b.dataset.userDel)));
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
      ui.modal({
        title: existing ? '编辑部门' : '新建部门',
        okText: '保存',
        body: '<div class="stack"><div class="field"><label for="odName">部门名称</label><input class="input" id="odName" value="' +
          esc(existing ? existing.name : '') + '" placeholder="例如：炼铁技术中心"></div><span class="err" id="odErr" hidden></span></div>',
        onMount(box, close) {
          box.querySelector('[data-ok]').addEventListener('click', () => {
            const name = box.querySelector('#odName').value.trim();
            const err = box.querySelector('#odErr');
            const show = msg => { err.hidden = false; err.textContent = msg; };
            if (!name) { show('请输入部门名称'); return; }
            const taken = departments().some(d => d !== existing && d.name === name);
            if (taken) { show('已有同名部门'); return; }
            if (existing) {
              const old = existing.name;
              existing.name = name;
              renameDeptRefs(old, name);
            } else {
              departments().push({ id: store.uid('dept'), name });
            }
            persistUsers();
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
      const used = svc.users().filter(u => u.dept === dept.name).length;
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
      const depts = departments();
      const presetDept = existing ? existing.dept : (depts.find(d => d.id === deptId) || depts[0] || {}).name || '';
      const roleIds = existing && Array.isArray(existing.roleIds) ? existing.roleIds : ['role-member'];
      const deptOptions = depts.length
        ? depts.map(d => '<option value="' + esc(d.name) + '"' + (d.name === presetDept ? ' selected' : '') + '>' + esc(d.name) + '</option>').join('')
        : '<option value="">请先新建部门</option>';
      const level = existing ? existing.clearance : 'internal';
      ui.modal({
        title: existing ? '编辑用户' : '新建用户',
        okText: '保存',
        body: '<div class="stack"><div class="grid-2"><div class="field"><label for="ouName">姓名</label><input class="input" id="ouName" value="' +
          esc(existing ? existing.name : '') + '"></div><div class="field"><label for="ouTitle">职务</label><input class="input" id="ouTitle" value="' +
          esc(existing ? existing.title : '') + '"></div></div><div class="grid-2"><div class="field"><label for="ouDept">部门</label><select class="select" id="ouDept">' +
          deptOptions + '</select></div><div class="field"><label for="ouLevel">密级</label><select class="select" id="ouLevel">' +
          P.LEVELS.map(l => '<option value="' + l.id + '"' + (l.id === level ? ' selected' : '') + '>' + esc(l.label) + '</option>').join('') +
          '</select></div></div><div class="field"><span class="field-label">角色</span><div class="org-perms">' +
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
            const dept = box.querySelector('#ouDept').value;
            if (!dept) { show('请选择部门'); return; }
            const next = {
              name,
              title: box.querySelector('#ouTitle').value.trim(),
              dept,
              clearance: box.querySelector('#ouLevel').value || 'internal',
              roleIds: Array.from(box.querySelectorAll('.ou-role:checked')).map(i => i.value)
            };
            if (existing) {
              existing.name = next.name;
              existing.title = next.title;
              existing.dept = next.dept;
              existing.clearance = next.clearance;
              existing.roleIds = next.roleIds;
            } else {
              AOS.data.users.push(Object.assign({ id: store.uid('u') }, next));
            }
            persistUsers();
            close();
            draw();
            ui.toast(existing ? '已保存用户' : '已添加用户');
          });
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
      ui.modal({
        title: existing ? '编辑角色' : '新建角色',
        okText: '保存',
        body: '<div class="stack"><div class="field"><label for="orName">名称</label><input class="input" id="orName" value="' +
          esc(existing ? existing.name : '') + '"></div><div class="field"><label for="orDesc">说明</label><input class="input" id="orDesc" value="' +
          esc(existing ? existing.description || '' : '') + '"></div><div class="field"><span class="field-label">功能权限</span><div class="org-perms">' +
          PERM_DEFS.map(p => '<label class="check"><input type="checkbox" class="or-perm" value="' + esc(p.id) + '"' +
            (selected.indexOf(p.id) >= 0 ? ' checked' : '') + '><span>' + esc(p.name) + '<span class="hint" style="display:block">' + esc(p.hint) + '</span></span></label>').join('') +
          '</div></div><div class="field"><label for="orScope">数据范围</label><input class="input" id="orScope" value="本企业" disabled></div>' +
          '<span class="err" id="orErr" hidden></span></div>',
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
            if (existing) {
              existing.name = name;
              existing.description = description;
              existing.permissions = permissions;
              if (!existing.dataScope) existing.dataScope = 'enterprise';
            } else {
              roleList().push({ id: store.uid('role'), name, description, permissions, dataScope: 'enterprise' });
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
